const { EventEmitter } = require('events');

const TRACKS = [
  { title: "Can't Take My Eyes Off You (Ruthi…)", artist: 'Jason Lux', app: 'Spotify.exe', duration: 251, hue: 22 },
  { title: 'Lo-fi Beats to Study To', artist: 'YouTube · Chill Radio', app: 'chrome.exe', duration: 3600, hue: 200 },
  { title: 'Midnight City', artist: 'M83', app: 'Spotify.exe', duration: 243, hue: 280 },
];

function art(hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},80%,60%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,25%)"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="100" r="46" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="6"/></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// Reproductor simulado para desarrollar la UI fuera de Windows.
class MockMedia extends EventEmitter {
  constructor() {
    super();
    this.i = 0;
    this.position = 62;
    this.playing = true;
    this.state = { active: false };
  }

  #build() {
    const t = TRACKS[this.i];
    this.state = {
      active: true, key: `${this.i}`, app: t.app, title: t.title, artist: t.artist,
      playing: this.playing, position: this.position, duration: t.duration,
      canNext: true, canPrev: true, canSeek: true, thumb: art(t.hue), at: Date.now(),
    };
    this.emit('state', this.state);
  }

  start() {
    this.#build();
    this.timer = setInterval(() => {
      if (this.playing) {
        this.position += 1;
        if (this.position >= TRACKS[this.i].duration) this.send('next');
      }
      this.#build();
    }, 1000);
  }

  send(cmd, value) {
    if (cmd === 'toggle') this.playing = !this.playing;
    if (cmd === 'next') { this.i = (this.i + 1) % TRACKS.length; this.position = 0; }
    if (cmd === 'prev') { this.i = (this.i + TRACKS.length - 1) % TRACKS.length; this.position = 0; }
    if (cmd === 'seek') this.position = value;
    this.#build();
  }

  stop() { clearInterval(this.timer); }
}

module.exports = { MockMedia };
