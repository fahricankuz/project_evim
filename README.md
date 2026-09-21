# Evim

Kiracı ve ev sahibinin **aynı veriye iki taraftan baktığı** kira yönetimi prototipi.
Kira ödemeleri, talepler, belgeler, giriş tutanağı ve sözleşme yenilemesi tek akışta.

Tek sayfalık HTML prototipten, üzerinde gerçekten gezinilebilen bir uygulamaya dönüştürüldü:
her ekranın kendi adresi var, geri tuşu çalışır, bağlantı paylaşılınca aynı ekran açılır.

---

## Çalıştırma

Derleme adımı yok — statik dosyalar. Herhangi bir statik sunucu yeterli:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

ya da

```bash
npx --yes serve .
```

> `file://` ile açmayın: uygulama ES modülleri kullandığı için tarayıcı
> CORS nedeniyle modülleri yükleyemez.

---

## Gezinme

| Yol | Ekran |
| --- | --- |
| `#/kiraci` | Kiracı paneli |
| `#/kiraci/odemeler` | Ödemeler, kira geçmişi, yenileme |
| `#/kiraci/talepler` | Talepler (`/talepler/<id>` doğrudan talep detayı) |
| `#/kiraci/mesajlar` | Yazışma |
| `#/kiraci/belgeler` | Belgeler |
| `#/kiraci/belgeler/tutanak` | Giriş tutanağı |
| `#/kiraci/takvim` | Yaklaşan işler |
| `#/ev-sahibi` | Portföy |
| `#/ev-sahibi/ev/<ev>/<bölüm>` | Ev detayı — `ozet`, `odeme`, `talep`, `mesaj`, `belge`, `tutanak` |
| `#/ev-sahibi/talepler` | Tüm evlerin talepleri |
| `#/ev-sahibi/mesajlar` | Tüm yazışmalar |
| `#/ev-sahibi/takvim` | Takvim |
| `#/ev-sahibi/rapor` | Yıllık rapor, beyanname özeti, CSV |

Alt sayfalar (sheet) da adreste taşınır: `?s=ayarlar`, `?s=talep&pid=moda&id=r1`,
`?s=dekont&key=2026-09` … Böylece geri tuşu sheet'i kapatır ve bir talebin
bağlantısı doğrudan paylaşılabilir.

**Kısayollar**

| Tuş | İş |
| --- | --- |
| `Alt` + `←` | Geri |
| `Alt` + `1…5` | Sekmeler |
| `Alt` + `K` | Arama |
| `Esc` | Açık sayfayı / turu kapat |
| Soldan kaydırma | Geri (dokunmatik) |

Masaüstünde soldaki panel ekran haritasını, geçerli adresi, temayı ve veri
araçlarını gösterir. Dar ekranlarda aynı harita *Ayarlar → Ekran haritası*
altında.

---

## Ne yapabiliyor

**Ödemeler.** Dekont yüklerken tutar, tarih ve not girilir; görsel küçültülüp
saklanır. Tutar kiranın altındaysa ödeme **kısmi** işaretlenir ve kalan bakiye
takip edilir. Ev sahibi dekontu onaylar ya da gerekçeyle reddeder; gecikme gün
sayısı ve vade tarihi her iki tarafta da aynı görünür. Dönem hesabı sözleşme
başından itibaren kapanmamış ilk ayı bulur, böylece geçmiş bir gecikme gözden
kaçmaz.

**Talepler.** Arıza / tadilat / ek talep aynı akışta: Açıldı → Görüldü →
İşlemde → Çözüldü. Masrafın kimde olduğu ayrıca önerilir ve onaylanır; ek
talepler karara bağlanır. Her talebin zaman çizelgesi tutulur.

**Belgeler ve tutanak.** Kategorili belge arşivi; bitiş/tahliye tarihi girilen
belgeler hatırlatmaya dönüşür. Giriş tutanağı oda oda fotoğraf ve notla
tutulur, iki taraf onaylayınca kilitlenir, metin olarak dışa aktarılır.

**Sözleşme yenileme.** TÜFE oranı girilince yasal üst sınır hesaplanır; ev
sahibi sınırı aşamayan bir teklif gönderir, kiracı kabul eder ya da görüşmeye
çağırır.

**Takip.** Hatırlatma eşikleri ayarlanabilir (kira günü, yenileme, DASK,
tahliye). Takvim ekranı tüm evlerin işlerini *gecikmiş / bu hafta / bu ay /
sonrası* diye gruplar. Arama; talep, belge, mesaj ve ev bilgilerinde çalışır
(Türkçe karakter duyarsız).

**Rapor.** Yıllık tahsilat, ev bazında dağılım, beyanname özeti ve CSV çıktısı.

**Rehberli tur.** Sekiz adımda uygulamayı ekran ekran gezdirir.

**Veri.** Her şey tarayıcıda (`localStorage`) durur; JSON olarak dışa/içe
aktarılabilir, demo tek tıkla sıfırlanır. Depolama dolarsa fotoğraflar atılıp
geri kalan kaydedilir.

---

## Dosya düzeni

```
index.html               iskelet
assets/css/app.css       tasarım tokenları, bileşenler, açık/koyu tema
assets/js/
  util.js                tarih, para, metin, görsel küçültme
  icons.js               satır içi SVG ikonlar
  state.js               demo verisi, kalıcılık, tema
  logic.js               dönem hesabı, hatırlatmalar, rapor, arama
  router.js              hash yönlendirme, geçmiş, ekran haritası
  views.js               ekranların HTML'i
  sheets.js              alt sayfalar, odak tuzağı
  notify.js              bildirim şeridi
  tour.js                rehberli tur
  render.js              tek giriş noktalı çizim
  actions.js             tıklama / form / alan işleyicileri
  main.js                bağlama ve açılış
```

Veri akışı tek yönlü: `actions.js` durumu değiştirir → `render.js` adrese
bakarak ekranı yeniden çizer. Görünümler saf fonksiyondur, etkileşim
`data-act` öznitelikleriyle bağlanır.

---

## Erişilebilirlik

Odak görünür, açık sayfalarda odak içeride tutulur ve kapanınca geri verilir;
bildirimler `aria-live` ile duyurulur; dokunma hedefleri en az 44 px;
`prefers-reduced-motion` ve `prefers-color-scheme` desteklenir; içeriğe atlama
bağlantısı vardır.

---

## Sınırlar

Bu bir prototip: sunucu, kimlik doğrulama ve gerçek bildirim yok. Dosyalar
cihazdan çıkmaz. Kira artış hesabı bilgi amaçlıdır, resmî TÜFE oranı
TÜİK'ten doğrulanmalıdır.
