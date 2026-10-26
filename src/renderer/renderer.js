const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const island = $('#island');
const pages = $$('.page');
const dots = $$('.dots i');
let page = 0;
let hovered = false;
let peekTimer, collapseTimer;
let media = { active: false };
let seeking = null;

/* ---------- Expansión / click-through ---------- */
let interactive = false;
function setInteractive(on) {
  if (on === interactive) return;
  interactive = on;
  window.island.setInteractive(on);
}
document.addEventListener('mousemove', (e) => setInteractive(!!e.target.closest('#island')));
document.addEventListener('mouseleave', () => setInteractive(false));

function setExpanded(on) {
  island.classList.toggle('expanded', on);
  island.classList.toggle('compact', !on);
  syncWatch();
}
island.addEventListener('mouseenter', () => {
  hovered = true;
  clearTimeout(collapseTimer);
  setExpanded(true);
});
island.addEventListener('mouseleave', () => {
  hovered = false;
  collapseTimer = setTimeout(() => { if (!hovered && !peekTimer) setExpanded(false); }, 350);
});

function peek(ms = 3500) {
  setExpanded(true);
  page = 0; showPage();
  clearTimeout(peekTimer);
  peekTimer = setTimeout(() => {
    peekTimer = null;
    if (!hovered) setExpanded(false);
  }, ms);
}

/* ---------- Páginas ---------- */
var showPage = function () {
  pages.forEach((p, i) => {
    p.classList.toggle('active', i === page);
    p.classList.toggle('before', i < page);
  });
  dots.forEach((d, i) => d.classList.toggle('on', i === page));
  syncWatch();
};
function go(delta) {
  page = (page + delta + pages.length) % pages.length;
  showPage();
}
function syncWatch() {
  window.island.watchSystem(island.classList.contains('expanded') && page === 1);
}
$('.prev-page').onclick = () => go(-1);
$('.next-page').onclick = () => go(1);
island.addEventListener('wheel', (e) => {
  if (!island.classList.contains('expanded')) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { go(e.deltaX > 0 ? 1 : -1); }
}, { passive: true });
showPage();

/* ---------- Reloj ---------- */
function tickClock() {
  const d = new Date();
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  $$('.clock').forEach((c) => (c.textContent = t));
  $('.date').textContent = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(',', '');
  setTimeout(tickClock, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
}
tickClock();

/* ---------- Batería ---------- */
const CIRC = 2 * Math.PI * 10;
function applyBattery(b) {
  const pct = Math.round(b.level * 100);
  $$('.ring-fg').forEach((r) => (r.style.strokeDashoffset = CIRC * (1 - b.level)));
  island.classList.toggle('charging', b.charging);
  island.classList.toggle('low', pct <= 20);
  $('.batt-pct').textContent = pct + '%';
}
if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    applyBattery(b);
    ['levelchange', 'chargingchange'].forEach((ev) => b.addEventListener(ev, () => applyBattery(b)));
  });
} else {
  applyBattery({ level: 1, charging: true });
}

/* ---------- Multimedia ---------- */
const fmt = (s) => {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
};
function sourceLabel(app = '') {
  const a = app.toLowerCase();
  if (a.includes('spotify')) return 'Spotify';
  if (/chrome|msedge|edge|firefox|brave|opera|vivaldi|arc/.test(a)) return 'Web';
  return '';
}

const art = $('.art img');
function applyMedia(s) {
  const trackChanged = s.active && media.key !== s.key;
  media = s;
  const idle = !s.active || (!s.title && !s.artist);
  $('.page-media').classList.toggle('idle', idle);
  island.classList.toggle('playing', !idle && !!s.playing);
  if (idle) return;

  $('.title').textContent = s.title || '—';
  $('.artist').textContent = s.artist || '';
  $('.src').textContent = sourceLabel(s.app);
  $('.src').style.display = sourceLabel(s.app) ? '' : 'none';
  if (s.thumb) { if (art.getAttribute('src') !== s.thumb) art.src = s.thumb; } else art.removeAttribute('src');
  $('.btn-prev').classList.toggle('off', !s.canPrev);
  $('.btn-next').classList.toggle('off', !s.canNext);
  $('.bar').classList.toggle('disabled', !s.canSeek || !s.duration);
  renderProgress();
  if (trackChanged && s.playing && !island.classList.contains('toasting')) peek();
}

function currentPos() {
  if (!media.active) return 0;
  const drift = media.playing ? (Date.now() - media.at) / 1000 : 0;
  return Math.min(media.duration || Infinity, media.position + drift);
}
function renderProgress() {
  if (!media.active) return;
  const dur = media.duration || 0;
  const pos = seeking !== null ? seeking * dur : currentPos();
  $('.bar-fill').style.width = dur ? (100 * pos / dur) + '%' : '0%';
  $('.t-pos').textContent = fmt(pos);
  $('.t-rem').textContent = dur ? '-' + fmt(dur - pos) : '--:--';
}
setInterval(() => { if (island.classList.contains('expanded') && page === 0) renderProgress(); }, 250);

// `media.at` viene del proceso principal (mismo reloj de la máquina).
window.island.onMedia((s) => applyMedia(s));

$('.btn-play').onclick = () => window.island.media('toggle');
$('.btn-next').onclick = () => window.island.media('next');
$('.btn-prev').onclick = () => window.island.media('prev');

const bar = $('.bar');
const fracAt = (e) => {
  const r = bar.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
};
bar.addEventListener('pointerdown', (e) => {
  bar.setPointerCapture(e.pointerId);
  bar.classList.add('drag');
  seeking = fracAt(e);
  renderProgress();
});
bar.addEventListener('pointermove', (e) => { if (seeking !== null) { seeking = fracAt(e); renderProgress(); } });
bar.addEventListener('pointerup', (e) => {
  if (seeking === null) return;
  const target = fracAt(e) * (media.duration || 0);
  seeking = null;
  bar.classList.remove('drag');
  media.position = target; media.at = Date.now();
  window.island.media('seek', target);
});

/* ---------- Recursos ---------- */
function setTile(k, text, pct) {
  const t = $(`.tile[data-k="${k}"]`);
  $('.val', t).textContent = text;
  const m = $('.meter div', t);
  m.style.width = Math.min(100, Math.max(0, pct ?? 0)) + '%';
  m.className = pct >= 90 ? 'hot' : pct >= 70 ? 'warn' : '';
}
const rate = (b) => {
  const u = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return (b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)) + ' ' + u[i];
};
const netPct = (b) => 100 * Math.min(1, Math.log10(1 + b / 1024) / 5); // escala log hasta ~100 MB/s

window.island.onSystem((s) => {
  setTile('cpu', s.cpu + '%', s.cpu);
  setTile('ram', s.ram + '%', s.ram);
  s.gpu == null ? setTile('gpu', 'N/D', 0) : setTile('gpu', Math.round(s.gpu) + '%', s.gpu);
  s.disk == null ? setTile('disk', 'N/D', 0) : setTile('disk', Math.round(s.disk) + '%', s.disk);
  setTile('rx', rate(s.rx), netPct(s.rx));
  setTile('tx', rate(s.tx), netPct(s.tx));
});

/* ---------- Notificaciones ---------- */
const APPS = [
  { re: /telegram/i, cls: 'telegram', glyph: '✈', name: 'Telegram' },
  { re: /whatsapp/i, cls: 'whatsapp', glyph: '✆', name: 'WhatsApp' },
  { re: /outlook|olk|mail/i, cls: 'outlook', glyph: '✉', name: 'Outlook' },
  { re: /teams/i, cls: 'teams', glyph: 'T', name: 'Teams' },
];
function classify(n) {
  const hay = `${n.app} ${n.aumid}`;
  const hit = APPS.find((a) => a.re.test(hay));
  return hit || { cls: '', glyph: (n.app || '?').trim().charAt(0).toUpperCase(), name: n.app || 'Notificación' };
}
function makeBadge(n, small) {
  const info = classify(n);
  const b = document.createElement('div');
  b.className = `badge ${info.cls}${small ? ' sm' : ''}`;
  b.textContent = info.glyph;
  return b;
}
const ago = (t) => {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? 'ahora' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h`;
};

const notifs = [];
let unread = 0;
let toastTimer = null;
const toastEl = $('.toast');

function renderUnread() {
  const u = $('.unread');
  u.hidden = unread === 0;
  u.textContent = unread > 9 ? '9+' : unread;
}
function renderNotifList() {
  const ul = $('.notif-list');
  ul.replaceChildren();
  $('.page-notifs .empty').textContent = notifs.length || notifAccess !== 'Allowed' ? '' : 'Sin notificaciones';
  for (const n of notifs.slice(0, 3)) {
    const li = document.createElement('li');
    const txt = document.createElement('div'); txt.className = 'n-text';
    const t = document.createElement('div'); t.className = 'n-title'; t.textContent = n.title || classify(n).name;
    const b = document.createElement('div'); b.className = 'n-body'; b.textContent = n.body || classify(n).name;
    txt.append(t, b);
    const time = document.createElement('div'); time.className = 'n-time'; time.textContent = ago(n.time);
    li.append(makeBadge(n, true), txt, time);
    li.onclick = () => window.island.openApp(n.aumid);
    ul.append(li);
  }
}
let notifAccess = 'Allowed';
function renderAccess() {
  const denied = notifAccess === 'Denied' || notifAccess === 'Unspecified';
  const empty = $('.page-notifs .empty');
  if (denied) empty.textContent = 'Windows no permite leer notificaciones. Actívalo en Privacidad › Notificaciones.';
  else if (!notifs.length) empty.textContent = 'Sin notificaciones';
  else empty.textContent = '';
  $('.settings-link').hidden = !denied;
}
$('.settings-link').onclick = () => window.island.openNotifSettings();

function showToast(n) {
  const info = classify(n);
  const badge = $('.badge', toastEl);
  badge.className = `badge ${info.cls}`;
  badge.textContent = info.glyph;
  $('.t-app').textContent = info.name;
  $('.t-title').textContent = n.title || '';
  $('.t-text').textContent = n.body || '';
  toastEl.onclick = () => { window.island.openApp(n.aumid); endToast(); };
  setExpanded(true);
  island.classList.add('toasting');
  clearTimeout(peekTimer); peekTimer = null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(endToast, 5500);
}
function endToast() {
  clearTimeout(toastTimer); toastTimer = null;
  island.classList.remove('toasting');
  if (!hovered) setTimeout(() => { if (!hovered && !toastTimer) setExpanded(false); }, 200);
}
island.addEventListener('mouseenter', () => { if (toastTimer) { clearTimeout(toastTimer); toastTimer = setTimeout(endToast, 4000); } });

function addNotification(n, silent) {
  notifs.unshift(n);
  notifs.length = Math.min(notifs.length, 20);
  renderNotifList(); renderAccess();
  if (silent) return;
  if (!(island.classList.contains('expanded') && page === 2)) { unread++; renderUnread(); }
  showToast(n);
}
window.island.onNotification((n) => addNotification(n, false));
window.island.onNotifAccess((st) => { notifAccess = st; renderAccess(); });
window.island.getNotifications().then(({ history, access }) => {
  notifAccess = access;
  [...history].reverse().forEach((n) => addNotification(n, true));
  renderAccess();
});

// Al abrir la página de notificaciones se marcan como leídas.
const _showPage = showPage;
showPage = function () {
  _showPage();
  if (page === 2) { unread = 0; renderUnread(); renderNotifList(); }
};
setInterval(() => { if (page === 2) renderNotifList(); }, 30000);
