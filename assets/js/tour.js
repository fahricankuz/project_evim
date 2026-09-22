/* Rehberli tur: uygulamayı ekran ekran gezdirir.
   Her adım bir adrese gider; tur sırasında gerçek ekranlar kullanılır. */

import { S, ui, save } from './state.js';
import { esc } from './util.js';

export const TOUR = [
  { path:'/kiraci', title:'Kiracı paneli',
    body:'Kiracı açılışta tek şeyi görür: bu ay ne ödeyeceğini ve neyin beklediğini. Üstteki hap ile rolü değiştirebilirsin.' },
  { path:'/kiraci/odemeler', title:'Ödemeler',
    body:'Kira geçmişi, aidat, depozito ve fatura sorumlulukları tek sayfada. Dekont yüklerken tutar ve tarih de girilir; eksik ödeme kısmi olarak takip edilir.' },
  { path:'/kiraci/talepler', title:'Talepler',
    body:'Arıza, tadilat ve ek talepler aynı akışta ilerler: Açıldı → Görüldü → İşlemde → Çözüldü. Masrafın kimde olduğu ayrıca onaylanır.' },
  { path:'/kiraci/belgeler/tutanak', title:'Giriş tutanağı',
    body:'Taşınırken oda oda fotoğraf ve not. İki taraf da onaylayınca tutanak kilitlenir; çıkışta karşılaştırma buradan yapılır.' },
  { path:'/ev-sahibi', title:'Ev sahibi portföyü',
    body:'Aynı veri, diğer taraftan. Ay içindeki tahsilat oranı, onay bekleyenler ve öncelikli işler en üstte.' },
  { path:'/ev-sahibi/ev/moda/odeme', title:'Ev detayı',
    body:'Her evin kendi ödeme, talep, mesaj, belge ve tutanak bölümü var. Üstteki şeritten bölümler arasında geçebilirsin.' },
  { path:'/ev-sahibi/ev/moda/gider', title:'Gider defteri',
    body:'Emlak vergisi, sigorta, tamir gibi giderler burada. Talep faturaları otomatik işlenir; net getiri anında hesaplanır.' },
  { path:'/ev-sahibi/ev/moda/cikis', title:'Çıkış ve depozito',
    body:'Taşınırken giriş ve çıkış odaları yan yana karşılaştırılır, kesintiler iki tarafın onayıyla depozitodan düşülür.' },
  { path:'/ev-sahibi/takvim', title:'Takvim',
    body:'Tüm evlerin yaklaşan işleri tek listede: gecikmiş, bu hafta, bu ay ve sonrası.' },
  { path:'/ev-sahibi/rapor', title:'Rapor',
    body:'Yıllık net getiri, ev bazında dağılım ve götürü/gerçek gider karşılaştırmalı vergi tahmini.' }
];

export function isActive(){ return ui.tour != null; }
export function step(){ return ui.tour != null ? TOUR[ui.tour] : null; }

export function startTour(){ ui.tour = 0; }
export function nextStep(){ if (ui.tour != null && ui.tour < TOUR.length - 1) ui.tour++; else endTour(); }
export function prevStep(){ if (ui.tour != null && ui.tour > 0) ui.tour--; }
export function endTour(){ ui.tour = null; S.tourDone = true; save(); }

/** Tur çubuğunun HTML'i; tur kapalıysa boş string. */
export function tourBar(){
  const s = step();
  if (!s) return '';
  const i = ui.tour;
  return '<div class="tourbar" role="dialog" aria-label="Rehberli tur">' +
    '<div class="tt">'+esc(s.title)+'</div>' +
    '<div class="bd">'+esc(s.body)+'</div>' +
    '<div class="ba"><span class="ix">'+(i+1)+' / '+TOUR.length+'</span>' +
      (i > 0 ? '<button class="btn small ghost" data-act="tourPrev">Geri</button>' : '') +
      '<button class="btn small ghost" data-act="tourEnd">Çık</button>' +
      '<button class="btn small light" data-act="tourNext">'+(i === TOUR.length-1 ? 'Bitir' : 'İleri')+'</button>' +
    '</div></div>';
}
