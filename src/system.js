const os = require('os');
const si = require('systeminformation');
const { GpuProbe } = require('./gpu/windows');

// Muestrea recursos solo mientras la UI los está mostrando, para que la isla
// no consuma CPU en reposo.
class SystemMonitor {
  constructor(onSample) {
    this.onSample = onSample;
    this.timer = null;
    this.prevCpu = this.#cpuTimes();
    this.disk = { pct: null, at: 0, busy: false };
    this.net = { rx: 0, tx: 0, busy: false };
    this.gpu = { pct: null, name: '', vendor: '' };
    this.gpuProbe = new GpuProbe((g) => { this.gpu = g; });
  }

  #cpuTimes() {
    let idle = 0, total = 0;
    for (const c of os.cpus()) {
      for (const k of Object.keys(c.times)) total += c.times[k];
      idle += c.times.idle;
    }
    return { idle, total };
  }

  // Red y disco se refrescan en segundo plano: una lectura lenta no debe
  // retrasar la muestra (CPU y RAM salen al instante).
  #refreshNet() {
    if (this.net.busy) return;
    this.net.busy = true;
    si.networkStats().then((net) => {
      this.net.rx = net.reduce((a, n) => a + (n.rx_sec > 0 ? n.rx_sec : 0), 0);
      this.net.tx = net.reduce((a, n) => a + (n.tx_sec > 0 ? n.tx_sec : 0), 0);
    }).catch(() => {}).finally(() => { this.net.busy = false; });
  }

  #refreshDisk() {
    if (this.disk.busy || Date.now() - this.disk.at < 30000) return;
    this.disk.busy = true;
    si.fsSize().then((fs) => {
      const main = fs.find((d) => /^c:?$/i.test(d.mount.replace(/[\\/]/g, ''))) || fs[0];
      this.disk.pct = main ? main.use : null;
      this.disk.at = Date.now();
    }).catch(() => {}).finally(() => { this.disk.busy = false; });
  }

  #sample() {
    const now = this.#cpuTimes();
    const dTotal = now.total - this.prevCpu.total;
    const cpu = dTotal > 0 ? 100 * (1 - (now.idle - this.prevCpu.idle) / dTotal) : 0;
    this.prevCpu = now;

    const totalMem = os.totalmem();
    const ram = 100 * (1 - os.freemem() / totalMem);

    this.#refreshNet();
    this.#refreshDisk();

    this.onSample({
      cpu: Math.round(cpu), ram: Math.round(ram),
      ramUsed: totalMem - os.freemem(), ramTotal: totalMem,
      gpu: this.gpu.pct, gpuName: this.gpu.name, gpuVendor: this.gpu.vendor,
      disk: this.disk.pct, rx: this.net.rx, tx: this.net.tx,
    });
  }

  watch(on) {
    if (on && !this.timer) {
      this.prevCpu = this.#cpuTimes();
      this.gpuProbe.start();
      this.timer = setInterval(() => this.#sample(), 1500);
      setTimeout(() => this.#sample(), 100);
    } else if (!on && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.gpuProbe.stop();
    }
  }
}

module.exports = { SystemMonitor };
