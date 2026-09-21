/* Tek giriş noktalı çizim: rota değişince ekran, sekmeler, panel ve katman yenilenir. */

import { S, ui } from './state.js';
import { current } from './router.js';
import { tenantScreen, landlordScreen, tabbar, shell } from './views.js';
import { renderLayer } from './sheets.js';
import { tourBar } from './tour.js';

let lastKey = null;

export function render(){
  const route = current();
  const screen = document.getElementById('screen');

  const key = route.role + '|' + route.path;
  const keepScroll = key === lastKey ? screen.scrollTop : 0;

  screen.innerHTML = route.role === 'tenant' ? tenantScreen(route) : landlordScreen(route);
  screen.scrollTop = keepScroll;
  lastKey = key;

  document.getElementById('tabbar').innerHTML = tabbar(route);
  document.getElementById('shell').innerHTML = shell(route);
  document.getElementById('tour').innerHTML = tourBar();

  // Sohbet ekranı ilk açılışta en alta kaydırılır.
  const chat = document.getElementById('chat');
  if (chat && ui.lastChatKey !== key){
    screen.scrollTop = screen.scrollHeight;
    ui.lastChatKey = key;
  }
  if (!chat) ui.lastChatKey = null;

  renderLayer(route);
  document.title = titleFor(route);
}

function titleFor(route){
  if (route.role === 'landlord'){
    if (route.pid) return S.props[route.pid].name + ' · Evim';
    return { portfolio:'Portföy', lreq:'Talepler', lmsg:'Mesajlar', report:'Rapor', agenda:'Takvim' }[route.tab] + ' · Evim';
  }
  return { panel:'Panel', pay:'Ödemeler', req:'Talepler', msg:'Mesajlar', docs:'Belgeler', agenda:'Takvim' }[route.tab] + ' · Evim';
}

/** Yalnızca katmanı yeniler (form içi anlık güncellemeler için). */
export function refreshLayer(){ renderLayer(current()); }
