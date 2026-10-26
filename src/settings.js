const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  display: 'primary',   // 'primary' o el id de una pantalla
  theme: 'dark',        // 'dark' | 'light' | 'auto'
  accent: '#30d158',
  autoStart: false,
  startDelay: 0,        // segundos de espera al iniciar con Windows
  startHidden: false,
  notifications: true,
};

const THEMES = ['dark', 'light', 'auto'];
const DELAYS = [0, 5, 10, 30, 60];

// Solo se aceptan claves conocidas y con valores válidos: el panel y cualquier
// archivo editado a mano pasan por aquí.
function sanitize(patch, base) {
  const out = { ...base };
  if (typeof patch.display === 'string' && patch.display.length < 32) out.display = patch.display;
  if (THEMES.includes(patch.theme)) out.theme = patch.theme;
  if (typeof patch.accent === 'string' && /^#[0-9a-f]{6}$/i.test(patch.accent)) out.accent = patch.accent.toLowerCase();
  if (typeof patch.autoStart === 'boolean') out.autoStart = patch.autoStart;
  if (DELAYS.includes(patch.startDelay)) out.startDelay = patch.startDelay;
  if (typeof patch.startHidden === 'boolean') out.startHidden = patch.startHidden;
  if (typeof patch.notifications === 'boolean') out.notifications = patch.notifications;
  return out;
}

class Settings {
  constructor() {
    this.file = null;
    this.values = { ...DEFAULTS };
  }

  load() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    try {
      this.values = sanitize(JSON.parse(fs.readFileSync(this.file, 'utf8')), DEFAULTS);
    } catch {
      this.values = { ...DEFAULTS };
    }
    return this.values;
  }

  set(patch) {
    this.values = sanitize(patch, this.values);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.values, null, 2));
    } catch (err) {
      console.error('[settings] no se pudo guardar:', err.message);
    }
    return this.values;
  }

  reset() {
    return this.set(DEFAULTS);
  }
}

module.exports = { settings: new Settings(), DEFAULTS };
