import EventEmitter from './EventEmitter.js';

/**
 * Tracks viewport size + device pixel ratio.
 * PERFORMANCE: pixelRatio is hard-capped — rendering at the native ratio of
 * a 3x phone would trash the fill rate for almost no perceptible gain.
 */
export default class Sizes extends EventEmitter {
  constructor() {
    super();
    this.maxPR = 2;                 // overridden from the detected quality tier
    this.renderScale = 1;           // temporarily lowered during continuous-render sections for fps
    this.update();
    let raf = 0;
    window.addEventListener('resize', () => {
      // debounce to one update per frame to avoid resize storms
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { this.update(); this.emit('resize'); });
    });
  }
  update() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.aspect = this.width / this.height;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPR) * this.renderScale;
  }
}
