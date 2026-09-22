/* Veri sürümü geçişleri.
   Kayıtlı veri eski bir sürümdeyse sırayla yükseltilir; hiçbir durumda
   silinmez. Yeni bir veri alanı eklenince VERSION artırılır ve STEPS'e
   bir adım eklenir. */

import { parse, iso, addM, mkey } from './util.js';

export const VERSION = 2;

/** Eski anahtarlar: bulunursa taşınır, kendileri olduğu gibi bırakılır. */
export const LEGACY_KEYS = ['evim-proto-v1'];

const STEPS = {
  /* v1: ilk tek dosyalık prototip. Rota bilgisi durumda tutuluyordu,
     belge kimlikleri, talep geçmişi ve sözleşme başlangıcı yoktu. */
  1(s){
    const out = {
      v: 2,
      myHome: s.myHome || (s.order && s.order[0]),
      props: {},
      order: (s.order || []).slice(),
      settings: Object.assign({ rentDays:3, renewDays:60, insDays:30, evictDays:90, reqUpdates:true, lateNotice:true }, s.settings),
      inbox: (s.inbox || []).map(n => Object.assign({ go:null }, n)),
      theme: 'system',
      seenHint: !!s.seenHint,
      tourDone: false
    };
    let docSeq = 0;
    Object.keys(s.props || {}).forEach(id => {
      const p = JSON.parse(JSON.stringify(s.props[id]));
      // Sözleşme başı: en eski ödeme ayı; yoksa bitişten bir yıl öncesi.
      const keys = Object.keys(p.pay || {}).sort();
      p.startDate = p.startDate || (keys.length ? keys[0] + '-01' : iso(addM(parse(p.contractEnd), -12)));
      p.pay = p.pay || {};
      p.requests = (p.requests || []).map(r => Object.assign({ decision:null, shots:[] }, r, {
        log: r.log || [{ at: parse(r.date).getTime(), text:'Talep açıldı' }]
      }));
      p.docs = (p.docs || []).map(d => Object.assign({ id: d.id || 'm' + (++docSeq) }, d));
      p.msgs = p.msgs || [];
      p.bills = p.bills || [];
      p.inspect = p.inspect || { tenantOk:false, landlordOk:false, rooms:[] };
      p.inspect.rooms = (p.inspect.rooms || []).map(r => Object.assign({ shots:[] }, r));
      out.props[id] = p;
    });
    return out;
  }
};

/** Veriyi güncel sürüme getirir. Bilinmeyen bir ara sürümde hata fırlatır. */
export function migrate(data){
  let s = data;
  while ((s.v || 1) < VERSION){
    const step = STEPS[s.v || 1];
    if (!step) throw new Error('Geçiş adımı yok: v' + s.v);
    s = step(s);
  }
  return s;
}
