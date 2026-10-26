const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const { EventEmitter } = require('events');

// Puente con las sesiones multimedia de Windows (SMTC): cubre Spotify y
// cualquier reproductor de navegador (Chrome, Edge, Firefox, Brave...).
class WindowsMedia extends EventEmitter {
  constructor() {
    super();
    this.state = { active: false };
    this.proc = null;
    this.stopped = false;
    this.retryMs = 1000;
  }

  start() {
    this.stopped = false;
    const script = path.join(__dirname, 'smtc.ps1').replace('app.asar', 'app.asar.unpacked');
    this.proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] }
    );
    readline.createInterface({ input: this.proc.stdout }).on('line', (line) => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      this.retryMs = 1000;
      this.#merge(msg);
    });
    this.proc.on('exit', () => {
      this.proc = null;
      if (this.stopped) return;
      setTimeout(() => this.start(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 15000);
    });
    this.proc.stdin.on('error', () => {});
  }

  #merge(msg) {
    if (!msg.active) {
      this.state = { active: false };
    } else {
      const sameTrack = this.state.key === msg.key;
      const thumb = msg.thumb !== undefined ? msg.thumb : sameTrack ? this.state.thumb : null;
      this.state = { ...msg, thumb, at: Date.now() };
    }
    this.emit('state', this.state);
  }

  send(cmd, value) {
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(JSON.stringify({ cmd, value }) + '\n');
    }
  }

  stop() {
    this.stopped = true;
    if (this.proc) {
      this.send('quit');
      this.proc.kill();
    }
  }
}

module.exports = { WindowsMedia };
