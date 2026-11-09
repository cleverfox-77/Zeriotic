/**
 * Preloader.js
 * The mark draws itself in CSS, so it is moving from the very first paint.
 * This only feeds the progress bar and opens the way in once the world is ready.
 */
export default class Preloader {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.el = document.getElementById('preloader');
    this.fill = document.getElementById('preloader-fill');
    this.pct = document.getElementById('preloader-pct');
    this.target = 0;
    this.shown = 0;
    this._done = false;

    document.body.classList.add('is-loading');

    this.el.querySelectorAll('.js-enter-btn, .js-enter-no-audio').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const on = btn.dataset.audio !== 'off';
        import('../utils/Sound.js').then(({ sound }) => {
          sound.setEnabled(on);
          document.querySelector('.js-mute-btn')?.classList.toggle('is-muted', !on);
        }).catch(() => {});
        this._dismiss();
      });
    });

    this._timeout = setTimeout(() => { if (!this._done) this.target = 1; }, 12000);
    requestAnimationFrame(() => this._loop());
  }

  /** Fed by the world as it builds. */
  setProgress(frac) { this.target = Math.max(this.target, frac); }

  _loop() {
    const rate = this.target >= 1 ? 0.3 : 0.14;
    this.shown = Math.min(1, this.shown + (this.target - this.shown) * rate + (this.target >= 1 ? 0.01 : 0));
    this.pct.textContent = `${Math.round(this.shown * 100)}%`;
    this.fill.style.width = `${(this.shown * 100).toFixed(1)}%`;

    if (this.target >= 1 && this.shown > 0.995 && !this._done) {
      this._done = true;
      this.el.classList.add('is-ready');
      setTimeout(() => { if (!this._dismissed) this._dismiss(); }, 8000);
      return;
    }
    requestAnimationFrame(() => this._loop());
  }

  _dismiss() {
    if (this._dismissed) return;
    this._dismissed = true;
    clearTimeout(this._timeout);
    this.pct.textContent = '100%';
    this.fill.style.width = '100%';
    this.el.classList.add('is-leaving');
    document.body.classList.remove('is-loading');
    // The opening starts while the veil lifts, not after it.
    requestAnimationFrame(() => this.onComplete?.());
    setTimeout(() => { this.el.style.display = 'none'; }, 560);
  }
}
