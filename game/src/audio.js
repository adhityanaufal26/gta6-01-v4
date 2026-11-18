// audio.js — procedural WebAudio only: engine hum, sirens, gunshots, UI blips, radio loops. No audio files.
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null; this.sirenTimer = null;
    this.radioNodes = null; this.radioStep = 0; this.radioTimer = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  blip(freq = 660, dur = 0.07, type = 'square', vol = 0.15) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }
  gunshot(big = false) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.12), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = big ? 0.5 : 0.3;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = big ? 900 : 1800;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  crash() { this.blip(90, 0.25, 'sawtooth', 0.4); this.blip(55, 0.3, 'triangle', 0.35); }
  siren(on) {
    if (!this.ensure()) return;
    if (on && !this.sirenTimer) {
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'sine'; g.gain.value = 0.05; o.connect(g); g.connect(this.master); o.start();
      let up = true;
      this.sirenTimer = setInterval(() => {
        if (this.muted) return;
        o.frequency.setTargetAtTime(up ? 950 : 650, this.ctx.currentTime, 0.05); up = !up;
      }, 420);
      this._sirenOsc = o; this._sirenGain = g;
    } else if (!on && this.sirenTimer) {
      clearInterval(this.sirenTimer); this.sirenTimer = null;
      try { this._sirenOsc.stop(); } catch (e) {}
    }
  }
  engineStart(speed01) {
    if (!this.ensure()) return;
    if (!this.engineOsc) {
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 60; g.gain.value = 0.0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      o.connect(f); f.connect(g); g.connect(this.master); o.start();
      this.engineOsc = o; this.engineGain = g;
    }
    const target = this.muted ? 0 : 0.03 + speed01 * 0.06;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.1);
  }
  engineStop() { if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }
  // Radio: a tiny step sequencer. station 0 synthwave, 1 latin groove, 2 talk/news bed.
  radioNote(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  radioTick(station, step) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.02;
    const synth = [55, 0, 65.4, 0, 82.4, 0, 65.4, 98, 55, 0, 65.4, 0, 110, 98, 82.4, 73.4];
    const latin = [130.8, 0, 164.8, 196, 0, 164.8, 146.8, 0, 130.8, 0, 164.8, 196, 220, 196, 164.8, 146.8];
    if (station === 0) {
      const n = synth[step % 16]; if (n) this.radioNote(n * 4, t, 0.22, 'sawtooth', 0.05);
      if (step % 4 === 0) this.radioNote(220, t, 0.1, 'square', 0.03);
      if (step % 8 === 4) this.radioNote(330, t, 0.3, 'triangle', 0.04);
    } else if (station === 1) {
      const n = latin[step % 16]; if (n) this.radioNote(n * 2, t, 0.16, 'triangle', 0.07);
      if (step % 2 === 0) this.radioNote(90, t, 0.08, 'sine', 0.09);
      if (step % 4 === 2) this.radioNote(523, t, 0.08, 'square', 0.02);
    } else {
      if (step % 16 === 0) this.radioNote(196, t, 0.5, 'sine', 0.03);
      if (step % 8 === 0) this.radioNote(147, t, 0.4, 'sine', 0.025);
    }
  }
}
