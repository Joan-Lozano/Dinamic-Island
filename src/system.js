const os = require('os');
const si = require('systeminformation');

// Muestrea recursos solo mientras la UI los está mostrando, para que la isla
// no consuma CPU en reposo.
class SystemMonitor {
  constructor(onSample) {
    this.onSample = onSample;
    this.timer = null;
    this.prevCpu = this.#cpuTimes();
    this.diskPct = null;
    this.diskAt = 0;
    this.gpuMissing = false;
    this.busy = false;
  }

  #cpuTimes() {
    let idle = 0, total = 0;
    for (const c of os.cpus()) {
      for (const k of Object.keys(c.times)) total += c.times[k];
      idle += c.times.idle;
    }
    return { idle, total };
  }

  async #sample() {
    if (this.busy) return;
    this.busy = true;
    try {
      const now = this.#cpuTimes();
      const dTotal = now.total - this.prevCpu.total;
      const cpu = dTotal > 0 ? 100 * (1 - (now.idle - this.prevCpu.idle) / dTotal) : 0;
      this.prevCpu = now;

      const totalMem = os.totalmem();
      const ram = 100 * (1 - os.freemem() / totalMem);

      const [net, gpu] = await Promise.all([
        si.networkStats().catch(() => []),
        this.gpuMissing ? null : si.graphics().catch(() => null),
      ]);

      if (Date.now() - this.diskAt > 30000) {
        this.diskAt = Date.now();
        const fs = await si.fsSize().catch(() => []);
        const main = fs.find((d) => /^c:?$/i.test(d.mount.replace(/[\\/]/g, ''))) || fs[0];
        this.diskPct = main ? main.use : null;
      }

      let gpuPct = null;
      if (gpu) {
        const g = gpu.controllers.find((c) => typeof c.utilizationGpu === 'number');
        if (g) gpuPct = g.utilizationGpu; else this.gpuMissing = true;
      }

      const rx = net.reduce((a, n) => a + (n.rx_sec > 0 ? n.rx_sec : 0), 0);
      const tx = net.reduce((a, n) => a + (n.tx_sec > 0 ? n.tx_sec : 0), 0);

      this.onSample({
        cpu: Math.round(cpu), ram: Math.round(ram),
        ramUsed: totalMem - os.freemem(), ramTotal: totalMem,
        gpu: gpuPct, disk: this.diskPct, rx, tx,
      });
    } finally {
      this.busy = false;
    }
  }

  watch(on) {
    if (on && !this.timer) {
      this.prevCpu = this.#cpuTimes();
      this.timer = setInterval(() => this.#sample(), 1500);
      setTimeout(() => this.#sample(), 300);
    } else if (!on && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = { SystemMonitor };
