/* Alt sayfalar (sheet'ler). Hangi sheet'in açık olduğu adresten okunur:
   ?s=<ad> — böylece geri tuşu sheet'i kapatır, link paylaşımı sheet'i açar. */

import { S, ui, CATS, DOC_CATS, COST_OPTS, STEPS, EXPENSE_CATS, DEDUCTION_PRESETS } from './state.js';
import { I, ic } from './icons.js';
import { current } from './router.js';
import { P, period, statusOf, remaining, ST, reminders, otherPerson, rentAt, moveOutSummary } from './logic.js';
import { searchBody, isCurrent, installBlock } from './views.js';
import { esc, opts, tl, fmt, fmtFull, monthYear, parse, iso, t0, daysTo, tm, ago } from './util.js';
import { screenMap } from './router.js';
import { LIVE } from './config.js';
import { live, mediaSrc, inviteLink, markInboxRead } from './backend.js';
import { isStored, storedPath } from './mapping.js';

function reqOf(p, id){ return p.requests.find(r => r.id === id); }

/** Açık sheet'in gövdesi; null dönerse katman boş kalır. */
export function sheetBody(route){
  const name = route.sheet;
  if (!name) return null;
  const pid = route.params.pid || route.pid || S.myHome;
  const p = S.props[pid] ? P(pid) : P(S.myHome);

  switch (name){
    case 'arama': return searchBody();
    case 'harita': return mapSheet(route);
    case 'bildirim': return inboxSheet();
    case 'ayarlar': return settingsSheet();
    case 'yeni-talep': return newReqSheet(p);
    case 'talep': return reqSheet(p, route.params.id || route.reqId);
    case 'belge': return uploadSheet(p, route.params.cat);
    case 'dekont': return receiptSheet(p, route.params.key);
    case 'odeme': return payFormSheet(p, route.params.key);
    case 'red': return rejectSheet(p, route.params.key);
    case 'yenileme': return renewalSheet(p);
    case 'ev-ekle': return addPropSheet();
    case 'ev-duzenle': return editPropSheet(p);
    case 'metin': return textSheet();
    case 'kiraci-ekle': return addTenantSheet(p);
    case 'gider': return expenseSheet(p, route.params.id);
    case 'teklif': return quoteSheet(p, route.params.id);
    case 'fatura': return invoiceSheet(p, route.params.id);
    case 'cikis-baslat': return startMoveOutSheet(p);
    case 'kesinti': return deductionSheet(p);
    case 'iade': return refundSheet(p);
    case 'hesap': return LIVE ? accountSheet() : null;
    case 'davet-paylas': return shareInviteSheet(p, route.params.code || route.params.key);
    default: return null;
  }
}

function mapSheet(route){
  const map = screenMap();
  const items = route.role === 'tenant' ? map.tenant : map.landlord;
  return '<h3>Ekran haritası</h3>' +
    (LIVE ? '' :
    '<div class="seg" role="group" aria-label="Rol" style="margin-bottom:12px">' +
      '<button data-act="nav" data-go="/kiraci" aria-pressed="'+(route.role === 'tenant')+'">Kiracı</button>' +
      '<button data-act="nav" data-go="/ev-sahibi" aria-pressed="'+(route.role === 'landlord')+'">Ev sahibi</button></div>') +
    '<div class="maplist">' + items.map(it =>
      '<button class="'+(it.depth ? 'depth' : '')+'" data-act="nav" data-go="'+esc(it.path)+'"' +
      (isCurrent(route, it) ? ' aria-current="true"' : '')+'>'+(it.depth ? '' : ic(it.icon, 17))+esc(it.label)+'</button>').join('') +
    '</div>' +
    (LIVE ? '' : '<button class="btn ghost block" style="margin-top:14px" data-act="startTour">'+ic('flag', 16)+' Rehberli tura başla</button>');
}

function inboxSheet(){
  if (S.inbox.some(n => !n.read)) markInboxRead().catch(() => {});
  S.inbox.forEach(n => { n.read = true; });
  const rem = reminders();
  return '<div class="row" style="justify-content:space-between"><h3 style="margin:0">Bildirimler</h3>' +
      (S.inbox.length ? '<button class="btn small ghost" data-act="clearInbox">Geçmişi temizle</button>' : '') + '</div>' +
    '<h2 style="margin:16px 0 4px">Hatırlatmalar</h2><div class="list">' +
      (rem.length
        ? rem.map(r => '<button class="li" data-act="nav" data-go="'+esc(r.go)+'">' +
            '<div><b>'+esc(r.t)+'</b><div class="muted">'+esc(r.b)+'</div></div>' +
            '<span class="chip '+(r.w > 1 ? 'bad' : 'wait')+'">Git</span></button>').join('')
        : '<div class="muted" style="padding:10px 0">Şu an hatırlatma yok.</div>') + '</div>' +
    '<h2 style="margin:18px 0 4px">Son olaylar</h2><div class="list">' +
      (S.inbox.length
        ? S.inbox.slice().reverse().map(n => '<div class="li"><div><b>'+esc(n.title)+'</b>' +
            '<div class="muted">'+esc(n.body)+'</div></div>' +
            '<span class="muted" style="flex:none">'+esc(ago(n.at))+'</span></div>').join('')
        : '<div class="muted" style="padding:10px 0">Henüz olay yok.</div>') + '</div>';
}

function settingsSheet(){
  const s = S.settings;
  const previews = ui.role === 'tenant'
    ? [['rent','Kira yaklaşıyor'],['reqUpd','Talep güncellendi'],['renew','Yenileme teklifi'],['evict','Tahliye tarihi']]
    : [['receipt','Dekont geldi'],['late','Kira gecikti'],['newReq','Yeni talep'],['dask','DASK bitiyor']];

  return '<h3>Ayarlar</h3>' +
    '<div class="muted" style="margin-bottom:6px">Hatırlatma eşikleri '+(ui.role === 'tenant' ? 'kiracı' : 'ev sahibi')+' görünümüne uygulanır.</div>' +
    '<label class="toggle">Kira günü hatırlatması (gün önce)<input type="number" min="0" max="15" value="'+s.rentDays+'" data-input="set" data-k="rentDays"></label>' +
    '<label class="toggle">Sözleşme yenileme (gün önce)<input type="number" min="7" max="120" value="'+s.renewDays+'" data-input="set" data-k="renewDays"></label>' +
    (ui.role === 'landlord' ? '<label class="toggle">DASK ve sigorta (gün önce)<input type="number" min="7" max="90" value="'+s.insDays+'" data-input="set" data-k="insDays"></label>' : '') +
    '<label class="toggle">Tahliye tarihi (gün önce)<input type="number" min="7" max="180" value="'+s.evictDays+'" data-input="set" data-k="evictDays"></label>' +
    '<label class="toggle">Talep güncellemeleri<input type="checkbox" data-input="setb" data-k="reqUpdates"'+(s.reqUpdates ? ' checked' : '')+'></label>' +

    '<h2 style="margin:18px 0 8px">Tema</h2><div class="seg" role="group" aria-label="Tema">' +
      ['system','light','dark'].map((v, i) => '<button data-act="theme" data-v="'+v+'" aria-pressed="'+(S.theme === v)+'">'+['Sistem','Açık','Koyu'][i]+'</button>').join('') +
    '</div>' +

    (LIVE
      ? '<h2 style="margin:18px 0 8px">Hesap</h2><button class="btn small ghost block" data-act="sheet" data-s="hesap">Hesap ve bildirim ayarları</button>'
      : '<h2 style="margin:18px 0 8px">Bildirimleri dene</h2><div class="grid2">' +
          previews.map(([v, label]) => '<button class="btn small ghost" data-act="preview" data-v="'+v+'">'+label+'</button>').join('') +
        '</div>') +

    (installBlock() ? '<h2 style="margin:18px 0 8px">Uygulama</h2>' + installBlock() : '') +
    '<h2 style="margin:18px 0 8px">Veri</h2><div class="stack" style="gap:8px">' +
      (LIVE ? '' : '<button class="btn small ghost" data-act="startTour">'+ic('flag', 15)+' Rehberli tur</button>') +
      '<button class="btn small ghost" data-act="sheet" data-s="harita">'+ic('map', 15)+' Ekran haritası</button>' +
      '<button class="btn small ghost" data-act="exportData">'+(LIVE ? 'Verilerimi indir (JSON)' : 'Verileri dışa aktar (JSON)')+'</button>' +
      (LIVE ? '' :
        '<label class="btn small ghost" style="cursor:pointer">Veri içe aktar<input type="file" accept="application/json" class="sr" data-input="importData"></label>' +
        '<button class="btn small danger" data-act="reset">Demo verisini sıfırla</button>') +
    '</div>' +
    '<p class="foot">'+(LIVE ? 'Verilerin sunucuda, yalnızca evin üyelerinin erişebileceği şekilde saklanır.' : 'Veriler yalnızca bu tarayıcıda saklanır.')+'</p>';
}

function newReqSheet(p){
  return '<h3>Yeni talep</h3><form class="stack" data-form="newReq" data-pid="'+p.id+'">' +
    '<label class="field">Tür<select name="cat">'+opts(CATS, 'Arıza')+'</select></label>' +
    '<label class="field">Başlık<input name="title" required maxlength="80" placeholder="Ör. Mutfak musluğu damlatıyor"></label>' +
    '<label class="field">Açıklama<textarea name="desc" maxlength="600" placeholder="Ne zamandır sürüyor, nerede, nasıl?"></textarea></label>' +
    '<label class="field">Aciliyet<select name="urgency">'+opts(['Normal','Acil'], 'Normal')+'</select></label>' +
    '<label class="field">Fotoğraf<input type="file" name="files" accept="image/*" multiple style="padding-top:10px"></label>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Talebi gönder</button></div></form>';
}

function reqSheet(p, id){
  const r = reqOf(p, id);
  if (!r) return '<h3>Talep bulunamadı</h3><button class="btn ghost block" data-act="closeSheet">Kapat</button>';

  let steps = '';
  for (let i = 0; i < 4; i++){
    steps += '<i class="'+(i <= r.status ? 'on' : '')+'"></i>' + (i < 3 ? '<b class="'+(i < r.status ? 'on' : '')+'"></b>' : '');
  }

  let ctrl = '';
  if (ui.role === 'landlord'){
    if (r.cat === 'Ek talep' && !r.decision)
      ctrl += '<div class="row"><button class="btn primary" style="flex:1" data-act="decide" data-pid="'+p.id+'" data-id="'+r.id+'" data-v="Onaylandı">Onayla</button>' +
        '<button class="btn ghost" style="flex:1" data-act="decide" data-pid="'+p.id+'" data-id="'+r.id+'" data-v="Reddedildi">Reddet</button></div>';
    else if (r.status < 3)
      ctrl += '<button class="btn primary block" data-act="advance" data-pid="'+p.id+'" data-id="'+r.id+'">Durumu ilerlet: '+STEPS[r.status+1]+'</button>';
    if (r.status > 0 && r.cat !== 'Ek talep')
      ctrl += '<button class="btn ghost block" data-act="rewind" data-pid="'+p.id+'" data-id="'+r.id+'">Bir adım geri al</button>';
    ctrl += '<label class="field">Masrafı kim karşılıyor?<select data-input="cost" data-pid="'+p.id+'" data-id="'+r.id+'">'+opts(COST_OPTS, r.cost)+'</select></label>';
  } else {
    if (r.cost !== 'Belirlenmedi' && !r.costOk && r.cat !== 'Ek talep')
      ctrl += '<div class="note">Ev sahibi masrafın <b>'+esc(r.cost)+'</b> tarafından karşılanmasını önerdi.</div>' +
        '<button class="btn primary block" data-act="okCost" data-pid="'+p.id+'" data-id="'+r.id+'">Masraf paylaşımını onayla</button>';
    if (r.status < 3)
      ctrl += '<button class="btn ghost block" data-act="closeReq" data-pid="'+p.id+'" data-id="'+r.id+'">Talebi kapat (çözüldü)</button>';
  }

  const shots = (r.shots || []).map((src, j) =>
    '<div class="thumb"><img src="'+esc(mediaSrc(src))+'" alt="Talep fotoğrafı '+(j+1)+'"></div>').join('');
  const placeholders = Array.from({ length: Math.min(r.photos || 0, 5) }, () => '<div class="ph">foto</div>').join('');

  const timeline = (r.log || []).slice().reverse().map(e =>
    '<div class="li"><div><b style="font-size:14px">'+esc(e.text)+'</b><div class="muted">'+esc(ago(e.at))+'</div></div></div>').join('');

  return '<div class="label" style="color:var(--accent)">'+esc(r.cat)+' · '+esc(r.urgency)+' · '+fmtFull(parse(r.date))+'</div>' +
    '<h3 style="margin-top:4px">'+esc(r.title)+'</h3><div class="stack">' +
    '<div class="muted" style="font-size:15px">'+esc(r.desc || 'Açıklama yok.')+'</div>' +
    (shots || placeholders ? '<div class="thumbs">'+shots+placeholders+'</div>' : '') +
    (r.cat !== 'Ek talep'
      ? '<div><div class="steps">'+steps+'</div><div class="steplbl">'+STEPS.map((s,i) => '<span class="'+(i === r.status ? 'on' : '')+'">'+s+'</span>').join('')+'</div></div>'
      : (r.decision
          ? '<span class="chip '+(r.decision === 'Onaylandı' ? 'ok' : 'bad')+'">'+esc(r.decision)+'</span>'
          : '<span class="chip wait">Ev sahibinin kararı bekleniyor</span>')) +
    '<div class="kv"><span>Masraf</span><span>'+esc(r.cost)+(r.costOk ? ' · onaylı' : r.cost !== 'Belirlenmedi' ? ' · onay bekliyor' : '')+'</span></div>' +
    ctrl +
    quotesSection(p, r) +
    (timeline ? '<section><h2 style="margin-bottom:4px">Geçmiş</h2><div class="list">'+timeline+'</div></section>' : '') +
    '<button class="btn ghost block" data-act="goMsg" data-pid="'+p.id+'">Bu talep hakkında yaz</button></div>';
}

function uploadSheet(p, cat){
  return '<h3>Belge yükle</h3><form class="stack" data-form="upload" data-pid="'+p.id+'">' +
    '<label class="field">Kategori<select name="cat">'+opts(DOC_CATS, cat || DOC_CATS[0])+'</select></label>' +
    '<label class="field">Dosya<input type="file" name="file" accept="application/pdf,image/*" required style="padding-top:10px"></label>' +
    '<label class="field">Bitiş veya tahliye tarihi (varsa)<input type="date" name="until"></label>' +
    '<div class="muted">Tarih girersen, yaklaştığında iki tarafa da hatırlatma gider. Tahliye taahhütnamesi ve sigorta poliçeleri için önerilir.</div>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Yükle</button></div></form>';
}

function receiptSheet(p, key){
  const rc = p.pay[key] || {};
  const st = statusOf(p, key);
  return '<h3>'+monthYear(key)+' dekontu</h3><div class="stack">' +
    receiptPreview(rc) +
    '<div class="kv"><span>Tutar</span><span>'+tl(rc.amount != null ? rc.amount : rentAt(p, key))+'</span></div>' +
    '<div class="kv"><span>Beklenen</span><span>'+tl(rentAt(p, key))+'</span></div>' +
    '<div class="kv"><span>Ödeme tarihi</span><span>'+(rc.date ? fmtFull(parse(rc.date)) : '—')+'</span></div>' +
    '<div class="kv"><span>Durum</span><span>'+esc((ST[st] || ST.pending)[0])+'</span></div>' +
    (rc.note ? '<div class="kv"><span>Not</span><span>'+esc(rc.note)+'</span></div>' : '') +
    (rc.rejectReason ? '<div class="note warn">Red gerekçesi: '+esc(rc.rejectReason)+'</div>' : '') +
    (ui.role === 'landlord' && (st === 'review' || st === 'partial')
      ? '<div class="row"><button class="btn primary" style="flex:1" data-act="approvePay" data-pid="'+p.id+'" data-key="'+key+'">Onayla</button>' +
        '<button class="btn ghost" style="flex:1" data-act="sheet" data-s="red" data-pid="'+p.id+'" data-key="'+key+'">Reddet</button></div>'
      : '') +
    (ui.role === 'tenant' && (st === 'rejected' || st === 'late' || st === 'pending')
      ? '<button class="btn primary block" data-act="sheet" data-s="odeme" data-pid="'+p.id+'" data-key="'+key+'">Dekont yükle</button>'
      : '') +
    '</div>';
}

function payFormSheet(p, key){
  const k = key || period(p).key;
  const rec = p.pay[k] || {};
  const paid = rec.status === 'partial' ? Number(rec.amount) || 0 : 0;
  const due = rentAt(p, k);
  const suggest = Math.max(0, due - paid);
  return '<h3>'+monthYear(k)+' ödemesi</h3><form class="stack" data-form="pay" data-pid="'+p.id+'" data-key="'+k+'">' +
    '<div class="kv"><span>Bu ayın kirası</span><span>'+tl(due)+'</span></div>' +
    (paid ? '<div class="kv"><span>Şimdiye kadar ödenen</span><span>'+tl(paid)+'</span></div>' : '') +
    '<label class="field">Ödenen tutar (₺)<input name="amount" type="number" min="0" step="1" required value="'+suggest+'" inputmode="numeric"></label>' +
    '<label class="field">Ödeme tarihi<input name="date" type="date" required value="'+iso(t0())+'" max="'+iso(t0())+'"></label>' +
    '<label class="field">Dekont (görsel ya da PDF)<input type="file" name="file" accept="image/*,application/pdf" required style="padding-top:10px"></label>' +
    '<label class="field">Not (isteğe bağlı)<input name="note" maxlength="120" placeholder="Ör. havale açıklaması"></label>' +
    '<div class="muted">Tutar kiranın altındaysa ödeme kısmi olarak işaretlenir ve kalan bakiye takip edilir.</div>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Gönder</button></div></form>';
}

function rejectSheet(p, key){
  return '<h3>Dekontu reddet</h3><form class="stack" data-form="reject" data-pid="'+p.id+'" data-key="'+key+'">' +
    '<div class="muted">Kiracıya gerekçe iletilir; ödeme yeniden yüklenebilir.</div>' +
    '<label class="field">Gerekçe<select name="reason">'+opts(['Tutar eksik','Dekont okunmuyor','Farklı hesaba yatmış','Tarih uyuşmuyor','Diğer'], 'Tutar eksik')+'</select></label>' +
    '<label class="field">Açıklama (isteğe bağlı)<input name="note" maxlength="120"></label>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn danger" style="flex:1">Reddet</button></div></form>';
}

function renewalSheet(p){
  const cpi = ui.renewal.cpi == null ? '' : ui.renewal.cpi;
  const max = cpi === '' ? 0 : Math.round(p.rent * (1 + Number(cpi)/100));
  return '<h3>Kira artışı hesaplama</h3><div class="stack">' +
    '<div class="kv"><span>Mevcut kira</span><span>'+tl(p.rent)+'</span></div>' +
    '<div class="kv"><span>Sözleşme bitişi</span><span>'+fmtFull(parse(p.contractEnd))+'</span></div>' +
    '<label class="field">Son 12 aylık TÜFE ortalaması (%)' +
      '<input type="number" step="0.01" min="0" max="200" value="'+cpi+'" data-input="cpi" placeholder="TÜİK’in açıkladığı oran" inputmode="decimal"></label>' +
    '<div class="note" id="maxOut">' +
      (cpi === '' ? 'Oranı girince yasal üst sınır burada görünür.' : 'Yasal üst sınır: <b>'+tl(max)+'</b> (+'+tl(max - p.rent)+')') + '</div>' +
    (ui.role === 'landlord'
      ? '<label class="field">Önereceğin kira<input type="number" min="0" value="'+(ui.renewal.amount || max || '')+'" data-input="amount" inputmode="numeric"></label>' +
        '<button class="btn primary block" data-act="sendRenewal" data-pid="'+p.id+'"'+(cpi === '' ? ' disabled' : '')+'>Teklifi kiracıya gönder</button>'
      : '') +
    '<div class="muted">Oranı TÜİK’in resmi açıklamasından kontrol et. Taraflar daha düşük bir artışta anlaşabilir.</div></div>';
}

function addPropSheet(){
  return '<h3>Ev ekle</h3><form class="stack" data-form="addProp">' +
    '<label class="field">Ev adı<input name="name" required maxlength="60" placeholder="Ör. Kadıköy 3+1"></label>' +
    '<label class="field">Adres<input name="addr" required maxlength="120"></label>' +
    '<div class="grid2"><label class="field">Aylık kira (₺)<input name="rent" type="number" min="0" required inputmode="numeric"></label>' +
    '<label class="field">Ödeme günü<input name="due" type="number" min="1" max="28" value="1" inputmode="numeric"></label></div>' +
    '<label class="field">Kiracının telefonu<input name="phone" type="tel" placeholder="05__ ___ __ __"></label>' +
    '<div class="muted">Kaydettiğinde kiracıya WhatsApp ile davet linki hazırlanır; katıldığında ev iki taraflı panele dönüşür.</div>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Kaydet ve davet et</button></div></form>';
}

function editPropSheet(p){
  return '<h3>Ev bilgileri</h3><form class="stack" data-form="editProp" data-pid="'+p.id+'">' +
    '<label class="field">Ev adı<input name="name" required maxlength="60" value="'+esc(p.name)+'"></label>' +
    '<label class="field">Adres<input name="addr" required maxlength="120" value="'+esc(p.addr)+'"></label>' +
    '<div class="grid2"><label class="field">Aylık kira (₺)<input name="rent" type="number" min="0" required value="'+p.rent+'"></label>' +
    '<label class="field">Ödeme günü<input name="due" type="number" min="1" max="28" value="'+p.dueDay+'"></label></div>' +
    '<div class="grid2"><label class="field">Aidat (₺)<input name="aidat" type="number" min="0" value="'+p.aidat+'"></label>' +
    '<label class="field">Aidatı ödeyen<select name="aidatPayer">'+opts(['Kiracı','Ev sahibi'], p.aidatPayer)+'</select></label></div>' +
    '<div class="grid2"><label class="field">Depozito (₺)<input name="deposit" type="number" min="0" value="'+p.deposit+'"></label>' +
    '<label class="field">Tahmini değer (₺)<input name="value" type="number" min="0" value="'+(p.value || '')+'" placeholder="İsteğe bağlı"></label></div>' +
    '<div class="muted">Kira tutarını değiştirirsen bugünden geçerli yeni bir dönem olarak kira geçmişine eklenir. Değer, net getiri oranı için kullanılır.</div>' +
    '<div class="grid2"><label class="field">Sözleşme bitişi<input name="contractEnd" type="date" value="'+esc(p.contractEnd)+'"></label>' +
    '<label class="field">DASK bitişi<input name="dask" type="date" value="'+esc(p.dask)+'"></label></div>' +

    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Kaydet</button></div>' +
    (S.order.length > 1 ? '<button type="button" class="btn small danger block" data-act="removeProp" data-pid="'+p.id+'">Bu evi kaldır</button>' : '') +
    '</form>';
}

function textSheet(){
  const t = ui.text || { title:'Metin', body:'' };
  return '<h3>'+esc(t.title)+'</h3><div class="stack">' +
    '<textarea id="txtOut" readonly style="min-height:220px;border-radius:12px;border:1px solid var(--line);background:var(--bg);padding:12px;font-size:14px">'+esc(t.body)+'</textarea>' +
    '<div class="row"><button class="btn primary" style="flex:1" data-act="copyText">Kopyala</button>' +
    '<button class="btn ghost" style="flex:1" data-act="downloadText">İndir</button></div></div>';
}

/* ---------------- teklifler ve fatura ---------------- */

function quotesSection(p, r){
  const quotes = r.quotes || [];
  const landlord = ui.role === 'landlord';
  if (!quotes.length && !landlord && !r.invoice) return '';
  return '<section class="card stack" style="gap:8px">' +
    '<div class="row" style="justify-content:space-between"><h2>Usta ve teklifler</h2>' +
      (landlord && r.status < 3 ? '<button class="btn small ghost" data-act="sheet" data-s="teklif" data-pid="'+p.id+'" data-id="'+r.id+'">'+ic('plus', 15)+' Teklif</button>' : '') + '</div>' +
    (quotes.length
      ? '<div class="list">' + quotes.slice().sort((a, b) => a.amount - b.amount).map(q =>
          '<div class="li"><div style="min-width:0"><b>'+esc(q.vendor)+'</b>' +
            '<div class="muted">'+tl(q.amount)+(q.note ? ' · '+esc(q.note) : '')+'</div></div>' +
          '<div class="row" style="gap:6px">' +
            (q.chosen ? '<span class="chip ok">Seçildi</span>'
              : landlord && r.status < 3 ? '<button class="btn small ghost" data-act="chooseQuote" data-pid="'+p.id+'" data-id="'+r.id+'" data-q="'+esc(q.id)+'">Seç</button>' : '') +
            (q.phone ? '<a class="iconbtn sm" href="tel:'+esc(q.phone)+'" aria-label="'+esc(q.vendor)+' ara">'+ic('phone', 16)+'</a>' : '') +
            (landlord && !q.chosen ? '<button class="iconbtn sm" data-act="removeQuote" data-pid="'+p.id+'" data-id="'+r.id+'" data-q="'+esc(q.id)+'" aria-label="'+esc(q.vendor)+' teklifini sil">'+ic('x', 16)+'</button>' : '') +
          '</div></div>').join('') + '</div>'
      : '<div class="muted">Henüz teklif yok. Ustalardan aldığın fiyatları ekleyip karşılaştırabilirsin.</div>') +
    (r.invoice
      ? '<div class="note">Fatura: '+tl(r.invoice.amount)+' · ' +
          (r.invoice.path ? '<a class="doclink" href="'+esc(mediaSrc(r.invoice.path))+'" target="_blank" rel="noopener">'+esc(r.invoice.name)+'</a>' : esc(r.invoice.name)) +
          ' · '+fmtFull(parse(r.invoice.date)) +
          (r.invoice.expenseId ? ' · gider defterine işlendi' : '')+'</div>'
      : landlord ? '<button class="btn small ghost" data-act="sheet" data-s="fatura" data-pid="'+p.id+'" data-id="'+r.id+'">Fatura ekle</button>' : '') +
    '</section>';
}

function quoteSheet(p, reqId){
  const r = p.requests.find(x => x.id === reqId);
  if (!r) return null;
  return '<h3>Teklif ekle</h3><form class="stack" data-form="quote" data-pid="'+p.id+'" data-id="'+r.id+'">' +
    '<div class="muted">'+esc(r.title)+'</div>' +
    '<label class="field">Usta ya da firma<input name="vendor" required maxlength="60"></label>' +
    '<div class="grid2"><label class="field">Tutar (₺)<input name="amount" type="number" min="0" required inputmode="numeric"></label>' +
    '<label class="field">Telefon<input name="phone" type="tel"></label></div>' +
    '<label class="field">Not<input name="note" maxlength="120" placeholder="Ör. parça dahil, 2 gün"></label>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Ekle</button></div></form>';
}

function invoiceSheet(p, reqId){
  const r = p.requests.find(x => x.id === reqId);
  if (!r) return null;
  const q = (r.quotes || []).find(x => x.chosen);
  const landlordPays = r.cost === 'Ev sahibi' || r.cost === 'Paylaşımlı';
  return '<h3>Fatura ekle</h3><form class="stack" data-form="invoice" data-pid="'+p.id+'" data-id="'+r.id+'">' +
    '<div class="muted">'+esc(r.title)+(q ? ' · '+esc(q.vendor) : '')+'</div>' +
    '<div class="grid2"><label class="field">Tutar (₺)<input name="amount" type="number" min="0" required value="'+(q ? q.amount : '')+'"></label>' +
    '<label class="field">Tarih<input name="date" type="date" required value="'+iso(t0())+'"></label></div>' +
    '<label class="field">Fatura dosyası<input type="file" name="file" accept="application/pdf,image/*" style="padding-top:10px"></label>' +
    '<label class="toggle">Gider defterine ekle'+(r.cost === 'Paylaşımlı' ? ' (yarısı)' : '') +
      '<input type="checkbox" name="toExpense"'+(landlordPays ? ' checked' : '')+'></label>' +
    '<div class="muted">Masraf: '+esc(r.cost)+'. Masraf kiracıdaysa gider defterine eklenmez.</div>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Kaydet</button></div></form>';
}

/* ---------------- kiracılar ---------------- */

function addTenantSheet(p){
  return '<h3>Kiracı ekle</h3><form class="stack" data-form="addTenant" data-pid="'+p.id+'">' +
    '<div class="muted">'+esc(p.name)+' için yeni bir kiracı hesabı. Ev arkadaşları aynı evin ödemelerini, taleplerini ve yazışmalarını birlikte görür.</div>' +
    '<label class="field">Ad soyad<input name="name" required maxlength="60"></label>' +
    '<label class="field">E-posta<input name="email" type="email" placeholder="Davet bu adrese gider"></label>' +
    '<label class="field">Telefon<input name="phone" type="tel" placeholder="05__ ___ __ __"></label>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Ekle ve davet et</button></div></form>';
}

/* ---------------- giderler ---------------- */

function expenseSheet(p, id){
  const e = id ? (p.expenses || []).find(x => x.id === id) : null;
  return '<h3>'+(e ? 'Gideri düzenle' : 'Gider ekle')+'</h3><form class="stack" data-form="expense" data-pid="'+p.id+'"'+(e ? ' data-id="'+esc(e.id)+'"' : '')+'>' +
    '<label class="field">Kategori<select name="cat">'+opts(EXPENSE_CATS, e ? e.cat : EXPENSE_CATS[0])+'</select></label>' +
    '<div class="grid2"><label class="field">Tutar (₺)<input name="amount" type="number" min="0" required value="'+(e ? e.amount : '')+'" inputmode="numeric"></label>' +
    '<label class="field">Tarih<input name="date" type="date" required value="'+(e ? esc(e.date) : iso(t0()))+'"></label></div>' +
    '<label class="field">Açıklama<input name="note" maxlength="120" value="'+(e ? esc(e.note || '') : '')+'"></label>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Kaydet</button></div>' +
    (e ? '<button type="button" class="btn small danger block" data-act="removeExpense" data-pid="'+p.id+'" data-id="'+esc(e.id)+'">Gideri sil</button>' : '') +
    '</form>';
}

/* ---------------- çıkış ---------------- */

function startMoveOutSheet(p){
  return '<h3>Çıkış sürecini başlat</h3><form class="stack" data-form="startMoveOut" data-pid="'+p.id+'">' +
    '<div class="muted">Giriş tutanağındaki '+p.inspect.rooms.length+' oda karşılaştırma için kopyalanır. Kiracı ve ev sahibi odaları birlikte değerlendirir, kesintiler iki tarafın onayından sonra kesinleşir.</div>' +
    '<label class="field">Çıkış tarihi<input name="date" type="date" required value="'+iso(t0())+'"></label>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Başlat</button></div></form>';
}

function deductionSheet(p){
  return '<h3>Kesinti ekle</h3><form class="stack" data-form="deduction" data-pid="'+p.id+'">' +
    '<label class="field">Kalem<input name="label" required maxlength="60" list="dedPresets" placeholder="Ör. Boya"></label>' +
    '<datalist id="dedPresets">'+DEDUCTION_PRESETS.map(x => '<option value="'+esc(x)+'">').join('')+'</datalist>' +
    '<label class="field">Tutar (₺)<input name="amount" type="number" min="0" required inputmode="numeric"></label>' +
    '<label class="field">Gerekçe<input name="note" maxlength="140" placeholder="Hangi odada, girişe göre ne değişti?"></label>' +
    '<div class="muted">Kesinti eklemek iki tarafın onayını sıfırlar. Olağan kullanımdan kaynaklı yıpranma için kesinti yapılamaz.</div>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Ekle</button></div></form>';
}

function refundSheet(p){
  const sm = moveOutSummary(p);
  return '<h3>Depozito iadesi</h3><form class="stack" data-form="refund" data-pid="'+p.id+'">' +
    '<div class="kv"><span>Hesaplanan iade</span><span>'+tl(sm.refund)+'</span></div>' +
    '<div class="grid2"><label class="field">İade edilen (₺)<input name="amount" type="number" min="0" required value="'+sm.refund+'"></label>' +
    '<label class="field">Tarih<input name="date" type="date" required value="'+iso(t0())+'"></label></div>' +
    '<div class="row"><button type="button" class="btn ghost" style="flex:1" data-act="closeSheet">Vazgeç</button>' +
    '<button class="btn primary" style="flex:1">Kaydet</button></div></form>';
}

/* ---------------- dekont önizleme ---------------- */

function receiptPreview(rc){
  const v = rc.photo;
  const isPdf = isStored(v) && /\.pdf$/i.test(storedPath(v));
  if (v && !isPdf)
    return '<div class="ph" style="width:100%;height:190px;font-size:14px"><img src="'+esc(mediaSrc(v))+'" alt="Dekont görseli" style="width:100%;height:100%;object-fit:contain;border-radius:10px"></div>';
  if (isPdf)
    return '<a class="btn ghost block" href="'+esc(mediaSrc(v))+'" target="_blank" rel="noopener">'+ic('doc', 16)+' '+esc(rc.receipt || 'Dekontu aç')+'</a>';
  return '<div class="ph" style="width:100%;height:120px;font-size:14px">'+esc(rc.receipt || 'Dekont yok')+'</div>';
}

/* ---------------- hesap ---------------- */

function accountSheet(){
  const prof = live.profile || {};
  const push = ui.pushState || 'unknown';
  const pushText = {
    on:'Açık — kira günü, dekont, talep ve mesajlar telefonuna gelir.',
    off:'Kapalı.',
    denied:'Tarayıcı ayarlarında engellenmiş. Site ayarlarından izin vermelisin.',
    install:'iPhone’da bildirimler için önce Evim’i ana ekrana ekle (Paylaş → Ana Ekrana Ekle).',
    unsupported:'Bu tarayıcı anlık bildirimleri desteklemiyor.',
    unknown:'Kontrol ediliyor…'
  }[push];
  return '<h3>Hesap</h3><div class="stack">' +
    '<div class="card"><div class="kv"><span>E-posta</span><span>'+esc(live.user?.email || '')+'</span></div>' +
      '<div class="kv"><span>Hesap türü</span><span>'+(prof.role === 'landlord' ? 'Ev sahibi' : 'Kiracı')+'</span></div></div>' +
    '<form class="stack" data-form="profile">' +
      '<label class="field">Ad soyad<input name="name" required maxlength="60" value="'+esc(prof.name || '')+'"></label>' +
      '<label class="field">Telefon<input name="phone" type="tel" value="'+esc(prof.phone || '')+'"></label>' +
      '<button class="btn primary block">Kaydet</button></form>' +

    '<section class="card stack" style="gap:8px"><h2>Bildirimler</h2>' +
      '<div class="muted">'+esc(pushText)+'</div>' +
      (push === 'on' || push === 'off'
        ? '<button class="btn small '+(push === 'on' ? 'ghost' : 'primary')+'" data-act="togglePush">'+(push === 'on' ? 'Anlık bildirimleri kapat' : 'Anlık bildirimleri aç')+'</button>' : '') +
      '<label class="toggle">E-posta ile de bildir<input type="checkbox" data-input="setb" data-k="email"'+(S.settings.email ? ' checked' : '')+'></label>' +
    '</section>' +

    '<details class="card"><summary><b>Şifreyi değiştir</b></summary><form class="stack" data-form="newpass" style="margin-top:10px">' +
      '<label class="field">Yeni şifre<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>' +
      '<label class="field">Yeni şifre (tekrar)<input name="password2" type="password" required minlength="8" autocomplete="new-password"></label>' +
      '<button class="btn primary block">Şifreyi güncelle</button></form></details>' +

    (ui.authMsg ? '<div class="note'+(ui.authMsg.kind === 'error' ? ' warn' : '')+'">'+esc(ui.authMsg.text)+'</div>' : '') +
    '<button class="btn ghost block" data-act="signOut">Çıkış yap</button>' +
    '<button class="btn small danger block" data-act="deleteAccount">Hesabı sil</button>' +
    '<p class="foot">Oturumun bu cihazda açık kalır; çıkış yapana kadar tekrar giriş gerekmez.</p></div>';
}

/* ---------------- davet paylaşımı ---------------- */

function shareInviteSheet(p, code){
  if (!code) return null;
  const link = LIVE ? inviteLink(code) : location.origin + location.pathname + '#/katil/' + code;
  const text = 'Merhaba, '+p.name+' için Evim’de ortak panelimize katılır mısın? Davet kodun: '+code+' — '+link;
  return '<h3>Kiracını davet et</h3><div class="stack">' +
    '<div class="muted">Kiracın bu bağlantıyla kayıt olunca ya da kodu girince '+esc(p.name)+' paneline bağlanır. Kod 30 gün geçerlidir.</div>' +
    '<div class="codebox" aria-label="Davet kodu">'+esc(code)+'</div>' +
    '<input class="inline" id="inviteLink" readonly value="'+esc(link)+'" aria-label="Davet bağlantısı">' +
    '<div class="grid2">' +
      '<button class="btn primary" data-act="copyInvite">'+ic('doc', 16)+' Kopyala</button>' +
      '<a class="btn ghost" href="https://wa.me/?text='+encodeURIComponent(text)+'" target="_blank" rel="noopener">WhatsApp</a></div>' +
    '<a class="btn ghost block" href="mailto:?subject='+encodeURIComponent('Evim daveti')+'&body='+encodeURIComponent(text)+'">E-posta ile gönder</a>' +
    (LIVE ? '' : '<div class="note">Demo modunda davet gerçek değildir; kod yalnızca akışı göstermek içindir.</div>') +
    '</div>';
}

/* ---------------- katman yönetimi ve odak tuzağı ---------------- */

let lastFocus = null;

export function renderLayer(route){
  const L = document.getElementById('layer');
  const body = sheetBody(route);

  if (!body){
    if (L.innerHTML){
      L.innerHTML = '';
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
      lastFocus = null;
    }
    return;
  }

  const wasOpen = !!L.innerHTML;
  if (!wasOpen) lastFocus = document.activeElement;

  L.innerHTML = '<div class="scrim" data-act="closeSheet" data-self="1">' +
    '<div class="sheet" role="dialog" aria-modal="true" tabindex="-1"><div class="grab"></div>'+body+'</div></div>';

  const sheet = L.querySelector('.sheet');
  if (!wasOpen && sheet){
    const first = sheet.querySelector('input:not([type=hidden]):not(.sr), textarea, select, button');
    (first || sheet).focus({ preventScroll:true });
  }
}

/** Sheet açıkken Tab odağı içeride tutar. */
export function trapFocus(ev){
  const sheet = document.querySelector('#layer .sheet');
  if (!sheet || ev.key !== 'Tab') return;
  const nodes = [...sheet.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null || el === document.activeElement);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length-1];
  if (ev.shiftKey && document.activeElement === first){ ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last){ ev.preventDefault(); first.focus(); }
}
