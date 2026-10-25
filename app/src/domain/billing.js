/* Mülk sahibi aboneliği.

   Kiracılar ücretsizdir. Mülk sahibi 14 günlük denemeyle başlar; süre bitince
   abonelik yoksa kayıtlar salt okunur olur (okuma ve mesajlaşma açık).
   Satın alma App Store / Google Play üzerinden RevenueCat ile yapılır; bu
   sürümde web, abonelik durumunu gösterir ve telefondan abone olmayı anlatır. */

import { t } from './i18n.js';
import { CONFIG, LIVE } from './config.js';
import { ui } from './state.js';
import { live } from './backend.js';

const DAY = 86400000;
export const TRIAL_DAYS = 14;

export const PLAN_LABEL = { monthly: () => t('Aylık'), annual: () => t('Yıllık') };

/** Hesap açılış zamanı (auth.tsx ayarlar); deneme buradan sayılır. */
export const account = { since: Date.now(), subscribed: null };

export function access(){
  if (LIVE) return live.access || { access:true, pending:true };
  const d = ui.demoBilling;
  if (d && d.state === 'subscribed')
    return { access:true, subscribed:true, inTrial:false, store:'demo', willRenew:true, productId:d.plan,
      expiresAt: new Date(Date.now() + (d.plan === 'annual' ? 365 : 30) * DAY).toISOString() };
  const ends = account.since + TRIAL_DAYS * DAY;
  if ((d && d.state === 'expired') || Date.now() > ends)
    return { access:false, subscribed:false, inTrial:false, trialDays:TRIAL_DAYS };
  return { access:true, subscribed:false, inTrial:true, trialDays:TRIAL_DAYS, trialEnds:new Date(ends).toISOString() };
}

export function trialDaysLeft(a = access()){
  if (!a.inTrial || !a.trialEnds) return 0;
  return Math.max(0, Math.ceil((Date.parse(a.trialEnds) - Date.now()) / DAY));
}

/** Görünüm mülk sahibiyse ve erişimi yoksa kayıt değiştirilemez. */
export function canWrite(){
  return ui.role !== 'landlord' || access().access !== false;
}

export function planList(){ return CONFIG.billing.plans; }
