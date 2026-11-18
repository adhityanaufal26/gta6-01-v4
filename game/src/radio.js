// radio.js — 3 switchable in-car stations with DJ text lines, cycled with R.
export const STATIONS = [
  { name: 'WAVE 98 — SYNTHWAVE', dj: 'DJ Neon says: driving into the sunset, Palmera Bay. This one is for the night runners.' },
  { name: 'CALOR 101 — LATIN GROOVE', dj: 'DJ Marisol here on Calor 101 — turn it up, the whole bay is dancing tonight.' },
  { name: 'BAY TALK 760 — NEWS', dj: 'Bay Talk 760: police report heavy traffic near the port. In other news, the sun is still shining.' },
];

export class Radio {
  constructor(game) {
    this.game = game;
    this.station = -1; // -1 = off
    this.step = 0;
    this._acc = 0;
    this.djLine = '';
  }
  cycle() {
    this.station = (this.station + 1) % STATIONS.length;
    if (this.station === 0 && this._wasOff) { /* first press turns on */ }
    this.djLine = STATIONS[this.station].dj;
    this.game.hud.toast(STATIONS[this.station].name + ' — ' + this.djLine, 4200);
    this.game.audio.blip(880, 0.08, 'square', 0.12);
    return this.station;
  }
  turnOff() { this.station = -1; }
  update(dt) {
    if (this.station < 0) return;
    this._acc += dt;
    const stepDur = 0.21;
    while (this._acc >= stepDur) {
      this._acc -= stepDur;
      this.game.audio.radioTick(this.station, this.step++);
    }
  }
  label() { return this.station < 0 ? 'RADIO: OFF' : 'RADIO: ' + STATIONS[this.station].name; }
}
