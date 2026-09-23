# Evim

Kiracı ve ev sahibinin **aynı veriye iki taraftan baktığı** kira yönetimi
uygulaması. Kira ödemeleri, talepler, belgeler, giriş/çıkış tutanağı,
depozito iadesi, giderler ve sözleşme yenilemesi tek akışta.

Telefona yüklenebilir (PWA), çevrimdışı açılır, Türkçe ve İngilizce çalışır.

---

## İki çalışma modu

| | Demo | Gerçek hesaplar |
| --- | --- | --- |
| Ne zaman | `assets/js/config.js` boşken ya da adrese `?demo` eklenince | `config.js` Supabase bilgileriyle doldurulunca |
| Hesap | Yok; kiracı/ev sahibi görünümü arasında geçilebilir | E-posta + şifre; oturum açık kalır |
| Veri | Yalnızca bu tarayıcıda (`localStorage`) | Supabase (Postgres), cihazlar arası anlık eşitleme |
| Arayüz | Her iki rol tek cihazda | Herkes yalnızca kendi rolünün arayüzünü görür |
| Bildirim | Uygulama içi | Uygulama içi + anlık bildirim (Web Push) + isteğe bağlı e-posta |

Gerçek sürümü kurmak için adım adım kılavuz: **[docs/kurulum.md](docs/kurulum.md)**.

---

## Çalıştırma

Derleme adımı yok — statik dosyalar.

```bash
npm start            # → http://localhost:8000
# ya da
python3 -m http.server 8000
```

> `file://` ile açmayın: ES modülleri ve service worker bir sunucu ister.

**Yayın:** varsayılan dala her gönderimde `.github/workflows/pages.yml` siteyi
GitHub Pages'e yükler (Settings → Pages → Source: *GitHub Actions*).

---

## Ne yapabiliyor

**Ödemeler.** Dekont (görsel ya da PDF) tutar, tarih ve notla yüklenir. Eksik
tutar **kısmi** ödeme olur, kalan bakiye takip edilir. Ev sahibi onaylar ya da
gerekçeyle reddeder; gecikme her iki tarafta aynı görünür.

**Kira geçmişi.** Her tutar değişikliği geçerlilik tarihiyle saklanır; geçmiş
dönemler o dönemin kirasıyla hesaplanır. Kabul edilen yenileme, sözleşme
bitiminden itibaren geçerli yeni dönem olarak eklenir.

**Talepler, teklif ve fatura.** Arıza / tadilat / ek talep: Açıldı → Görüldü →
İşlemde → Çözüldü. Ev sahibi usta tekliflerini karşılaştırıp seçer, faturayı
ekler; fatura otomatik olarak gider defterine işlenir.

**Gider defteri ve net getiri.** Emlak vergisi, aidat, sigorta, tamir… Ev
başına yıllık net getiri ve değere göre getiri oranı.

**Vergi tahmini.** Konut kira geliri istisnası, götürü ve gerçek gider
yöntemlerinin karşılaştırması, artan oranlı tarife. Oranlar
`assets/js/tax.js` içindeki `RATES` tablosuna gömülüdür; yeni yıl eklenene
kadar en yakın önceki yıl kullanılır ve ekranda uyarı çıkar.

**Çıkış ve depozito iadesi.** Çıkış tutanağı giriş tutanağıyla oda oda
karşılaştırılır; ev sahibi kesinti girer, iki taraf onaylar, iade hesaplanır.

**Birden fazla kiracı.** Aynı eve birden çok kiracı hesabı eklenir (davet
bağlantısı ya da kodla). Mesajlarda gönderen adıyla görünür.

**Sözleşme yenileme.** TÜFE ortalamasıyla yasal üst sınır hesaplanır; teklif
sınırı aşamaz, kiracı kabul eder ya da görüşmeye çağırır.

**Takip.** Ayarlanabilir hatırlatma eşikleri (kira günü, yenileme, DASK,
tahliye), takvim, Türkçe karakter duyarsız arama, yıllık rapor ve CSV.

**Veri.** JSON dışa/içe aktarma; eski sürümlerin verisi kayıpsız taşınır
(taşımadan önce yedek alınır). Silme gibi geri dönüşsüz işler uygulama içi
onay penceresi ister.

---

## Gezinme

| Yol | Ekran |
| --- | --- |
| `#/giris`, `#/kayit`, `#/sifre` | Giriş, kayıt, şifre sıfırlama (gerçek mod) |
| `#/katil/<kod>`, `#/davet` | Davetle eve katılma |
| `#/kiraci` | Kiracı paneli |
| `#/kiraci/odemeler` | Ödemeler, kira geçmişi, yenileme |
| `#/kiraci/talepler` | Talepler (`/talepler/<id>` doğrudan talep) |
| `#/kiraci/mesajlar` | Yazışma |
| `#/kiraci/belgeler` | Belgeler (`/tutanak`, `/cikis`) |
| `#/kiraci/takvim` | Yaklaşan işler |
| `#/mulk-sahibi` | Portföy |
| `#/mulk-sahibi/mulk/<ev>/<bölüm>` | `ozet`, `odeme`, `talep`, `mesaj`, `belge`, `tutanak`, `gider`, `cikis` |
| `#/mulk-sahibi/talepler`, `/mesajlar`, `/takvim` | Tüm evler |
| `#/mulk-sahibi/rapor` | Net getiri, vergi tahmini, CSV |

Alt sayfalar da adreste taşınır (`?s=talep&pid=moda&id=r1`), böylece geri tuşu
onları kapatır ve bağlantısı paylaşılabilir.

**Kısayollar:** `Alt+←` geri · `Alt+1…5` sekmeler · `Alt+K` arama · `Esc`
kapat · soldan kaydırma geri (dokunmatik).

---

## Dil

Arayüz Türkçe ve İngilizce. Dil tarayıcıdan seçilir, *Ayarlar → Dil* ile
değiştirilir. Çeviri anahtarı Türkçe metnin kendisidir:

```js
t('Kaydet')                                  // → "Save"
t('{n} gün kaldı', { n })                    // tekil||çoğul: "1 day left" / "3 days left"
t('Ara|telefon')                             // bağlam: arama değil, telefonla ara
```

İngilizce karşılıklar `assets/js/en.js` içinde. Yeni bir `t('…')` eklenip
çevirisi girilmezse `tests/i18n.spec.mjs` hata verir.

---

## Dosya düzeni

```
index.html                 iskelet
manifest.webmanifest, sw.js  PWA: kurulum, çevrimdışı kabuk, anlık bildirim
assets/css/app.css         tasarım tokenları, bileşenler, açık/koyu tema
assets/js/
  config.js                demo / gerçek mod ayarı
  state.js                 durum, demo verisi, kalıcılık
  migrate.js               sürümler arası veri taşıma
  logic.js                 dönem, kira geçmişi, hatırlatma, rapor, arama
  tax.js                   vergi oranları ve hesabı
  router.js                hash yönlendirme, oturum koruması
  views.js, sheets.js      ekranlar ve alt sayfalar
  auth.js                  giriş, kayıt, davet ekranları
  backend.js               Supabase oturumu, eşitleme, dosya, bildirim
  mapping.js               tablo satırları ↔ uygulama durumu (saf)
  i18n.js, en.js           çeviri
  confirm.js, notify.js, tour.js, pwa.js, icons.js, util.js
  render.js, actions.js, main.js
supabase/schema.sql        tablolar, satır düzeyi güvenlik, tetikleyiciler
supabase/functions/push/   anlık bildirim ve e-posta gönderen fonksiyon
docs/kurulum.md            gerçek sürüm kurulum kılavuzu
tests/                     Playwright testleri
```

Veri akışı tek yönlü: eylem durumu değiştirir → `save()` → `render()`.
Gerçek modda `save()` değişikliği tablolara çevirip (`mapping.js`) gecikmeli
olarak Supabase'e yazar; diğer cihazlardan gelen değişiklikler anlık abonelikle
gelir.

**Güvenlik** veritabanındadır: her tablo satır düzeyi kurallarla korunur,
tetikleyiciler rol kurallarını zorlar (ör. kiracı ödemesini onaylayamaz,
ev sahibi kiracı adına mesaj yazamaz, kimse karşı tarafın onayını veremez).

---

## Testler

```bash
npm ci
npx playwright install chromium
npm test
```

- **Arayüz** — rotalar, akışlar, özellikler, veri taşıma, PWA, dil (masaüstü ve
  mobil görünüm).
- **Veritabanı** — `supabase/schema.sql` tarayıcıda çalışan Postgres (PGlite)
  üzerinde kurulur; rol kuralları, davet, bildirim ve hesap silme denenir.
- **Gerçek mod** — sahte bir Supabase istemcisiyle giriş, eşitleme ve davet
  akışları.

Her gönderimde GitHub Actions'ta çalışır (`.github/workflows/ci.yml`).

---

## Erişilebilirlik

Görünür odak, açık sayfalarda odak tuzağı, `aria-live` duyurular, en az 44 px
dokunma hedefleri, `prefers-reduced-motion` ve `prefers-color-scheme` desteği.

---

## Sınırlar

- Sunucunun ürettiği bildirim metinleri (kira hatırlatması, yeni talep…)
  şimdilik yalnızca Türkçe.
- Vergi oranları elle güncellenir; 2026 oranları henüz eklenmedi. Hesap bilgi
  amaçlıdır, beyan öncesi mali müşavire danışılmalıdır.
- Kira artış sınırı için resmî TÜFE oranı TÜİK'ten doğrulanmalıdır.
- KVKK aydınlatma metni taslaktır; yayına almadan önce bir hukukçuya
  gösterilmelidir.
- iPhone'da anlık bildirim için uygulamanın ana ekrana eklenmesi gerekir.
