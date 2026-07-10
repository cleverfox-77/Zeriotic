import anime from 'animejs/lib/anime.es.js';

/**
 * Preloader.js
 * The Zeriotic mark draws itself on (ring → square → diagonal, as SVG strokes),
 * the wordmark resolves beneath it, and a percentage counter is fed by the real
 * LoadingManager progress before the whole thing dissolves to reveal the scene.
 *
 * The percentage is eased toward the true load fraction so it never stalls or
 * jumps — it feels like a smooth fill even though bytes arrive in bursts.
 */
export default class Preloader {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.el = document.getElementById('preloader');
    this.fill = document.getElementById('preloader-fill');
    this.pct = document.getElementById('preloader-pct');
    this.target = 0;     // true fraction 0..1 from Resources
    this.shown = 0;      // displayed fraction, eased
    this._done = false;

    document.body.classList.add('is-loading');

    this._drawMark();

    this._raf = requestAnimationFrame(() => this._loop());
  }

  /** Stroke-draw the mark (ring → square → diagonal), then resolve the wordmark. */
  _drawMark() {
    const parts = ['pre-ring', 'pre-rect', 'pre-diag']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const tl = anime.timeline({ easing: 'easeInOutQuart' });
    parts.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      tl.add({ targets: p, strokeDashoffset: [len, 0], duration: 520 + i * 60 }, i === 0 ? 0 : '-=260');
    });
    tl.add({
      targets: '.preloader__brand',
      opacity: [0, 1], translateY: [8, 0], duration: 900, easing: 'easeOutExpo',
    }, '-=300');
  }

  /** Wired to Resources 'progress'. */
  setProgress(frac) { this.target = Math.max(this.target, frac); }

  _loop() {
    // Ease toward the real fraction; once everything is in, drive firmly to 100%
    // so the bar never lingers asymptotically at 99%.
    const rate = this.target >= 1 ? 0.16 : 0.08;
    this.shown += (this.target - this.shown) * rate + (this.target >= 1 ? 0.004 : 0);
    this.shown = Math.min(this.shown, 1);
    const p = Math.round(this.shown * 100);
    this.pct.textContent = p + '%';
    this.fill.style.width = (this.shown * 100).toFixed(1) + '%';

    if (this.target >= 1 && this.shown > 0.995 && !this._done) {
      this._done = true;
      this._finish();
      return;
    }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _finish() {
    this.pct.textContent = '100%';
    this.fill.style.width = '100%';
    anime.timeline({ easing: 'easeInOutQuart' })
      .add({ targets: '.preloader__inner', opacity: [1, 0], translateY: [0, -16], duration: 700, delay: 250 })
      .add({
        targets: '#preloader', opacity: [1, 0], duration: 900,
        complete: () => {
          this.el.style.display = 'none';
          document.body.classList.remove('is-loading');
          this.onComplete?.();
        },
      }, '-=400');
  }
}
