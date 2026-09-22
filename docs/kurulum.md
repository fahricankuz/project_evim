# Gerçek hesaplarla yayına alma

Uygulama, `assets/js/config.js` boşken **demo modunda** çalışır: hesap yok,
veriler yalnızca o tarayıcıda. Bu kılavuz, e-posta ve şifreyle giriş yapılan,
kiracı ile ev sahibinin kendi cihazlarından aynı veriyi gördüğü gerçek sürümü
kurmak içindir.

Gerekenler: bir [Supabase](https://supabase.com) hesabı (ücretsiz katman
başlangıç için yeterli), bu GitHub deposu, bilgisayarında Node.js (yalnızca
bildirim anahtarı üretmek ve fonksiyonu yüklemek için).

Toplam süre: yaklaşık 30–45 dakika.

---

## 1. Supabase projesi

1. supabase.com → **New project**.
2. Bölge olarak **Central EU (Frankfurt)** seç (Türkiye'ye en yakın).
3. Veritabanı şifresini güvenli bir yere kaydet.

## 2. Veritabanı

1. Sol menü → **Database → Extensions** → `pg_cron`'u etkinleştir
   (günlük kira hatırlatmaları için).
2. **SQL Editor → New query** → `supabase/schema.sql` dosyasının tamamını
   yapıştır → **Run**.

Dosya tekrar çalıştırılabilir; şemayı güncellediğinde aynı adımı yinele.

Bu adım şunları kurar:

- tablolar ve her evin verisini yalnızca o evin üyelerine açan güvenlik kuralları,
- kiracının ödeme onaylaması, masraf değiştirmesi ya da karşı tarafın onayını
  vermesi gibi yetkisiz işlemleri sunucuda reddeden tetikleyiciler,
- dekont, talep, mesaj, yenileme ve çıkış olaylarında otomatik bildirimler,
- her sabah 09:00'da (İstanbul) çalışan hatırlatmalar,
- özel (herkese kapalı) dosya deposu.

Kuralların tamamı `tests/sql.spec.mjs` içinde gerçek bir Postgres'e karşı test edilir.

## 3. Giriş ayarları

**Authentication → URL Configuration**

- **Site URL**: uygulamanın yayın adresi, ör. `https://KULLANICI.github.io/project_evim/`
- **Redirect URLs**: aynı adresi ekle. Yerelde deneyeceksen `http://localhost:8000/` da ekle.

**Authentication → Providers → Email**

- *Confirm email* açık kalsın: kayıttan sonra kullanıcıya doğrulama bağlantısı gider.

İsteğe bağlı olarak **Authentication → Email Templates** altındaki e-postaları
Türkçeleştirebilirsin.

## 4. Uygulamayı bağla

**Project Settings → API** sayfasından iki değeri al ve
`assets/js/config.js` içine yaz:

```js
supabaseUrl: 'https://xxxxxxxx.supabase.co',
supabaseAnonKey: 'eyJhbGciOi...',
```

> `anon` anahtarı herkese açık olacak şekilde tasarlanmıştır; güvenliği
> veritabanı kuralları sağlar. **`service_role` anahtarını asla bu dosyaya ya
> da depoya yazma.**

Commit edip push'la. Artık uygulama açılışta giriş ekranını gösterir. Adrese
`?demo` eklersen (ör. `.../project_evim/?demo#/kiraci`) demo yine açılır.

## 5. Anlık bildirimler (telefona)

Uygulama kapalıyken de bildirim gitmesi için.

### 5.1 Anahtar üret

```bash
npx web-push generate-vapid-keys
```

- **Public Key** → `assets/js/config.js` içindeki `vapidPublicKey`.
- **Private Key** → bir sonraki adımda gizli değişken olarak.

### 5.2 Fonksiyonu yükle

[Supabase CLI](https://supabase.com/docs/guides/cli) ile:

```bash
npx supabase login
npx supabase link --project-ref PROJE_KIMLIGI

npx supabase secrets set \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:senin@adresin.com" \
  WEBHOOK_SECRET="uzun-rastgele-bir-deger" \
  APP_URL="https://KULLANICI.github.io/project_evim/"

npx supabase functions deploy push --no-verify-jwt
```

`--no-verify-jwt` gerekli, çünkü fonksiyonu veritabanı çağırır. Yetkisiz
çağrılar `WEBHOOK_SECRET` başlığıyla engellenir.

### 5.3 Veritabanını fonksiyona bağla

**Database → Webhooks → Create a new hook**

| Alan | Değer |
| --- | --- |
| Table | `notifications` |
| Events | `Insert` |
| Type | Supabase Edge Functions → `push` |
| HTTP Headers | `x-evim-secret`: 5.2'deki `WEBHOOK_SECRET` |

### 5.4 Dene

Uygulamada **Hesap → Anlık bildirimleri aç**. Başka bir hesaptan mesaj
gönderince bildirim gelmeli.

- **Android / masaüstü Chrome, Edge, Firefox**: doğrudan çalışır.
- **iPhone (iOS 16.4+)**: önce Safari'de **Paylaş → Ana Ekrana Ekle**, sonra
  uygulamayı ana ekrandan açıp bildirimleri aç. Apple, ana ekrana eklenmemiş
  sitelere bildirim izni vermiyor.

### 5.5 E-posta bildirimleri (isteğe bağlı)

[Resend](https://resend.com) hesabı açıp alan adını doğrula, sonra:

```bash
npx supabase secrets set RESEND_API_KEY="re_..." EMAIL_FROM="Evim <bildirim@alanadin.com>"
```

Kullanıcılar **Hesap → E-posta ile de bildir** seçeneğiyle açar.

## 6. GitHub Pages

Depo → **Settings → Pages → Source: GitHub Actions**. Varsayılan dala her
push'ta site `https://KULLANICI.github.io/project_evim/` adresinde güncellenir.

Kendi alan adını kullanacaksan Pages ayarlarından ekle ve 3. adımdaki
Supabase adreslerini de güncelle.

## 7. Kontrol listesi

- [ ] İki farklı tarayıcıda (ya da biri gizli pencerede) bir ev sahibi, bir kiracı hesabı aç.
- [ ] Ev sahibi ev ekler; açılan davet bağlantısını kiracıya gönderir.
- [ ] Kiracı bağlantıyla kaydolur ve eve bağlanır.
- [ ] Kiracı dekont yükler; ev sahibinin ekranında sayfa yenilenmeden görünür.
- [ ] Ev sahibi onaylar; kiracıya bildirim düşer.
- [ ] Telefondan ana ekrana ekle, uygulamayı kapatıp mesaj gönder: bildirim gelmeli.

---

## Bilmen gerekenler

**Ücretsiz katman.** 500 MB veritabanı, 1 GB dosya, aylık 50.000 aktif
kullanıcı. Ücretsiz projeler bir hafta hiç kullanılmazsa duraklatılır;
gerçek kullanımda Pro plana geçmek gerekir.

**KVKK.** Kayıt ekranı kişisel verilerin işlenmesi, karşı tarafla paylaşılması
ve yurt dışında saklanması için açık rıza alır. Kullanıcı hesabını ve sahibi
olduğu evlerin verisini uygulamadan silebilir. Yayına almadan önce aydınlatma
metnini ve rıza ifadesini bir hukukçuya kontrol ettir.

**Yıllık güncellemeler.**
- `assets/js/tax.js`: yeni yılın istisna tutarı ve gelir vergisi tarifesi.
- `sw.js`: dosya değişikliklerinden sonra `CACHE` sürümünü artır; kullanıcılara
  "Yeni sürüm hazır" bildirimi gider.

**Testler.** `npm install && npx playwright install chromium && npm test`.
Veritabanı kuralları PGlite (WASM Postgres) ile, istemci akışları sahte bir
Supabase ile test edilir; gerçek Supabase gerekmez.
