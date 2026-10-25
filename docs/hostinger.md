# Hostinger'a kurulum

Kiracım statik bir sitedir: derlenmiş dosyalar Hostinger'a yüklenir, veri ve giriş Supabase'dedir.
Hostinger'da **Node.js, veritabanı ya da PHP gerekmez**; en ucuz web hosting paketi (Premium/Business)
ve bir alan adı yeter. Aşağıdaki işlerin çoğu bir kez yapılır; sonra her güncelleme otomatik gelir.

> Yapabildiklerim ve yapamadıklarım: derleme paketini, `.htaccess` ayarlarını, otomatik paketleme
> iş akışını ve bu rehberi hazırladım ve test ettim (derleme, güvenlik başlıkları, tüm sayfalar).
> Hostinger, Supabase, GitHub ve alan adı hesaplarında tıklanacak adımları yalnızca siz yapabilirsiniz;
> hepsi aşağıda sırayla yazılı.

## Genel akış

```
GitHub'a push → (otomatik) siteyi derle → `hostinger` dalı + zip paketi → Hostinger public_html
```

## 1. Supabase'i kur (bir kez)

`docs/kurulum.md` → bölüm 1-4. Kısaca: proje aç → SQL Editor'de `supabase/schema.sql` dosyasını çalıştır →
**Project Settings → API**'den `Project URL` ve `anon public` anahtarını al.

Sonra **Authentication → URL Configuration**:
- *Site URL*: `https://kiracim.online` (kendi alan adınız)
- *Redirect URLs*: `https://kiracim.online/**`

## 2. GitHub değişkenlerini gir (bir kez)

Depo → **Settings → Secrets and variables → Actions → Variables** → *New repository variable*:

| Ad | Değer |
| --- | --- |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `anon public` anahtarı (herkese açık olabilir; veriyi sunucu kuralları korur) |
| `TURNSTILE_SITE_KEY` | isteğe bağlı, bot koruması (`docs/guvenlik.md` bölüm 4) |

`service_role` anahtarını **asla** buraya yazmayın.

## 3. Hostinger'ın "GitHub'dan içe aktar" sihirbazı (önerilen, otomatik güncellenir)

Hostinger → **Websites → Website ekle → Node.js uygulaması / GitHub'dan içe aktar** adımında depoyu seçince
"Yapı ayarlarını gözden geçirin" ekranı gelir. Bu proje için alanlar:

| Alan | Değer | Neden |
| --- | --- | --- |
| Depo | Kodun **`app/` klasörünü içeren** depo (bu proje: `Bora-colpan23/project_evim`) | Eski `Evim_v1` deposunda yeni uygulama yoktur. |
| Dal | `app/` klasörünü içeren dal | Yeni kod birleştirilince varsayılan dal; o zamana kadar `claude/brave-dijkstra-6bx0lo`. |
| Framework ön ayarı | **Other** | Listede Expo yok; çıktı düz statik dosyadır. |
| Düğüm sürümü | **22.x** | Uygulama Node 22 ile test edildi (20.x de çalışır). |
| Kök dizin | **`app`** | Uygulama bu klasördedir (kökte eski site var). |
| Derleme komutu | **`npm run build`** | `app/package.json` içinde `build`, siteyi derler ve sertleştirir. |
| Paket yöneticisi | **npm** | |
| Çıktı dizini | **`dist`** | Derlenmiş site buraya yazılır. |
| Giriş dosyası | **boş bırak** | Sunucu çalıştırmayan statik site. |
| Ortam değişkenleri | aşağıdaki tablo | Derleme sırasında uygulanır. |

Ortam değişkenleri (**Ortam değişkenleri → Ekle**):

| Anahtar | Değer |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon public` anahtarı |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | isteğe bağlı (bot koruması, `docs/guvenlik.md` bölüm 4) |

Bu üç değişken **derleme sırasında** siteye gömülür; sonradan değiştirirsen yeniden dağıtım gerekir.
`service_role` anahtarını **asla** girme.

Dağıtım bitince `https://kiracim.online/giris/kiraci` adresini doğrudan aç; açılıyorsa temiz adresler çalışıyor demektir
(derleme her sayfanın klasör kopyasını da ürettiği için yeniden yazma kuralı olmayan sunucularda da çalışır).

## 4. Elle yükleme (zip): GitHub Actions ile

Depo → **Actions** → **Hostinger paketi** → **Run workflow** → bitince alttaki **kiracim-hostinger** paketini indir.
(Değişkenler: depo Settings → Secrets and variables → Actions → Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, isteğe bağlı `TURNSTILE_SITE_KEY`.)
Aynı iş akışı `hostinger` adlı bir dala da derlenmiş site yazar.

## 5. Eski yöntemler (zip yükleme ve Git)

### Yol A: zip ile (en kolayı, 5 dakika)

1. hPanel → **Websites** → alan adınız → **File Manager** (Dosya Yöneticisi).
2. Sağ üstteki ayarlardan **gizli dosyaları göster** seçeneğini açın (`.htaccess` gizli dosyadır).
3. `public_html` içindeki varsayılan dosyaları (ör. `default.php`) silin.
4. Üstteki **Upload** ile `kiracim-hostinger.zip` dosyasını `public_html` içine yükleyin.
5. Zip'e sağ tık → **Extract** (içeriği doğrudan `public_html` köküne çıkarın; `index.html` ve `.htaccess` kökte olmalı).
6. Zip dosyasını silin.

Her güncellemede 3. bölümden yeni zip'i alıp aynısını tekrarlayın (eski dosyaların üzerine yazar).

### Yol B: Git ile otomatik (bir kez kurulur, sonra kendiliğinden güncellenir)

1. hPanel → **Advanced → Git**.
2. *Repository*: depo adresiniz (`https://github.com/<kullanıcı>/project_evim.git`); *Branch*: **`hostinger`**; *Directory*: boş bırakın (`public_html`).
   Depo özelse Hostinger'ın gösterdiği **SSH anahtarını** GitHub → depo → Settings → **Deploy keys**'e (yalnızca okuma) ekleyin ve SSH adresini kullanın.
3. **Create** → ilk çekmeyi **Deploy** ile yapın.
4. Hostinger'ın verdiği **Auto Deployment (webhook) adresini** GitHub → depo → Settings → **Webhooks** → *Add webhook* → Payload URL olarak ekleyin (Content type: `application/json`, olay: *Just the push event*).
   Böylece `hostinger` dalı her güncellenince site kendiliğinden yenilenir.

## 6. Alan adı ve SSL

1. hPanel → **Domains**: alan adınızı bu web sitesine bağlayın (Hostinger'dan aldıysanız otomatik bağlıdır; başka yerden aldıysanız nameserver'ları Hostinger'a çevirin ya da `A` kaydını Hostinger IP'sine yönlendirin).
2. hPanel → **Security → SSL**: ücretsiz SSL'i etkinleştirin. `.htaccess` HTTP'yi otomatik HTTPS'e yönlendirir.
3. `www` için: hPanel'de `www.kiracim.online` adresini ana alan adına yönlendirin ya da alt alan adı olarak ekleyin.

## 7. Yönetici hesabını aç (bir kez)

`docs/kurulum.md` → "Yönetici (denetçi) hesabı": sitede bir hesap açın, SQL Editor'de
`insert into public.admins …` çalıştırın. Sonra `https://kiracim.online/giris/yonetici` ile girin.
Yönetici paneli (denetim, bağlantılar, mesajlar, yasaklama, işlem kaydı) için aynı belgeye bakın.
**Yönetici hesabında iki adımlı doğrulama ve benzersiz parola kullanın.**

## 8. Kurulum sonrası kontrol listesi

- [ ] `https://kiracim.online` açılıyor, adres çubuğunda kilit görünüyor.
- [ ] `http://kiracim.online` otomatik `https` olur.
- [ ] `https://kiracim.online/giris/kiraci` adresini **doğrudan açınca** ve sayfayı **yenileyince** giriş ekranı gelir (404 gelirse `.htaccess` yüklenmemiştir, 4. bölümde gizli dosyaları göster).
- [ ] Kiracı kaydı yapılıyor; Supabase → Authentication → Users listesinde kullanıcı görünüyor.
- [ ] Yönetici girişi `/admin` panelini açıyor; yönetici olmayan hesap açamıyor.
- [ ] <https://securityheaders.com> adresinde alan adınız (Hostinger'da başlıklar `.htaccess` ile gelir; yüksek not beklenir).
- [ ] Tarayıcı konsolunda (F12) kırmızı "Content Security Policy" hatası yok. Varsa 2. bölümdeki `SUPABASE_URL` değişkeni eksik ya da hatalı yazılmıştır; düzeltip paketi yeniden üretin.

## 9. Koruma (WAF ve alan adı)

- `.htaccess`: HTTPS zorlaması, HSTS, çerçeve koruması, gizli dosyalara erişimi kapatma, önbellek. Hostinger'da bu başlıklar gerçekten gönderilir (GitHub Pages'ten farkı).
- Daha güçlü WAF (bot ve saldırı filtresi, hız sınırı) için alan adının önüne **Cloudflare** konur; adımlar `docs/guvenlik.md` bölüm 3'tedir. Hostinger'ın kendi güvenlik araçlarını hPanel → **Security** altında da açın (planınıza göre değişir).
- Hesap, alan adı kilidi, DNSSEC, DMARC: `docs/guvenlik.md` bölüm 2.
- Giriş/kayıt bot koruması ve Supabase ayarları: `docs/guvenlik.md` bölüm 4.

## 10. Sık sorunlar

| Belirti | Neden / çözüm |
| --- | --- |
| Ana sayfa açılıyor ama `/giris/kiraci` 404 | `.htaccess` yok. Dosya Yöneticisi'nde gizli dosyaları göster; zip'i `public_html` köküne çıkardığından emin ol (iç içe klasör olmasın). |
| Sayfa beyaz / boş | F12 konsoluna bak. Çoğunlukla `SUPABASE_URL`/`SUPABASE_ANON_KEY` GitHub değişkenleri girilmeden derlendi; değişkenleri girip paketi yeniden üret. |
| Giriş yapılıyor ama veri gelmiyor | `supabase/schema.sql` çalıştırılmamış ya da tekrar çalıştırılmamış (yeni sürümlerde şema da güncellenir). |
| Eski sürüm görünüyor | Tarayıcıda Ctrl+F5. Hostinger CDN/önbellek açıksa hPanel → **Cache Manager** → *Purge all*. |
| E-postalar gelmiyor (kayıt onayı, şifre sıfırlama) | Supabase → Authentication → **SMTP Settings**'ten kendi e-posta sunucunuzu (Hostinger e-postası olabilir) bağlayın; Supabase'in varsayılan e-postası saatlik sınırlıdır. |
| `/admin` boş görünüyor | Hesap `public.admins` tablosunda değil (6. bölüm). |

## 11. Güncelleme

Kod değişince varsayılan dala birleşmesi yeter: iş akışı yeni paketi üretir; Yol B'de Hostinger kendiliğinden
çeker, Yol A'da yeni zip'i yüklersiniz. Veritabanı şeması değiştiğinde (`supabase/schema.sql`) dosyayı
Supabase SQL Editor'de yeniden çalıştırmayı unutmayın; tekrar çalıştırmak zararsızdır.
