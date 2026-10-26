const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// Lee el uso de GPU mientras alguien lo está mirando: el proceso solo vive
// entre start() y stop().
class GpuProbe {
  constructor(onValue) {
    this.onValue = onValue;
    this.proc = null;
  }

  start() {
    if (this.proc || process.platform !== 'win32') return;
    const script = path.join(__dirname, 'gpu.ps1').replace('app.asar', 'app.asar.unpacked');
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    this.proc = proc;
    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      try { this.onValue(JSON.parse(line)); } catch { /* línea no JSON */ }
    });
    readline.createInterface({ input: proc.stderr }).on('line', (line) => console.error('[gpu]', line));
    proc.on('exit', () => { if (this.proc === proc) this.proc = null; });
  }

  stop() {
    if (this.proc) { this.proc.kill(); this.proc = null; }
  }
}

module.exports = { GpuProbe };
