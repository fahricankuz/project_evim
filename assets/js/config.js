/* Sunucu yapılandırması.

   Boş bırakılırsa uygulama DEMO modunda çalışır: veriler yalnızca bu
   tarayıcıda durur, hesap gerekmez, kiracı/ev sahibi görünümleri arasında
   geçilebilir.

   Supabase projesi kurulunca (bkz. docs/kurulum.md) aşağıyı doldurun:
   - supabaseUrl, supabaseAnonKey: Supabase → Project Settings → API.
     "anon" anahtarı herkese açık olacak şekilde tasarlanmıştır; güvenlik
     veritabanındaki satır düzeyi kurallarla sağlanır. service_role
     anahtarını ASLA buraya yazmayın.
   - vapidPublicKey: anlık bildirimler için (npx web-push generate-vapid-keys).

   Yapılandırılmış bir sitede adrese ?demo eklenirse yine demo açılır. */

export const CONFIG = Object.assign({
  supabaseUrl: '',
  supabaseAnonKey: '',
  vapidPublicKey: '',
  // supabase-js modülünün adresi (testler sahte bir sürümle değiştirir).
  supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
}, globalThis.EVIM_CONFIG || {});

const forceDemo = new URLSearchParams(location.search).has('demo');

/** Gerçek hesaplarla mı çalışıyoruz? */
export const LIVE = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) && !forceDemo;
