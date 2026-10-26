const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const { EventEmitter } = require('events');

// Notificaciones de Windows (Telegram, WhatsApp, Outlook, Teams, etc.) vía
// UserNotificationListener. Requiere Configuración > Privacidad > Notificaciones.
class WindowsNotifications extends EventEmitter {
  constructor() {
    super();
    this.access = 'Unspecified';
    this.proc = null;
    this.stopped = false;
    this.retryMs = 1000;
  }

  start() {
    this.stopped = false;
    const script = path.join(__dirname, 'notifications.ps1').replace('app.asar', 'app.asar.unpacked');
    this.proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    readline.createInterface({ input: this.proc.stderr }).on('line', (line) => console.error('[notif]', line));
    readline.createInterface({ input: this.proc.stdout }).on('line', (line) => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      this.retryMs = 1000;
      if (msg.type === 'access') { this.access = msg.status; this.emit('access', msg.status); }
      else if (msg.type === 'notification') this.emit('notification', msg);
    });
    this.proc.on('exit', () => {
      this.proc = null;
      if (this.stopped) return;
      setTimeout(() => this.start(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 15000);
    });
    this.proc.stdin.on('error', () => {});
  }

  open(aumid) {
    if (typeof aumid !== 'string' || !/^[\w.!\-]+$/.test(aumid)) return;
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(JSON.stringify({ cmd: 'open', aumid }) + '\n');
    }
  }

  stop() {
    this.stopped = true;
    if (this.proc) { this.proc.stdin.write('{"cmd":"quit"}\n'); this.proc.kill(); }
  }
}

module.exports = { WindowsNotifications };
