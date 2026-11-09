/**
 * Sound.js - procedural ratchet / hover audio (Web Audio, no copied samples).
 * Tiny filtered-noise clicks that mimic tactile hover sounds.
 */
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this._last = 0;
  }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? 0.25 : 0; }
  _click(freq = 4500, dur = 0.05, gain = 0.06) {
    if (!this.ctx || !this.enabled) return;
    const now = performance.now();
    if (now - this._last < 45) return; // throttle ratchet
    this._last = now;
    const t = this.ctx.currentTime;
    const nb = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = nb;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  hover() { this.unlock(); this._click(5200, 0.04, 0.045); }
  enter() { this.unlock(); this._click(3200, 0.07, 0.06); this._click(5200, 0.05, 0.04); }
  leave() { this._click(2600, 0.05, 0.035); }
}
export const sound = new Sound();

export function initSound() {
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  // hover ratchet delegation
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('a, button, [data-cursor]');
    if (t && !t._ratcheted) { sound.hover(); t._ratcheted = true; setTimeout(() => t._ratcheted = false, 300); }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) sound.enter();
  });
  const mute = document.querySelector('.js-mute-btn');
  if (mute) mute.addEventListener('click', () => {
    const on = !sound.enabled;
    sound.setEnabled(on);
    mute.classList.toggle('is-muted', !on);
    mute.setAttribute('aria-pressed', String(!on));
  });
}
