/* Etkileşimler: tıklama, form ve alan değişiklikleri. */

import { S, ui, save, reset as resetState, replaceState, setTheme, seed, VERSION, STEPS } from './state.js';
import { go, openSheet, closeSheet, current, setParams } from './router.js';
import {
  P, period, statusOf, remaining, yearIncome, monthCollection, rentAt, normalize, tenantsLabel,
  meTenant, senderName, unpaid, moveOutSummary, yearNumbers, sum
} from './logic.js';
import { estimate } from './tax.js';
import { render, refreshLayer } from './render.js';
import { notify } from './notify.js';
import { ask } from './confirm.js';
import { migrate } from './migrate.js';
import { install } from './pwa.js';
import { LIVE } from './config.js';
import * as backend from './backend.js';
import { AUTH_ACTIONS, AUTH_FORMS, authSubmit } from './auth.js';
import { startTour, nextStep, prevStep, endTour, TOUR } from './tour.js';
import {
  iso, t0, parse, fmt, fmtFull, monthYear, tl, daysTo, shrink, download, esc, announce, uid
} from './util.js';

/** Mesaja kimlik verir; sunucu mesajları kimlikle eşleştirir. */
function pushMsg(p, m){ p.msgs.push(Object.assign({ id: uid('m') }, m)); }
function sysMsg(p, text){ pushMsg(p, { from:'system', text, at:Date.now() }); }
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
  sheet: d => {
    openSheet(d.s, { pid:d.pid, key:d.key, cat:d.cat, id:d.id });
    if (d.s === 'hesap'){
      ui.authMsg = null;
      backend.pushState().then(st => { ui.pushState = st; refreshLayer(); }).catch(() => {});
    }
  },

  copyInvite: async () => {
    const el = document.getElementById('inviteLink');
    try { await navigator.clipboard.writeText(el.value); notify({ title:'Kopyalandı', body:'Davet bağlantısı panoya alındı.', icon:'doc' }, false); }
    catch(e){ el.select(); }
  },
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
    pushMsg(p, {
      from:'landlord',
      text:'Merhaba, '+monthYear(per.key)+' kirası için hatırlatma. Ödediysen dekontu uygulamaya yükleyebilir misin? Teşekkürler.',
      at: Date.now()
    });
    save(); render();
    notify({ title:'Hatırlatma gönderildi', body:tenantsLabel(p)+' için nazik bir mesaj iletildi.', icon:'chat' });
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
    // Yeni tutar sözleşme bitişinden itibaren geçerli; kira geçmişine yazılır.
    p.rentHistory = (p.rentHistory || []).filter(h => h.from !== p.contractEnd);
    p.rentHistory.push({ from:p.contractEnd, amount:p.renewal.amount, note:'Yenileme · TÜFE %'+p.renewal.cpi });
    normalize(p);
    sysMsg(p, 'Yenileme teklifi kabul edildi: '+tl(p.renewal.amount));
    save(); render();
    notify({ title:'Teklifi kabul ettin', body:'Yeni kira '+fmtFull(parse(p.contractEnd))+' itibarıyla '+tl(p.renewal.amount)+'.', icon:'card' });
  },

  cancelRenewal: async d => {
    if (!await ask({ title:'Teklif geri çekilsin mi?', body:'Kiracı artık teklifi göremez.', ok:'Geri çek' })) return;
    const p = P(d.pid);
    p.renewal = null;
    sysMsg(p, 'Yenileme teklifi geri çekildi');
    save(); render();
  },

  /* ---- belgeler ve tutanak ---- */
  removeDoc: async d => {
    const p = P(d.pid);
    const doc = p.docs.find(x => x.id === d.id);
    if (!doc) return;
    if (!await ask({ title:'Belge silinsin mi?', body:'“'+doc.name+'” kalıcı olarak kaldırılır.', ok:'Sil', danger:true })) return;
    p.docs = p.docs.filter(x => x.id !== d.id);
    save(); render();
  },

  removeRoom: async d => {
    const p = P(d.pid);
    const room = p.inspect.rooms[Number(d.i)];
    if (!room) return;
    if (!await ask({ title:room.n+' silinsin mi?', body:'Odanın notu ve fotoğrafları silinir; tutanak onayları sıfırlanır.', ok:'Sil', danger:true })) return;
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
      new Date(m.at).toLocaleString('tr-TR')+' · '+senderName(p, m)+': '+m.text).join('\n');
    openText('Yazışma dökümü', body);
  },

  shareReport: () => {
    const year = String(ui.reportYear || new Date().getFullYear());
    const yn = yearNumbers(year);
    const e = estimate(yn.gross, yn.exp, { year:Number(year), noExemption:!!ui.noExemption });
    const body = year+' yılı konut kira geliri özeti\n\n' +
      yn.rows.map(r => { const p = P(r.id); return p.name+' ('+p.addr+')\n  Tahsil edilen: '+tl(r.gross)+'  ·  Giderler: '+tl(r.exp); }).join('\n') +
      '\n\nToplam tahsil edilen: '+tl(yn.gross) +
      '\nToplam belgeli gider: '+tl(yn.exp) +
      '\nİstisna ('+e.rates.year+'): '+(ui.noExemption ? 'uygulanmıyor' : tl(e.istisna)) +
      (e.belowExemption ? '\n\nGelir istisna tutarının altında.' :
        '\n\nTahmini vergi — götürü gider: '+tl(e.goturu.tax)+' · gerçek gider: '+tl(e.gercek.tax) +
        '\nDaha avantajlı yöntem: '+(e.best === 'gercek' ? 'gerçek gider' : 'götürü gider')) +
      (e.rates.approx ? '\n\nUyarı: '+year+' oranları eklenmediği için '+e.rates.year+' oranları kullanıldı.' : '') +
      '\n\nNot: Onaylanmış ve kısmi ödemelerden hesaplanmıştır. Tahmindir; beyan için mali müşavirinize danışın.';
    openText('Beyanname özeti', body);
  },

  exportCsv: () => {
    const rows = [['Tür','Ev','Dönem / tarih','Durum / kategori','Tutar','Açıklama']];
    S.order.forEach(id => {
      const p = P(id);
      Object.keys(p.pay).sort().forEach(k => {
        const r = p.pay[k];
        rows.push(['Ödeme', p.name, k, r.status, r.amount != null ? r.amount : rentAt(p, k), r.date || '']);
      });
      (p.expenses || []).slice().sort((a, b) => a.date < b.date ? -1 : 1).forEach(e => {
        rows.push(['Gider', p.name, e.date, e.cat, e.amount, e.note || '']);
      });
    });
    const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\n');
    download('evim-kayitlar.csv', '\uFEFF'+csv, 'text/csv;charset=utf-8');
    notify({ title:'CSV indirildi', body:'Ödemeler ve giderler dosyası hazırlandı.', icon:'chart' }, false);
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
  clearInbox: () => { S.inbox = []; save(); backend.clearInboxRemote(); render(); },

  theme: d => { setTheme(d.v); render(); },

  reset: async () => {
    if (!await ask({ title:'Demo sıfırlansın mı?', body:'Girdiğin her şey silinir ve örnek veri yeniden yüklenir.', ok:'Sıfırla', danger:true })) return;
    resetState();
    go('/kiraci', { replace:true });
    render();
    notify({ title:'Sıfırlandı', body:'Demo verisi yeniden yüklendi.', icon:'home' }, false);
  },

  removeProp: async d => {
    const name = P(d.pid)?.name || 'Bu ev';
    if (!await ask({ title:name+' kaldırılsın mı?', body:'Evin ödemeleri, talepleri, mesajları ve belgeleri de silinir.', ok:'Kaldır', danger:true })) return;
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

  /* ---- kiracılar ---- */
  removeTenant: async d => {
    const p = P(d.pid);
    const t = p.tenants.find(x => x.id === d.id);
    if (!t) return;
    if (!await ask({ title:t.name+' evden çıkarılsın mı?', body:'Bu kiracı artık evin ödemelerini, taleplerini ve yazışmalarını göremez. Geçmiş kayıtlar korunur.', ok:'Çıkar', danger:true })) return;
    if (LIVE){
      try {
        if (t.pending) await backend.deleteInvite(p.id, t.code);
        else await backend.removeMember(p.id, t.id);
        render();
      } catch(e){ notify({ title:'İşlem yapılamadı', body: backend.humanError(e), icon:'home' }, false); }
      return;
    }
    p.tenants = p.tenants.filter(x => x.id !== d.id);
    sysMsg(p, t.name+' evden çıkarıldı');
    save(); render();
  },

  /* ---- teklifler ---- */
  chooseQuote: d => {
    const p = P(d.pid), r = reqOf(p, d.id);
    r.quotes.forEach(q => { q.chosen = q.id === d.q; });
    const q = r.quotes.find(x => x.chosen);
    logReq(r, 'Teklif seçildi: '+q.vendor+' · '+tl(q.amount));
    sysMsg(p, 'Talep için usta seçildi: '+q.vendor+' ('+tl(q.amount)+') · '+r.title);
    if (r.status < 2){ r.status = 2; logReq(r, 'Durum: '+STEPS[2]); }
    save(); render();
    notify({ title:'Usta seçildi', body:q.vendor+' · '+tl(q.amount)+'. Kiracıya bildirildi.', icon:'wrench' });
  },

  removeQuote: d => {
    const p = P(d.pid), r = reqOf(p, d.id);
    r.quotes = r.quotes.filter(q => q.id !== d.q);
    save(); render();
  },

  /* ---- giderler ---- */
  removeExpense: async d => {
    const p = P(d.pid);
    const e = p.expenses.find(x => x.id === d.id);
    if (!e) return;
    if (!await ask({ title:'Gider silinsin mi?', body:e.cat+' · '+tl(e.amount), ok:'Sil', danger:true })) return;
    p.expenses = p.expenses.filter(x => x.id !== d.id);
    // Talep faturasına bağlıysa bağlantıyı kopar.
    p.requests.forEach(r => { if (r.invoice && r.invoice.expenseId === d.id) r.invoice.expenseId = null; });
    save(); closeSheet(); render();
  },

  /* ---- çıkış ---- */
  addUnpaidDeduction: d => {
    const p = P(d.pid), due = unpaid(p);
    if (!due.total) return;
    p.moveOut.deductions.push({
      id:uid('k'), kind:'rent', label:'Ödenmemiş kira', amount:due.total,
      note: due.months.map(m => monthYear(m.key)+' '+tl(m.owed)).join(', ')
    });
    resetMoveOutApprovals(p);
    save(); render();
  },

  removeDeduction: d => {
    const p = P(d.pid);
    p.moveOut.deductions = p.moveOut.deductions.filter(x => x.id !== d.id);
    resetMoveOutApprovals(p);
    save(); render();
  },

  removeExitShot: d => {
    const p = P(d.pid);
    p.moveOut.rooms[Number(d.i)].shots.splice(Number(d.j), 1);
    resetMoveOutApprovals(p);
    save(); render();
  },

  approveMoveOut: d => {
    const p = P(d.pid), mo = p.moveOut;
    if (ui.role === 'tenant') mo.tenantOk = true; else mo.landlordOk = true;
    const both = mo.tenantOk && mo.landlordOk;
    sysMsg(p, 'Çıkış hesabı '+(ui.role === 'tenant' ? 'kiracı' : 'ev sahibi')+' tarafından onaylandı'+(both ? ' · iade: '+tl(moveOutSummary(p).refund) : ''));
    save(); render();
    notify({ title:'Çıkış hesabı onaylandı', body: both ? 'İki taraf da onayladı; iade tutarı kesinleşti.' : 'Karşı tarafın onayı bekleniyor.', icon:'key' });
  },

  cancelMoveOut: async d => {
    if (!await ask({ title:'Çıkış süreci iptal edilsin mi?', body:'Çıkış notları, fotoğraflar ve kesintiler silinir.', ok:'İptal et', danger:true })) return;
    const p = P(d.pid);
    p.moveOut = null;
    sysMsg(p, 'Çıkış süreci iptal edildi');
    save(); render();
  },

  exportMoveOut: d => {
    const p = P(d.pid), mo = p.moveOut, sm = moveOutSummary(p);
    const body = p.name+' · '+p.addr+'\nÇıkış raporu'+(mo.date ? ' · '+fmtFull(parse(mo.date)) : '')+'\n' +
      'Kiracı: '+tenantsLabel(p)+'\n\n' +
      'ODALAR\n' + mo.rooms.map(r => {
        const entry = p.inspect.rooms.find(x => x.n === r.n);
        return '- '+r.n+': '+(r.condition || 'değerlendirilmedi') +
          '\n    Giriş: '+(entry ? (entry.note || 'not yok') : 'kayıt yok') +
          '\n    Çıkış: '+(r.note || 'not yok')+' · '+(r.shots || []).length+' fotoğraf';
      }).join('\n') +
      '\n\nKESİNTİLER\n' + (mo.deductions.length ? mo.deductions.map(x => '- '+x.label+': '+tl(x.amount)+(x.note ? ' ('+x.note+')' : '')).join('\n') : '- yok') +
      '\n\nDepozito: '+tl(sm.deposit)+'\nKesinti toplamı: '+tl(sm.deducted)+'\nİade: '+tl(sm.refund) +
      (sm.extra ? '\nKiracıdan ayrıca talep: '+tl(sm.extra) : '') +
      '\n\nKiracı onayı: '+(mo.tenantOk ? 'var' : 'yok')+'\nEv sahibi onayı: '+(mo.landlordOk ? 'var' : 'yok') +
      (mo.refunded ? '\nİade yapıldı: '+tl(mo.refunded.amount)+' · '+fmtFull(parse(mo.refunded.date)) : '');
    openText('Çıkış raporu', body);
  },

  install: async () => { await install(); render(); },

  /* ---- tur ---- */
  startTour: () => { startTour(); closeSheet(); tourGo(); render(); },
  tourNext: () => { nextStep(); tourGo(); render(); },
  tourPrev: () => { prevStep(); tourGo(); render(); },
  tourEnd: () => { endTour(); render(); }
};

/** Bir kalem değişince iki tarafın da yeniden onaylaması gerekir. */
function resetMoveOutApprovals(p){
  if (!p.moveOut) return;
  p.moveOut.tenantOk = false;
  p.moveOut.landlordOk = false;
}

Object.assign(A, AUTH_ACTIONS);

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

  if (AUTH_FORMS.includes(type)) return authSubmit(type, fd, f);

  if (type === 'msg'){
    const text = String(fd.get('text') || '').trim();
    if (!text) return;
    pushMsg(p, { from: ui.role, by: ui.role === 'tenant' ? meTenant(p)?.id : undefined, text, at: Date.now() });
    save(); render();
    document.getElementById('msgIn')?.focus();
    if (!LIVE && ui.role === 'tenant'){
      setTimeout(() => {
        pushMsg(p, { from:'landlord', text:'Tamam, not aldım.', at: Date.now() });
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
      const v = await backend.storeFile(p.id, file, { maxSide:720 });
      if (v) shots.push(v);
    }
    const r = {
      id:uid('r'), cat:fd.get('cat'), title:String(fd.get('title')).trim(),
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
    const due = rentAt(p, key);

    const rec = {
      status: total < due ? 'partial' : 'review',
      date: String(fd.get('date') || iso(t0())),
      amount: total,
      receipt: file.name,
      note: String(fd.get('note') || '').trim() || undefined
    };
    // Görsel küçültülür; gerçek hesapta PDF dahil dosya depoya yüklenir.
    const stored = await backend.storeFile(p.id, file);
    if (stored) rec.photo = stored;

    p.pay[key] = rec;
    sysMsg(p, monthYear(key)+' kirası için dekont yüklendi'+(rec.status === 'partial' ? ' (kısmi: '+tl(total)+')' : ''));
    save();
    closeSheet();
    render();
    notify({
      title: rec.status === 'partial' ? 'Kısmi ödeme kaydedildi' : 'Dekont yüklendi',
      body: rec.status === 'partial'
        ? tl(due - total)+' bakiye görünüyor; kalanı yükleyince onaya gider.'
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
    const path = LIVE ? await backend.storeFile(p.id, file) : null;
    p.docs.push(Object.assign({ id:uid('d'), cat, name:file.name, at: iso(t0()), until: until || undefined }, path ? { path } : {}));
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
    const id = uid('p'), t = t0();
    const name = String(fd.get('name')).trim();
    const rent = Number(fd.get('rent')) || 0;
    const phone = String(fd.get('phone') || '');
    S.props[id] = {
      id, name, addr:String(fd.get('addr')).trim(),
      // Gerçek hesapta kiracı davetle katılır; demoda yer tutucu eklenir.
      tenants: LIVE ? [] : [{ id:uid('t'), name:'Davet bekleniyor', phone, email:'' }],
      landlord: LIVE ? { name: backend.live.profile?.name || 'Ev sahibi', phone: backend.live.profile?.phone || '' } : (S.order.length ? P(S.order[0]).landlord : { name:'Ev sahibi', phone:'' }),
      ownerId: LIVE ? backend.live.user?.id : undefined,
      rent, dueDay: Number(fd.get('due')) || 1,
      rentHistory:[{ from: iso(t), amount: rent, note:'Sözleşme başlangıcı' }],
      expenses:[], value:null, moveOut:null,
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

    if (LIVE){
      // Ev sunucuya yazılınca kiracı için davet kodu üretilir.
      try {
        const code = await backend.createInvite(id, { name:'', email:'', phone });
        openSheet('davet-paylas', { pid:id, code });
      } catch(e){ notify({ title:'Davet oluşturulamadı', body: backend.humanError(e), icon:'home' }, false); }
      return;
    }

    const ph = phone.replace(/\D/g, '');
    notify({
      title:'Ev eklendi', body:'Kiracıya davet linkini gönder.', icon:'home',
      actions:[{ label:'WhatsApp ile davet et', run:() => {
        const num = ph ? '9' + ph.replace(/^9/, '') : '';
        window.open('https://wa.me/'+num+'?text='+encodeURIComponent('Merhaba, '+name+' için Evim’de ortak panelimize katılır mısın? [davet linki]'), '_blank', 'noopener');
      } }]
    });
    return;
  }

  if (type === 'addTenant'){
    const name = String(fd.get('name')).trim();
    const email = String(fd.get('email') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    if (LIVE){
      try {
        const code = await backend.createInvite(p.id, { name, email, phone });
        closeSheet();
        setTimeout(() => openSheet('davet-paylas', { pid:p.id, code }), 60);
      } catch(e){ notify({ title:'Davet oluşturulamadı', body: backend.humanError(e), icon:'home' }, false); }
      return;
    }
    p.tenants.push({ id:uid('t'), name, email, phone });
    sysMsg(p, name+' eve kiracı olarak eklendi');
    save(); closeSheet(); render();
    setTimeout(() => openSheet('davet-paylas', { pid:p.id, code:'DEMO' + String(Math.floor(Math.random() * 9000) + 1000) }), 60);
    return;
    const digits = phone.replace(/\D/g, '');
    notify({
      title:'Kiracı eklendi',
      body: email ? name+' için davet '+email+' adresine gönderilecek.' : name+' eklendi. Davet bağlantısını paylaşabilirsin.',
      icon:'home',
      actions: digits ? [{ label:'WhatsApp ile davet et', run:() => window.open('https://wa.me/9'+digits.replace(/^9/, '')+'?text='+encodeURIComponent('Merhaba, '+p.name+' için Evim’de ortak panelimize katılır mısın? [davet linki]'), '_blank', 'noopener') }] : undefined
    });
    return;
  }

  if (type === 'quote'){
    const r = reqOf(p, f.dataset.id);
    const q = { id:uid('q'), vendor:String(fd.get('vendor')).trim(), phone:String(fd.get('phone') || '').trim(),
      amount:Number(fd.get('amount')) || 0, note:String(fd.get('note') || '').trim(), chosen:false };
    r.quotes = r.quotes || [];
    r.quotes.push(q);
    logReq(r, 'Teklif eklendi: '+q.vendor+' · '+tl(q.amount));
    save(); closeSheet(); render();
    return;
  }

  if (type === 'invoice'){
    const r = reqOf(p, f.dataset.id);
    const amount = Number(fd.get('amount')) || 0;
    const date = String(fd.get('date'));
    const file = f.querySelector('input[type=file]').files[0];
    let expenseId = null;
    if (fd.get('toExpense') && r.cost !== 'Kiracı'){
      expenseId = uid('e');
      p.expenses = p.expenses || [];
      p.expenses.push({
        id:expenseId, cat:'Tamir ve bakım', amount: r.cost === 'Paylaşımlı' ? Math.round(amount / 2) : amount,
        date, note: r.title + (r.cost === 'Paylaşımlı' ? ' (yarı pay)' : ''), reqId:r.id
      });
    }
    const path = file && LIVE ? await backend.storeFile(p.id, file) : null;
    r.invoice = Object.assign({ amount, date, name: file ? file.name : 'fatura', expenseId }, path ? { path } : {});
    logReq(r, 'Fatura işlendi: '+tl(amount));
    sysMsg(p, 'Talep faturası: '+r.title+' · '+tl(amount));
    save(); closeSheet(); render();
    notify({ title:'Fatura kaydedildi', body: expenseId ? 'Gider defterine de işlendi.' : 'Gider defterine eklenmedi.', icon:'doc' }, false);
    return;
  }

  if (type === 'expense'){
    p.expenses = p.expenses || [];
    const data = { cat:String(fd.get('cat')), amount:Number(fd.get('amount')) || 0, date:String(fd.get('date')), note:String(fd.get('note') || '').trim() };
    const id = f.dataset.id;
    if (id) Object.assign(p.expenses.find(e => e.id === id), data);
    else p.expenses.push(Object.assign({ id:uid('e') }, data));
    ui.expenseYear = data.date.slice(0, 4);
    save(); closeSheet(); render();
    notify({ title: id ? 'Gider güncellendi' : 'Gider eklendi', body:data.cat+' · '+tl(data.amount), icon:'chart' }, false);
    return;
  }

  if (type === 'startMoveOut'){
    p.moveOut = {
      started: Date.now(), date: String(fd.get('date')),
      rooms: p.inspect.rooms.map(r => ({ n:r.n, note:'', shots:[], condition:'' })),
      deductions: [], tenantOk:false, landlordOk:false, refunded:null
    };
    sysMsg(p, 'Çıkış süreci başlatıldı · '+fmtFull(parse(p.moveOut.date)));
    save(); closeSheet(); render();
    notify({ title:'Çıkış süreci başladı', body:'Odaları birlikte değerlendirip kesintileri onaylayın.', icon:'key' });
    return;
  }

  if (type === 'deduction'){
    p.moveOut.deductions.push({ id:uid('k'), label:String(fd.get('label')).trim(), amount:Number(fd.get('amount')) || 0, note:String(fd.get('note') || '').trim() });
    resetMoveOutApprovals(p);
    save(); closeSheet(); render();
    return;
  }

  if (type === 'refund'){
    const amount = Number(fd.get('amount')) || 0, date = String(fd.get('date'));
    p.moveOut.refunded = { amount, date };
    sysMsg(p, 'Depozito iadesi yapıldı: '+tl(amount));
    save(); closeSheet(); render();
    notify({ title:'İade kaydedildi', body:tl(amount)+' · '+fmtFull(parse(date))+'. Kiracıya bildirildi.', icon:'key' });
    return;
  }

  if (type === 'editProp'){
    p.name = String(fd.get('name')).trim();
    p.addr = String(fd.get('addr')).trim();
    const newRent = Number(fd.get('rent')) || p.rent;
    if (newRent !== p.rent){
      const today = iso(t0());
      p.rentHistory = (p.rentHistory || []).filter(h => h.from !== today);
      p.rentHistory.push({ from: today, amount: newRent, note:'Elle güncellendi' });
    }
    p.value = Number(fd.get('value')) || null;
    p.dueDay = Math.min(28, Math.max(1, Number(fd.get('due')) || p.dueDay));
    p.aidat = Number(fd.get('aidat')) || 0;
    p.aidatPayer = fd.get('aidatPayer');
    p.deposit = Number(fd.get('deposit')) || 0;
    if (fd.get('contractEnd')) p.contractEnd = String(fd.get('contractEnd'));
    if (fd.get('dask')) p.dask = String(fd.get('dask'));
    normalize(p);
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

  if (n === 'exitNote'){
    // Onaylar yazarken değil, alan bırakılınca sıfırlanır (bkz. change).
    P(d.pid).moveOut.rooms[Number(d.i)].note = ev.target.value;
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

  if (n === 'exitNote'){ resetMoveOutApprovals(P(d.pid)); save(); render(); return; }

  if (n === 'exitCond'){
    const p = P(d.pid);
    p.moveOut.rooms[Number(d.i)].condition = ev.target.value;
    resetMoveOutApprovals(p);
    save(); render();
    return;
  }

  if (n === 'exitPhoto'){
    const files = [...(ev.target.files || [])];
    if (!files.length) return;
    const p = P(d.pid), room = p.moveOut.rooms[Number(d.i)];
    for (const file of files.slice(0, 6)){
      const v = await backend.storeFile(d.pid, file, { maxSide:720 });
      if (v) room.shots.push(v);
    }
    resetMoveOutApprovals(p);
    const ok = save();
    render();
    if (!ok) notify({ title:'Yer kalmadı', body:'Tarayıcı depolaması doldu; fotoğraflar kaydedilemedi.', icon:'cam' }, false);
    return;
  }

  if (n === 'signupRole'){
    // Formu yeniden çizmeden seçimi göster (yazılanlar kaybolmasın).
    ui.signupRole = ev.target.value;
    document.querySelectorAll('.rolecard').forEach(c => c.classList.toggle('on', c.querySelector('input').checked));
    return;
  }

  if (n === 'expenseYear'){ ui.expenseYear = ev.target.value; render(); return; }
  if (n === 'reportYear'){ ui.reportYear = ev.target.value; render(); return; }
  if (n === 'noExemption'){ ui.noExemption = ev.target.checked; render(); return; }

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
      const v = await backend.storeFile(d.pid, file, { maxSide:720 });
      if (v) room.shots.push(v);
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
      if (!parsed || !parsed.props || !parsed.order || (parsed.v || 1) > VERSION) throw new Error('bad');
      replaceState(migrate(parsed));
      go('/kiraci', { replace:true });
      render();
      notify({ title:'Veri yüklendi', body:'Dosyadaki durum geri yüklendi.', icon:'doc' }, false);
    } catch(e){
      notify({ title:'Dosya okunamadı', body:'Bu dosya Evim verisi gibi görünmüyor.', icon:'doc' }, false);
    }
    ev.target.value = '';
  }
}
