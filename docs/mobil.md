# iOS ve Android uygulaması

Evim'in telefon uygulaması, web sürümüyle **aynı koddan** üretilir:
[Capacitor](https://capacitorjs.com) web uygulamasını yerel bir iOS/Android
kabuğunun içinde çalıştırır ve telefonun yeteneklerine (bildirim, Face ID,
kamera, mağaza ödemesi) erişim verir. Web sürümü GitHub Pages'te aynen
yayınlanmaya devam eder.

```
assets/, index.html ──► scripts/build.mjs ──► www/ ──► cap sync ──► ios/  (Xcode)
                           (+ native/entry.js)                  └─► android/ (Android Studio)
```

| Klasör | İçerik |
| --- | --- |
| `native/entry.js` | Yerel eklentilerin listesi (tek pakette derlenir) |
| `assets/js/native.js` | Eklentileri uygulamaya bağlar; web'de hiçbir şey yapmaz |
| `ios/`, `android/` | Yerel projeler (Xcode / Android Studio ile açılır) |
| `resources/` | Uygulama ikonu ve açılış ekranı kaynakları |
| `capacitor.config.json` | Uygulama kimliği, ad, eklenti ayarları |

## Telefonda neler farklı

- **Anlık bildirim** — iPhone'da APNs, Android'de Firebase (FCM). Ana ekrana
  ekleme gerekmez.
- **Uygulama kilidi** — Ayarlar → Güvenlik: Face ID / Touch ID / parmak izi.
- **Güvenli oturum** — oturum anahtarı Keychain (iOS) / Keystore (Android)
  içinde saklanır.
- **Kamera** — dekont ve talep formunda "Kamerayla çek".
- **Bağlantılar** — davet, e-posta doğrulama ve şifre sıfırlama bağlantıları
  doğrudan uygulamayı açar.
- **Android geri tuşu** — önce açık pencereyi, sonra önceki ekranı kapatır;
  ana ekranda uygulamayı arka plana alır.
- **Abonelik** — App Store / Google Play'in kendi ödeme ekranı
  (bkz. [abonelik.md](abonelik.md)).
- Service worker ve "uygulamayı yükle" önerisi telefonda kapalıdır; dosyalar
  zaten cihazdadır.

---

## 1. Geliştirme ortamı

| | Gerekli |
| --- | --- |
| Her ikisi | Node.js 22, `npm ci` |
| iOS | Mac + Xcode 16 veya üstü |
| Android | Android Studio (JDK 21 ve Android SDK birlikte gelir) |

```bash
npm ci
npm run android   # www/ üretir, eşitler, Android Studio'yu açar
npm run ios       # www/ üretir, eşitler, Xcode'u açar
```

Android Studio'da ▶ ile emülatörde ya da USB ile bağlı telefonda çalıştır.
Xcode'da önce **Signing & Capabilities → Team** seç (Apple hesabın), sonra ▶.

Kodu değiştirdikten sonra `npm run build:native` yeterli; yerel projeyi
yeniden açmak gerekmez.

> Mac'in yoksa: her gönderimde GitHub Actions iki platformu da derler
> (`.github/workflows/mobile.yml`) ve Android için kurulabilir bir APK
> üretir: **Actions → Mobil derleme → son çalıştırma → Artifacts**.

## 2. Uygulama kimliği

Varsayılan kimlik `app.evim`. Mağazaya **ilk yüklemeden sonra
değiştirilemez**; başka bir kimlik istiyorsan (ör. `com.sirketin.evim`)
şimdi şu yerlerde değiştir:

- `capacitor.config.json` → `appId`
- `android/app/build.gradle` → `namespace` ve `applicationId`
  (ve `android/app/src/main/java/app/evim/` klasör yolu)
- Xcode → App hedefi → *Bundle Identifier*
- `assets/js/config.js` → `billing.androidPackage`

## 3. Bağlantıların uygulamayı açması

Davet ve e-posta bağlantılarının telefonda doğrudan uygulamayı açması için
uygulamanın bir **alan adı** olmalı (ör. `evim.app`). GitHub Pages'e özel alan
adı bağlanabilir: Settings → Pages → *Custom domain*.

1. `assets/js/config.js` → `publicUrl: 'https://evim.app/'`
2. Aynı alan adını şuralara yaz:
   - `android/gradle.properties` → `evimHost=evim.app`
   - `ios/App/App/App.entitlements` → `applinks:evim.app`
3. Sitenin doğrulama dosyaları için GitHub → Settings → Secrets and
   variables → Actions → **Variables**:
   - `APPLE_TEAM_ID` — developer.apple.com → Membership → Team ID
   - `ANDROID_SHA256` — Play Console → Test and release → App integrity →
     *App signing key certificate* → SHA-256
4. Supabase → Authentication → URL Configuration → **Redirect URLs**:
   `https://evim.app/auth` ve `evim://auth` ekle.

Alan adı yokken de çalışır: uygulama e-posta dönüşleri için `evim://`
şemasını kullanır (e-posta linki bilgisayarda açılırsa çalışmaz, telefonda
çalışır).

## 4. Anlık bildirimler

### iPhone (APNs)

1. developer.apple.com → Certificates, IDs & Profiles → **Keys** → "+" →
   *Apple Push Notifications service (APNs)* → .p8 dosyasını indir.
2. Supabase gizli değişkenleri:

```bash
supabase secrets set APNS_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
supabase secrets set APNS_KEY_ID=XXXXXXXXXX APNS_TEAM_ID=YYYYYYYYYY APNS_BUNDLE_ID=app.evim
# Xcode'dan doğrudan kurulan geliştirme sürümüyle denerken:
supabase secrets set APNS_SANDBOX=1
```

Xcode'da *Push Notifications* yeteneği `App.entitlements` ile zaten açık.

### Android (Firebase Cloud Messaging)

1. console.firebase.google.com → proje oluştur → **Android uygulaması ekle**
   (paket adı `app.evim`) → `google-services.json` dosyasını
   `android/app/` klasörüne koy.
2. Firebase → Project settings → **Service accounts** → *Generate new
   private key* (JSON).

```bash
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat evim-firebase-adminsdk.json)"
```

Sonra push fonksiyonunu yeniden yükle:

```bash
supabase functions deploy push --no-verify-jwt
```

Uygulamada: Hesap → *Anlık bildirimleri aç*.

## 5. Mağaza sürümü

### Google Play

1. Bir kez yükleme anahtarı oluştur ve **güvenli yerde sakla** (kaybolursa
   güncelleme yüklenemez):

```bash
keytool -genkey -v -keystore evim-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias evim
```

2. Paket (.aab):

```bash
npm run build:native
cd android
EVIM_KEYSTORE=/yol/evim-upload.jks EVIM_KEYSTORE_PASSWORD=… EVIM_KEY_ALIAS=evim EVIM_KEY_PASSWORD=… \
  ./gradlew bundleRelease -PevimVersionCode=2 -PevimVersionName=1.0.1
# → android/app/build/outputs/bundle/release/app-release.aab
```

3. Play Console → uygulama oluştur → **Test and release → Closed testing** →
   .aab dosyasını yükle. Yeni kişisel hesaplarda üretime geçmeden önce en az
   12 test kullanıcısıyla 14 gün kapalı test şartı vardır.
4. Her yeni sürümde `evimVersionCode` bir artmalı.

### App Store

1. App Store Connect → **Apps → "+"** → Bundle ID `app.evim`.
2. Xcode → üst menü **Product → Archive** → *Distribute App* → *App Store
   Connect*. Sürüm: App hedefi → General → *Version* ve *Build*.
3. Önce **TestFlight** ile kendin ve birkaç kişiyle dene, sonra incelemeye
   gönder.

### İnceleme için hazırlık

- **Test hesabı**: bir mülk sahibi ve bir kiracı hesabı; mülk sahibinde örnek
  mülkler olsun. İnceleme notuna e-posta/şifreleri yaz.
- **Gizlilik**: App Store *App Privacy* ve Play *Data safety* formları.
  Toplanan veriler: ad, e-posta, telefon (hesap); fotoğraf ve belgeler
  (kullanıcı içeriği); satın alma geçmişi (abonelik). Veriler reklam ya da
  izleme için kullanılmaz.
- **Hesap silme** uygulama içinde: Hesap → *Hesabı sil*. Play Console bir de
  web adresi ister; bunun için gizlilik sayfana "hesabını silmek için
  uygulamada Hesap → Hesabı sil" açıklaması yeterlidir.
- **Gizlilik politikası ve kullanım koşulları** adresleri `config.js` →
  `billing.termsUrl`, `billing.privacyUrl` alanlarına ve mağaza sayfalarına.
- **Ekran görüntüleri**: iPhone 6.9", Android telefon; Türkçe ve İngilizce.

## 6. Güncellemeler

Web sitesi her gönderimde kendiliğinden güncellenir. Telefon uygulamasında
değişiklikler **yeni mağaza sürümüyle** kullanıcıya ulaşır (sürüm numarasını
artırıp yeniden yükle). İleride sık güncelleme gerekirse mağaza kurallarına
uygun "canlı güncelleme" hizmetleri (ör. Capgo) eklenebilir.

## İkon ve açılış ekranı

Kaynaklar `resources/` klasöründe. Değiştirirsen:

```bash
npx @capacitor/assets generate --assetPath resources --ios --android \
  --iconBackgroundColor '#A8492A' --splashBackgroundColor '#F7F1E8' --splashBackgroundColorDark '#171512'
```
