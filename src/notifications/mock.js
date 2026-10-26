const { EventEmitter } = require('events');

const SAMPLES = [
  { app: 'Telegram Desktop', aumid: 'Telegram.TelegramDesktop', title: 'Laura', body: '¿Quedamos a las 7 para cenar?' },
  { app: 'WhatsApp', aumid: '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App', title: 'Equipo Familia', body: 'Mamá: Ya llegué a casa 🙂' },
  { app: 'Outlook', aumid: 'Microsoft.OutlookForWindows_8wekyb3d8bbwe!Microsoft.OutlookForWindows', title: 'Reunión de planificación', body: 'Mañana 10:00 · Sala 3' },
  { app: 'Microsoft Teams', aumid: 'MSTeams_8wekyb3d8bbwe!MSTeams', title: 'Carlos Ruiz', body: 'Te mencionó en #proyecto-alfa' },
];

class MockNotifications extends EventEmitter {
  constructor() { super(); this.access = 'Allowed'; this.i = 0; }
  start() {
    this.emit('access', 'Allowed');
    const fire = () => {
      this.emit('notification', { type: 'notification', id: this.i, ...SAMPLES[this.i % SAMPLES.length], time: Date.now() });
      this.i++;
    };
    setTimeout(fire, 6000);
    this.timer = setInterval(fire, 25000);
  }
  open() {}
  stop() { clearInterval(this.timer); }
}

module.exports = { MockNotifications };
