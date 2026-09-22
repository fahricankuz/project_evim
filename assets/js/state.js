/* Uygulama durumu: demo verisi, kalıcılık ve tema. */

import { t0, iso, add, addM, mkey, parse, DAY } from './util.js';
import { VERSION, LEGACY_KEYS, migrate } from './migrate.js';

export { VERSION };
export const KEY = 'evim';

export const STEPS = ['Açıldı','Görüldü','İşlemde','Çözüldü'];
export const CATS = ['Arıza','Tadilat','Ek talep'];
export const DOC_CATS = ['Kira sözleşmesi','Tahliye taahhütnamesi','DASK poliçesi','Konut sigortası','Giriş–çıkış tutanağı','Fatura ve aidat','Diğer'];
export const COST_OPTS = ['Belirlenmedi','Ev sahibi','Kiracı','Paylaşımlı'];

/** Sıfırdan demo verisi üretir; tüm tarihler bugüne göredir. */
export function seed(){
  const t = t0(), now = Date.now();

  const START = { moda: iso(add(t,-313)), cihangir: iso(add(t,-195)), atasehir: iso(add(t,-337)) };

  /**
   * Sözleşme başından bugüne kadarki ayları onaylı ödeme olarak doldurur.
   * `skipLast` kadar son ay boş bırakılır (gecikme ya da onay bekleyen ay kurgusu için).
   */
  const pays = (rent, startISO, skipLast = 0) => {
    const o = {};
    const start = parse(startISO);
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endKey = mkey(addM(new Date(t.getFullYear(), t.getMonth(), 1), -skipLast));
    while (mkey(cur) <= endKey){
      o[mkey(cur)] = {
        status:'approved',
        date: iso(new Date(cur.getFullYear(), cur.getMonth(), 3)),
        amount: rent,
        receipt: 'dekont_'+mkey(cur)+'.pdf',
        approvedAt: new Date(cur.getFullYear(), cur.getMonth(), 4).getTime()
      };
      cur = addM(cur, 1);
    }
    return o;
  };

  const landlord = { name:'[Ev sahibi adı]', phone:'05000000000' };

  const moda = {
    id:'moda', name:'Moda’daki ev', addr:'Moda Cd. No:[__] D:4, Kadıköy',
    tenant:{ name:'[Kiracı adı]', phone:'05000000001' }, landlord,
    rent:32500, dueDay:5, aidat:2750, aidatPayer:'Kiracı', deposit:65000, depositNote:'Banka hesabında',
    startDate: START.moda, contractEnd: iso(add(t,52)), dask: iso(add(t,120)),
    bills:[{n:'Elektrik',who:'Kiracı'},{n:'Doğalgaz',who:'Kiracı'},{n:'Su',who:'Kiracı'},{n:'İnternet',who:'Kiracı'}],
    pay: pays(32500, START.moda, 0),
    requests:[
      { id:'r1', cat:'Arıza', title:'Kombi basıncı düşüyor',
        desc:'Basınç her sabah 0,5 bara iniyor, iki gündür sıcak su kesiliyor.',
        urgency:'Normal', status:2, cost:'Ev sahibi', costOk:true, decision:null,
        date: iso(add(t,-7)), photos:2, shots:[],
        log:[
          { at: now-7*DAY, text:'Talep açıldı' },
          { at: now-6*DAY, text:'Ev sahibi görüntüledi' },
          { at: now-5*DAY, text:'Masraf ev sahibinde olarak onaylandı' },
          { at: now-5*DAY+7200000, text:'Servis çağrıldı · İşlemde' }
        ] },
      { id:'r2', cat:'Ek talep', title:'Salona klima montajı',
        desc:'Masrafı bana ait olmak üzere salona klima taktırmak istiyorum.',
        urgency:'Normal', status:0, cost:'Kiracı', costOk:false, decision:null,
        date: iso(add(t,-2)), photos:0, shots:[],
        log:[{ at: now-2*DAY, text:'Talep açıldı' }] }
    ],
    msgs:[
      { from:'tenant', text:'Merhaba, kombi için talep açtım, fotoğraflar ekte.', at: now-6*DAY },
      { from:'landlord', text:'Gördüm, yarın servis arayacak.', at: now-6*DAY+3600000 },
      { from:'system', text:'Talep durumu: İşlemde · Masraf ev sahibinde, onaylandı', at: now-5*DAY }
    ],
    docs:[
      { id:'d1', cat:'Kira sözleşmesi', name:'kira_sozlesmesi_imzali.pdf', at: iso(add(t,-313)) },
      { id:'d2', cat:'DASK poliçesi', name:'dask_police.pdf', at: iso(add(t,-245)), until: iso(add(t,120)) },
      { id:'d3', cat:'Giriş–çıkış tutanağı', name:'giris_tutanagi.pdf', at: iso(add(t,-312)) }
    ],
    inspect:{ tenantOk:true, landlordOk:false, rooms:[
      { n:'Salon', photos:8, shots:[], note:'Sayaçlar okundu' },
      { n:'Mutfak', photos:6, shots:[], note:'Dolap kapağı menteşesi gevşek' },
      { n:'Yatak odası', photos:5, shots:[], note:'' },
      { n:'Banyo', photos:4, shots:[], note:'Fayansta kılcal çatlak' },
      { n:'Balkon', photos:0, shots:[], note:'' }
    ] },
    renewal:null
  };

  const cihangir = {
    id:'cihangir', name:'Cihangir 1+1', addr:'Sıraselviler Cd. No:[__] D:2, Beyoğlu',
    tenant:{ name:'[Kiracı 2]', phone:'05000000002' }, landlord,
    rent:41000, dueDay:10, aidat:1500, aidatPayer:'Kiracı', deposit:82000, depositNote:'Nakit alındı',
    startDate: START.cihangir, contractEnd: iso(add(t,170)), dask: iso(add(t,22)),
    bills:[{n:'Elektrik',who:'Kiracı'},{n:'Su',who:'Ev sahibi'}],
    pay: (() => {
      const o = pays(41000, START.cihangir, 1);
      o[mkey(t)] = { status:'review', date: iso(add(t,-1)), amount:41000, receipt:'dekont_bu_ay.jpg' };
      return o;
    })(),
    requests:[
      { id:'r3', cat:'Tadilat', title:'Banyo aspiratörü değişimi',
        desc:'Aspiratör ses yapıyor ve çekmiyor.', urgency:'Normal', status:0,
        cost:'Belirlenmedi', costOk:false, decision:null, date: iso(add(t,-1)), photos:1, shots:[],
        log:[{ at: now-DAY, text:'Talep açıldı' }] }
    ],
    msgs:[ { from:'tenant', text:'Bu ayın dekontunu yükledim.', at: now-DAY } ],
    docs:[
      { id:'d4', cat:'Kira sözleşmesi', name:'sozlesme_cihangir.pdf', at: iso(add(t,-195)) },
      { id:'d5', cat:'DASK poliçesi', name:'dask_cihangir.pdf', at: iso(add(t,-343)), until: iso(add(t,22)) }
    ],
    inspect:{ tenantOk:true, landlordOk:true, rooms:[
      { n:'Salon', photos:6, shots:[], note:'' },
      { n:'Yatak odası', photos:4, shots:[], note:'' },
      { n:'Banyo', photos:3, shots:[], note:'' }
    ] },
    renewal:null
  };

  const atasehir = {
    id:'atasehir', name:'Ataşehir 2+1', addr:'Atatürk Mah. [__] Sk. No:[__], Ataşehir',
    tenant:{ name:'[Kiracı 3]', phone:'05000000003' }, landlord,
    rent:27000, dueDay:1, aidat:3200, aidatPayer:'Kiracı', deposit:54000, depositNote:'Banka hesabında',
    startDate: START.atasehir, contractEnd: iso(add(t,28)), dask: iso(add(t,200)),
    bills:[{n:'Elektrik',who:'Kiracı'},{n:'Doğalgaz',who:'Kiracı'}],
    pay: pays(27000, START.atasehir, 1),
    requests:[], msgs:[],
    docs:[
      { id:'d6', cat:'Kira sözleşmesi', name:'sozlesme_atasehir.pdf', at: iso(add(t,-337)) },
      { id:'d7', cat:'Tahliye taahhütnamesi', name:'tahliye_taahhut.pdf', at: iso(add(t,-337)), until: iso(add(t,75)) }
    ],
    inspect:{ tenantOk:true, landlordOk:true, rooms:[
      { n:'Salon', photos:7, shots:[], note:'' },
      { n:'Mutfak', photos:5, shots:[], note:'' }
    ] },
    renewal:null
  };

  return {
    v: VERSION,
    myHome:'moda',
    props:{ moda, cihangir, atasehir },
    order:['moda','cihangir','atasehir'],
    settings:{ rentDays:3, renewDays:60, insDays:30, evictDays:90, reqUpdates:true, lateNotice:true },
    inbox:[],
    theme:'system',
    seenHint:false,
    tourDone:false
  };
}

/** Kayıt yeni bir uygulama sürümünden geliyorsa üzerine yazmamak için. */
let readOnly = false;
/** Açılışta ne olduğunu kullanıcıya söylemek için (main.js okur). */
export const bootInfo = { migratedFrom:null, newer:false, corrupt:false };

function read(key){
  try { return JSON.parse(localStorage.getItem(key)); } catch(e){ return undefined; }
}

function load(){
  // v2 sürümü 'evim-v2' anahtarını kullanıyordu; önce onu tek anahtara taşı.
  const keys = [KEY, 'evim-v2', ...LEGACY_KEYS];
  for (const key of keys){
    const raw = read(key);
    if (raw === undefined){ if (key === KEY && localStorage.getItem(KEY)) bootInfo.corrupt = true; continue; }
    if (!raw || !raw.props || !raw.order) continue;

    const v = raw.v || 1;
    if (v > VERSION){
      // Daha yeni bir sürümün verisi: okunur ama asla üzerine yazılmaz.
      readOnly = true;
      bootInfo.newer = true;
      return raw;
    }
    if (v === VERSION && key === KEY) return raw;

    try {
      // Geçişten önce ham veriyi yedekle.
      try { localStorage.setItem('evim-yedek-v' + v, JSON.stringify(raw)); } catch(e){}
      const next = migrate(raw);
      bootInfo.migratedFrom = v;
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch(e){}
      return next;
    } catch(e){
      console.error('Veri geçişi başarısız', e);
      bootInfo.corrupt = true;
    }
  }
  return seed();
}

export let S = load();
export function isReadOnly(){ return readOnly; }

/** Kalıcılık. Kota dolarsa fotoğrafları atıp yeniden dener. */
export function save(){
  if (readOnly) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
    return true;
  } catch(e){
    try {
      const slim = JSON.parse(JSON.stringify(S));
      Object.values(slim.props).forEach(p => {
        p.inspect.rooms.forEach(r => { r.shots = []; });
        p.requests.forEach(r => { r.shots = []; });
        Object.values(p.pay).forEach(rec => { delete rec.photo; });
      });
      localStorage.setItem(KEY, JSON.stringify(slim));
      S = slim;
      return false;
    } catch(e2){ return false; }
  }
}

/** Durumu tamamen değiştirir (sıfırlama ve içe aktarma için). */
export function replaceState(next){
  readOnly = false;
  S = next;
  save();
  applyTheme();
}

export function reset(){ replaceState(seed()); }

/** Geçici, kaydedilmeyen arayüz durumu. */
export const ui = {
  reqTab:'open',
  q:'',
  renewal:{ cpi:null, amount:null },
  lastChatKey:null,
  tour:null
};

export function applyTheme(){
  const el = document.documentElement;
  if (S.theme === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', S.theme);
}

export function setTheme(v){ S.theme = v; save(); applyTheme(); }
