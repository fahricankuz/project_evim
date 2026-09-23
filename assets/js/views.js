/* Ekranların HTML'i. Saf fonksiyonlar: durumu okur, string döndürür.
   Etkileşim data-act öznitelikleriyle actions.js'e bağlanır. */

import { t } from './i18n.js';
import { S, ui, STEPS, DOC_CATS, CONDITIONS } from './state.js';
import { estimate } from './tax.js';
import { pwa } from './pwa.js';
import { LIVE } from './config.js';
import { live, mediaSrc } from './backend.js';
import { LANGS, getLang } from './i18n.js';
import { I, ic } from './icons.js';
import { current, screenMap, PROP_SUBS } from './router.js';
import {
  P, period, statusOf, dueDate, remaining, chip, ST, openReqs, newReqs,
  otherPerson, otherLabel, monthCollection, yearIncome, reminders, agendaItems, search, unreadCount,
  rentAt, tenantsLabel, meTenant, senderName, expensesIn, sum, moveOutSummary, unpaid, yearNumbers, dataYears
} from './logic.js';
import {
  esc, tl, fmt, fmtFull, monthName, monthYear, parse, t0, iso, between, daysTo,
  tm, dayLabel, ago, up, percent
} from './util.js';

/* ---------------- ortak parçalar ---------------- */

export function header(title, sub, backPath){
  const n = unreadCount();
  const roleLabel = ui.role === 'tenant' ? t('Kiracı görünümü') : t('Ev sahibi görünümü');
  return (
    (LIVE ? syncPill() :
    ('<button class="rolepill" data-act="switchRole" aria-label="'+t('Görünümü değiştir')+'">') +
      '<i></i>'+roleLabel+(' '+t('· değiştir')+'</button>')) +
    '<div class="top">' +
      '<div class="row" style="align-items:flex-start;gap:8px">' +
        (backPath ? '<button class="iconbtn" data-act="nav" data-go="'+esc(backPath)+('" aria-label="'+t('Geri')+'">')+I.back+'</button>' : '') +
        '<div><h1>'+esc(title)+'</h1>'+(sub ? '<div class="sub">'+esc(sub)+'</div>' : '')+'</div>' +
      '</div>' +
      '<div class="row" style="gap:8px">' +
        ('<button class="iconbtn" data-act="sheet" data-s="arama" aria-label="'+t('Ara')+'">')+I.search+'</button>' +
        ('<button class="iconbtn" data-act="sheet" data-s="bildirim" aria-label="'+t('Bildirimler ve hatırlatmalar')+'">')+I.bell+(n ? '<span class="badge">'+n+'</span>' : '')+'</button>' +
        ('<button class="iconbtn" data-act="sheet" data-s="ayarlar" aria-label="'+t('Ayarlar')+'">')+I.gear+'</button>' +
      '</div>' +
    '</div>'
  );
}

/** Gerçek hesapta kayıt durumu: kullanıcı değişikliğin gittiğini görsün. */
function syncPill(){
  const st = live.status;
  const map = {
    syncing: [t('Kaydediliyor…'), 'wait'],
    offline: [t('Çevrimdışı · bu cihazda saklanıyor'), 'off'],
    error:   [t('Kaydedilemedi'), 'err'],
    synced:  [t('Kaydedildi'), 'ok'],
    idle:    [t('Bağlanıyor…'), 'wait']
  };
  const [label, cls] = map[st] || map.idle;
  const who = live.profile ? live.profile.name : '';
  return '<button class="rolepill status '+cls+('" data-act="sheet" data-s="hesap" aria-label="'+t('Hesap:')+' ')+esc(who)+' · '+label+'">' +
    '<i></i>'+esc(who ? who.split(' ')[0] + ' · ' : '')+label+'</button>';
}

function payAction(p, per){
  const key = per.key;
  if (ui.role === 'tenant'){
    if (per.status === 'pending' || per.status === 'late' || per.status === 'rejected')
      return '<button class="btn light block" data-act="sheet" data-s="odeme" data-pid="'+p.id+'" data-key="'+key+'">'+ic('doc')+(' '+t('Dekont yükle')+'</button>');
    if (per.status === 'partial')
      return '<button class="btn light block" data-act="sheet" data-s="odeme" data-pid="'+p.id+'" data-key="'+key+('">'+t('Kalan')+' ')+tl(remaining(p, key))+(' '+t('için dekont yükle')+'</button>');
    if (per.status === 'review')
      return '<button class="btn ghost block" data-act="sheet" data-s="dekont" data-pid="'+p.id+'" data-key="'+key+('">'+t('Yüklediğin dekontu gör')+'</button>');
    return '';
  }
  if (per.status === 'review')
    return '<div class="row"><button class="btn light" style="flex:1" data-act="approvePay" data-pid="'+p.id+'" data-key="'+key+('">'+t('Onayla')+'</button>') +
           '<button class="btn ghost" style="flex:1" data-act="sheet" data-s="dekont" data-pid="'+p.id+'" data-key="'+key+('">'+t('Dekontu gör')+'</button></div>');
  if (per.status === 'late' || per.status === 'partial')
    return '<button class="btn light block" data-act="nudge" data-pid="'+p.id+('">'+t('Nazik hatırlatma gönder')+'</button>');
  return '';
}

export function rentHero(p){
  const per = period(p);
  const dd = between(t0(), per.due);
  let line;
  switch (per.status){
    case 'late': line = t('{n} gün gecikti · vade {date}', { n:-dd, date:fmtFull(per.due) }); break;
    case 'review': line = (t('Dekont yüklendi ·')+' ') + (ui.role === 'tenant' ? t('ev sahibi onayı bekleniyor') : t('onayını bekliyor')); break;
    case 'partial': line = t('{paid} ödendi · {left} bakiye', { paid: tl(per.rec?.amount || 0), left: tl(remaining(p, per.key)) }); break;
    case 'rejected': line = t('Dekont reddedildi') + (per.rec?.rejectReason ? ' · '+per.rec.rejectReason : ''); break;
    case 'approved': line = t('Ödendi ve onaylandı'); break;
    default: line = (t('Son ödeme')+' ')+fmtFull(per.due)+' · '+(dd === 0 ? t('bugün') : t('{n} gün kaldı', { n:dd }));
  }
  return '<section class="hero stack" style="gap:12px">' +
    '<div class="row" style="justify-content:space-between;align-items:flex-start">' +
      '<div><div class="label">'+monthYear(per.key)+(' '+t('kirası')+'</div>') +
      '<div class="big" style="margin-top:6px">'+tl(rentAt(p, per.key))+'</div>' +
      '<div class="muted" style="margin-top:6px">'+esc(line)+'</div></div>'+chip(per.status)+'</div>' +
    payAction(p, per) + '</section>';
}

export function renewalCard(p){
  const rd = daysTo(p.contractEnd);
  const r = p.renewal;

  if (r && r.status === 'sent'){
    if (ui.role === 'tenant')
      return '<section class="card stack">' +
        ('<div class="row" style="justify-content:space-between"><h2>'+t('Yenileme teklifi geldi')+'</h2><span class="chip wait">'+t('Yanıt bekliyor')+'</span></div>') +
        ('<div><div class="kv"><span>'+t('Mevcut kira')+'</span><span>')+tl(p.rent)+'</span></div>' +
        ('<div class="kv"><span>'+t('Önerilen kira')+'</span><span>')+tl(r.amount)+'</span></div>' +
        ('<div class="kv"><span>'+t('Yasal üst sınır (TÜFE {pct})', { pct:percent(r.cpi, 2) }))+'</span><span>'+tl(r.max)+'</span></div></div>' +
        (r.amount < r.max ? ('<div class="note">'+t('Teklif yasal üst sınırın')+' ')+tl(r.max - r.amount)+(' '+t('altında.')+'</div>') : '') +
        '<div class="row"><button class="btn primary" style="flex:1" data-act="acceptRenewal" data-pid="'+p.id+('">'+t('Kabul et')+'</button>') +
        '<button class="btn ghost" style="flex:1" data-act="goMsg" data-pid="'+p.id+('">'+t('Görüşelim')+'</button></div></section>');
    return '<section class="card">' +
      ('<div class="row" style="justify-content:space-between"><h2>'+t('Yenileme teklifi gönderildi')+'</h2><span class="chip wait">'+t('Yanıt bekleniyor')+'</span></div>') +
      '<div class="muted" style="margin-top:6px">'+tl(r.amount)+(' '+t('önerdin · yasal üst sınır')+' ')+tl(r.max)+'</div>' +
      '<button class="btn small ghost" style="margin-top:10px" data-act="cancelRenewal" data-pid="'+p.id+('">'+t('Teklifi geri çek')+'</button></section>');
  }

  if (r && r.status === 'accepted')
    return ('<section class="card"><div class="row" style="justify-content:space-between"><h2>'+t('Yeni dönem kirası')+'</h2><span class="chip ok">'+t('Anlaşıldı')+'</span></div>') +
      '<div class="muted" style="margin-top:6px">'+fmtFull(parse(p.contractEnd))+(' '+t('itibarıyla')+' ')+tl(r.amount)+'</div></section>';

  if (rd > S.settings.renewDays) return '';

  return '<section class="card stack">' +
    ('<div class="row" style="justify-content:space-between"><h2>'+t('Sözleşme yenileme')+'</h2><span class="chip ')+(rd <= 30 ? 'bad' : 'wait')+'">'+t('{n} gün', { n:rd })+'</span></div>' +
    '<div class="muted">'+t('Sözleşme {date} tarihinde yenileniyor. Artış, son 12 aylık TÜFE ortalamasıyla sınırlıdır; iki taraf da aynı hesabı görür.', { date:fmtFull(parse(p.contractEnd)) })+'</div>' +
    '<button class="btn '+(ui.role === 'landlord' ? 'primary' : 'ghost')+' block" data-act="sheet" data-s="yenileme" data-pid="'+p.id+'">' +
      (ui.role === 'landlord' ? t('Artışı hesapla ve teklif gönder') : t('Yasal üst sınırı hesapla')) + '</button></section>';
}

export function secPay(p){
  const keys = Object.keys(p.pay).sort().reverse();
  const rows = keys.map(k => {
    const r = p.pay[k];
    return '<button class="li" data-act="sheet" data-s="dekont" data-pid="'+p.id+'" data-key="'+k+'">' +
      '<div><b>'+monthYear(k)+'</b><div class="muted">'+(r.receipt ? esc(r.receipt)+' · ' : '')+(r.date ? fmtFull(parse(r.date)) : '')+
      (r.status === 'partial' ? ' · '+tl(r.amount) : '')+'</div></div>'+chip(r.status)+'</button>';
  }).join('');

  const year = new Date().getFullYear();
  const paidYear = keys.filter(k => k.startsWith(String(year)) && p.pay[k].status === 'approved');

  return '<div class="stack">' + rentHero(p) + renewalCard(p) +
    '<div class="grid2">' +
      ('<div class="card"><div class="label">'+t('Aidat')+'</div><div style="font-weight:800;font-size:18px;margin-top:4px">')+tl(p.aidat)+' '+t('/ ay')+'</div><div class="muted">'+esc(t(p.aidatPayer))+(' '+t('öder')+'</div></div>') +
      ('<div class="card"><div class="label">'+t('Depozito')+'</div><div style="font-weight:800;font-size:18px;margin-top:4px">')+tl(p.deposit)+'</div><div class="muted">'+esc(p.depositNote)+'</div></div>' +
    '</div>' +
    ('<section class="card"><h2 style="margin-bottom:6px">'+t('Faturalar kimin adına?')+'</h2>') +
      (p.bills.length
        ? '<div class="list">'+p.bills.map(b => '<div class="li"><b>'+esc(b.n)+'</b><span class="chip">'+esc(t(b.who))+'</span></div>').join('')+'</div>'
        : ('<div class="muted">'+t('Fatura kaydı yok.')+'</div>')) + '</section>' +
    rentHistoryCard(p) +
    ('<section><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>'+t('Ödeme geçmişi')+'</h2>') +
      '<span class="muted">'+t('{year}: {n} ödeme onaylı', { year, n:paidYear.length })+'</span></div>' +
      '<div class="list">'+rows+'</div></section></div>';
}

export function reqCard(p, r){
  let steps = '';
  for (let i = 0; i < 4; i++){
    steps += '<i class="'+(i <= r.status ? 'on' : '')+'"></i>' + (i < 3 ? '<b class="'+(i < r.status ? 'on' : '')+'"></b>' : '');
  }
  const cost = r.cost === 'Belirlenmedi'
    ? ('<span class="chip">'+t('Masraf belirlenmedi')+'</span>')
    : '<span class="chip '+(r.costOk ? 'ok' : 'wait')+('">'+t('Masraf:')+' ')+esc(t(r.cost))+(r.costOk ? (' '+t('· onaylı')) : '')+'</span>';
  const decision = r.cat === 'Ek talep'
    ? (r.decision ? '<span class="chip '+(r.decision === 'Onaylandı' ? 'ok' : 'bad')+'">'+esc(t(r.decision))+'</span>' : ('<span class="chip wait">'+t('Karar bekleniyor')+'</span>'))
    : '';
  const shots = (r.shots || []).length + (r.photos || 0);
  const route = current();
  const showProp = ui.role === 'landlord' && !route.pid;

  return '<button class="card stack" style="gap:10px" data-act="openReq" data-pid="'+p.id+'" data-id="'+r.id+'">' +
    '<div class="row" style="justify-content:space-between;align-items:flex-start">' +
      '<div><div class="label" style="color:var(--accent)">'+esc(t(r.cat))+(r.urgency === 'Acil' ? (' '+t('· Acil')) : '')+(showProp ? ' · '+esc(p.name) : '')+'</div>' +
      '<div style="font-weight:800;font-size:16px;margin-top:3px">'+esc(r.title)+'</div></div>' +
      '<span class="muted">'+fmt(parse(r.date))+'</span></div>' +
    (r.cat !== 'Ek talep'
      ? '<div><div class="steps">'+steps+'</div><div class="steplbl">'+STEPS.map((s,i) => '<span class="'+(i === r.status ? 'on' : '')+'">'+t(s)+'</span>').join('')+'</div></div>'
      : '') +
    '<div class="row" style="flex-wrap:wrap;gap:6px">'+decision+cost+(shots ? '<span class="chip">'+t('{n} fotoğraf', { n:shots })+'</span>' : '') +
      (chosenQuote(r) ? '<span class="chip acc">'+esc(chosenQuote(r).vendor)+' · '+tl(chosenQuote(r).amount)+'</span>' : (r.quotes || []).length ? '<span class="chip">'+r.quotes.length+' teklif</span>' : '') +
      (r.invoice ? ('<span class="chip ok">'+t('Fatura işlendi')+'</span>') : '') + '</div></button>';
}

function chosenQuote(r){ return (r.quotes || []).find(q => q.chosen) || null; }

/** Mesaj bu oturumun sahibine mi ait? */
function isMine(p, m){
  if (m.from !== ui.role) return false;
  if (ui.role === 'tenant') return !m.by || m.by === meTenant(p)?.id;
  return true;
}

export function secReq(p){
  const st = ui.reqTab || 'open';
  const list = p.requests.filter(r => st === 'open' ? r.status < 3 : r.status >= 3);
  return '<div class="stack">' +
    (ui.role === 'tenant' ? '<button class="btn primary block" data-act="sheet" data-s="yeni-talep" data-pid="'+p.id+'">'+ic('plus')+(' '+t('Yeni talep aç')+'</button>') : '') +
    ('<div class="seg" role="group" aria-label="'+t('Talep filtresi')+'">') +
      '<button data-act="reqTab" data-v="open" aria-pressed="'+(st === 'open')+('">'+t('Açık ('))+openReqs(p).length+')</button>' +
      '<button data-act="reqTab" data-v="done" aria-pressed="'+(st === 'done')+('">'+t('Tamamlanan ('))+(p.requests.length - openReqs(p).length)+')</button></div>' +
    (list.length
      ? list.map(r => reqCard(p, r)).join('')
      : '<div class="empty">'+(st === 'open' ? t('Açık talep yok.') : t('Tamamlanan talep yok.'))+
        (ui.role === 'tenant' && st === 'open' ? ('<br>'+t('Bir arıza ya da isteğin olduğunda buradan açabilirsin.')) : '')+'</div>') +
    '</div>';
}

export function secMsg(p){
  const o = otherPerson(p);
  let lastDay = '';
  const bubbles = p.msgs.map(m => {
    let sep = '';
    const d = dayLabel(m.at);
    if (d !== lastDay){ sep = '<div class="daysep">'+esc(d)+'</div>'; lastDay = d; }
    if (m.from === 'system') return sep + '<div class="bub sys">'+esc(m.text)+'</div>';
    const mine = isMine(p, m);
    // Birden fazla kiracı varsa kimin yazdığı gösterilir.
    const who = !mine && (p.tenants.length > 1 || ui.role === 'tenant' && m.from === 'tenant') ? '<b class="who">'+esc(senderName(p, m))+'</b>' : '';
    return sep + '<div class="bub '+(mine ? 'me' : 'them')+'">'+who+esc(m.text)+'<small>'+tm(m.at)+'</small></div>';
  }).join('');

  return '<div class="stack">' +
    '<div class="card row" style="justify-content:space-between">' +
      '<div><div class="label">'+otherLabel()+'</div><b>'+esc(o.name)+'</b></div>' +
      '<a class="btn small primary" href="tel:'+esc(o.phone)+'">'+ic('phone', 16)+' '+t('Ara|telefon')+'</a></div>' +
    '<div class="chat" id="chat">'+(bubbles || ('<div class="bub sys">'+t('Henüz mesaj yok. Yazışmalar tarihli olarak saklanır.')+'</div>'))+'</div>' +
    '<form class="composer" data-form="msg" data-pid="'+p.id+'">' +
      ('<label class="sr" for="msgIn">'+t('Mesaj')+'</label>') +
      ('<input id="msgIn" name="text" placeholder="'+t('Mesaj yaz')+'" autocomplete="off">') +
      ('<button class="iconbtn" style="background:var(--accent);color:var(--accent-ink);border:0" aria-label="'+t('Gönder')+'">')+ic('send', 20)+'</button></form>' +
    '<button class="btn small ghost" data-act="exportChat" data-pid="'+p.id+('">'+t('Yazışmayı dışa aktar')+'</button></div>');
}

export function secDocs(p){
  const groups = DOC_CATS.map(c => {
    const ds = p.docs.filter(d => d.cat === c);
    return '<section class="card">' +
      '<div class="row" style="justify-content:space-between"><h2>'+esc(t(c))+'</h2>' +
        '<button class="btn small ghost" data-act="sheet" data-s="belge" data-pid="'+p.id+'" data-cat="'+esc(c)+'">'+ic('plus', 16)+(' '+t('Yükle')+'</button></div>') +
      (ds.length
        ? '<div class="list" style="margin-top:8px">'+ds.map(d => {
            const soon = d.until && daysTo(d.until) <= 60;
            const title = d.path
              ? '<a class="doclink" href="'+esc(mediaSrc(d.path))+'" target="_blank" rel="noopener">'+esc(d.name)+'</a>'
              : esc(d.name);
            return '<div class="li"><div><b style="font-size:14px">'+title+'</b>' +
              ('<div class="muted">'+t('Yüklendi')+' ')+fmtFull(parse(d.at)) +
              (d.until ? ' · '+(d.cat === 'Tahliye taahhütnamesi' ? t('tahliye') : t('bitiş'))+' '+fmtFull(parse(d.until)) : '')+'</div></div>' +
              '<div class="row" style="gap:6px">' +
              (soon ? '<span class="chip wait">'+t('{n} gün', { n:daysTo(d.until) })+'</span>' : ('<span class="chip">'+t('PDF')+'</span>')) +
              '<button class="iconbtn sm" data-act="removeDoc" data-pid="'+p.id+'" data-id="'+esc(d.id)+'" aria-label="'+esc(d.name)+' belgesini sil">'+ic('x', 16)+'</button>' +
              '</div></div>';
          }).join('')+'</div>'
        : ('<div class="muted" style="margin-top:6px">'+t('Henüz belge yok.')+'</div>')) +
      '</section>';
  }).join('');

  const inspectPath = ui.role === 'tenant' ? '/kiraci/belgeler/tutanak' : '/ev-sahibi/ev/'+p.id+'/tutanak';
  const done = p.inspect.tenantOk && p.inspect.landlordOk;

  return '<div class="stack">' +
    '<button class="card row" style="justify-content:space-between" data-act="nav" data-go="'+inspectPath+'">' +
      ('<div><b>'+t('Giriş tutanağı')+'</b><div class="muted">')+(done ? t('İki taraf da onayladı') : t('Onay bekleyen taraf var'))+'</div></div>' +
      (done ? ('<span class="chip ok">'+t('Tamam')+'</span>') : ('<span class="chip wait">'+t('Aç')+'</span>'))+'</button>' +
    groups +
    ('<p class="foot">'+t('Bu prototipte dosyalar cihazdan çıkmaz; yalnızca adları ve küçültülmüş görselleri saklanır.')+'</p></div>');
}

export function secInspect(p){
  const ins = p.inspect;
  const rows = ins.rooms.map((r, i) => {
    const shots = (r.shots || []).map((src, j) =>
      '<div class="thumb"><img src="'+esc(mediaSrc(src))+'" alt="'+esc(r.n)+(' '+t('fotoğrafı')+' ')+(j+1)+'">' +
      '<button data-act="removeShot" data-pid="'+p.id+'" data-i="'+i+'" data-j="'+j+('" aria-label="'+t('Fotoğrafı sil')+'">×</button></div>')).join('');
    const count = (r.photos || 0) + (r.shots || []).length;
    return '<section class="card stack" style="gap:10px">' +
      '<div class="row" style="justify-content:space-between"><b style="font-size:16px">'+esc(r.n)+'</b>' +
        '<div class="row" style="gap:6px"><span class="chip '+(count ? (r.note ? 'wait' : 'ok') : '')+'">'+(count ? t('{n} fotoğraf', { n:count }) : t('Fotoğraf yok'))+'</span>' +
        '<button class="iconbtn sm" data-act="removeRoom" data-pid="'+p.id+'" data-i="'+i+'" aria-label="'+esc(r.n)+(' '+t('odasını sil')+'">')+ic('x', 16)+'</button></div></div>' +
      (shots ? '<div class="thumbs">'+shots+'</div>' : '') +
      ('<label class="field">'+t('Not')+'<input value="')+esc(r.note)+'" data-input="roomNote" data-pid="'+p.id+'" data-i="'+i+('" placeholder="'+t('Hasar, eksik, sayaç okuması')+'"></label>') +
      '<label class="btn small ghost" style="cursor:pointer">'+ic('cam', 16)+(' '+t('Fotoğraf ekle')) +
        '<input type="file" accept="image/*" multiple class="sr" data-input="roomPhoto" data-pid="'+p.id+'" data-i="'+i+'"></label></section>';
  }).join('');

  const mineOk = ui.role === 'tenant' ? ins.tenantOk : ins.landlordOk;
  const bothOk = ins.tenantOk && ins.landlordOk;

  return '<div class="stack">' +
    ('<div class="note">'+t('Taşınırken oda oda kayıt al; iki taraf da onaylayınca tutanak kilitlenir. Çıkışta aynı odalar karşılaştırmalı rapor olarak açılır.')+'</div>') +
    rows +
    '<form class="row" data-form="room" data-pid="'+p.id+'">' +
      ('<label class="sr" for="roomIn">'+t('Oda adı')+'</label>') +
      ('<input id="roomIn" name="n" placeholder="'+t('Oda ekle (ör. Çocuk odası)')+'" style="flex:1;min-height:46px;border-radius:12px;border:1px solid var(--line);background:var(--surface);padding:0 12px">') +
      ('<button class="btn ghost">'+t('Ekle')+'</button></form>') +
    ('<section class="hero stack" style="gap:10px"><div class="label">'+t('Onay durumu')+'</div>') +
      ('<div class="kv"><span class="muted">'+t('Kiracı')+'</span><span>')+(ins.tenantOk ? t('Onayladı') : t('Bekleniyor'))+'</span></div>' +
      ('<div class="kv"><span class="muted">'+t('Ev sahibi')+'</span><span>')+(ins.landlordOk ? t('Onayladı') : t('Bekleniyor'))+'</span></div>' +
      (mineOk
        ? (bothOk
            ? ('<div class="muted">'+t('Tutanak tamamlandı.')+'</div>')
            : '<button class="btn light block" data-act="nudgeInspect" data-pid="'+p.id+('">'+t('Karşı tarafa hatırlat')+'</button>'))
        : '<button class="btn light block" data-act="approveInspect" data-pid="'+p.id+('">'+t('Tutanağı onayla')+'</button>')) +
      '<button class="btn ghost block" data-act="exportInspect" data-pid="'+p.id+('">'+t('Tutanağı dışa aktar')+'</button>') +
    '</section></div>';
}

export function agendaSection(p){
  const items = agendaItems(p);
  return ('<section><h2 style="margin-bottom:6px">'+t('Gündem')+'</h2><div class="list">') +
    items.map(it => '<button class="li" data-act="nav" data-go="'+esc(it.go)+'">' +
      '<div><b>'+esc(it.title)+'</b><div class="muted">'+esc(it.sub)+'</div></div>' +
      '<span class="chip '+(it.cls || (it.days != null && it.days <= 14 ? 'bad' : ''))+'">'+esc(it.chip)+'</span></button>').join('') +
    '</div></section>';
}

/* ---------------- kiracı ekranları ---------------- */

function tenantPanel(p){
  const o = p.landlord;
  const me = meTenant(p);
  const mates = p.tenants.filter(x => x.id !== me?.id);
  return header(p.name, p.addr) + '<div class="stack">' +
    '<div class="card stack" style="padding:10px 12px;gap:8px">' +
      personRow(t('ES'), o.name, t('Ev sahibi · bağlı'), ('<span class="chip ok">'+t('Aktif')+'</span>')) +
      mates.map(x => personRow(initials(x.name), x.name, t('Ev arkadaşın'), '')).join('') +
    '</div>' +
    rentHero(p) + renewalCard(p) +
    (p.moveOut && !p.moveOut.refunded ? moveOutTeaser(p, '/kiraci/belgeler/cikis') : '') +
    '<div class="grid4">' +
      '<button class="qa" data-act="sheet" data-s="yeni-talep" data-pid="'+p.id+'">'+I.plus+(t('Talep aç')+'</button>') +
      '<button class="qa" data-act="nav" data-go="/kiraci/mesajlar">'+I.chat+(t('Mesaj')+'</button>') +
      '<a class="qa" href="tel:'+esc(o.phone)+'">'+I.phone+t('Ara|telefon')+'</a>' +
      '<button class="qa" data-act="nav" data-go="/kiraci/belgeler">'+I.doc+(t('Belgeler')+'</button></div>') +
    agendaSection(p) + '</div>';
}

function personRow(abbr, name, sub, right){
  return '<div class="row">' +
    '<div class="avatar">'+esc(abbr)+'</div>' +
    '<div style="flex:1;min-width:0"><b>'+esc(name)+'</b><div class="muted">'+esc(sub)+'</div></div>'+right+'</div>';
}

function initials(name){
  const parts = String(name).replace(/[\[\]]/g, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toLocaleUpperCase('tr-TR');
}

function moveOutTeaser(p, go){
  const m = moveOutSummary(p);
  return '<button class="card row" style="justify-content:space-between" data-act="nav" data-go="'+go+'">' +
    ('<div><b>'+t('Çıkış süreci')+'</b><div class="muted">'+t('Depozito')+' ')+tl(m.deposit)+(' '+t('· kesinti')+' ')+tl(m.deducted)+(' '+t('· iade')+' ')+tl(m.refund)+'</div></div>' +
    ('<span class="chip wait">'+t('Aç')+'</span></button>');
}

export function tenantScreen(route){
  const p = P(S.myHome);
  switch (route.tab){
    case 'panel': return tenantPanel(p);
    case 'pay': return header(t('Ödemeler'), p.name) + secPay(p);
    case 'req': return header(t('Talepler'), p.name) + secReq(p);
    case 'msg': return header(t('Mesajlar'), p.name) + secMsg(p);
    case 'agenda': return header(t('Takvim'), p.name) + agendaScreenBody([p]);
    case 'docs':
      if (route.sub === 'tutanak') return header(t('Tutanak'), p.name, '/kiraci/belgeler') + inspectTabs(p, 'giris', '/kiraci/belgeler') + secInspect(p);
      if (route.sub === 'cikis') return header(t('Tutanak'), p.name, '/kiraci/belgeler') + inspectTabs(p, 'cikis', '/kiraci/belgeler') + secMoveOut(p);
      return header(t('Belgeler'), p.name) + secDocs(p);
    default: return tenantPanel(p);
  }
}

/** Giriş / çıkış tutanakları arasında geçiş. */
function inspectTabs(p, active, base){
  const giris = ui.role === 'tenant' ? base + '/tutanak' : '/ev-sahibi/ev/'+p.id+'/tutanak';
  const cikis = ui.role === 'tenant' ? base + '/cikis' : '/ev-sahibi/ev/'+p.id+'/cikis';
  return ('<div class="seg" role="group" aria-label="'+t('Tutanak türü')+'" style="margin-bottom:14px">') +
    '<button data-act="nav" data-go="'+giris+'" aria-pressed="'+(active === 'giris')+('">'+t('Giriş')+'</button>') +
    '<button data-act="nav" data-go="'+cikis+'" aria-pressed="'+(active === 'cikis')+('">'+t('Çıkış ve depozito')+'</button></div>');
}

/* ---------------- ev sahibi ekranları ---------------- */

function portfolio(){
  const m = monthCollection();
  const rem = reminders().slice(0, 4).map(r =>
    '<button class="li" data-act="nav" data-go="'+esc(r.go)+'">' +
      '<div><b>'+esc(up(r.t))+'</b><div class="muted">'+esc(r.b)+'</div></div>' +
      '<span class="chip '+(r.w > 1 ? 'bad' : 'wait')+'">'+(r.w > 1 ? t('Öncelikli') : t('Yakında'))+'</span></button>').join('');

  const cards = S.order.map(id => {
    const p = P(id), per = period(p), o = openReqs(p).length;
    return '<button class="card prop" data-act="nav" data-go="/ev-sahibi/ev/'+id+'">' +
      '<div class="r1"><div><b style="font-size:16px">'+esc(p.name)+'</b>' +
        '<div class="muted">'+esc(tenantsLabel(p))+' · '+tl(p.rent)+'/ay</div></div>'+chip(per.status)+'</div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px">' +
        (o ? '<span class="chip acc">'+t('{n} açık talep', { n:o })+'</span>' : '') +
        '<span class="chip">'+t('Yenileme {n} gün', { n:daysTo(p.contractEnd) })+'</span>' +
        (daysTo(p.dask) <= S.settings.insDays ? '<span class="chip bad">'+t('DASK {n} gün', { n:daysTo(p.dask) })+'</span>' : '') +
        (p.moveOut && !p.moveOut.refunded ? ('<span class="chip wait">'+t('Çıkış süreci')+'</span>') : '') +
      '</div></button>';
  }).join('');

  const openTotal = S.order.reduce((a, id) => a + openReqs(P(id)).length, 0);

  if (!S.order.length){
    return header(t('Portföyüm'), t('Henüz ev yok')) + '<div class="stack">' +
      ('<div class="empty"><b style="font-size:17px;color:var(--ink)">'+t('İlk evini ekle')+'</b><br>') +
      (t('Evi ekleyince kiracın için bir davet kodu oluşur. Kiracın kodla katılınca kira, talep ve belgeleri birlikte takip edersiniz.')+'</div>') +
      '<button class="btn primary block" data-act="sheet" data-s="ev-ekle">'+ic('plus')+(' '+t('Ev ekle')+'</button></div>');
  }

  return header(t('Portföyüm'), t('{n} ev', { n:S.order.length })) + '<div class="stack">' +
    '<section class="hero stack" style="gap:12px"><div class="label">'+monthYear(m.key)+' kira durumu</div>' +
      '<div class="row" style="justify-content:space-between;align-items:flex-end">' +
        '<div><div class="big">'+tl(m.collected)+'</div>' +
        '<div class="muted" style="margin-top:6px">'+tl(m.expected)+(' '+t('beklenenin tahsil edilen kısmı')+'</div></div>') +
        '<div class="mid">'+percent(Math.round(m.pct*100))+'</div></div>' +
      '<div class="bar"><i style="width:'+(m.pct*100).toFixed(1)+'%"></i></div>' +
      ('<div class="grid2"><div><div class="muted">'+t('Onay bekleyen')+'</div><b>')+tl(m.waiting)+'</b></div>' +
      ('<div><div class="muted">'+t('Geciken')+'</div><b>')+tl(m.late)+'</b></div></div></section>' +
    '<div class="grid2">' +
      ('<button class="card" data-act="nav" data-go="/ev-sahibi/talepler"><div class="label">'+t('Açık talep')+'</div><div class="mid" style="margin-top:4px">')+openTotal+'</div></button>' +
      ('<button class="card" data-act="nav" data-go="/ev-sahibi/rapor"><div class="label">'+t('Bu yıl tahsil edilen')+'</div><div class="mid" style="margin-top:4px">')+tl(yearIncome().total)+'</div></button></div>' +
    (rem ? ('<section><h2 style="margin-bottom:6px">'+t('Öncelikli işler')+'</h2><div class="list">')+rem+'</div></section>' : '') +
    ('<section class="stack"><h2>'+t('Evlerim')+'</h2>')+cards +
      '<button class="btn ghost block" data-act="sheet" data-s="ev-ekle">'+ic('plus')+(' '+t('Ev ekle ve kiracı davet et')+'</button></section></div>');
}

function propDetail(route){
  const p = P(route.pid), sub = route.sub || 'ozet';
  let body = '';

  if (sub === 'ozet'){
    body = '<div class="stack">' +
      tenantsCard(p) +
      rentHero(p) +
      (p.moveOut && !p.moveOut.refunded ? moveOutTeaser(p, '/ev-sahibi/ev/'+p.id+'/cikis') : '') +
      '<section class="card">' +
        ('<div class="kv"><span>'+t('Aylık kira')+'</span><span>')+tl(p.rent)+'</span></div>' +
        ('<div class="kv"><span>'+t('Ödeme günü')+'</span><span>')+t('Her ayın {n}’i', { n:p.dueDay })+'</span></div>' +
        ('<div class="kv"><span>'+t('Aidat')+'</span><span>')+tl(p.aidat)+' · '+esc(t(p.aidatPayer))+'</span></div>' +
        ('<div class="kv"><span>'+t('Depozito')+'</span><span>')+tl(p.deposit)+'</span></div>' +
        ('<div class="kv"><span>'+t('Sözleşme bitişi')+'</span><span>')+fmtFull(parse(p.contractEnd))+'</span></div>' +
        ('<div class="kv"><span>'+t('DASK bitişi')+'</span><span>')+fmtFull(parse(p.dask))+'</span></div>' +
        (p.value ? ('<div class="kv"><span>'+t('Tahmini değer')+'</span><span>')+tl(p.value)+'</span></div>' : '') +
        '<button class="btn small ghost block" style="margin-top:10px" data-act="sheet" data-s="ev-duzenle" data-pid="'+p.id+('">'+t('Bilgileri düzenle')+'</button></section>') +
      agendaSection(p) + '</div>';
  }
  else if (sub === 'odeme') body = secPay(p);
  else if (sub === 'talep') body = secReq(p);
  else if (sub === 'mesaj') body = secMsg(p);
  else if (sub === 'belge') body = secDocs(p);
  else if (sub === 'tutanak') body = inspectTabs(p, 'giris') + secInspect(p);
  else if (sub === 'cikis') body = inspectTabs(p, 'cikis') + secMoveOut(p);
  else if (sub === 'gider') body = secExpenses(p);

  const strip = sub === 'cikis' ? 'tutanak' : sub;
  return header(p.name, p.addr, '/ev-sahibi') +
    ('<div class="scrollseg" role="group" aria-label="'+t('Ev bölümleri')+'" style="margin-bottom:14px">') +
      PROP_SUBS.map(s => '<button data-act="nav" data-go="/ev-sahibi/ev/'+p.id+'/'+s[0]+'" aria-pressed="'+(strip === s[0])+'">'+s[1]+'</button>').join('') +
    '</div>' + body;
}

function tenantsCard(p){
  return '<section class="card stack" style="gap:10px">' +
    '<div class="row" style="justify-content:space-between"><h2>'+(p.tenants.length > 1 ? t('Kiracılar') : t('Kiracı'))+'</h2>' +
      '<button class="btn small ghost" data-act="sheet" data-s="kiraci-ekle" data-pid="'+p.id+'">'+ic('plus', 15)+(' '+t('Kiracı ekle')+'</button></div>') +
    (p.tenants.length
      ? p.tenants.map(tn => tn.pending
        ? personRow('?', tn.name || t('Davet bekleniyor'), (tn.name ? (t('Davet bekleniyor ·')+' ') : (t('Henüz katılmadı ·')+' '))+'kod '+tn.code,
            '<div class="row" style="gap:6px">' +
              '<button class="btn small ghost" data-act="sheet" data-s="davet-paylas" data-pid="'+p.id+'" data-key="'+esc(tn.code)+('">'+t('Paylaş')+'</button>') +
              '<button class="iconbtn sm" data-act="removeTenant" data-pid="'+p.id+'" data-id="'+esc(tn.id)+('" aria-label="'+t('Daveti iptal et')+'">')+ic('x', 16)+'</button></div>')
        : personRow(initials(tn.name), tn.name, tn.email || tn.phone || t('İletişim bilgisi yok'),
          '<div class="row" style="gap:6px">' +
            (tn.phone ? '<a class="iconbtn sm" href="tel:'+esc(tn.phone)+'" aria-label=\"'+esc(t('{name} ara|telefon', { name:tn.name }))+'\">'+ic('phone', 16)+'</a>' : '') +
            '<button class="iconbtn sm" data-act="removeTenant" data-pid="'+p.id+'" data-id="'+esc(tn.id)+'" aria-label="'+esc(tn.name)+(' '+t('kiracısını çıkar')+'">')+ic('x', 16)+'</button></div>')).join('')
      : ('<div class="muted">'+t('Bu evde kayıtlı kiracı yok. Kiracı ekleyerek davet edebilirsin.')+'</div>')) +
    '<button class="btn small ghost" data-act="nav" data-go="/ev-sahibi/ev/'+p.id+'/mesaj">'+ic('chat', 15)+(' '+t('Mesaj gönder')+'</button>') +
    '</section>';
}

/* ---------------- kira tutarı geçmişi ---------------- */

export function rentHistoryCard(p){
  const hist = (p.rentHistory || []).slice().sort((a, b) => a.from < b.from ? 1 : -1);
  if (!hist.length) return '';
  const today = iso(t0());
  return ('<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>'+t('Kira tutarı geçmişi')+'</h2>') +
      '<span class="muted">'+t('{n} dönem', { n:hist.length })+'</span></div><div class="list">' +
    hist.map((h, i) => {
      const prev = hist[i + 1];
      const pct = prev && prev.amount ? Math.round((h.amount / prev.amount - 1) * 1000) / 10 : null;
      const future = h.from > today;
      return '<div class="li"><div><b>'+tl(h.amount)+'</b><div class="muted">'+fmtFull(parse(h.from))+(future ? (' '+t('itibarıyla')) : '')+(h.note ? ' · '+esc(t(h.note)) : '')+'</div></div>' +
        (pct != null ? '<span class="chip '+(future ? 'wait' : '')+'">'+(pct >= 0 ? '+' : '')+percent(pct, 2)+'</span>' : ('<span class="chip">'+t('Başlangıç')+'</span>')) + '</div>';
    }).join('') + '</div></section>';
}

/* ---------------- çıkış ve depozito iadesi ---------------- */

export function secMoveOut(p){
  const mo = p.moveOut;
  if (!mo){
    return '<div class="stack">' +
      ('<div class="note">'+t('Taşınma zamanı geldiğinde çıkış sürecini buradan başlat. Giriş tutanağındaki odalar karşılaştırma için kopyalanır; kesintiler iki tarafın onayından sonra depozitodan düşülür.')+'</div>') +
      ('<div class="card"><div class="kv"><span>'+t('Depozito')+'</span><span>')+tl(p.deposit)+'</span></div>' +
        ('<div class="kv"><span>'+t('Ödenmemiş kira')+'</span><span>')+tl(unpaid(p).total)+'</span></div></div>' +
      '<button class="btn primary block" data-act="sheet" data-s="cikis-baslat" data-pid="'+p.id+('">'+t('Çıkış sürecini başlat')+'</button></div>');
  }

  const sm = moveOutSummary(p);
  const both = mo.tenantOk && mo.landlordOk;
  const mineOk = ui.role === 'tenant' ? mo.tenantOk : mo.landlordOk;
  const locked = both;

  const rooms = mo.rooms.map((r, i) => {
    const entry = p.inspect.rooms.find(x => x.n === r.n);
    const entryCount = entry ? (entry.photos || 0) + (entry.shots || []).length : 0;
    const shots = (r.shots || []).map((src, j) =>
      '<div class="thumb"><img src="'+esc(mediaSrc(src))+'" alt="'+esc(r.n)+(' '+t('çıkış fotoğrafı')+' ')+(j+1)+'">' +
      (locked ? '' : '<button data-act="removeExitShot" data-pid="'+p.id+'" data-i="'+i+'" data-j="'+j+('" aria-label="'+t('Fotoğrafı sil')+'">×</button>'))+'</div>').join('');
    const entryShots = entry ? (entry.shots || []).slice(0, 4).map(src => '<img src="'+esc(mediaSrc(src))+'" alt="'+esc(r.n)+(' '+t('giriş fotoğrafı')+'">')).join('') : '';
    const cls = r.condition === 'Aynı' ? 'ok' : r.condition === 'Yıpranmış' ? 'wait' : r.condition ? 'bad' : '';
    return '<section class="card stack" style="gap:10px">' +
      '<div class="row" style="justify-content:space-between"><b style="font-size:16px">'+esc(r.n)+'</b>' +
        (r.condition ? '<span class="chip '+cls+'">'+esc(t(r.condition))+'</span>' : ('<span class="chip">'+t('Değerlendirilmedi')+'</span>'))+'</div>' +
      '<div class="compare">' +
        ('<div><div class="label">'+t('Girişte')+'</div><div class="muted">')+(entry ? esc(entry.note || t('Not yok'))+' · '+t('{n} fotoğraf', { n:entryCount }) : t('Girişte kayıt yok'))+'</div>' +
          (entryShots ? '<div class="thumbs" style="margin-top:6px">'+entryShots+'</div>' : '')+'</div>' +
        ('<div><div class="label">'+t('Çıkışta')+'</div>') +
          (locked
            ? '<div class="muted">'+esc(r.note || t('Not yok'))+' · '+t('{n} fotoğraf', { n:(r.shots || []).length })+'</div>'
            : '<input class="inline" value="'+esc(r.note)+'" data-input="exitNote" data-pid="'+p.id+'" data-i="'+i+('" placeholder="'+t('Durum notu')+'" aria-label="')+esc(r.n)+(' '+t('çıkış notu')+'">')) +
          (shots ? '<div class="thumbs" style="margin-top:6px">'+shots+'</div>' : '')+'</div>' +
      '</div>' +
      (locked ? '' :
        '<div class="row" style="gap:8px">' +
          '<label class="field" style="flex:1"><span class="sr">'+esc(r.n)+' durumu</span><select data-input="exitCond" data-pid="'+p.id+'" data-i="'+i+'">' +
            ('<option value="">'+t('Durum seç')+'</option>') + CONDITIONS.map(c => '<option'+(c === r.condition ? ' selected' : '')+'>'+esc(t(c))+'</option>').join('') + '</select></label>' +
          '<label class="btn small ghost" style="cursor:pointer">'+ic('cam', 16)+(' '+t('Fotoğraf')+'<input type="file" accept="image/*" multiple class="sr" data-input="exitPhoto" data-pid="')+p.id+'" data-i="'+i+'"></label>' +
        '</div>') +
      '</section>';
  }).join('');

  const deductions = (mo.deductions || []).map(d =>
    '<div class="li"><div><b>'+esc(d.label)+'</b>'+(d.note ? '<div class="muted">'+esc(d.note)+'</div>' : '')+'</div>' +
      '<div class="row" style="gap:6px"><b>'+tl(d.amount)+'</b>' +
      (!locked && ui.role === 'landlord' ? '<button class="iconbtn sm" data-act="removeDeduction" data-pid="'+p.id+'" data-id="'+esc(d.id)+'" aria-label="'+esc(d.label)+' kesintisini sil">'+ic('x', 16)+'</button>' : '') +
      '</div></div>').join('');

  const due = unpaid(p);
  const hasUnpaidLine = (mo.deductions || []).some(d => d.kind === 'rent');

  return '<div class="stack">' +
    '<section class="hero stack" style="gap:10px">' +
      ('<div class="label">'+t('Depozito hesabı'))+(mo.date ? (' '+t('· çıkış')+' ')+fmtFull(parse(mo.date)) : '')+'</div>' +
      ('<div class="kv"><span class="muted">'+t('Depozito')+'</span><span>')+tl(sm.deposit)+'</span></div>' +
      ('<div class="kv"><span class="muted">'+t('Kesintiler')+'</span><span>− ')+tl(sm.deducted)+'</span></div>' +
      ('<div class="row" style="justify-content:space-between;align-items:flex-end;margin-top:4px"><div><div class="muted">'+t('İade edilecek')+'</div>') +
        '<div class="big">'+tl(sm.refund)+'</div></div>' +
        (mo.refunded ? ('<span class="chip ok">'+t('İade edildi')+'</span>') : both ? ('<span class="chip wait">'+t('Onaylandı')+'</span>') : ('<span class="chip">'+t('Taslak')+'</span>')) + '</div>' +
      (sm.extra ? ('<div class="note warn">'+t('Kesintiler depozitoyu')+' ')+tl(sm.extra)+(' '+t('aşıyor; bu tutar kiracıdan ayrıca talep edilir.')+'</div>') : '') +
    '</section>' +

    ('<section><h2 style="margin-bottom:8px">'+t('Oda oda karşılaştırma')+'</h2><div class="stack">')+rooms+'</div></section>' +

    ('<section class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>'+t('Kesintiler')+'</h2>') +
      (!locked && ui.role === 'landlord' ? '<button class="btn small ghost" data-act="sheet" data-s="kesinti" data-pid="'+p.id+'">'+ic('plus', 15)+(' '+t('Ekle')+'</button>') : '') + '</div>' +
      (deductions ? '<div class="list">'+deductions+'</div>' : ('<div class="muted">'+t('Kesinti yok; depozitonun tamamı iade edilir.')+'</div>')) +
      (!locked && ui.role === 'landlord' && due.total > 0 && !hasUnpaidLine
        ? '<button class="btn small ghost block" style="margin-top:10px" data-act="addUnpaidDeduction" data-pid="'+p.id+('">'+t('Ödenmemiş kirayı ekle ('))+tl(due.total)+')</button>' : '') +
    '</section>' +

    ('<section class="card stack" style="gap:8px"><h2>'+t('Onaylar')+'</h2>') +
      ('<div class="kv"><span>'+t('Kiracı')+'</span><span>')+(mo.tenantOk ? t('Onayladı') : t('Bekleniyor'))+'</span></div>' +
      ('<div class="kv"><span>'+t('Ev sahibi')+'</span><span>')+(mo.landlordOk ? t('Onayladı') : t('Bekleniyor'))+'</span></div>' +
      (mo.refunded
        ? '<div class="note">'+tl(mo.refunded.amount)+' '+fmtFull(parse(mo.refunded.date))+' tarihinde iade edildi.</div>'
        : !mineOk
          ? '<button class="btn primary block" data-act="approveMoveOut" data-pid="'+p.id+('">'+t('Hesabı onayla')+'</button>')
          : !both
            ? ('<div class="muted">'+t('Karşı tarafın onayı bekleniyor. Bir kalem değişirse onaylar sıfırlanır.')+'</div>')
            : ui.role === 'landlord'
              ? '<button class="btn primary block" data-act="sheet" data-s="iade" data-pid="'+p.id+('">'+t('İadeyi yaptım')+'</button>')
              : ('<div class="muted">'+t('Ev sahibinin iadeyi yapması bekleniyor.')+'</div>')) +
      '<button class="btn ghost block" data-act="exportMoveOut" data-pid="'+p.id+('">'+t('Çıkış raporunu dışa aktar')+'</button>') +
      (!mo.refunded && ui.role === 'landlord' ? '<button class="btn small ghost block" data-act="cancelMoveOut" data-pid="'+p.id+('">'+t('Çıkış sürecini iptal et')+'</button>') : '') +
    '</section></div>';
}

/* ---------------- gider defteri ---------------- */

export function secExpenses(p){
  const year = String(ui.expenseYear || new Date().getFullYear());
  const years = [...new Set([String(new Date().getFullYear()), ...(p.expenses || []).map(e => String(e.date).slice(0, 4))])].sort().reverse();
  const list = expensesIn(p, year).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const total = sum(list);

  const byCat = {};
  list.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + Number(e.amount); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...cats.map(c => c[1]));

  const yn = yearNumbers(year).rows.find(r => r.id === p.id);

  return '<div class="stack">' +
    '<div class="row" style="justify-content:space-between">' +
      ('<label class="field" style="flex-direction:row;align-items:center;gap:8px">'+t('Yıl')+'<select data-input="expenseYear" style="min-height:38px">') +
        years.map(y => '<option'+(y === year ? ' selected' : '')+'>'+y+'</option>').join('') + '</select></label>' +
      '<button class="btn small primary" data-act="sheet" data-s="gider" data-pid="'+p.id+'">'+ic('plus', 15)+(' '+t('Gider ekle')+'</button></div>') +

    '<section class="hero stack" style="gap:10px"><div class="label">'+year+' net getiri</div>' +
      '<div class="big">'+tl(yn.net)+'</div>' +
      ('<div class="grid2"><div><div class="muted">'+t('Tahsil edilen')+'</div><b>')+tl(yn.gross)+'</b></div>' +
        ('<div><div class="muted">'+t('Giderler')+'</div><b>')+tl(yn.exp)+'</b></div></div>' +
      (yn.yieldPct != null ? ('<div class="muted">'+t('Değere göre net getiri: {pct}', { pct:percent(yn.yieldPct * 100) }))+'</div>' : '') +
    '</section>' +

    (cats.length
      ? ('<section class="card stack"><h2>'+t('Kategoriye göre')+'</h2>') + cats.map(([c, v]) =>
          '<div><div class="row" style="justify-content:space-between;font-size:14px"><b>'+esc(t(c))+'</b><span style="font-weight:800">'+tl(v)+'</span></div>' +
          '<div class="bar" style="margin-top:6px"><i style="width:'+(v/max*100).toFixed(1)+'%"></i></div></div>').join('') + '</section>'
      : '') +

    ('<section><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>'+t('Kayıtlar')+'</h2><span class="muted">')+t('{n} gider · {amount}', { n:list.length, amount:tl(total) })+'</span></div>' +
      (list.length
        ? '<div class="list">' + list.map(e =>
            '<button class="li" data-act="sheet" data-s="gider" data-pid="'+p.id+'" data-id="'+esc(e.id)+'">' +
              '<div><b>'+esc(t(e.cat))+'</b><div class="muted">'+fmtFull(parse(e.date))+(e.note ? ' · '+esc(e.note) : '')+(e.reqId ? (' '+t('· talebe bağlı')) : '')+'</div></div>' +
              '<b>'+tl(e.amount)+'</b></button>').join('') + '</div>'
        : '<div class="empty">'+year+(' '+t('için gider kaydı yok.')+'</div>')) +
    '</section></div>';
}

function allRequests(){
  const st = ui.reqTab || 'open';
  const cards = [];
  S.order.forEach(id => {
    const p = P(id);
    p.requests.filter(r => st === 'open' ? r.status < 3 : r.status >= 3).forEach(r => cards.push(reqCard(p, r)));
  });
  const openN = S.order.reduce((a, id) => a + openReqs(P(id)).length, 0);
  const allN = S.order.reduce((a, id) => a + P(id).requests.length, 0);

  return header(t('Talepler'), t('Tüm evler')) + '<div class="stack">' +
    ('<div class="seg" role="group" aria-label="'+t('Talep filtresi')+'">') +
      '<button data-act="reqTab" data-v="open" aria-pressed="'+(st === 'open')+('">'+t('Açık ('))+openN+')</button>' +
      '<button data-act="reqTab" data-v="done" aria-pressed="'+(st === 'done')+('">'+t('Tamamlanan ('))+(allN - openN)+')</button></div>' +
    (cards.length ? cards.join('') : ('<div class="empty">'+t('Bu listede talep yok.')+'</div>')) + '</div>';
}

function threads(){
  return header(t('Mesajlar'), t('Kiracılarınla yazışmalar')) + '<div class="list">' +
    S.order.map(id => {
      const p = P(id), last = p.msgs[p.msgs.length-1];
      return '<button class="li" data-act="nav" data-go="/ev-sahibi/ev/'+id+'/mesaj">' +
        '<div style="min-width:0"><b>'+esc(tenantsLabel(p))+'</b>' +
        '<div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px">'+esc(p.name)+' · '+(last ? esc(last.text) : t('Henüz mesaj yok'))+'</div></div>' +
        '<span class="muted">'+(last ? fmt(last.at) : '')+'</span></button>';
    }).join('') + '</div>';
}

function report(){
  const years = dataYears();
  const year = String(ui.reportYear || years[0]);
  const yn = yearNumbers(year);
  const dep = S.order.reduce((a, id) => a + P(id).deposit, 0);
  const monthly = S.order.reduce((a, id) => a + P(id).rent, 0);
  const max = Math.max(1, ...yn.rows.map(r => r.gross));

  return header(t('Rapor'), year+(' '+t('yılı'))) + '<div class="stack">' +
    ('<label class="field" style="flex-direction:row;align-items:center;gap:8px">'+t('Yıl')+'<select data-input="reportYear" style="min-height:38px">') +
      years.map(y => '<option'+(y === year ? ' selected' : '')+'>'+y+'</option>').join('') + '</select></label>' +

    '<section class="hero stack" style="gap:10px"><div class="label">'+t('{year} net kira getirisi', { year })+'</div>' +
      '<div class="big">'+tl(yn.net)+'</div>' +
      ('<div class="grid2"><div><div class="muted">'+t('Tahsil edilen')+'</div><b>')+tl(yn.gross)+'</b></div>' +
        ('<div><div class="muted">'+t('Giderler')+'</div><b>')+tl(yn.exp)+'</b></div></div>' +
      ('<div class="muted">'+t('Onaylanmış ve kısmi ödemelerden, girilen giderler düşülerek hesaplanır.')+'</div></section>') +

    ('<section class="card stack"><h2>'+t('Ev bazında')+'</h2>') +
      yn.rows.map(r =>
        '<div><div class="row" style="justify-content:space-between;font-size:14px">' +
          '<b>'+esc(r.name)+'</b><span style="font-weight:800">'+tl(r.net)+'</span></div>' +
          ('<div class="bar split" style="margin-top:6px" title="'+t('Brüt')+' ')+tl(r.gross)+', gider '+tl(r.exp)+'">' +
            '<i style="width:'+(Math.max(0, r.net)/max*100).toFixed(1)+'%"></i><i class="exp" style="width:'+(Math.min(r.exp, r.gross)/max*100).toFixed(1)+'%"></i></div>' +
          ('<div class="muted" style="margin-top:4px">'+t('Brüt')+' ')+tl(r.gross)+(' '+t('· gider')+' ')+tl(r.exp) +
            (r.yieldPct != null ? (' '+t('· net getiri {pct}', { pct:percent(r.yieldPct * 100) })) : '')+'</div></div>'
      ).join('') +
      ('<div class="legend"><span><i></i>'+t('Net')+'</span><span><i class="exp"></i>'+t('Gider')+'</span></div></section>') +

    taxCard(year, yn) +

    '<div class="grid2">' +
      ('<div class="card"><div class="label">'+t('Tutulan depozito')+'</div><div style="font-weight:800;font-size:18px;margin-top:4px">')+tl(dep)+'</div></div>' +
      ('<div class="card"><div class="label">'+t('Aylık toplam kira')+'</div><div style="font-weight:800;font-size:18px;margin-top:4px">')+tl(monthly)+'</div></div></div>' +
    ('<button class="btn primary block" data-act="shareReport">'+t('Beyanname özeti oluştur')+'</button>') +
    ('<button class="btn ghost block" data-act="exportCsv">'+t('Ödemeleri ve giderleri CSV indir')+'</button>') +
    ('<p class="foot">'+t('Özet bilgi amaçlıdır; kira geliri beyanı için mali müşavirine danış.')+'</p></div>');
}

function taxCard(year, yn){
  const e = estimate(yn.gross, yn.exp, { year:Number(year), noExemption: !!ui.noExemption });
  const r = e.rates;
  const pick = m => e.best === m ? (' <span class="chip ok">'+t('Daha avantajlı')+'</span>') : '';
  return '<section class="card stack" style="gap:10px">' +
    ('<div class="row" style="justify-content:space-between"><h2>'+t('Vergi tahmini')+'</h2><span class="chip">')+r.year+(' '+t('oranları')+'</span></div>') +
    (r.approx ? '<div class="note warn">'+year+(' '+t('oranları henüz uygulamada yok;')+' ')+r.year+(' '+t('değerleriyle yaklaşık hesaplandı.')+'</div>') : '') +
    ('<div class="kv"><span>'+t('Konut kira geliri')+'</span><span>')+tl(e.gross)+'</span></div>' +
    ('<div class="kv"><span>'+t('İstisna')+'</span><span>')+(ui.noExemption ? t('Uygulanmıyor') : '− '+tl(e.istisna))+'</span></div>' +
    (e.belowExemption
      ? ('<div class="note">'+t('Gelir istisna tutarının altında; bu yıl için konut kira geliri beyanı gerekmeyebilir.')+'</div>')
      : ('<div class="kv"><span>'+t('Vergiye tabi kısım')+'</span><span>')+tl(e.taxable)+'</span></div>' +
        '<div class="taxgrid">' +
          ('<div class="card"><div class="label">'+t('Götürü gider ({pct})', { pct:percent(Math.round(r.goturu * 100)) }))+'</div><div class="mid">'+tl(e.goturu.tax)+('</div><div class="muted">'+t('Matrah')+' ')+tl(e.goturu.base)+'</div>'+pick('goturu')+'</div>' +
          ('<div class="card"><div class="label">'+t('Gerçek gider')+'</div><div class="mid">')+tl(e.gercek.tax)+('</div><div class="muted">'+t('İndirilebilir gider')+' ')+tl(e.gercek.allowed)+'</div>'+pick('gercek')+'</div>' +
        '</div>') +
    ('<label class="toggle" style="border-top:0;padding:4px 0;font-size:14px">'+t('İstisnadan yararlanamıyorum')+'<input type="checkbox" data-input="noExemption"')+(ui.noExemption ? ' checked' : '')+'></label>' +
    ('<div class="muted" style="font-size:12.5px">'+t('Ticari, zirai ya da serbest meslek kazancı beyan edenler veya diğer gelirleri belirli sınırı aşanlar istisnadan yararlanamaz. Tahmin başka gelir olmadığını varsayar; beyan öncesi mali müşavirine danış.')+'</div>') +
    '</section>';
}

/** Takvim: tüm evlerin yaklaşan işleri tarih sırasında. */
function agendaScreenBody(props){
  const all = [];
  props.forEach(p => agendaItems(p).forEach(it => all.push(Object.assign({ prop:p.name }, it))));
  all.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

  if (!all.length) return ('<div class="empty">'+t('Yaklaşan bir iş görünmüyor.')+'</div>');

  const buckets = [
    [t('Gecikmiş'), it => it.days != null && it.days < 0],
    [t('Bu hafta'), it => it.days != null && it.days >= 0 && it.days <= 7],
    [t('Bu ay'), it => it.days != null && it.days > 7 && it.days <= 30],
    [t('Sonrası'), it => it.days == null || it.days > 30]
  ];

  return '<div class="stack">' + buckets.map(([label, test]) => {
    const list = all.filter(test);
    if (!list.length) return '';
    return '<section><h2 style="margin-bottom:6px">'+label+'</h2><div class="list">' +
      list.map(it => '<button class="li" data-act="nav" data-go="'+esc(it.go)+'">' +
        '<div><b>'+esc(it.title)+'</b><div class="muted">'+(props.length > 1 ? esc(it.prop)+' · ' : '')+esc(it.sub)+'</div></div>' +
        '<span class="chip '+(it.days != null && it.days <= 7 ? 'bad' : '')+'">'+esc(it.chip)+'</span></button>').join('') +
      '</div></section>';
  }).join('') + '</div>';
}

function agendaScreen(){
  return header(t('Takvim'), t('Tüm evlerin yaklaşan işleri')) + agendaScreenBody(S.order.map(id => P(id)));
}

export function landlordScreen(route){
  if (route.tab === 'portfolio') return route.pid ? propDetail(route) : portfolio();
  if (route.tab === 'lreq') return allRequests();
  if (route.tab === 'lmsg') return threads();
  if (route.tab === 'report') return report();
  if (route.tab === 'agenda') return agendaScreen();
  return portfolio();
}

/* ---------------- sekme çubuğu ve gezinme paneli ---------------- */

const TENANT_TABBAR = [
  ['panel',t('Panel'),'home','/kiraci'],
  ['pay',t('Ödemeler'),'card','/kiraci/odemeler'],
  ['req',t('Talepler'),'wrench','/kiraci/talepler'],
  ['msg',t('Mesajlar'),'chat','/kiraci/mesajlar'],
  ['docs',t('Belgeler'),'doc','/kiraci/belgeler']
];
const LANDLORD_TABBAR = [
  ['portfolio',t('Portföy'),'grid','/ev-sahibi'],
  ['lreq',t('Talepler'),'wrench','/ev-sahibi/talepler'],
  ['lmsg',t('Mesajlar'),'chat','/ev-sahibi/mesajlar'],
  ['agenda',t('Takvim'),'calendar','/ev-sahibi/takvim'],
  ['report',t('Rapor'),'chart','/ev-sahibi/rapor']
];

export function tabbar(route){
  const tabs = route.role === 'tenant' ? TENANT_TABBAR : LANDLORD_TABBAR;
  const reqN = route.role === 'tenant'
    ? openReqs(P(S.myHome)).length
    : S.order.reduce((a, id) => a + newReqs(P(id)).length, 0);

  return tabs.map(tb => {
    const badge = (tb[0] === 'req' || tb[0] === 'lreq') && reqN ? '<span class="n">'+reqN+'</span>' : '';
    return '<button class="tab" data-act="nav" data-go="'+tb[3]+'"'+(route.tab === tb[0] ? ' aria-current="page"' : '')+'>' +
      I[tb[2]]+'<span>'+tb[1]+'</span>'+badge+'</button>';
  }).join('');
}

/** Harita öğesi geçerli adresi kapsıyor mu (alt sayfalar dahil)? */
export function isCurrent(route, item){
  if (route.path === item.path) return true;
  // Kök adresler her şeyin öneki olduğu için yalnızca tam eşleşmede işaretlenir.
  if (item.path === '/kiraci' || item.path === '/ev-sahibi') return false;
  return route.path.startsWith(item.path + '/');
}

/** Dil seçici: her dilin adı kendi dilinde yazılır. */
export function langSwitch(){
  return '<div class="seg" role="group" aria-label="'+t('Dil')+' / Language">' +
    LANGS.map(([code, name]) => '<button data-act="lang" data-v="'+code+'" lang="'+code+'" aria-pressed="'+(getLang() === code)+'">'+name+'</button>').join('') +
    '</div>';
}

/** Kurulum önerisi: tarayıcı destekliyorsa düğme, iOS'ta talimat, kuruluysa hiçbir şey. */
export function installBlock(){
  if (pwa.installed) return '';
  if (pwa.installable)
    return '<button class="btn small primary" data-act="install">'+ic('home', 15)+(' '+t('Uygulamayı yükle')+'</button>');
  if (pwa.ios)
    return ('<div class="note" style="font-size:13px">'+t('Ana ekrana eklemek için Safari’de')+' <b>'+t('Paylaş')+'</b> → <b>'+t('Ana Ekrana Ekle')+'</b>.</div>');
  return '';
}

export function shell(route, bare){
  const map = screenMap();
  const items = route.role === 'tenant' ? map.tenant : map.landlord;
  const brand = '<div class="brand"><div class="mark">'+ic('home', 20)+('</div><div><b>'+t('Evim')+'</b>') +
      '<div class="muted" style="font-size:12px">'+(LIVE ? t('Kira yönetimi') : t('Kira yönetimi · demo'))+'</div></div></div>';

  if (bare){
    return brand + ('<p class="muted">'+t('Kiracı ve ev sahibi aynı kaydı görür: ödemeler, talepler, belgeler, tutanaklar ve depozito tek yerde.')+'</p>') +
      ('<ul class="bullets"><li>'+t('Dekont yükle, onay al')+'</li><li>'+t('Arıza ve tadilat taleplerini adım adım izle')+'</li>') +
      ('<li>'+t('Giriş–çıkış tutanağı ve depozito hesabı')+'</li><li>'+t('Kira artışını yasal sınırla hesapla')+'</li></ul>');
  }

  if (LIVE){
    const prof = live.profile || {};
    const themeBtnL = (v, label, icon) =>
      '<button class="btn small '+(S.theme === v ? 'primary' : 'ghost')+'" data-act="theme" data-v="'+v+'">'+ic(icon, 15)+' '+label+'</button>';
    return brand +
      '<div class="card stack" style="gap:8px;padding:14px"><div class="row">' +
        '<div class="avatar">'+esc(initials(prof.name || '?'))+'</div>' +
        '<div style="min-width:0"><b>'+esc(prof.name || '')+'</b><div class="muted" style="font-size:12.5px">'+(prof.role === 'landlord' ? t('Ev sahibi') : t('Kiracı'))+' · '+esc(live.user?.email || '')+'</div></div></div>' +
        ('<button class="btn small ghost" data-act="sheet" data-s="hesap">'+t('Hesap ve bildirimler')+'</button></div>') +
      ('<div><h2>'+t('Ekranlar')+'</h2><div class="maplist" style="margin-top:6px">') +
        items.map(it => '<button class="'+(it.depth ? 'depth' : '')+'" data-act="nav" data-go="'+esc(it.path)+'"' +
          (isCurrent(route, it) ? ' aria-current="true"' : '')+'>'+(it.depth ? '' : ic(it.icon, 17))+esc(it.label)+'</button>').join('') +
      '</div></div>' +
      ('<div><h2>'+t('Tema')+'</h2><div class="shellgrid" style="margin-top:6px">') +
        themeBtnL('system',t('Sistem'),'gear')+themeBtnL('light',t('Açık'),'sun')+themeBtnL('dark',t('Koyu'),'moon')+'</div></div>' +
      '<div><h2>'+t('Dil')+'</h2><div style="margin-top:6px">'+langSwitch()+'</div></div>' +
      ('<div class="stack" style="gap:8px"><h2>'+t('Araçlar')+'</h2>') + installBlock() +
        '<button class="btn small ghost" data-act="sheet" data-s="arama">'+ic('search', 15)+(' '+t('Ara')+'</button>') +
        ('<button class="btn small ghost" data-act="exportData">'+t('Verilerimi indir')+'</button>') +
        ('<button class="btn small ghost" data-act="signOut">'+t('Çıkış yap')+'</button></div>');
  }
  const themeBtn = (v, label, icon) =>
    '<button class="btn small '+(S.theme === v ? 'primary' : 'ghost')+'" data-act="theme" data-v="'+v+'">'+ic(icon, 15)+' '+label+'</button>';

  return '<div class="brand"><div class="mark">'+ic('home', 20)+('</div><div><b>'+t('Evim')+'</b>') +
      ('<div class="muted" style="font-size:12px">'+t('Kira yönetimi prototipi')+'</div></div></div>') +

    ('<div class="seg" role="group" aria-label="'+t('Rol')+'">') +
      '<button data-act="nav" data-go="/kiraci" aria-pressed="'+(route.role === 'tenant')+('">'+t('Kiracı')+'</button>') +
      '<button data-act="nav" data-go="/ev-sahibi" aria-pressed="'+(route.role === 'landlord')+('">'+t('Ev sahibi')+'</button></div>') +

    ('<div><h2>'+t('Ekranlar')+'</h2><div class="maplist" style="margin-top:6px">') +
      items.map(it => '<button class="'+(it.depth ? 'depth' : '')+'" data-act="nav" data-go="'+esc(it.path)+'"' +
        (isCurrent(route, it) ? ' aria-current="true"' : '')+'>'+(it.depth ? '' : ic(it.icon, 17))+esc(it.label)+'</button>').join('') +
    '</div></div>' +

    ('<div><h2>'+t('Adres')+'</h2><div class="routebox" style="margin-top:6px">#')+esc(route.path)+(route.sheet ? '?s='+esc(route.sheet) : '')+'</div></div>' +

    ('<div><h2>'+t('Tema')+'</h2><div class="shellgrid" style="margin-top:6px">') +
      themeBtn('system',t('Sistem'),'gear')+themeBtn('light',t('Açık'),'sun')+themeBtn('dark',t('Koyu'),'moon')+'</div></div>' +
    '<div><h2>'+t('Dil')+'</h2><div style="margin-top:6px">'+langSwitch()+'</div></div>' +

    ('<div class="stack" style="gap:8px"><h2>'+t('Araçlar')+'</h2>') + installBlock() +
      '<button class="btn small ghost" data-act="startTour">'+ic('flag', 15)+(' '+t('Rehberli tura başla')+'</button>') +
      '<button class="btn small ghost" data-act="sheet" data-s="arama">'+ic('search', 15)+(' '+t('Ara')+'</button>') +
      ('<button class="btn small ghost" data-act="exportData">'+t('Verileri dışa aktar')+'</button>') +
      ('<label class="btn small ghost" style="cursor:pointer">'+t('Veri içe aktar')+'<input type="file" accept="application/json" class="sr" data-input="importData"></label>') +
      ('<button class="btn small danger" data-act="reset">'+t('Demoyu sıfırla')+'</button></div>') +

    ('<p class="foot" style="margin-top:auto">'+t('Her ekranın kendi adresi var; bağlantıyı paylaşınca aynı ekran açılır.')+'</p>');
}

/* ---------------- arama paneli ---------------- */

export function searchBody(){
  const q = ui.q || '';
  const results = search(q);
  return ('<h3>'+t('Ara')+'</h3>') +
    '<div class="search">'+ic('search')+'<input id="searchIn" data-input="q" value="'+esc(q)+('" placeholder="'+t('Talep, belge, mesaj ya da ev ara')+'" autocomplete="off"></div>') +
    (q.trim().length < 2
      ? ('<div class="empty">'+t('En az iki harf yaz. Talep başlıkları, belge adları, mesajlar ve ev bilgileri taranır.')+'</div>')
      : results.length
        ? '<div class="list" style="margin-top:12px">'+results.map(r =>
            '<button class="li" data-act="nav" data-go="'+esc(r.go)+'"><div class="row" style="gap:10px;min-width:0">' +
            '<span style="color:var(--accent);flex:none">'+ic(r.icon)+'</span>' +
            '<div style="min-width:0"><b style="font-size:14px">'+esc(r.title)+'</b><div class="muted">'+esc(r.sub)+'</div></div></div></button>').join('')+'</div>'
        : ('<div class="empty">'+t('Sonuç yok.')+'</div>'));
}

export { agendaScreenBody };
