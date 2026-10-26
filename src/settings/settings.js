const $ = (s) => document.querySelector(s);

const ACCENTS = [
  { v: '#30d158', n: 'Verde' },
  { v: '#0a84ff', n: 'Azul' },
  { v: '#bf5af2', n: 'Violeta' },
  { v: '#ff375f', n: 'Rosa' },
  { v: '#ff9f0a', n: 'Naranja' },
  { v: '#64d2ff', n: 'Cielo' },
];

let state = null;
const lightQuery = window.matchMedia('(prefers-color-scheme: light)');

function applyTheme() {
  const t = state.settings.theme;
  document.documentElement.dataset.theme = t === 'auto' ? (lightQuery.matches ? 'light' : 'dark') : t;
  document.documentElement.style.setProperty('--accent', state.settings.accent);
}

function save(patch) {
  // Se refleja al instante y el proceso principal confirma con el estado final.
  state.settings = { ...state.settings, ...patch };
  render();
  window.settingsApi.set(patch).then((s) => { state = s; render(); });
}

function renderDisplays() {
  const box = $('#displays');
  box.replaceChildren();
  const selected = state.displays.some((d) => d.id === state.settings.display)
    ? state.settings.display
    : (state.displays.find((d) => d.primary) || state.displays[0]).id;
  const maxW = Math.max(...state.displays.map((d) => d.bounds.x + d.bounds.width));
  const minX = Math.min(...state.displays.map((d) => d.bounds.x));
  const minY = Math.min(...state.displays.map((d) => d.bounds.y));
  const maxH = Math.max(...state.displays.map((d) => d.bounds.y + d.bounds.height));
  const scale = Math.min(1, 300 / (maxW - minX), 110 / (maxH - minY));

  const map = document.createElement('div');
  map.className = 'map';
  map.style.width = Math.round((maxW - minX) * scale) + 'px';
  map.style.height = Math.round((maxH - minY) * scale) + 'px';
  state.displays.forEach((d, i) => {
    const b = document.createElement('button');
    b.className = 'mon' + (d.id === selected ? ' on' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(d.id === selected));
    b.setAttribute('aria-label', `${d.name}, ${d.size}${d.primary ? ', principal' : ''}`);
    b.style.left = Math.round((d.bounds.x - minX) * scale) + 'px';
    b.style.top = Math.round((d.bounds.y - minY) * scale) + 'px';
    b.style.width = Math.round(d.bounds.width * scale) - 4 + 'px';
    b.style.height = Math.round(d.bounds.height * scale) - 4 + 'px';
    const n = document.createElement('span');
    n.textContent = String(i + 1);
    b.append(n);
    b.onclick = () => save({ display: d.id });
    map.append(b);
  });
  box.append(map);

  const list = document.createElement('ul');
  list.className = 'mon-list';
  state.displays.forEach((d, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1} · ${d.name} · ${d.size}${d.primary ? ' · principal' : ''}`;
    if (d.id === selected) li.className = 'on';
    list.append(li);
  });
  box.append(list);
}

function renderSeg(el, value) {
  el.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.v === value;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
}

function renderAccents() {
  const box = $('#accents');
  box.replaceChildren();
  ACCENTS.forEach((a) => {
    const b = document.createElement('button');
    b.className = 'sw' + (a.v === state.settings.accent ? ' on' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(a.v === state.settings.accent));
    b.setAttribute('aria-label', a.n);
    b.title = a.n;
    b.style.setProperty('--c', a.v);
    b.onclick = () => save({ accent: a.v });
    box.append(b);
  });
}

function render() {
  const s = state.settings;
  applyTheme();
  $('#version').textContent = 'v' + state.version;
  renderDisplays();
  renderSeg($('#theme'), s.theme);
  renderAccents();
  $('#autoStart').checked = s.autoStart;
  $('#startHidden').checked = s.startHidden;
  $('#notifications').checked = s.notifications;
  $('#startDelay').value = String(s.startDelay);
  $('#delay-row').classList.toggle('off', !s.autoStart);
  $('#startDelay').disabled = !s.autoStart;
  $('#autostart-note').textContent = state.packaged
    ? 'La isla arranca al iniciar sesión.'
    : 'Modo desarrollo: se registra el proyecto, no el instalador.';
}

$('#theme').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) save({ theme: b.dataset.v });
});
$('#autoStart').addEventListener('change', (e) => save({ autoStart: e.target.checked }));
$('#startHidden').addEventListener('change', (e) => save({ startHidden: e.target.checked }));
$('#notifications').addEventListener('change', (e) => save({ notifications: e.target.checked }));
$('#startDelay').addEventListener('change', (e) => save({ startDelay: Number(e.target.value) }));
$('#identify').addEventListener('click', () => window.settingsApi.identify());
$('#reset').addEventListener('click', () => window.settingsApi.reset().then((s) => { state = s; render(); }));
$('#quit').addEventListener('click', () => window.settingsApi.quit());
lightQuery.addEventListener('change', () => state && applyTheme());
window.settingsApi.onChange((s) => { state = s; render(); });

window.settingsApi.get().then((s) => { state = s; render(); });
