# Kurumsal satış için ürün yapılacaklar listesi

> [`gtm-stratejisi.md`](gtm-stratejisi.md) §3 ve §6'dan türetildi. Sıra,
> 90 günlük plandaki haftalara göre. **P0** = outreach başlamadan şart,
> **P1** = ilk müşterilerle birlikte, **P2** = 3. aydan sonra.

---

## P0 — Hafta 1–2: Toplu içe aktarma

40 birimi elle girmek ilk demoda müşteriyi kaybettirir.

- [ ] İndirilebilir Excel/CSV şablonu: mülk adı, adres, tip (Konut/Ofis/Mağaza/Depo), alan, kira, ödeme günü, aidat ve ödeyen, depozito ve türü, başlangıç/bitiş, DASK, stopaj, kiracı adı/telefon/e-posta, kiracı şirket unvanı/VKN
- [ ] Yükleme ekranı: dosyayı oku (`;` ve `,` ayırıcı, UTF-8 BOM — mevcut CSV dışa aktarımıyla aynı biçim, `assets/js/actions.js`)
- [ ] Satır bazında doğrulama ve önizleme (hatalı satırlar kırmızı, neden yazılı); kaydetmeden önce onay
- [ ] Toplu kaydetme (gerçek modda tek işlemde Supabase'e yazım)
- [ ] Kiracılara toplu davet: içe aktarılan her birim için davet kodu üret, e-posta/SMS/WhatsApp ile gönder (`invites` tablosu)
- [ ] Mevcut kayıtlarla çakışma: aynı ad/adres varsa güncelle mi, atla mı?
- [ ] Testler (`tests/`) ve çeviri anahtarları (`assets/js/en.js`)

## P0 — Hafta 1–2: Satış sayfası

- [ ] kiracim.online'da ofis / mağaza / depo sahiplerine yönelik sayfa (stopaj, TÜFE tavanı, tutanak, toplu kiracı)
- [ ] 60 saniyelik demo videosu için hazır demo verisi: 1 iş hanı, 20 birim (`assets/js/state.js` demo verisine ek senaryo)
- [ ] "Demo talep et" formu (kurumsal başvurular için)

## P0 — Hafta 3–6: Portföy fiyatı, web ödeme, e-fatura

Şirketler App Store'dan abonelik almaz; muhasebe fatura ister.

- [ ] Fiyat modeli kararı: Bireysel (1–5 birim) / Portföy (6–50, birim başı) / Kurumsal (50+, sözleşmeli)
- [ ] `subscriptions` tablosuna plan ve birim limiti alanları; `require_access()` birim sayısını da kontrol etsin (`supabase/schema.sql`)
- [ ] Limit aşımında uyarı ve yükseltme akışı (`assets/js/billing.js`)
- [ ] Web ödeme: iyzico veya PayTR entegrasyonu (abonelik + yıllık peşin), webhook ile `subscriptions` güncelleme (`supabase/functions/billing/` yanına yeni fonksiyon)
- [ ] Mağaza aboneliği ile web aboneliğinin aynı hesapta çakışmaması
- [ ] Fatura bilgisi ekranı: unvan, VKN/TCKN, vergi dairesi, adres
- [ ] e-Fatura / e-Arşiv: entegratör seçimi (ör. mevcut muhasebe yazılımınızın entegratörü) ve ödeme sonrası otomatik fatura
- [ ] `config.js` → `billing.plans` ve `docs/abonelik.md` güncellemesi

## P1 — Hafta 7–10: Ekip / yönetici rolü

Bugün mülk başına tek `landlord`; emlakçı, muhasebeci ya da yönetim firması aynı portföye giremiyor.

- [ ] Rol modeli: `owner` (sahip), `manager` (yönetici — emlakçı, yönetim firması), `accountant` (salt okuma + rapor). `memberships.role` kısıtını genişlet
- [ ] Satır düzeyi güvenlik ve tetikleyiciler: kim ödeme onaylar, kim kira değiştirir, kim silebilir (`supabase/schema.sql`)
- [ ] Ekip üyesi davet etme (portföy veya mülk bazında)
- [ ] Yönetici paneli: birden fazla mülk sahibinin portföyünü tek ekranda görme (emlakçı / yönetim firması için)
- [ ] İşlem geçmişi: kim, neyi, ne zaman değiştirdi
- [ ] Abonelik kimde: sahipte mi, yöneticide mi (kanal ortağı modeli için)
- [ ] Kanal ortağı tavsiye kodu ve gelir paylaşımı takibi

## P2 — Hafta 11–13: Bina hiyerarşisi ve toplu duyuru

- [ ] "Bina" kavramı: bina > birimler (plaza, iş hanı, çarşı, depo sitesi)
- [ ] Bina bazında özet: doluluk, tahsilat oranı, geciken ödemeler
- [ ] Toplu duyuru: bir binadaki tüm kiracılara mesaj + anlık bildirim (su kesintisi, bakım, toplantı)
- [ ] Bina bazında rapor ve CSV (mevcut yıllık rapora ek)
- [ ] Toplu kira artışı: binadaki tüm sözleşmelere TÜFE tavanlı yenileme teklifi

## P2 — Kurumsal güven paketi

Satın alma ve BT birimleri bunları sorar.

- [ ] KVKK aydınlatma metni ve açık rıza akışının gözden geçirilmesi (`site/gizlilik`)
- [ ] Veri işleme sözleşmesi (DPA) şablonu
- [ ] Veri yeri (Supabase bölgesi), yedekleme sıklığı ve saklama süresi belgesi
- [ ] Hizmet seviyesi (SLA) ve destek kanalı tanımı
- [ ] Güvenlik özeti sayfası: satır düzeyi güvenlik, şifreleme, erişim kontrolü

## Sonra — GYO/AVM keşif görüşmelerine göre karar verilecek

Bunlar keşif görüşmelerinden çıkacak ihtiyaçlara göre önceliklendirilecek; şimdi yapılmayacak.

- [ ] ERP / muhasebe entegrasyonu (Logo, Netsis, Mikro, SAP) — dışa aktarım biçimi ya da API
- [ ] Ciro kirası (AVM: cironun yüzdesi)
- [ ] Ortak alan gideri dağıtımı (m² ya da pay oranına göre)
- [ ] Banka hesap hareketlerinden otomatik ödeme eşleştirme
- [ ] Site yönetim yazılımlarıyla (aidat tarafı) entegrasyon
