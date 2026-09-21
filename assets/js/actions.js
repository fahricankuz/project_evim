/* Etkileşimler: tıklama, form ve alan değişiklikleri. */

import { S, ui, save, reset as resetState, replaceState, setTheme, seed, VERSION, STEPS } from './state.js';
import { go, openSheet, closeSheet, current, setParams } from './router.js';
import { P, period, statusOf, remaining, yearIncome, monthCollection } from './logic.js';
import { render, refreshLayer } from './render.js';
import { notify } from './notify.js';
import { startTour, nextStep, prevStep, endTour, TOUR } from './tour.js';
import {
  iso, t0, parse, fmt, fmtFull, monthYear, tl, daysTo, shrink, download, esc, announce
} from './util.js';

function sysMsg(p, text){ p.msgs.push({ from:'system', text, at:Date.now() }); }
function logReq(r, text){ (r.log = r.log || []).push({ at:Date.now(), text }); }
function reqOf(p, id){ return p.requests.find(r => r.id === id); }

/** Tur açıkken adım adresine gider. */
function tourGo(){
  const s = ui.tour != null ? TOUR[ui.tour] : null;
  if (s) go(s.path); else render();
}

export const A = {
  /* ---- gezinme ---- */
  nav: d => go(d.go),
  sheet: d => openSheet(d.s, { pid:d.pid, key:d.key, cat:d.cat, id:d.id }),
  closeSheet: () => closeSheet(),

  switchRole: () => {
    const toLandlord = ui.role === 'tenant';
    go(toLandlord ? '/ev-sahibi' : '/kiraci');
    notify({
      title: toLandlord ? 'Ev sahibi görünümü' : 'Kiracı görünümü',
      body: toLandlord ? 'Üç evinin genel durumunu görüyorsun.' : 'Moda’daki evin kiracısı olarak görüyorsun.',
      icon:'home'
    }, false);
  },

  goMsg: d => go(ui.role === 'tenant' ? '/kiraci/mesajlar' : '/ev-sahibi/ev/'+d.pid+'/mesaj'),

  reqTab: d => { ui.reqTab = d.v; render(); },

  openReq: d => openSheet('talep', { pid:d.pid, id:d.id }),

  /* ---- talepler ---- */
  advance: d => {
    const p = P(d.pid), r = reqOf(p, d.id);
    r.status = Math.min(3, r.status + 1);
    logReq(r, 'Durum: '+STEPS[r.status]);
    sysMsg(p, 'Talep durumu: '+r.title+' · '+STEPS[r.status]);
    save(); render();
    if (S.settings.reqUpdates)
      notify({ title:'Talep güncellendi', body:r.title+' → '+STEPS[r.status]+'. Kiracıya bildirildi.', icon:'wrench' });
  },

  rewind: d => {
    const p = P(d.pid), r = reqOf(p, d.id);
    r.status = Math.max(0, r.status - 1);
    logReq(r, 'Durum geri alındı: '+STEPS[r.status]);
    save(); render();
  },

  decide: d => {
    const p = P(d.pid), r = reqOf(p, d.id);
    r.decision = d.v; r.status = 3;
    logReq(r, 'Karar: '+d.v);
    sysMsg(p, 'Ek talep: '+r.title+' · '+d.v);
    save(); render();
    notify({ title:'Karar kaydedildi', body:r.title+': '+d.v, icon:'wrench' });
  },

  okCost: d => {
    const p = P(d.pid), r = reqOf(p, d.id);
    r.costOk = true;
    logReq(r, 'Masraf paylaşımı onaylandı: '+r.cost);
    sysMsg(p, 'Masraf paylaşımı onaylandı: '+r.cost);
    save(); render();
  },

  closeReq: d => {
    const p = P(d.pid), r = reqOf(p, d.id);
    r.status = 3;
    logReq(r, 'Kiracı talebi çözüldü olarak işaretledi');
    sysMsg(p, 'Talep kapatıldı: '+r.title);
    save(); render();
    notify({ title:'Talep kapatıldı', body:r.title, icon:'wrench' });
  },

  /* ---- ödemeler ---- */
  approvePay: d => {
    const p = P(d.pid), rec = p.pay[d.key];
    if (!rec) return;
    rec.status = 'approved';
    rec.approvedAt = Date.now();
    delete rec.rejectReason;
    sysMsg(p, monthYear(d.key)+' kirası onaylandı');
    save(); closeSheet(); render();
    notify({ title:'Ödeme onaylandı', body:p.name+' · '+monthYear(d.key)+' kirası. Kiracıya bildirildi.', icon:'card' });
  },

  nudge: d => {
    const p = P(d.pid), per = period(p);
    p.msgs.push({
      from:'landlord',
      text:'Merhaba, '+monthYear(per.key)+' kirası için hatırlatma. Ödediysen dekontu uygulamaya yükleyebilir misin? Teşekkürler.',
      at: Date.now()
    });
    save(); render();
    notify({ title:'Hatırlatma gönderildi', body:p.tenant.name+' için nazik bir mesaj iletildi.', icon:'chat' });
  },

  /* ---- yenileme ---- */
  sendRenewal: d => {
    const p = P(d.pid);
    const cpi = Number(ui.renewal.cpi);
    if (!isFinite(cpi)) return;
    const max = Math.round(p.rent * (1 + cpi/100));
    const amt = Math.min(Number(ui.renewal.amount) || max, max);
    p.renewal = { amount:amt, max, cpi, status:'sent', at:Date.now() };
    sysMsg(p, 'Yenileme teklifi: '+tl(amt)+' (yasal üst sınır '+tl(max)+')');
    ui.renewal = { cpi:null, amount:null };
    save(); closeSheet(); render();
    notify({ title:'Teklif gönderildi', body:'Kiracı uygulamada kabul edebilir ya da mesajla görüşebilir.', icon:'card' });
  },

  acceptRenewal: d => {
    const p = P(d.pid);
    p.renewal.status = 'accepted';
    sysMsg(p, 'Yenileme teklifi kabul edildi: '+tl(p.renewal.amount));
    save(); render();
    notify({ title:'Teklifi kabul ettin', body:'Yeni kira '+fmtFull(parse(p.contractEnd))+' itibarıyla '+tl(p.renewal.amount)+'.', icon:'card' });
  },

  cancelRenewal: d => {
    const p = P(d.pid);
    p.renewal = null;
    sysMsg(p, 'Yenileme teklifi geri çekildi');
    save(); render();
  },

  /* ---- belgeler ve tutanak ---- */
  removeDoc: d => {
    const p = P(d.pid);
    const doc = p.docs.find(x => x.id === d.id);
    if (!doc || !confirm('“'+doc.name+'” belgesi silinsin mi?')) return;
    p.docs = p.docs.filter(x => x.id !== d.id);
    save(); render();
  },

  removeRoom: d => {
    const p = P(d.pid);
    p.inspect.rooms.splice(Number(d.i), 1);
    p.inspect.tenantOk = false; p.inspect.landlordOk = false;
    save(); render();
  },

  removeShot: d => {
    const room = P(d.pid).inspect.rooms[Number(d.i)];
    room.shots.splice(Number(d.j), 1);
    save(); render();
  },

  approveInspect: d => {
    const p = P(d.pid);
    if (ui.role === 'tenant') p.inspect.tenantOk = true; else p.inspect.landlordOk = true;
    sysMsg(p, 'Giriş tutanağı '+(ui.role === 'tenant' ? 'kiracı' : 'ev sahibi')+' tarafından onaylandı');
    save(); render();
    notify({
      title:'Tutanak onaylandı',
      body: p.inspect.tenantOk && p.inspect.landlordOk ? 'İki taraf da onayladı; tutanak kilitlendi.' : 'Karşı tarafın onayı bekleniyor.',
      icon:'doc'
    });
  },

  nudgeInspect: () => notify({ title:'Hatırlatma gönderildi', body:'Karşı tarafa tutanağı onaylaması için bildirim gitti.', icon:'doc' }),

  exportInspect: d => {
    const p = P(d.pid);
    const body = p.name+' · '+p.addr+'\nGiriş tutanağı · '+fmtFull(new Date())+'\n\n' +
      p.inspect.rooms.map(r => '- '+r.n+': '+((r.photos||0)+(r.shots||[]).length)+' fotoğraf'+(r.note ? ' · '+r.note : '')).join('\n') +
      '\n\nKiracı onayı: '+(p.inspect.tenantOk ? 'var' : 'yok')+'\nEv sahibi onayı: '+(p.inspect.landlordOk ? 'var' : 'yok');
    openText('Tutanak dökümü', body);
  },

  /* ---- dışa aktarma ---- */
  exportChat: d => {
    const p = P(d.pid);
    const body = p.name+' · '+p.addr+'\n\n' + p.msgs.map(m =>
      new Date(m.at).toLocaleString('tr-TR')+' · ' +
      (m.from === 'tenant' ? p.tenant.name : m.from === 'landlord' ? p.landlord.name : 'Sistem')+': '+m.text).join('\n');
    openText('Yazışma dökümü', body);
  },

  shareReport: () => {
    const yi = yearIncome();
    const body = yi.year+' yılı konut kira geliri özeti\n\n' +
      S.order.map(id => { const p = P(id); return p.name+' ('+p.addr+'): '+tl(yi.per[id]); }).join('\n') +
      '\n\nToplam: '+tl(yi.total) +
      '\n\nNot: Onaylanmış ve kısmi ödemelerden hesaplanmıştır. Beyan için mali müşavirinize danışın.';
    openText('Beyanname özeti', body);
  },

  exportCsv: () => {
    const rows = [['Ev','Ay','Durum','Tutar','Ödeme tarihi']];
    S.order.forEach(id => {
      const p = P(id);
      Object.keys(p.pay).sort().forEach(k => {
        const r = p.pay[k];
        rows.push([p.name, k, r.status, r.amount != null ? r.amount : p.rent, r.date || '']);
      });
    });
    const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\n');
    download('evim-kira-gecmisi.csv', '﻿'+csv, 'text/csv;charset=utf-8');
    notify({ title:'CSV indirildi', body:'Kira geçmişi dosyası hazırlandı.', icon:'chart' }, false);
  },

  exportData: () => {
    download('evim-verileri.json', JSON.stringify(S, null, 2));
    notify({ title:'Veriler indirildi', body:'JSON dosyasını içe aktararak geri yükleyebilirsin.', icon:'doc' }, false);
  },

  copyText: async () => {
    const t = document.getElementById('txtOut');
    try {
      await navigator.clipboard.writeText(t.value);
      notify({ title:'Kopyalandı', body:'Metin panoya alındı.', icon:'doc' }, false);
    } catch(e){
      t.select();
      notify({ title:'Kopyalanamadı', body:'Metin seçildi; Ctrl/Cmd + C ile kopyalayabilirsin.', icon:'doc' }, false);
    }
  },

  downloadText: () => {
    const t = ui.text || { title:'metin', body:'' };
    download(t.title.toLocaleLowerCase('tr-TR').replace(/\s+/g,'-')+'.txt', t.body, 'text/plain;charset=utf-8');
  },

  /* ---- bildirim, tema, veri ---- */
  clearInbox: () => { S.inbox = []; save(); render(); },

  theme: d => { setTheme(d.v); render(); },

  reset: () => {
    if (!confirm('Demo verisi sıfırlansın mı? Girdiğin her şey silinir.')) return;
    resetState();
    go('/kiraci', { replace:true });
    render();
    notify({ title:'Sıfırlandı', body:'Demo verisi yeniden yüklendi.', icon:'home' }, false);
  },

  removeProp: d => {
    if (!confirm('Bu ev portföyden kaldırılsın mı?')) return;
    delete S.props[d.pid];
    S.order = S.order.filter(x => x !== d.pid);
    if (S.myHome === d.pid) S.myHome = S.order[0];
    save();
    go('/ev-sahibi', { replace:true });
    render();
  },

  preview: d => {
    closeSheet();
    const moda = P('moda') || P(S.order[0]);
    const cih = P('cihangir') || P(S.order[0]);
    const map = {
      rent:{ title:'Kira günü yaklaşıyor', body: monthYear(period(moda).key)+' kirası yaklaşıyor. Ödeyince dekontu yükle.', icon:'card',
             actions:[{ label:'Ödemelere git', run:() => go('/kiraci/odemeler') }] },
      reqUpd:{ title:'Talebin güncellendi', body:'Kombi basıncı düşüyor → Usta çağrıldı. Masraf ev sahibinde.', icon:'wrench',
             actions:[{ label:'Talebi aç', run:() => go('/kiraci/talepler') }] },
      renew:{ title:'Yenileme teklifi geldi', body:'Ev sahibin yeni dönem için teklif gönderdi. Yasal üst sınırla karşılaştırarak incele.', icon:'card',
             actions:[{ label:'İncele', run:() => go('/kiraci/odemeler') }] },
      evict:{ title:'Tahliye tarihi yaklaşıyor', body:'Taahhütnamedeki tarihe yaklaşıldı.', icon:'doc',
             actions:[{ label:'Belgeler', run:() => go('/kiraci/belgeler') }] },
      receipt:{ title:cih.name+': dekont geldi', body:'Bu ayın kirası için dekont yüklendi. Onayını bekliyor.', icon:'card',
             actions:[{ label:'Onayla', run:() => go('/ev-sahibi/ev/'+cih.id+'/odeme') }] },
      late:{ title:'Kira gecikti', body:'Bu ayın kirası henüz ödenmedi. Nazik bir hatırlatma gönderebilirsin.', icon:'card',
             actions:[{ label:'Portföye git', run:() => go('/ev-sahibi') }] },
      newReq:{ title:cih.name+': yeni talep', body:'Banyo aspiratörü değişimi · fotoğraf ekli.', icon:'wrench',
             actions:[{ label:'Talebi aç', run:() => go('/ev-sahibi/ev/'+cih.id+'/talep') }] },
      dask:{ title:'DASK yenileme', body:cih.name+' poliçesi '+daysTo(cih.dask)+' gün içinde bitiyor.', icon:'doc',
             actions:[{ label:'Belgelere git', run:() => go('/ev-sahibi/ev/'+cih.id+'/belge') }] }
    };
    notify(map[d.v]);
  },

  /* ---- tur ---- */
  startTour: () => { startTour(); closeSheet(); tourGo(); render(); },
  tourNext: () => { nextStep(); tourGo(); render(); },
  tourPrev: () => { prevStep(); tourGo(); render(); },
  tourEnd: () => { endTour(); render(); }
};

function openText(title, body){
  ui.text = { title, body };
  openSheet('metin');
}

/* ---------------- formlar ---------------- */

export async function onSubmit(ev){
  const f = ev.target.closest('[data-form]');
  if (!f) return;
  ev.preventDefault();

  const fd = new FormData(f);
  const type = f.dataset.form;
  const p = f.dataset.pid ? P(f.dataset.pid) : null;

  if (type === 'msg'){
    const text = String(fd.get('text') || '').trim();
    if (!text) return;
    p.msgs.push({ from: ui.role, text, at: Date.now() });
    save(); render();
    document.getElementById('msgIn')?.focus();
    if (ui.role === 'tenant'){
      setTimeout(() => {
        p.msgs.push({ from:'landlord', text:'Tamam, not aldım.', at: Date.now() });
        save();
        if (current().tab === 'msg') render();
        notify({ title:p.landlord.name, body:'Tamam, not aldım.', icon:'chat' }, false);
      }, 2500);
    }
    return;
  }

  if (type === 'newReq'){
    const files = [...(f.querySelector('input[type=file]').files || [])];
    const shots = [];
    for (const file of files.slice(0, 4)){
      try { shots.push(await shrink(file, 720)); } catch(e){ /* görsel değilse atla */ }
    }
    const r = {
      id:'r'+Date.now(), cat:fd.get('cat'), title:String(fd.get('title')).trim(),
      desc:String(fd.get('desc') || '').trim(), urgency:fd.get('urgency'),
      status:0, cost:'Belirlenmedi', costOk:false, decision:null,
      date: iso(t0()), photos:0, shots,
      log:[{ at:Date.now(), text:'Talep açıldı' }]
    };
    p.requests.unshift(r);
    sysMsg(p, 'Yeni talep açıldı: '+r.title);
    save();
    go(ui.role === 'tenant' ? '/kiraci/talepler' : '/ev-sahibi/ev/'+p.id+'/talep', { replace:true });
    render();
    notify({ title:'Talep gönderildi', body:'Ev sahibine bildirildi. Durum değiştikçe haber vereceğiz.', icon:'wrench' });
    return;
  }

  if (type === 'pay'){
    const key = f.dataset.key;
    const file = f.querySelector('input[type=file]').files[0];
    if (!file) return;
    const amount = Math.max(0, Number(fd.get('amount')) || 0);
    const prev = p.pay[key];
    const already = prev && prev.status === 'partial' ? Number(prev.amount) || 0 : 0;
    const total = already + amount;

    const rec = {
      status: total < p.rent ? 'partial' : 'review',
      date: String(fd.get('date') || iso(t0())),
      amount: total,
      receipt: file.name,
      note: String(fd.get('note') || '').trim() || undefined
    };
    try { rec.photo = await shrink(file, 900); } catch(e){ /* PDF: görsel yok */ }

    p.pay[key] = rec;
    sysMsg(p, monthYear(key)+' kirası için dekont yüklendi'+(rec.status === 'partial' ? ' (kısmi: '+tl(total)+')' : ''));
    save();
    closeSheet();
    render();
    notify({
      title: rec.status === 'partial' ? 'Kısmi ödeme kaydedildi' : 'Dekont yüklendi',
      body: rec.status === 'partial'
        ? tl(p.rent - total)+' bakiye görünüyor; kalanı yükleyince onaya gider.'
        : 'Ev sahibinin onayı bekleniyor. Onaylanınca haber vereceğiz.',
      icon:'card'
    });
    return;
  }

  if (type === 'reject'){
    const key = f.dataset.key, rec = p.pay[key];
    if (!rec) return;
    const note = String(fd.get('note') || '').trim();
    rec.status = 'rejected';
    rec.rejectReason = String(fd.get('reason')) + (note ? ' · '+note : '');
    sysMsg(p, monthYear(key)+' dekontu reddedildi: '+rec.rejectReason);
    save();
    closeSheet();
    render();
    notify({ title:'Dekont reddedildi', body:'Kiracıya gerekçe iletildi.', icon:'card' });
    return;
  }

  if (type === 'upload'){
    const file = f.querySelector('input[type=file]').files[0];
    if (!file) return;
    const until = fd.get('until');
    const cat = fd.get('cat');
    p.docs.push({ id:'d'+Date.now(), cat, name:file.name, at: iso(t0()), until: until || undefined });
    if (cat === 'DASK poliçesi' && until) p.dask = until;
    sysMsg(p, cat+' yüklendi: '+file.name);
    save();
    closeSheet();
    render();
    notify({ title:'Belge yüklendi', body: cat + (until ? ' · '+fmtFull(parse(until))+' için hatırlatma kuruldu' : ''), icon:'doc' });
    return;
  }

  if (type === 'room'){
    const n = String(fd.get('n') || '').trim();
    if (!n) return;
    p.inspect.rooms.push({ n, photos:0, shots:[], note:'' });
    p.inspect.tenantOk = false;
    p.inspect.landlordOk = false;
    save(); render();
    return;
  }

  if (type === 'addProp'){
    const id = 'p'+Date.now(), t = t0();
    const name = String(fd.get('name')).trim();
    S.props[id] = {
      id, name, addr:String(fd.get('addr')).trim(),
      tenant:{ name:'Davet bekleniyor', phone:String(fd.get('phone') || '') },
      landlord: P(S.order[0]).landlord,
      rent: Number(fd.get('rent')) || 0, dueDay: Number(fd.get('due')) || 1,
      aidat:0, aidatPayer:'Kiracı', deposit:0, depositNote:'—',
      startDate: iso(t), contractEnd: iso(new Date(t.getFullYear()+1, t.getMonth(), t.getDate())), dask: iso(new Date(t.getFullYear()+1, t.getMonth(), t.getDate())),
      bills:[], pay:{}, requests:[], msgs:[], docs:[],
      inspect:{ tenantOk:false, landlordOk:false, rooms:[{ n:'Salon', photos:0, shots:[], note:'' }] },
      renewal:null
    };
    S.order.push(id);
    save();
    go('/ev-sahibi/ev/'+id, { replace:true });
    render();

    const ph = String(fd.get('phone') || '').replace(/\D/g, '');
    notify({
      title:'Ev eklendi', body:'Kiracıya davet linkini gönder.', icon:'home',
      actions:[{ label:'WhatsApp ile davet et', run:() => {
        const num = ph ? '9' + ph.replace(/^9/, '') : '';
        window.open('https://wa.me/'+num+'?text='+encodeURIComponent('Merhaba, '+name+' için Evim’de ortak panelimize katılır mısın? [davet linki]'), '_blank', 'noopener');
      } }]
    });
    return;
  }

  if (type === 'editProp'){
    p.name = String(fd.get('name')).trim();
    p.addr = String(fd.get('addr')).trim();
    p.rent = Number(fd.get('rent')) || p.rent;
    p.dueDay = Math.min(28, Math.max(1, Number(fd.get('due')) || p.dueDay));
    p.aidat = Number(fd.get('aidat')) || 0;
    p.aidatPayer = fd.get('aidatPayer');
    p.deposit = Number(fd.get('deposit')) || 0;
    if (fd.get('contractEnd')) p.contractEnd = String(fd.get('contractEnd'));
    if (fd.get('dask')) p.dask = String(fd.get('dask'));
    p.tenant.name = String(fd.get('tenantName') || p.tenant.name);
    p.tenant.phone = String(fd.get('tenantPhone') || p.tenant.phone);
    save();
    closeSheet();
    render();
    notify({ title:'Kaydedildi', body:p.name+' bilgileri güncellendi.', icon:'home' }, false);
  }
}

/* ---------------- anlık alan değişiklikleri ---------------- */

export function onInput(ev){
  const d = ev.target.dataset || {};
  const n = d.input;
  if (!n) return;

  if (n === 'q'){
    ui.q = ev.target.value;
    const pos = ev.target.selectionStart;
    refreshLayer();
    const again = document.getElementById('searchIn');
    if (again){ again.focus(); try { again.setSelectionRange(pos, pos); } catch(e){} }
    return;
  }

  if (n === 'cpi' || n === 'amount'){
    const route = current();
    const p = P(route.params.pid || route.pid || S.myHome);
    ui.renewal[n] = ev.target.value === '' ? null : Number(ev.target.value);
    const out = document.getElementById('maxOut');
    if (!out) return;

    if (ui.renewal.cpi == null){
      out.innerHTML = 'Oranı girince yasal üst sınır burada görünür.';
    } else {
      const max = Math.round(p.rent * (1 + ui.renewal.cpi/100));
      if (n === 'cpi'){
        out.innerHTML = 'Yasal üst sınır: <b>'+tl(max)+'</b> (+'+tl(max - p.rent)+')';
        const am = document.querySelector('[data-input="amount"]');
        if (am && !ui.renewal.amount) am.value = max;
      } else if (ui.renewal.amount > max){
        out.innerHTML = 'Önerdiğin tutar yasal üst sınırı ('+tl(max)+') aşıyor; teklif sınırla gönderilir.';
      } else {
        out.innerHTML = 'Yasal üst sınır: <b>'+tl(max)+'</b> (+'+tl(max - p.rent)+')';
      }
    }
    const sb = document.querySelector('[data-act="sendRenewal"]');
    if (sb) sb.disabled = ui.renewal.cpi == null;
    return;
  }

  if (n === 'roomNote'){
    P(d.pid).inspect.rooms[Number(d.i)].note = ev.target.value;
    save();
  }
}

export async function onChangeField(ev){
  const d = ev.target.dataset || {};
  const n = d.input;
  if (!n) return;

  if (n === 'cost'){
    const p = P(d.pid), r = reqOf(p, d.id);
    r.cost = ev.target.value;
    r.costOk = false;
    logReq(r, 'Masraf önerisi: '+r.cost);
    sysMsg(p, 'Masraf önerisi: '+r.cost+' ('+r.title+')');
    save(); render();
    return;
  }

  if (n === 'set'){
    S.settings[d.k] = Math.max(0, Number(ev.target.value) || 0);
    save(); render();
    return;
  }

  if (n === 'setb'){
    S.settings[d.k] = ev.target.checked;
    save();
    return;
  }

  if (n === 'roomPhoto'){
    const files = [...(ev.target.files || [])];
    if (!files.length) return;
    const room = P(d.pid).inspect.rooms[Number(d.i)];
    room.shots = room.shots || [];
    for (const file of files.slice(0, 6)){
      try { room.shots.push(await shrink(file, 720)); } catch(e){ /* atla */ }
    }
    P(d.pid).inspect.tenantOk = false;
    P(d.pid).inspect.landlordOk = false;
    const ok = save();
    render();
    if (!ok) notify({ title:'Yer kalmadı', body:'Tarayıcı depolaması doldu; fotoğraflar kaydedilemedi.', icon:'cam' }, false);
    return;
  }

  if (n === 'importData'){
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.v !== VERSION || !parsed.props || !parsed.order) throw new Error('bad');
      replaceState(parsed);
      go('/kiraci', { replace:true });
      render();
      notify({ title:'Veri yüklendi', body:'Dosyadaki durum geri yüklendi.', icon:'doc' }, false);
    } catch(e){
      notify({ title:'Dosya okunamadı', body:'Bu dosya Evim verisi gibi görünmüyor.', icon:'doc' }, false);
    }
    ev.target.value = '';
  }
}
