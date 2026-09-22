import { test, expect } from '@playwright/test';
import { watchErrors, open } from './helpers.mjs';

const ROUTES = [
  ['#/kiraci', 'Moda’daki ev'],
  ['#/kiraci/odemeler', 'Ödemeler'],
  ['#/kiraci/talepler', 'Talepler'],
  ['#/kiraci/mesajlar', 'Mesajlar'],
  ['#/kiraci/belgeler', 'Belgeler'],
  ['#/kiraci/belgeler/tutanak', 'Tutanak'],
  ['#/kiraci/belgeler/cikis', 'Tutanak'],
  ['#/kiraci/takvim', 'Takvim'],
  ['#/ev-sahibi', 'Portföyüm'],
  ['#/ev-sahibi/talepler', 'Talepler'],
  ['#/ev-sahibi/mesajlar', 'Mesajlar'],
  ['#/ev-sahibi/takvim', 'Takvim'],
  ['#/ev-sahibi/rapor', 'Rapor'],
  ['#/ev-sahibi/ev/moda', 'Moda’daki ev'],
  ['#/ev-sahibi/ev/moda/odeme', 'Moda’daki ev'],
  ['#/ev-sahibi/ev/moda/talep', 'Moda’daki ev'],
  ['#/ev-sahibi/ev/moda/mesaj', 'Moda’daki ev'],
  ['#/ev-sahibi/ev/moda/belge', 'Moda’daki ev'],
  ['#/ev-sahibi/ev/moda/tutanak', 'Moda’daki ev'],
  ['#/ev-sahibi/ev/moda/cikis', 'Moda’daki ev'],
  ['#/ev-sahibi/ev/moda/gider', 'Moda’daki ev'],
  ['#/ev-sahibi/ev/cihangir/odeme', 'Cihangir 1+1'],
  ['#/ev-sahibi/ev/atasehir/ozet', 'Ataşehir 2+1'],
  ['#/bilinmeyen/yol', 'Moda’daki ev']
];

for (const [hash, title] of ROUTES){
  test(`rota ${hash} çizilir`, async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, hash);
    await expect(page.locator('#screen h1')).toHaveText(title);
    expect(errors).toEqual([]);
  });
}

const SHEETS = [
  '#/kiraci/odemeler?s=odeme&pid=moda',
  '#/kiraci/talepler?s=talep&pid=moda&id=r1',
  '#/kiraci/talepler/r1',
  '#/ev-sahibi?s=ayarlar',
  '#/ev-sahibi?s=bildirim',
  '#/ev-sahibi?s=arama',
  '#/ev-sahibi?s=harita',
  '#/ev-sahibi?s=ev-ekle',
  '#/ev-sahibi/ev/moda?s=ev-duzenle',
  '#/ev-sahibi/ev/moda/odeme?s=yenileme',
  '#/ev-sahibi/ev/moda?s=kiraci-ekle',
  '#/ev-sahibi/ev/moda/gider?s=gider',
  '#/ev-sahibi/ev/moda/gider?s=gider&id=e1',
  '#/ev-sahibi/ev/moda/talep?s=teklif&pid=moda&id=r1',
  '#/ev-sahibi/ev/moda/talep?s=fatura&pid=moda&id=r1',
  '#/ev-sahibi/ev/moda/cikis?s=cikis-baslat&pid=moda'
];

for (const hash of SHEETS){
  test(`sheet ${hash} açılır`, async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, hash);
    await expect(page.locator('#layer .sheet')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
