/* Mülk sahibi aboneliği.

   Kiracılar ücretsizdir. Mülk sahibi deneme süresiyle başlar; süre bitince
   abonelik yoksa kayıtları salt okunur olur. Asıl kural sunucudadır
   (schema.sql → require_access); bu modül arayüzün aynı kuralı önceden
   göstermesini ve satın almayı sağlar.

   Satın alma yolları:
   - iOS / Android (Capacitor): RevenueCat eklentisi, mağazanın kendi ödeme ekranı.
   - Web: RevenueCat Web Purchase Link (kart ödemesi), kullanıcı kimliğiyle.
   - Demo: gerçek ödeme yok; durumlar denenebilsin diye taklit edilir. */

import { t } from './i18n.js';
import { CONFIG, LIVE } from './config.js';
import { ui } from './state.js';
import { live, syncBilling, refreshAccess } from './backend.js';

const DAY = 86400000;

/** Çalışılan ortam: 'ios' | 'android' | 'web'. */
export function platform(){
  const C = globalThis.Capacitor;
  return C && typeof C.isNativePlatform === 'function' && C.isNativePlatform() ? C.getPlatform() : 'web';
}

/** Planın görünen adı ve dönemi. */
export const PLAN_LABEL = {
  monthly: () => t('Aylık'),
  annual:  () => t('Yıllık')
};

/* ---- durum ---- */

function demoState(){
  if (!ui.demoBilling) ui.demoBilling = { state:'trial', since: Date.now() };
  const d = ui.demoBilling;
  if (d.state === 'subscribed')
    return { role:'landlord', access:true, subscribed:true, inTrial:false, store:'demo', willRenew:true, productId:d.plan,
      expiresAt: new Date(d.since + (d.plan === 'annual' ? 365 : 30) * DAY).toISOString() };
  if (d.state === 'expired')
    return { role:'landlord', access:false, subscribed:false, inTrial:false, trialDays:14 };
  return { role:'landlord', access:true, subscribed:false, inTrial:true, trialDays:14,
    trialEnds: new Date(d.since + 9 * DAY).toISOString() };
}

/** Mülk sahibinin erişim durumu. Gerçek hesapta sunucudan (my_access) gelir. */
export function access(){
  if (!LIVE) return demoState();
  // Durum henüz okunmadıysa arayüz kilitlenmez; sunucu kuralı yine uygular.
  return live.access || { access:true, pending:true };
}

/** Deneme süresinden kalan gün (yukarı yuvarlanır). */
export function trialDaysLeft(a = access()){
  if (!a.inTrial || !a.trialEnds) return 0;
  return Math.max(0, Math.ceil((Date.parse(a.trialEnds) - Date.now()) / DAY));
}

/** Görünüm mülk sahibiyse ve erişimi yoksa kayıt değiştirilemez. */
export function canWrite(){
  return ui.role !== 'landlord' || access().access !== false;
}

/* ---- mağaza ---- */

let rc = null;

/** RevenueCat eklentisi (yalnızca iOS/Android). Paketleyici gerektirmez:
    Capacitor'ın yerel köprüsü eklentiyi adıyla kaydeder. */
async function purchases(){
  if (rc) return rc;
  const C = globalThis.Capacitor;
  const apiKey = platform() === 'ios' ? CONFIG.billing.revenuecatIosKey : CONFIG.billing.revenuecatAndroidKey;
  if (!apiKey) throw new Error(t('Mağaza anahtarı tanımlı değil (config.js → billing).'));
  const P = C.registerPlugin('Purchases');
  await P.configure({ apiKey, appUserID: live.user.id });
  rc = P;
  return P;
}

/** Plan fiyatları: mobilde mağazadan, web'de yapılandırmadan. */
export async function planPrices(){
  const out = {};
  CONFIG.billing.plans.forEach(p => { out[p.id] = p.price || ''; });
  if (!LIVE || platform() === 'web') return out;
  try {
    const P = await purchases();
    const o = await P.getOfferings();
    (o.current?.availablePackages || []).forEach(pkg => {
      const plan = CONFIG.billing.plans.find(p => p.package === pkg.identifier);
      if (plan) out[plan.id] = pkg.product.priceString;
    });
  } catch(e){ console.warn('Fiyatlar okunamadı', e); }
  return out;
}

/**
 * Satın alma. true: abonelik açıldı; false: kullanıcı vazgeçti;
 * 'redirect': web ödeme sayfasına gidildi.
 */
export async function purchase(planId){
  if (!LIVE){
    ui.demoBilling = { state:'subscribed', plan:planId, since: Date.now() };
    return true;
  }
  const plan = CONFIG.billing.plans.find(p => p.id === planId);
  if (platform() !== 'web'){
    const P = await purchases();
    const o = await P.getOfferings();
    const pkg = (o.current?.availablePackages || []).find(x => x.identifier === plan.package);
    if (!pkg) throw new Error(t('Bu plan mağazada bulunamadı.'));
    try {
      await P.purchasePackage({ aPackage: pkg });
    } catch(e){
      if (e && (e.userCancelled || e.code === '1' || e.code === 1)) return false;
      throw e;
    }
    await syncBilling();
    return true;
  }
  const url = CONFIG.billing.webPurchaseUrl;
  if (!url) throw new Error(t('Web ödeme bağlantısı henüz tanımlı değil.'));
  location.href = url.replace(/\/?$/, '/') + encodeURIComponent(live.user.id);
  return 'redirect';
}

/** Önceki satın alımları geri yükler (Apple bu düğmeyi zorunlu tutar). */
export async function restore(){
  if (!LIVE) return access().subscribed;
  if (platform() !== 'web'){
    const P = await purchases();
    await P.restorePurchases();
  }
  const a = await syncBilling();
  return !!(a && a.subscribed);
}

/** Aboneliğin yönetildiği yer: aboneliği hangi mağazadan aldıysa orası. */
export function manageUrl(a = access()){
  const store = a.store || (platform() === 'ios' ? 'app_store' : platform() === 'android' ? 'play_store' : null);
  if (store === 'app_store') return 'https://apps.apple.com/account/subscriptions';
  if (store === 'play_store') return 'https://play.google.com/store/account/subscriptions?package=' + encodeURIComponent(CONFIG.billing.androidPackage);
  return CONFIG.billing.webManageUrl || '';
}

/** Demo: durumları denemek için. */
export function demoSet(state){
  ui.demoBilling = { state, since: Date.now(), plan: ui.demoBilling?.plan };
}

export { refreshAccess };
