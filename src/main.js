const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const { SystemMonitor } = require('./system');

const WIN_W = 520;
const WIN_H = 200;
const useMock = process.argv.includes('--mock') || process.platform !== 'win32';

if (!app.requestSingleInstanceLock()) app.quit();

let win;
let tray;
let media;
let monitor;

function place() {
  const d = screen.getPrimaryDisplay();
  win.setBounds({
    x: d.bounds.x + Math.round((d.bounds.width - WIN_W) / 2),
    y: d.bounds.y,
    width: WIN_W,
    height: WIN_H,
  });
}

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
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());

  screen.on('display-metrics-changed', place);
  screen.on('display-added', place);
  screen.on('display-removed', place);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 16, height: 16 }));
  tray.setToolTip('Dinamic Island');
  const build = () =>
    Menu.buildFromTemplate([
      { label: win.isVisible() ? 'Ocultar isla' : 'Mostrar isla', click: () => { win.isVisible() ? win.hide() : win.showInactive(); tray.setContextMenu(build()); } },
      {
        label: 'Iniciar con Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() },
    ]);
  tray.setContextMenu(build());
}

app.whenReady().then(() => {
  const { MockMedia } = require('./media/mock');
  const { WindowsMedia } = require('./media/windows');
  media = useMock ? new MockMedia() : new WindowsMedia();
  monitor = new SystemMonitor((s) => win && !win.isDestroyed() && win.webContents.send('system:sample', s));

  createWindow();
  createTray();

  media.on('state', (s) => win && !win.isDestroyed() && win.webContents.send('media:state', s));
  media.start();

  ipcMain.handle('media:get', () => media.state);
  ipcMain.on('media:cmd', (_e, cmd, value) => media.send(cmd, value));
  ipcMain.on('system:watch', (_e, on) => monitor.watch(on));
  ipcMain.on('island:interactive', (_e, on) => {
    if (on) win.setIgnoreMouseEvents(false);
    else win.setIgnoreMouseEvents(true, { forward: true });
  });
});

app.on('before-quit', () => { media && media.stop(); monitor && monitor.watch(false); });
app.on('window-all-closed', () => app.quit());
