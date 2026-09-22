/* Hesap ekranları: giriş, kayıt, şifre sıfırlama, davetle katılma.
   Gerçek hesap modunda oturum açılmadan uygulamaya girilmez; kiracı ve ev
   sahibi yalnızca kendi arayüzünü görür. Oturum cihazda saklanır, bir kez
   giriş yapmak yeter. */

import { S, ui } from './state.js';
import { LIVE } from './config.js';
import { go, current } from './router.js';
import { notify } from './notify.js';
import { esc } from './util.js';
import { ic } from './icons.js';
import * as backend from './backend.js';

export const AUTH_ROUTES = ['giris', 'kayit', 'sifre', 'yeni-sifre', 'katil', 'davet'];
const PUBLIC_ROUTES = ['giris', 'kayit', 'sifre', 'katil'];
const INVITE_KEY = 'evim-davet';

/* ------------------------------------------------------------------ */
/* Yönlendirme kuralları                                               */
/* ------------------------------------------------------------------ */

/** Oturum sahibinin ana ekranı. */
export function home(){
  const role = backend.live.profile?.role;
  if (role === 'landlord') return '/ev-sahibi';
  return S.myHome ? '/kiraci' : '/davet';
}

/**
 * Gerçek hesap modunda her rota değişiminde çalışır; gidilmemesi gereken
 * bir adresse yönlendirilecek adresi döndürür.
 */
export function guard(route){
  if (!LIVE) return null;
  const { user, profile } = backend.live;

  if (!user) return route.auth && PUBLIC_ROUTES.includes(route.auth) ? null : '/giris';
  if (!profile) return null;                                  // yükleniyor

  if (route.auth){
    if (['giris', 'kayit', 'sifre'].includes(route.auth)) return home();
    if (route.auth === 'davet' && profile.role !== 'tenant') return home();
    return null;
  }
  if (profile.role === 'landlord' && route.role !== 'landlord') return '/ev-sahibi';
  if (profile.role === 'tenant'){
    if (!S.myHome) return '/davet';
    if (route.role !== 'tenant') return '/kiraci';
  }
  return null;
}

/** backend'den gelen oturum olayları. */
export async function onAuthEvent(evt){
  if (evt === 'signed-in' || evt === 'signed-out') ui.signupRole = null;
  if (evt === 'signed-in'){
    try { await backend.openSession(); }
    catch(e){ notify({ title:'Veriler yüklenemedi', body: backend.humanError(e), icon:'bell' }, false); }
    ui.meTenant = backend.live.user?.id;
    await acceptPendingInvite();
    go(home(), { replace:true });
  } else if (evt === 'signed-out'){
    go('/giris', { replace:true });
  } else if (evt === 'recovery'){
    go('/yeni-sifre', { replace:true });
  }
}

async function acceptPendingInvite(){
  let code = null;
  try { code = localStorage.getItem(INVITE_KEY); } catch(e){}
  if (!code || backend.live.profile?.role !== 'tenant') return;
  try {
    await backend.acceptInvite(code);
    notify({ title:'Eve katıldın', body:'Ev sahibinle artık aynı paneldesiniz.', icon:'home' }, false);
  } catch(e){
    notify({ title:'Davet kabul edilemedi', body: backend.humanError(e), icon:'home' }, false);
  }
  try { localStorage.removeItem(INVITE_KEY); } catch(e){}
}

/** /katil/<kod> adresine gelindiğinde: oturum varsa kabul et, yoksa kodu sakla. */
export async function handleJoinRoute(route){
  if (!LIVE || route.auth !== 'katil' || !route.code) return;
  try { localStorage.setItem(INVITE_KEY, route.code.toUpperCase()); } catch(e){}
  if (backend.live.user && backend.live.profile){
    if (backend.live.profile.role !== 'tenant'){
      ui.authMsg = { kind:'error', text:'Davetler kiracı hesapları içindir. Kiracı hesabıyla giriş yapmalısın.' };
      try { localStorage.removeItem(INVITE_KEY); } catch(e){}
      return;
    }
    await acceptPendingInvite();
    go(home(), { replace:true });
  }
}

/* ------------------------------------------------------------------ */
/* Ekranlar                                                            */
/* ------------------------------------------------------------------ */

function brand(sub){
  return '<div class="authbrand"><div class="mark">'+ic('home', 26)+'</div>' +
    '<div><div class="authname">Evim</div><div class="muted">'+esc(sub)+'</div></div></div>';
}

function message(){
  const m = ui.authMsg;
  if (!m) return '';
  return '<div class="note'+(m.kind === 'error' ? ' warn' : '')+'" role="'+(m.kind === 'error' ? 'alert' : 'status')+'">'+esc(m.text)+'</div>';
}

function pendingCode(){
  try { return localStorage.getItem(INVITE_KEY); } catch(e){ return null; }
}

export function authScreen(route){
  if (!LIVE) return demoNotice();
  switch (route.auth){
    case 'kayit': return signupScreen();
    case 'sifre': return forgotScreen();
    case 'yeni-sifre': return newPasswordScreen();
    case 'katil': return joinScreen(route);
    case 'davet': return inviteCodeScreen();
    default: return loginScreen();
  }
}

function demoNotice(){
  return '<div class="auth">' + brand('Demo sürüm') +
    '<div class="note">Bu sürüm demo modunda çalışıyor: hesap gerekmez, veriler yalnızca bu tarayıcıda saklanır. ' +
    'Gerçek hesaplar için sunucu kurulumu gerekir (docs/kurulum.md).</div>' +
    '<button class="btn primary block" data-act="nav" data-go="/kiraci">Demoyu aç</button></div>';
}

function loginScreen(){
  const code = pendingCode();
  return '<div class="auth">' + brand('Kira takibi, iki taraf için tek yerde') +
    '<h1>Giriş yap</h1>' +
    (code ? '<div class="note">Davet kodun kaydedildi: <b>'+esc(code)+'</b>. Giriş yapınca eve bağlanacaksın.</div>' : '') +
    message() +
    '<form class="stack" data-form="login" novalidate>' +
      '<label class="field">E-posta<input name="email" type="email" required autocomplete="email" inputmode="email"></label>' +
      '<label class="field">Şifre<input name="password" type="password" required autocomplete="current-password" minlength="8"></label>' +
      '<button class="btn primary block">Giriş yap</button>' +
    '</form>' +
    '<button class="linkbtn" data-act="nav" data-go="/sifre">Şifremi unuttum</button>' +
    '<div class="authalt">Hesabın yok mu? <button class="linkbtn" data-act="nav" data-go="/kayit">Kayıt ol</button></div>' +
  '</div>';
}

function signupScreen(){
  const code = pendingCode();
  const role = code ? 'tenant' : (ui.signupRole || 'tenant');
  const card = (v, title, sub) =>
    '<label class="rolecard'+(role === v ? ' on' : '')+(code && v !== 'tenant' ? ' off' : '')+'">' +
      '<input type="radio" name="role" value="'+v+'"'+(role === v ? ' checked' : '')+(code && v !== 'tenant' ? ' disabled' : '')+' data-input="signupRole">' +
      '<b>'+title+'</b><span class="muted">'+sub+'</span></label>';
  return '<div class="auth">' + brand('Hesap oluştur') +
    '<h1>Kayıt ol</h1>' +
    (code ? '<div class="note">Davet kodu <b>'+esc(code)+'</b> ile kiracı hesabı açıyorsun. Kayıttan sonra eve otomatik bağlanacaksın.</div>' : '') +
    message() +
    '<form class="stack" data-form="signup" novalidate>' +
      '<fieldset class="roles"><legend class="label">Hesap türü</legend>' +
        card('tenant', 'Kiracıyım', 'Kiramı öder, taleplerimi takip ederim') +
        card('landlord', 'Ev sahibiyim', 'Evlerimi ve kiracılarımı yönetirim') +
      '</fieldset>' +
      '<label class="field">Ad soyad<input name="name" required autocomplete="name" maxlength="60"></label>' +
      '<label class="field">E-posta<input name="email" type="email" required autocomplete="email" inputmode="email"></label>' +
      '<label class="field">Şifre<input name="password" type="password" required autocomplete="new-password" minlength="8" aria-describedby="pwHint"></label>' +
      '<div class="muted" id="pwHint" style="margin-top:-6px">En az 8 karakter.</div>' +
      '<label class="check"><input type="checkbox" name="consent" required> <span>Kişisel verilerimin kira ilişkisinin yürütülmesi amacıyla işlenmesini, kira ilişkisinin karşı tarafıyla paylaşılmasını ve yurt dışındaki sunucularda saklanmasını kabul ediyorum (KVKK).</span></label>' +
      '<button class="btn primary block">Hesap oluştur</button>' +
    '</form>' +
    '<div class="authalt">Hesabın var mı? <button class="linkbtn" data-act="nav" data-go="/giris">Giriş yap</button></div>' +
  '</div>';
}

function forgotScreen(){
  return '<div class="auth">' + brand('Şifre sıfırlama') +
    '<h1>Şifreni mi unuttun?</h1>' +
    '<p class="muted">E-posta adresini yaz; şifreni yenilemen için bir bağlantı gönderelim.</p>' +
    message() +
    '<form class="stack" data-form="forgot" novalidate>' +
      '<label class="field">E-posta<input name="email" type="email" required autocomplete="email" inputmode="email"></label>' +
      '<button class="btn primary block">Bağlantı gönder</button>' +
    '</form>' +
    '<button class="linkbtn" data-act="nav" data-go="/giris">Girişe dön</button></div>';
}

function newPasswordScreen(){
  return '<div class="auth">' + brand('Yeni şifre') +
    '<h1>Yeni şifreni belirle</h1>' + message() +
    '<form class="stack" data-form="newpass" novalidate>' +
      '<label class="field">Yeni şifre<input name="password" type="password" required autocomplete="new-password" minlength="8"></label>' +
      '<label class="field">Yeni şifre (tekrar)<input name="password2" type="password" required autocomplete="new-password" minlength="8"></label>' +
      '<button class="btn primary block">Kaydet</button>' +
    '</form></div>';
}

function joinScreen(route){
  const code = (route.code || '').toUpperCase();
  return '<div class="auth">' + brand('Davet') +
    '<h1>Evine davet edildin</h1>' +
    '<p class="muted">Ev sahibin seni Evim’e davet etti. Hesabını oluştur ya da giriş yap; evine otomatik bağlanacaksın.</p>' +
    '<div class="codebox">'+esc(code)+'</div>' + message() +
    '<button class="btn primary block" data-act="nav" data-go="/kayit">Kiracı hesabı oluştur</button>' +
    '<button class="btn ghost block" data-act="nav" data-go="/giris">Hesabım var, giriş yap</button></div>';
}

function inviteCodeScreen(){
  const name = backend.live.profile?.name || '';
  return '<div class="auth">' + brand(name ? 'Merhaba ' + name : 'Hoş geldin') +
    '<h1>Evine bağlan</h1>' +
    '<p class="muted">Ev sahibinden aldığın davet kodunu gir. Kodu ev sahibin Evim’de “Kiracı ekle” ile oluşturur.</p>' +
    message() +
    '<form class="stack" data-form="join" novalidate>' +
      '<label class="field">Davet kodu<input name="code" required autocomplete="one-time-code" autocapitalize="characters" maxlength="12" style="text-transform:uppercase;letter-spacing:.12em;font-weight:800"></label>' +
      '<button class="btn primary block">Eve bağlan</button>' +
    '</form>' +
    '<button class="linkbtn" data-act="signOut">Çıkış yap</button></div>';
}

/* ------------------------------------------------------------------ */
/* Formlar ve eylemler                                                 */
/* ------------------------------------------------------------------ */

export const AUTH_FORMS = ['login', 'signup', 'forgot', 'newpass', 'join', 'profile'];

function busy(form, on, label){
  const b = form.querySelector('button:not([type=button]):not(.linkbtn)');
  if (!b) return;
  if (on){ b.dataset.label = b.textContent; b.disabled = true; b.textContent = label || 'Bekle…'; }
  else { b.disabled = false; if (b.dataset.label) b.textContent = b.dataset.label; }
}

/**
 * Hata mesajını formu yeniden çizmeden gösterir; yazılanlar kaybolmaz ve
 * ekran okuyucu mesajı duyurur.
 */
function fail(text, form){
  ui.authMsg = { kind:'error', text };
  const host = (form && form.closest('.auth, .sheet')) || document.querySelector('#screen .auth');
  if (!host){ rerender(); return; }
  let box = host.querySelector('[data-authmsg]');
  if (!box){
    box = document.createElement('div');
    box.setAttribute('data-authmsg', '');
    (form || host.querySelector('form') || host.lastChild).before(box);
  }
  host.querySelectorAll('.note[role]').forEach(n => { if (n !== box) n.remove(); });
  box.className = 'note warn';
  box.setAttribute('role', 'alert');
  box.textContent = text;
  if (form) busy(form, false);
}

let rerender = () => {};
export function setRerender(fn){ rerender = fn; }

export async function authSubmit(type, fd, form){
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  ui.authMsg = null;

  if (type === 'login'){
    if (!email || !password) return fail('E-posta ve şifreni gir.', form);
    busy(form, true, 'Giriş yapılıyor…');
    try { await backend.signIn({ email, password }); }
    catch(e){ return fail(backend.humanError(e), form); }
    return;   // gerisini oturum olayı yürütür
  }

  if (type === 'signup'){
    const name = String(fd.get('name') || '').trim();
    const role = pendingCode() ? 'tenant' : String(fd.get('role') || 'tenant');
    if (!name) return fail('Adını yaz.', form);
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Geçerli bir e-posta adresi yaz.', form);
    if (password.length < 8) return fail('Şifre en az 8 karakter olmalı.', form);
    if (!fd.get('consent')) return fail('Devam etmek için KVKK onayını işaretle.', form);
    busy(form, true, 'Hesap oluşturuluyor…');
    try {
      const { needsConfirm } = await backend.signUp({ name, email, password, role });
      if (needsConfirm){
        ui.authMsg = { kind:'info', text: email + ' adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsin.' };
        go('/giris', { replace:true });
        rerender();
      }
    } catch(e){ return fail(backend.humanError(e), form); }
    return;
  }

  if (type === 'forgot'){
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Geçerli bir e-posta adresi yaz.', form);
    busy(form, true, 'Gönderiliyor…');
    try {
      await backend.resetPassword(email);
      ui.authMsg = { kind:'info', text:'Bir hesap varsa '+email+' adresine sıfırlama bağlantısı gönderildi.' };
      rerender();
    } catch(e){ fail(backend.humanError(e), form); }
    return;
  }

  if (type === 'newpass'){
    if (password.length < 8) return fail('Şifre en az 8 karakter olmalı.', form);
    if (password !== String(fd.get('password2') || '')) return fail('Şifreler aynı değil.', form);
    busy(form, true, 'Kaydediliyor…');
    try {
      await backend.updatePassword(password);
      notify({ title:'Şifre güncellendi', body:'Yeni şifrenle giriş yapabilirsin.', icon:'key' }, false);
      if (current().auth === 'yeni-sifre') go(home(), { replace:true });
      else rerender();
    } catch(e){ fail(backend.humanError(e), form); }
    return;
  }

  if (type === 'join'){
    const code = String(fd.get('code') || '').trim().toUpperCase();
    if (!code) return fail('Davet kodunu gir.', form);
    busy(form, true, 'Bağlanılıyor…');
    try {
      await backend.acceptInvite(code);
      ui.meTenant = backend.live.user?.id;
      notify({ title:'Eve katıldın', body:'Ev sahibinle artık aynı paneldesiniz.', icon:'home' }, false);
      go(home(), { replace:true });
    } catch(e){ fail(backend.humanError(e), form); }
    return;
  }

  if (type === 'profile'){
    const name = String(fd.get('name') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    if (!name) return fail('Adını yaz.', form);
    busy(form, true, 'Kaydediliyor…');
    try {
      await backend.updateProfile({ name, phone });
      notify({ title:'Kaydedildi', body:'Profil bilgilerin güncellendi.', icon:'home' }, false);
      busy(form, false);
      rerender();
    } catch(e){ fail(backend.humanError(e), form); }
  }
}

export const AUTH_ACTIONS = {
  signOut: async () => {
    await backend.signOut();
    go('/giris', { replace:true });
  },
  deleteAccount: async () => {
    const { ask } = await import('./confirm.js');
    if (!await ask({
      title:'Hesabın silinsin mi?',
      body:'Hesabın ve sahibi olduğun evlerin tüm kayıtları kalıcı olarak silinir. Bu işlem geri alınamaz.',
      ok:'Hesabı sil', danger:true
    })) return;
    try {
      await backend.deleteAccount();
      go('/giris', { replace:true });
      notify({ title:'Hesabın silindi', body:'Tüm verilerin kaldırıldı.', icon:'home' }, false);
    } catch(e){ notify({ title:'Silinemedi', body: backend.humanError(e), icon:'home' }, false); }
  },
  togglePush: async () => {
    try {
      const st = await backend.pushState();
      if (st === 'on') await backend.disablePush();
      else if (st === 'off') {
        const ok = await backend.enablePush();
        if (!ok) notify({ title:'İzin verilmedi', body:'Bildirim izni tarayıcı ayarlarından açılabilir.', icon:'bell' }, false);
      }
    } catch(e){ notify({ title:'Bildirimler açılamadı', body: backend.humanError(e), icon:'bell' }, false); }
    ui.pushState = await backend.pushState().catch(() => 'unsupported');
    rerender();
  }
};
