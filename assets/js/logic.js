/* Türetilmiş veriler: dönem hesabı, hatırlatmalar, raporlar, arama. */

import { S, ui, STEPS } from './state.js';
import { t0, iso, add, addM, mkey, between, daysTo, parse, fmt, fmtFull, monthName, monthYear, tl, match } from './util.js';

export function P(id){ return S.props[id]; }
export function role(){ return ui.role; }

export const ST = {
  approved:['Ödendi','ok'],
  review:['Onay bekliyor','wait'],
  partial:['Kısmi ödeme','wait'],
  rejected:['Dekont reddedildi','bad'],
  pending:['Bekliyor',''],
  late:['Gecikti','bad']
};

export function chip(st){
  const s = ST[st] || ST.pending;
  return '<span class="chip '+s[1]+'">'+s[0]+'</span>';
}

/** Bir ayın ödeme durumu; kayıt yoksa vadeye göre bekliyor/gecikti. */
export function statusOf(p, key){
  const rec = p.pay[key];
  if (rec) return rec.status;
  const d = parse(key+'-01');
  const due = new Date(d.getFullYear(), d.getMonth(), p.dueDay);
  return t0() > due ? 'late' : 'pending';
}

export function dueDate(p, key){
  const d = parse(key+'-01');
  return new Date(d.getFullYear(), d.getMonth(), p.dueDay);
}

/**
 * Odaklanılacak dönem: sözleşme başından bu yana kapanmamış ilk ay,
 * hepsi kapalıysa gelecek ay. Böylece geçmiş bir gecikme gözden kaçmaz.
 */
export function period(p){
  const t = t0(), cur = mkey(t);
  // Sözleşme başından tara; çok eski kayıtlarda 24 ayla sınırla.
  const start = p.startDate ? parse(p.startDate) : addM(t, -11);
  let cursor = new Date(Math.max(start.getTime(), addM(t, -24).getTime()));
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

  while (mkey(cursor) <= cur){
    const key = mkey(cursor);
    const st = statusOf(p, key);
    if (st !== 'approved'){
      return { key, due: dueDate(p, key), status: st, rec: p.pay[key] };
    }
    cursor = addM(cursor, 1);
  }
  const nx = addM(new Date(t.getFullYear(), t.getMonth(), 1), 1), nk = mkey(nx);
  return { key: nk, due: dueDate(p, nk), status: statusOf(p, nk), rec: p.pay[nk] };
}

/**
 * Belirli bir ay (YYYY-MM) ya da tarih (YYYY-MM-DD) için geçerli kira.
 * Kira tutarı geçmişinden okunur; yenilemeden sonra yeni tutar kendiliğinden devreye girer.
 */
export function rentAt(p, when){
  const hist = (p.rentHistory || []).slice().sort((a, b) => a.from < b.from ? -1 : 1);
  if (!hist.length) return p.rent;
  // Ay anahtarı verilmişse o ayın vade gününe bakılır.
  const date = String(when).length === 7 ? when + '-' + String(p.dueDay).padStart(2, '0') : String(when);
  let amount = hist[0].amount;
  for (const h of hist) if (h.from <= date) amount = h.amount;
  return amount;
}

/** Kısmi ödemede kalan bakiye. */
export function remaining(p, key){
  const rec = p.pay[key];
  if (!rec || rec.status !== 'partial') return 0;
  return Math.max(0, rentAt(p, key) - (Number(rec.amount) || 0));
}

/**
 * Ödenmemiş kira: sözleşme başından bugüne vadesi geçmiş ve kapanmamış aylar.
 * Çıkışta depozitodan düşülecek kalemi önermek için kullanılır.
 */
export function unpaid(p){
  const t = t0(), cur = mkey(t);
  let c = parse(p.startDate);
  c = new Date(c.getFullYear(), c.getMonth(), 1);
  const months = [];
  let total = 0;
  while (mkey(c) <= cur){
    const key = mkey(c);
    const st = statusOf(p, key);
    let owed = 0;
    if (st === 'late' || st === 'rejected') owed = rentAt(p, key);
    else if (st === 'partial') owed = remaining(p, key);
    if (owed > 0){ months.push({ key, owed }); total += owed; }
    c = addM(c, 1);
  }
  return { total, months };
}

/**
 * Sözleşme süresi dolmuşsa bir yıl uzatır (konut kirasında sözleşme
 * kendiliğinden yenilenir) ve güncel kirayı geçmişten yeniden okur.
 * Değişiklik olduysa true döner.
 */
export function normalize(p){
  let changed = false;
  const today = iso(t0());
  while (p.contractEnd < today){
    const d = parse(p.contractEnd);
    p.contractEnd = iso(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
    if (p.renewal) p.renewal = null;
    changed = true;
  }
  const r = rentAt(p, today);
  if (r !== p.rent){ p.rent = r; changed = true; }
  return changed;
}

export function normalizeAll(){
  let changed = false;
  Object.values(S.props).forEach(p => { if (normalize(p)) changed = true; });
  return changed;
}

/* ---- kiracılar ---- */

export function tenantsLabel(p){
  const names = (p.tenants || []).map(t => t.name);
  if (!names.length) return 'Kiracı yok';
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' ve ' + names[names.length - 1];
}

/** Demo'da kiracı görünümü evin ilk kiracısı olarak açılır; gerçek hesapta oturum sahibidir. */
export function meTenant(p){
  const id = ui.meTenant && p.tenants.some(t => t.id === ui.meTenant) ? ui.meTenant : p.tenants[0]?.id;
  return p.tenants.find(t => t.id === id) || null;
}

export function senderName(p, m){
  if (m.from === 'landlord') return p.landlord.name;
  if (m.from === 'system') return 'Sistem';
  return (p.tenants.find(t => t.id === m.by) || p.tenants[0] || { name:'Kiracı' }).name;
}

/* ---- giderler ---- */

export function expensesIn(p, year){
  return (p.expenses || []).filter(e => String(e.date).startsWith(String(year)));
}
export function sum(list, f = x => x.amount){ return list.reduce((a, x) => a + (Number(f(x)) || 0), 0); }

/* ---- çıkış ve depozito ---- */

export function moveOutSummary(p){
  const mo = p.moveOut;
  const deducted = mo ? sum(mo.deductions || []) : 0;
  const deposit = Number(p.deposit) || 0;
  return {
    deposit, deducted,
    refund: Math.max(0, deposit - deducted),
    extra: Math.max(0, deducted - deposit)
  };
}

export function openReqs(p){ return p.requests.filter(r => r.status < 3); }
export function newReqs(p){ return p.requests.filter(r => r.status === 0); }

export function otherPerson(p){
  if (ui.role === 'tenant') return p.landlord;
  return { name: tenantsLabel(p), phone: p.tenants[0]?.phone || '' };
}
export function otherLabel(){ return ui.role === 'tenant' ? 'Ev sahibi' : 'Kiracı'; }

/** Bu ayın tahsilat tablosu — portföy kartındaki oranın kaynağı. */
export function monthCollection(){
  const key = mkey(t0());
  let expected = 0, collected = 0, waiting = 0, late = 0;
  S.order.forEach(id => {
    const p = P(id);
    const due = rentAt(p, key);
    expected += due;
    const rec = p.pay[key];
    const st = statusOf(p, key);
    if (st === 'approved') collected += Number(rec?.amount) || due;
    else if (st === 'partial'){ collected += Number(rec?.amount) || 0; waiting += remaining(p, key); }
    else if (st === 'review') waiting += Number(rec?.amount) || due;
    else if (st === 'late' || st === 'rejected') late += due;
  });
  return { key, expected, collected, waiting, late, pct: expected ? collected/expected : 0 };
}

export function yearIncome(){
  const y = String(new Date().getFullYear());
  const per = {};
  let total = 0;
  S.order.forEach(id => {
    const p = P(id);
    let s = 0;
    Object.keys(p.pay).forEach(k => {
      const rec = p.pay[k];
      if (k.startsWith(y) && (rec.status === 'approved' || rec.status === 'partial')) s += Number(rec.amount) || 0;
    });
    per[id] = s;
    total += s;
  });
  return { per, total, year:y };
}

/** Yıl bazında brüt, gider ve net — rapor ve vergi tahmini için. */
export function yearNumbers(year){
  const y = String(year);
  const rows = S.order.map(id => {
    const p = P(id);
    let gross = 0;
    Object.keys(p.pay).forEach(k => {
      const rec = p.pay[k];
      if (k.startsWith(y) && (rec.status === 'approved' || rec.status === 'partial')) gross += Number(rec.amount) || 0;
    });
    const exp = sum(expensesIn(p, y));
    const net = gross - exp;
    return { id, name:p.name, gross, exp, net, value:p.value, yieldPct: p.value ? net / p.value : null };
  });
  return {
    year: y, rows,
    gross: sum(rows, r => r.gross),
    exp: sum(rows, r => r.exp),
    net: sum(rows, r => r.net)
  };
}

/** Kayıtlarda geçen yıllar (ödeme ya da gider), yeniden eskiye. */
export function dataYears(){
  const ys = new Set([String(new Date().getFullYear())]);
  S.order.forEach(id => {
    const p = P(id);
    Object.keys(p.pay).forEach(k => ys.add(k.slice(0, 4)));
    (p.expenses || []).forEach(e => ys.add(String(e.date).slice(0, 4)));
  });
  return [...ys].sort().reverse();
}

/** Ev bazlı yaklaşan işler — hem gündem listesinde hem takvimde kullanılır. */
export function agendaItems(p){
  const items = [];
  openReqs(p).forEach(r => items.push({
    kind:'req', title:r.title, sub:r.cat+' · '+STEPS[r.status],
    go:'/'+(ui.role==='tenant' ? 'kiraci/talepler/'+r.id : 'ev-sahibi/ev/'+p.id+'/talep?req='+r.id),
    chip:'Talep', cls:'acc'
  }));
  const per = period(p);
  if (per.status !== 'approved') items.push({
    kind:'pay', title: monthYear(per.key)+' kirası', sub:'Vade '+fmtFull(per.due),
    go:'/'+(ui.role==='tenant' ? 'kiraci/odemeler' : 'ev-sahibi/ev/'+p.id+'/odeme'),
    chip: between(t0(), per.due) + ' gün', days: between(t0(), per.due)
  });
  items.push({
    kind:'contract', title:'Sözleşme yenileme', sub: fmtFull(parse(p.contractEnd)),
    go:'/'+(ui.role==='tenant' ? 'kiraci/odemeler' : 'ev-sahibi/ev/'+p.id+'/odeme'),
    chip: daysTo(p.contractEnd)+' gün', days: daysTo(p.contractEnd)
  });
  items.push({
    kind:'dask', title:'DASK poliçesi', sub:'Bitiş '+fmtFull(parse(p.dask)),
    go:'/'+(ui.role==='tenant' ? 'kiraci/belgeler' : 'ev-sahibi/ev/'+p.id+'/belge'),
    chip: daysTo(p.dask)+' gün', days: daysTo(p.dask)
  });
  if (p.moveOut && !p.moveOut.refunded){
    const done = p.moveOut.tenantOk && p.moveOut.landlordOk;
    items.push({
      kind:'moveout', title:'Çıkış ve depozito iadesi',
      sub: done ? 'İki taraf onayladı · iade bekleniyor' : 'Onay bekleniyor',
      go: ui.role === 'tenant' ? '/kiraci/belgeler/cikis' : '/ev-sahibi/ev/'+p.id+'/cikis',
      chip: p.moveOut.date ? daysTo(p.moveOut.date)+' gün' : 'Süreçte',
      days: p.moveOut.date ? daysTo(p.moveOut.date) : null, cls:'acc'
    });
  }
  p.docs.forEach(d => {
    if (!d.until) return;
    items.push({
      kind:'doc', title:d.cat,
      sub:(d.cat === 'Tahliye taahhütnamesi' ? 'Tahliye ' : 'Bitiş ') + fmtFull(parse(d.until)),
      go:'/'+(ui.role==='tenant' ? 'kiraci/belgeler' : 'ev-sahibi/ev/'+p.id+'/belge'),
      chip: daysTo(d.until)+' gün', days: daysTo(d.until)
    });
  });
  return items;
}

/** Ayarlardaki eşiklere göre öne çıkan hatırlatmalar. */
export function reminders(){
  const out = [], s = S.settings;
  const ids = ui.role === 'tenant' ? [S.myHome] : S.order;

  ids.forEach(id => {
    const p = P(id);
    const per = period(p);
    const dd = between(t0(), per.due);
    const pre = ui.role === 'landlord' ? p.name + ': ' : '';
    const payGo = ui.role === 'tenant' ? '/kiraci/odemeler' : '/ev-sahibi/ev/'+id+'/odeme';
    const docGo = ui.role === 'tenant' ? '/kiraci/belgeler' : '/ev-sahibi/ev/'+id+'/belge';

    if (ui.role === 'tenant'){
      if ((per.status === 'pending') && dd <= s.rentDays)
        out.push({ t:'Kira günü yaklaşıyor', b: monthYear(per.key)+' kirası '+(dd===0?'bugün':dd+' gün sonra')+' ödenmeli.', go:payGo, w:1 });
      if (per.status === 'late')
        out.push({ t:'Kira gecikti', b: monthYear(per.key)+' kirası için dekont yüklenmedi ('+(-dd)+' gün).', go:payGo, w:2 });
      if (per.status === 'partial')
        out.push({ t:'Kısmi ödeme', b: monthYear(per.key)+' için '+tl(remaining(p, per.key))+' bakiye görünüyor.', go:payGo, w:2 });
      if (per.status === 'rejected')
        out.push({ t:'Dekont reddedildi', b:(per.rec?.rejectReason || 'Ev sahibi dekontu onaylamadı.'), go:payGo, w:2 });
      if (p.renewal && p.renewal.status === 'sent')
        out.push({ t:'Yenileme teklifi bekliyor', b: tl(p.renewal.amount)+' önerildi; yanıtını bekliyor.', go:payGo, w:2 });
    } else {
      if (per.status === 'review')
        out.push({ t:pre+'dekont onayı bekliyor', b: monthYear(per.key)+' kirası için dekont yüklendi.', go:payGo, w:2 });
      if (per.status === 'partial')
        out.push({ t:pre+'kısmi ödeme', b: monthYear(per.key)+' için '+tl(remaining(p, per.key))+' eksik.', go:payGo, w:2 });
      if (per.status === 'late')
        out.push({ t:pre+'kira gecikti', b: monthYear(per.key)+' kirası '+(-dd)+' gündür ödenmedi.', go:payGo, w:2 });
      if (newReqs(p).length)
        out.push({ t:pre+'yeni talep', b: newReqs(p).length+' talep yanıt bekliyor.', go:'/ev-sahibi/ev/'+id+'/talep', w:1 });
      if (daysTo(p.dask) <= s.insDays)
        out.push({ t:pre+'DASK yenileme', b:'Poliçe '+fmtFull(parse(p.dask))+' tarihinde bitiyor.', go:docGo, w:2 });
    }

    const rd = daysTo(p.contractEnd);
    if (rd <= s.renewDays && !(p.renewal && p.renewal.status === 'accepted'))
      out.push({ t:pre+'sözleşme yenileme', b: fmtFull(parse(p.contractEnd))+' · '+rd+' gün kaldı', go:payGo, w: rd <= 30 ? 2 : 1 });

    p.docs.forEach(d => {
      if (d.until && d.cat === 'Tahliye taahhütnamesi' && daysTo(d.until) <= s.evictDays)
        out.push({ t:pre+'tahliye tarihi yaklaşıyor', b:'Taahhütnamedeki tarih: '+fmtFull(parse(d.until)), go:docGo, w:1 });
    });

    if (p.moveOut && !p.moveOut.refunded){
      const mine = ui.role === 'tenant' ? p.moveOut.tenantOk : p.moveOut.landlordOk;
      const both = p.moveOut.tenantOk && p.moveOut.landlordOk;
      const go = ui.role === 'tenant' ? '/kiraci/belgeler/cikis' : '/ev-sahibi/ev/'+id+'/cikis';
      if (!mine) out.push({ t:pre+'çıkış tutanağı onayını bekliyor', b:'Kesintileri inceleyip onayla.', go, w:2 });
      else if (both && ui.role === 'landlord') out.push({ t:pre+'depozito iadesi', b:tl(moveOutSummary(p).refund)+' iade edilecek.', go, w:2 });
    }

    if (!(p.inspect.tenantOk && p.inspect.landlordOk))
      out.push({ t:pre+'tutanak onayı eksik', b:'Giriş tutanağını iki taraf da onaylamalı.',
        go: ui.role === 'tenant' ? '/kiraci/belgeler/tutanak' : '/ev-sahibi/ev/'+id+'/tutanak', w:1 });
  });

  return out.sort((a,b) => b.w - a.w);
}

export function unreadCount(){
  return reminders().length + S.inbox.filter(x => !x.read).length;
}

/** Rol bazlı genel arama: evler, talepler, belgeler, mesajlar. */
export function search(q){
  if (!q || q.trim().length < 2) return [];
  const ids = ui.role === 'tenant' ? [S.myHome] : S.order;
  const out = [];

  ids.forEach(id => {
    const p = P(id);
    const base = ui.role === 'tenant' ? '/kiraci' : '/ev-sahibi/ev/'+id;

    if (ui.role === 'landlord' && (match(p.name, q) || match(p.addr, q) || p.tenants.some(t => match(t.name, q))))
      out.push({ icon:'home', title:p.name, sub:p.addr, go:'/ev-sahibi/ev/'+id });

    p.requests.forEach(r => {
      if (match(r.title, q) || match(r.desc, q) || match(r.cat, q))
        out.push({ icon:'wrench', title:r.title, sub:p.name+' · '+r.cat+' · '+STEPS[r.status],
          go: ui.role === 'tenant' ? '/kiraci/talepler/'+r.id : base+'/talep?req='+r.id });
    });

    p.docs.forEach(d => {
      if (match(d.name, q) || match(d.cat, q))
        out.push({ icon:'doc', title:d.name, sub:p.name+' · '+d.cat, go: base+(ui.role==='tenant'?'/belgeler':'/belge') });
    });

    if (ui.role === 'landlord') (p.expenses || []).forEach(e => {
      if (match(e.note, q) || match(e.cat, q))
        out.push({ icon:'chart', title:e.cat+' · '+tl(e.amount), sub:p.name+(e.note ? ' · '+e.note : ''), go: base+'/gider' });
    });

    p.msgs.forEach(m => {
      if (match(m.text, q))
        out.push({ icon:'chat', title:m.text.slice(0,60), sub:p.name+' · mesaj',
          go: ui.role === 'tenant' ? '/kiraci/mesajlar' : base+'/mesaj' });
    });
  });

  return out.slice(0, 24);
}
