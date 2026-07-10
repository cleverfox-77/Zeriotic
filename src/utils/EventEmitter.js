/** Minimal event emitter — just enough for Sizes/Resources. */
export default class EventEmitter {
  constructor() { this._events = {}; }
  on(name, cb) { (this._events[name] ||= []).push(cb); return this; }
  off(name, cb) {
    if (!this._events[name]) return this;
    this._events[name] = this._events[name].filter((f) => f !== cb);
    return this;
  }
  emit(name, ...args) {
    for (const cb of this._events[name] || []) cb(...args);
    return this;
  }
}
