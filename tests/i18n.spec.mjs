// İngilizce desteği: sözlük kapsamı, İngilizce modda gezinme, dil değiştirme.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { EN } from '../assets/js/en.js';
import { watchErrors, open } from './helpers.mjs';

const DIR = new URL('../assets/js/', import.meta.url).pathname;
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

/** Kaynaktaki t('…') anahtarları (kaçışlar çözülerek). */
function sourceKeys(){
  const keys = new Set();
  for (const f of readdirSync(DIR).filter(f => f.endsWith('.js') && f !== 'en.js')){
    const src = readFileSync(DIR + f, 'utf8');
    for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) keys.add(JSON.parse('"' + m[1].replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'));
  }
  return keys;
}

test('kaynaktaki her metnin İngilizce karşılığı var', () => {
  const missing = [...sourceKeys()].filter(k => !(k in EN));
  expect(missing).toEqual([]);
});

test('şablon yer tutucuları çeviride korunuyor', () => {
  const bad = Object.entries(EN).filter(([k, v]) => {
    const a = [...new Set(k.match(/\{\w+\}/g) || [])].sort().join();
    // Tekil/çoğul biçimlerin her biri aynı yer tutucuları taşımalı.
    return v.split('||').some(part => [...new Set(part.match(/\{\w+\}/g) || [])].sort().join() !== a);
  });
  expect(bad).toEqual([]);
});

test('çeviriler HTML özniteliklerini bozacak karakter içermiyor', () => {
  expect(Object.entries(EN).filter(([, v]) => /["<>]/.test(v))).toEqual([]);
});

test.describe('İngilizce mod', () => {
  let errors;
  test.beforeEach(async ({ page }) => {
    errors = watchErrors(page);
    await page.addInitScript(() => {
      if (!localStorage.getItem('evim-tercih')) localStorage.setItem('evim-tercih', JSON.stringify({ lang:'en' }));
    });
  });
  test.afterEach(() => { expect(errors).toEqual([]); });

  const ROUTES = [
    '#/kiraci', '#/kiraci/odemeler', '#/kiraci/talepler', '#/kiraci/mesajlar', '#/kiraci/belgeler',
    '#/kiraci/belgeler/tutanak', '#/kiraci/belgeler/cikis', '#/kiraci/takvim',
    '#/ev-sahibi', '#/ev-sahibi/talepler', '#/ev-sahibi/mesajlar', '#/ev-sahibi/takvim', '#/ev-sahibi/rapor',
    '#/ev-sahibi/ev/moda', '#/ev-sahibi/ev/moda/odeme', '#/ev-sahibi/ev/moda/talep', '#/ev-sahibi/ev/moda/mesaj',
    '#/ev-sahibi/ev/moda/belge', '#/ev-sahibi/ev/moda/tutanak', '#/ev-sahibi/ev/moda/cikis', '#/ev-sahibi/ev/moda/gider',
    '#/ev-sahibi/ev/cihangir/odeme', '#/ev-sahibi/ev/atasehir/odeme'
  ];
  const SHEETS = [
    '#/kiraci/odemeler?s=odeme&pid=moda', '#/kiraci/talepler/r1', '#/kiraci/odemeler?s=dekont&pid=moda&key=2026-01',
    '#/ev-sahibi?s=ayarlar', '#/ev-sahibi?s=bildirim', '#/ev-sahibi?s=arama', '#/ev-sahibi?s=harita', '#/ev-sahibi?s=ev-ekle',
    '#/ev-sahibi/ev/moda?s=ev-duzenle', '#/ev-sahibi/ev/moda/odeme?s=yenileme', '#/ev-sahibi/ev/moda?s=kiraci-ekle',
    '#/ev-sahibi/ev/moda/gider?s=gider&id=e1', '#/ev-sahibi/ev/moda/talep?s=talep&id=r1',
    '#/ev-sahibi/ev/moda/talep?s=teklif&pid=moda&id=r1', '#/ev-sahibi/ev/moda/talep?s=fatura&pid=moda&id=r1',
    '#/ev-sahibi/ev/moda/cikis?s=cikis-baslat&pid=moda', '#/ev-sahibi/ev/cihangir/odeme?s=red&pid=cihangir&key=2026-09',
    '#/kiraci/talepler?s=yeni-talep&pid=moda', '#/kiraci/belgeler?s=belge&pid=moda'
  ];

  test('tüm ekran ve alt sayfalarda çevrilmemiş metin kalmaz', async ({ page }) => {
    for (const hash of [...ROUTES, ...SHEETS]){
      await page.goto('index.html' + hash);
      await expect(page.locator('#screen h1')).toBeVisible();
    }
    // Tur, çıkış süreci ve dışa aktarmalar da metin üretir.
    await page.goto('index.html#/ev-sahibi/ev/atasehir/cikis');
    await page.click('button:has-text("Start move-out")');
    await page.locator('#layer .sheet button:has-text("Start")').click();
    await page.click('button:has-text("Add unpaid rent")');
    await page.click('button:has-text("Export move-out report")');
    await page.keyboard.press('Escape');
    await page.goto('index.html#/ev-sahibi/rapor');
    await page.click('button:has-text("Create tax return summary")');
    await page.keyboard.press('Escape');
    await page.click('.shell button:has-text("Start guided tour")');
    for (let i = 0; i < 9; i++) await page.click('.tourbar .btn.light');

    const missing = await page.evaluate(() => [...globalThis.__i18nMissing]);
    expect(missing).toEqual([]);
  });

  test('arayüz İngilizce, tarih ve sayılar yerel biçimde', async ({ page }) => {
    await open(page, '#/ev-sahibi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#screen h1')).toHaveText('My portfolio');
    await expect(page.locator('#tabbar')).toHaveText(/Portfolio.*Requests.*Messages.*Calendar.*Report/);
    await expect(page.locator('#screen .hero .big')).toHaveText(/^₺\d{1,3}(,\d{3})*$/);

    await open(page, '#/kiraci/odemeler');
    await expect(page.locator('#screen .hero .label')).toHaveText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4} rent$/);
  });

  test('kullanıcı verisi olmayan yerlerde Türkçe harf kalmaz', async ({ page }) => {
    await open(page, '#/ev-sahibi?s=ayarlar');
    expect((await page.locator('#layer .sheet').innerText()).replace('Türkçe', '')).not.toMatch(TURKISH);
    await open(page, '#/ev-sahibi');
    expect(await page.locator('#tabbar').innerText()).not.toMatch(TURKISH);
    expect(await page.locator('#shell').innerText().then(s => s.replace(/Moda’daki ev|Cihangir 1\+1|Ataşehir 2\+1|English|Türkçe/g, ''))).not.toMatch(TURKISH);
  });

  test('dil ayarlardan değiştirilir ve kalıcıdır', async ({ page }) => {
    await open(page, '#/kiraci?s=ayarlar');
    await page.locator('#layer .sheet button[data-act=lang][data-v=tr]').click();
    await expect(page.locator('#screen h1')).toHaveText('Moda’daki ev');
    await expect(page.locator('#tabbar')).toContainText('Ödemeler');
    await page.reload();
    await expect(page.locator('#tabbar')).toContainText('Ödemeler');
    await page.locator('.shell button[data-act=lang][data-v=en]').click();
    await expect(page.locator('#tabbar')).toContainText('Payments');
  });
});

test.describe('İngilizce mod · gerçek hesap', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('evim-tercih', JSON.stringify({ lang:'en' }));
      window.EVIM_CONFIG = { supabaseUrl:'https://sahte.supabase.co', supabaseAnonKey:'anon', supabaseJs: location.origin + '/tests/fake-supabase.js' };
    });
  });

  test('giriş ve kayıt ekranları İngilizce', async ({ page }) => {
    await page.goto('index.html#/kayit');
    await expect(page.locator('#screen h1')).toHaveText('Sign up');
    await page.click('button:has-text("Create account")');
    await expect(page.locator('.note.warn')).toHaveText('Enter your name.');
    await page.goto('index.html#/giris');
    await expect(page.locator('#screen h1')).toHaveText('Log in');
    await expect(page.locator('#screen')).toContainText('Türkçe');
    const missing = await page.evaluate(() => [...globalThis.__i18nMissing]);
    expect(missing).toEqual([]);
  });
});
