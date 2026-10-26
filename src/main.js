const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell } = require('electron');
const path = require('path');
const { SystemMonitor } = require('./system');
const { settings } = require('./settings');

const WIN_W = 520;
const WIN_H = 200;
const useMock = process.argv.includes('--mock') || process.platform !== 'win32';
const launchedAtLogin = process.argv.includes('--autostart');
const launchDelayMs = (Number((process.argv.find((a) => a.startsWith('--delay=')) || '').slice(8)) || 0) * 1000;
const icon = path.join(__dirname, '..', 'assets', 'icon.png');

if (!app.requestSingleInstanceLock()) app.quit();

let win;
let settingsWin;
let tray;
let media;
let notif;
const history = [];
let monitor;

/* ---------- Pantallas ---------- */
function targetDisplay() {
  const want = settings.values.display;
  return screen.getAllDisplays().find((d) => String(d.id) === want) || screen.getPrimaryDisplay();
}

function listDisplays() {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    name: `Pantalla ${i + 1}`,
    size: `${Math.round(d.size.width * d.scaleFactor)}×${Math.round(d.size.height * d.scaleFactor)}`,
    primary: d.id === primary,
    bounds: d.bounds,
  }));
}

function place() {
  if (!win || win.isDestroyed()) return;
  const d = targetDisplay();
  win.setBounds({
    x: d.bounds.x + Math.round((d.bounds.width - WIN_W) / 2),
    y: d.bounds.y,
    width: WIN_W,
    height: WIN_H,
  });
}

// Muestra el número de cada pantalla un instante para saber cuál es cuál.
function identifyDisplays() {
  screen.getAllDisplays().forEach((d, i) => {
    const w = new BrowserWindow({
      x: d.bounds.x + Math.round(d.bounds.width / 2) - 90,
      y: d.bounds.y + Math.round(d.bounds.height / 2) - 90,
      width: 180, height: 180, frame: false, transparent: true, focusable: false,
      skipTaskbar: true, alwaysOnTop: true, resizable: false, hasShadow: false,
    });
    w.setIgnoreMouseEvents(true);
    const html = `<body style="margin:0;display:grid;place-items:center;height:100vh;background:rgba(10,10,12,.85);` +
      `color:#fff;font:700 96px 'Segoe UI',sans-serif;border-radius:28px">${i + 1}</body>`;
    w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    setTimeout(() => !w.isDestroyed() && w.destroy(), 1600);
  });
}

/* ---------- Ventana de la isla ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  place();
  win.webContents.on('console-message', (e) => console.log('[renderer]', e.message ?? e));
  win.webContents.on('preload-error', (_e, p, err) => console.error('[preload]', p, err));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!settings.values.startHidden) win.showInactive(); });

  screen.on('display-metrics-changed', place);
  screen.on('display-added', place);
  screen.on('display-removed', place);
}

/* ---------- Panel de ajustes ---------- */
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 620,
    height: 720,
    minWidth: 520,
    minHeight: 560,
    title: 'Dinamic Island · Ajustes',
    icon,
    backgroundColor: '#111114',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'settings', 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  settingsWin.setMenu(null);
  settingsWin.loadFile(path.join(__dirname, 'settings', 'index.html'));
  settingsWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function settingsPayload() {
  return {
    settings: settings.values,
    displays: listDisplays(),
    version: app.getVersion(),
    packaged: app.isPackaged,
  };
}

/* ---------- Inicio automático ---------- */
// En desarrollo se registra electron.exe con la ruta del proyecto; empaquetada
// basta con el propio ejecutable.
function applyAutoStart() {
  if (process.platform !== 'win32') return;
  const { autoStart, startDelay } = settings.values;
  const args = app.isPackaged ? [] : [app.getAppPath()];
  args.push('--autostart');
  if (startDelay > 0) args.push(`--delay=${startDelay}`);
  app.setLoginItemSettings({ openAtLogin: autoStart, path: process.execPath, args });
}

function applySettings() {
  place();
  applyAutoStart();
  const payload = settingsPayload();
  for (const w of [win, settingsWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('settings:changed', payload);
  }
  buildTrayMenu();
}

/* ---------- Bandeja ---------- */
function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ajustes…', click: openSettings },
    { label: win.isVisible() ? 'Ocultar isla' : 'Mostrar isla', click: () => { win.isVisible() ? win.hide() : win.showInactive(); buildTrayMenu(); } },
    {
      label: 'Iniciar con Windows',
      type: 'checkbox',
      checked: settings.values.autoStart,
      click: (item) => { settings.set({ autoStart: item.checked }); applySettings(); },
    },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ]));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }));
  tray.setToolTip('Dinamic Island');
  tray.on('double-click', openSettings);
  buildTrayMenu();
}

app.on('second-instance', openSettings);

app.whenReady().then(async () => {
  settings.load();
  // Al iniciar con Windows se puede esperar unos segundos a que el escritorio termine de cargar.
  if (launchedAtLogin && launchDelayMs > 0) await new Promise((r) => setTimeout(r, launchDelayMs));

  const { MockMedia } = require('./media/mock');
  const { WindowsMedia } = require('./media/windows');
  const { MockNotifications } = require('./notifications/mock');
  const { WindowsNotifications } = require('./notifications/windows');
  media = useMock ? new MockMedia() : new WindowsMedia();
  notif = useMock ? new MockNotifications() : new WindowsNotifications();
  monitor = new SystemMonitor((s) => win && !win.isDestroyed() && win.webContents.send('system:sample', s));

  createWindow();
  createTray();
  applyAutoStart();
  if (process.argv.includes('--settings')) openSettings();

  media.on('state', (s) => win && !win.isDestroyed() && win.webContents.send('media:state', s));
  media.start();

  const send = (ch, payload) => win && !win.isDestroyed() && win.webContents.send(ch, payload);
  notif.on('notification', (n) => {
    if (!settings.values.notifications) return;
    history.unshift(n); history.length = Math.min(history.length, 20); send('notif:new', n);
  });
  notif.on('access', (st) => send('notif:access', st));
  notif.start();

  ipcMain.handle('media:get', () => media.state);
  ipcMain.on('media:cmd', (_e, cmd, value) => media.send(cmd, value));
  ipcMain.handle('notif:get', () => ({ history, access: notif.access }));
  ipcMain.on('notif:open', (_e, aumid) => notif.open(aumid));
  ipcMain.on('notif:settings', () => shell.openExternal('ms-settings:privacy-notifications'));
  ipcMain.on('system:watch', (_e, on) => monitor.watch(on));
  ipcMain.on('island:interactive', (_e, on) => {
    if (on) win.setIgnoreMouseEvents(false);
    else win.setIgnoreMouseEvents(true, { forward: true });
  });

  ipcMain.handle('settings:get', () => settingsPayload());
  ipcMain.handle('settings:set', (_e, patch) => {
    if (patch && typeof patch === 'object') settings.set(patch);
    applySettings();
    return settingsPayload();
  });
  ipcMain.handle('settings:reset', () => { settings.reset(); applySettings(); return settingsPayload(); });
  ipcMain.on('settings:identify', identifyDisplays);
  ipcMain.on('settings:quit', () => app.quit());
});

app.on('before-quit', () => { media && media.stop(); notif && notif.stop(); monitor && monitor.watch(false); });
// La isla vive en la bandeja: cerrar el panel de ajustes no cierra la app.
app.on('window-all-closed', () => {});
