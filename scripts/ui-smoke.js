// Prueba de humo de la UI en Chromium con una API `window.island` simulada.
// Uso: node scripts/ui-smoke.js [carpeta-de-capturas]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const out = process.argv[2] || path.join(__dirname, '..', 'dist-shots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 520, height: 200 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.addInitScript(() => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#d4742c"/></svg>';
    const media = { active: true, key: 'k', app: 'Spotify.exe', title: "Can't Take My Eyes Off You (Ruthi…)", artist: 'Jason Lux',
      playing: true, position: 62, duration: 251, canNext: true, canPrev: true, canSeek: true, at: Date.now(),
      thumb: 'data:image/svg+xml;base64,' + btoa(svg) };
    window.__calls = [];
    window.island = {
      onMedia: (cb) => setTimeout(() => cb(media), 0),
      onSystem: (cb) => { window.__sys = cb; },
      media: (...a) => window.__calls.push(a),
      watchSystem: (on) => window.__calls.push(['watch', on]),
      setInteractive: () => {},
    };
    navigator.getBattery = async () => Object.assign(new EventTarget(), { level: 0.82, charging: true });
  });

  await page.goto('file://' + path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  await page.waitForTimeout(4600); // deja terminar el "peek" por cambio de pista
  await page.screenshot({ path: path.join(out, '1-compact.png') });

  await page.mouse.move(260, 20);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, '2-media.png') });

  await page.click('.btn-play');
  await page.click('.next-page');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__sys({ cpu: 37, ram: 74, gpu: null, disk: 91, rx: 2.4e6, tx: 35e3 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, '3-system.png') });

  const calls = await page.evaluate(() => window.__calls);
  console.log('calls:', JSON.stringify(calls));
  if (!calls.some((c) => c[0] === 'toggle') || !calls.some((c) => c[0] === 'watch' && c[1] === true)) errors.push('IPC calls missing');
  await browser.close();
  if (errors.length) { console.error('ERRORS', errors); process.exit(1); }
  console.log('ok ->', out);
})();
