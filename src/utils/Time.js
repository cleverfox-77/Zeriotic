/** Wall-clock elapsed time in seconds since construction. */
export default class Time {
  constructor() { this._start = performance.now(); }
  get elapsed() { return (performance.now() - this._start) / 1000; }
}
