/* Sunucu yapılandırması. EXPO_PUBLIC_* değişkenleri derleme sırasında gömülür.
   Boşsa uygulama yerel hesap modunda çalışır: hesap ve veri yalnızca bu
   cihazda durur. Supabase kurulunca (docs/kurulum.md) iki değişkeni doldurun;
   "anon" anahtarı herkese açık olacak şekilde tasarlanmıştır, güvenlik
   veritabanındaki satır düzeyi kurallarla sağlanır. */
export const CONFIG = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  publicUrl: 'https://kiracim.online/',
  supportEmail: 'info@kiracim.online',
  legal: {
    terms: 'https://kiracim.online/kosullar/',
    privacy: 'https://kiracim.online/gizlilik/',
    deletion: 'https://kiracim.online/hesap-silme/',
    support: 'https://kiracim.online/destek/'
  },
  billing: {
    plans: [
      { id:'monthly', price:249.99, label:'₺249,99' },
      { id:'annual',  price:2499.99, label:'₺2.499,99' }
    ]
  }
};
export const LIVE = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
