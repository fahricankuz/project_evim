import { t } from '../domain/i18n';
import { CONFIG } from '../domain/config';

/** Tanıtım metinleri: yalnızca uygulamada bulunan özellikler (README → "Ne yapabiliyor"). */
export const features = () => [
  { id: 'odeme', title: t('Ödemeler'), body: t('Dekont tutar, tarih ve notla yüklenir. Eksik tutar kısmi ödeme olur, kalan bakiye takip edilir. Mülk sahibi onaylar ya da gerekçeyle reddeder; gecikme iki tarafta aynı görünür.') },
  { id: 'talep', title: t('Talepler, teklif ve fatura'), body: t('Arıza, tadilat ve ek talep dört adımda ilerler: Açıldı, Görüldü, İşlemde, Çözüldü. Usta teklifleri karşılaştırılır; fatura otomatik olarak gider defterine işlenir.') },
  { id: 'cikis', title: t('Çıkış ve depozito iadesi'), body: t('Çıkış tutanağı giriş tutanağıyla oda oda karşılaştırılır. Mülk sahibi kesinti girer, iki taraf onaylar, iade hesaplanır.') },
  { id: 'yenileme', title: t('Sözleşme yenileme'), body: t('TÜFE ortalamasıyla yasal üst sınır hesaplanır. Teklif sınırı aşamaz; kiracı kabul eder ya da görüşmeye çağırır.') }
];
export const more = () => [
  { id: 'foto', title: t('Fotoğraflı yazışma'), body: t('Arızayı fotoğrafla anlat. Fotoğraf mesajın içinde görünür, yalnızca o evin kiracısı ve mülk sahibi görür.') },
  { id: 'kontrol', title: t('Kontrol edilen yüklemeler'), body: t('Dekont, belge ve faturalar Kiracım ekibince kontrol edilir; onaylanınca karşı tarafa görünür. Red gerekçesiyle döner.') },
  { id: 'gecmis', title: t('Kira geçmişi'), body: t('Her tutar değişikliği geçerlilik tarihiyle saklanır; geçmiş dönemler o dönemin kirasıyla hesaplanır.') },
  { id: 'gider', title: t('Gider defteri ve net getiri'), body: t('Emlak vergisi, aidat, sigorta, tamir. Ev başına yıllık net getiri ve değere göre getiri oranı.') },
  { id: 'vergi', title: t('Vergi tahmini'), body: t('Konut kira geliri istisnası, götürü ve gerçek gider yöntemlerinin karşılaştırması.') },
  { id: 'tip', title: t('Konut, ofis, mağaza, depo'), body: t('Tutanak alanları, talep önerileri ve belge kategorileri mülk tipine göre gelir.') },
  { id: 'stopaj', title: t('Şirket kiracı ve stopaj'), body: t('Kira stopajı (%20) düşülerek net tutar beklenir; brüt ve stopaj ayrı gösterilir.') },
  { id: 'coklu', title: t('Birden fazla kiracı'), body: t('Aynı eve birden çok kiracı hesabı davet bağlantısı ya da kodla eklenir.') },
  { id: 'takip', title: t('Takip'), body: t('Ayarlanabilir hatırlatmalar, takvim, Türkçe karakter duyarsız arama, yıllık rapor ve CSV.') },
  { id: 'veri', title: t('Verin sende'), body: t('JSON dışa ve içe aktarma. Silme gibi geri dönüşsüz işler onay ister.') }
];

export const plans = () => ([
  { id: 'monthly', name: t('Aylık'), price: CONFIG.billing.plans[0].label, per: t('/ ay'), note: t('İstediğin zaman iptal et') },
  { id: 'annual', name: t('Yıllık'), price: CONFIG.billing.plans[1].label, per: t('/ yıl'), note: t('2 ay bedava'), best: true }
]);

export const planPoints = () => [
  t('14 gün deneme, kart istenmez'),
  t('Sınırsız mülk ve kiracı hesabı'),
  t('Ödeme, talep, belge, gider ve rapor'),
  t('Deneme veya abonelik bitince kayıtlar salt okunur; okuma ve mesajlaşma açık kalır')
];

/** Üst menüdeki açılır panel: sol kategoriler, ortada ilgili özellikler. Yalnızca uygulamada olanlar. */
export const menu = () => [
  { id: 'odeme', icon: 'card', title: t('Ödemeler'), items: [
    { title: t('Dekont yükleme'), body: t('Tutar, tarih ve notla; görsel ya da PDF.') },
    { title: t('Kısmi ödeme'), body: t('Eksik tutar bakiye olarak takip edilir.') },
    { title: t('Onay ve red'), body: t('Mülk sahibi onaylar ya da gerekçeyle reddeder.') },
    { title: t('Gecikme takibi'), body: t('Gecikme iki tarafta aynı görünür.') }
  ] },
  { id: 'talep', icon: 'wrench', title: t('Talepler'), items: [
    { title: t('Arıza ve tadilat'), body: t('Açıldı, Görüldü, İşlemde, Çözüldü.') },
    { title: t('Usta teklifleri'), body: t('Teklifleri karşılaştır, birini seç.') },
    { title: t('Fatura ve gider'), body: t('Fatura gider defterine işlenir.') },
    { title: t('Fotoğraflı anlatım'), body: t('Sorunu fotoğrafla göster.') }
  ] },
  { id: 'yazisma', icon: 'chat', title: t('Yazışma ve belgeler'), items: [
    { title: t('Fotoğraflı mesaj'), body: t('Fotoğraf mesajın içinde görünür.') },
    { title: t('Belge arşivi'), body: t('Sözleşme, sigorta ve DASK tarihleri hatırlatılır.') },
    { title: t('Giriş tutanağı'), body: t('Oda oda, iki tarafın onayıyla.') },
    { title: t('Yazışma dökümü'), body: t('Tarihli olarak dışa aktarılır.') }
  ] },
  { id: 'cikis', icon: 'key', title: t('Çıkış ve depozito'), items: [
    { title: t('Çıkış tutanağı'), body: t('Giriş tutanağıyla karşılaştırılır.') },
    { title: t('Kesintiler'), body: t('Temizlik, boya, onarım ve ödenmemiş faturalar.') },
    { title: t('İade hesabı'), body: t('İade edilecek tutar kendiliğinden hesaplanır.') },
    { title: t('İki taraflı onay'), body: t('Kesinti değişirse onaylar sıfırlanır.') }
  ] },
  { id: 'yenileme', icon: 'calendar', title: t('Yenileme ve vergi'), items: [
    { title: t('TÜFE üst sınırı'), body: t('12 aylık ortalamayla yasal sınır hesaplanır.') },
    { title: t('Yenileme teklifi'), body: t('Kiracı kabul eder ya da görüşmeye çağırır.') },
    { title: t('Vergi tahmini'), body: t('Götürü ve gerçek gider yöntemi karşılaştırılır.') },
    { title: t('Kira stopajı'), body: t('Şirket kiracıda brüt, stopaj ve net ayrı görünür.') }
  ] },
  { id: 'rapor', icon: 'chart', title: t('Giderler ve rapor'), items: [
    { title: t('Gider defteri'), body: t('Vergi, aidat, sigorta ve tamir kayıtları.') },
    { title: t('Net getiri'), body: t('Ev başına yıllık net getiri ve oran.') },
    { title: t('Yıllık rapor'), body: t('Özet ve CSV olarak dışa aktarım.') },
    { title: t('Takvim ve hatırlatma'), body: t('Vade, yenileme ve sigorta tarihleri tek takvimde.') }
  ] }
];
