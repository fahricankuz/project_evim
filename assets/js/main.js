/* Uygulamayı ayağa kaldırır: rota, olay dinleyicileri, klavye ve açılış bildirimleri. */

import { S, ui, save, applyTheme, bootInfo } from './state.js';
import { start, onChange, go, closeSheet, current, back } from './router.js';
import { render } from './render.js';
import { A, onSubmit, onInput, onChangeField } from './actions.js';
import { trapFocus } from './sheets.js';
import { handleKey as handleConfirmKey } from './confirm.js';
import { reminders, normalizeAll } from './logic.js';
import { notify } from './notify.js';
import { up } from './util.js';
import { isActive as tourActive } from './tour.js';

applyTheme();

// Süresi dolan sözleşmeleri uzat, güncel kirayı geçmişten oku.
if (normalizeAll()) save();

/* ---- olay delegasyonu ---- */

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  // Scrim yalnızca kendisine tıklanınca kapanır, içeriğe tıklanınca değil.
  if (el.dataset.self && ev.target !== el) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  ev.preventDefault();
  fn(el.dataset, el, ev);
});

document.addEventListener('submit', onSubmit);
document.addEventListener('input', onInput);
document.addEventListener('change', onChangeField);

/* ---- klavye ---- */

const TAB_KEYS = {
  tenant:['/kiraci','/kiraci/odemeler','/kiraci/talepler','/kiraci/mesajlar','/kiraci/belgeler'],
  landlord:['/ev-sahibi','/ev-sahibi/talepler','/ev-sahibi/mesajlar','/ev-sahibi/takvim','/ev-sahibi/rapor']
};

document.addEventListener('keydown', ev => {
  if (handleConfirmKey(ev)) return;
  trapFocus(ev);

  if (ev.key === 'Escape'){
    if (current().sheet){ closeSheet(); return; }
    if (tourActive()){ A.tourEnd(); return; }
  }

  // Alt + ← geri, Alt + 1..5 sekmeler, Alt + K arama.
  if (!ev.altKey || ev.ctrlKey || ev.metaKey) return;

  if (ev.key === 'ArrowLeft'){ ev.preventDefault(); back(); return; }
  if (ev.key.toLowerCase() === 'k'){ ev.preventDefault(); A.sheet({ s:'arama' }); return; }

  const n = Number(ev.key);
  if (n >= 1 && n <= 5){
    const list = TAB_KEYS[ui.role] || TAB_KEYS.tenant;
    ev.preventDefault();
    go(list[n-1]);
  }
});

/* ---- kenardan kaydırarak geri ---- */

let touchX = null, touchY = null;
const phone = document.querySelector('.phone');

phone.addEventListener('touchstart', ev => {
  const t = ev.touches[0];
  touchX = t.clientX <= 28 ? t.clientX : null;
  touchY = t.clientY;
}, { passive:true });

phone.addEventListener('touchend', ev => {
  if (touchX == null) return;
  const t = ev.changedTouches[0];
  const dx = t.clientX - touchX, dy = Math.abs(t.clientY - touchY);
  touchX = null;
  if (dx > 70 && dy < 60) back();
}, { passive:true });

/* ---- açılış ---- */

onChange(() => render());
start();

if (bootInfo.migratedFrom){
  setTimeout(() => notify({ title:'Verin güncellendi', body:'Kayıtlı verin yeni sürüme taşındı; eski hali yedek olarak saklandı.', icon:'doc' }, false), 400);
} else if (bootInfo.newer){
  setTimeout(() => notify({ title:'Salt okunur mod', body:'Bu veri uygulamanın daha yeni bir sürümüyle kaydedilmiş. Değişiklikler kaydedilmeyecek.', icon:'doc' }, false), 400);
}

if (!S.seenHint){
  S.seenHint = true;
  save();
  setTimeout(() => notify({
    title:'Hoş geldin',
    body:'Üstteki hapla kiracı ve ev sahibi görünümleri arasında geçebilirsin. Rehberli tur için ayarlara bak.',
    icon:'home',
    actions:[{ label:'Rehberli tur', run:() => A.startTour() }]
  }, false), 700);
}

setTimeout(() => {
  if (current().sheet || tourActive()) return;
  const r = reminders()[0];
  if (r) notify({
    title: up(r.t), body:r.b, icon:'bell',
    actions:[{ label:'Git', run:() => go(r.go) }]
  }, false);
}, 2200);
