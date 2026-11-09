import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll.js - walks the camera through the building as the page scrolls.
 *
 * Every entry in STOPS ties a place on the page to a camera position, a look
 * target and the mood of the light. Between two stops everything is blended,
 * so the page and the world can never drift out of step.
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const STOPS = [
  { el: '#hero',            pos: V(0, 3.0, 40),          tgt: V(0, 2.5, -14),     mood: 'morning' },
  { el: '#manifesto',       pos: V(1.4, 3.6, 2),         tgt: V(0.5, 8.6, -14),   mood: 'morning' },
  { el: '#through-gate',    pos: V(3.8, 6.6, -19),       tgt: V(1, 6.2, -52),     mood: 'daylight' },
  { el: '#octadezx',        pos: V(-12, 4.6, -56),       tgt: V(-7.4, 6.6, -80),  mood: 'daylight' },
  { el: '#octa-results',    pos: V(-3.6, 4.2, -60),      tgt: V(0, 7.4, -80),     mood: 'daylight' },
  { el: '#octa-why',        pos: V(12.5, 5.4, -62),      tgt: V(5.6, 6.4, -80),   mood: 'daylight' },
  { el: '#octa-exit',       pos: V(0, 5, -103),          tgt: V(0, 2.4, -140),    mood: 'dusk' },
  { el: '#accert-one',      pos: V(1.9, 1.3, -126.5),    tgt: V(-3.6, 1.7, -145), tall: V(-2.9, 0.4, -134), mood: 'dusk' },
  { el: '#accert-story',    pos: V(-9.4, 0.9, -135.6),   tgt: V(-2.7, 0.9, -131.4), mood: 'dusk' },
  { el: '#accert-preorder', pos: V(2.2, 1.15, -125),     tgt: V(1.4, 2.0, -141),  mood: 'dusk' },
  { el: '#accert-exit',     pos: V(-1, 2.4, -178),       tgt: V(0, 7, -262),      mood: 'vault' },
  { el: '#security',        pos: V(-9.5, 5.4, -229),     tgt: V(-3.5, 10.4, -262), mood: 'vault' },
  { el: '#sec-capabilities', pos: V(0, 7, -232),         tgt: V(0, 11.8, -262),   mood: 'vault' },
  { el: '#sec-how',         pos: V(10, 6.4, -236),       tgt: V(3.6, 10.6, -262), mood: 'vault' },
  { el: '#sec-exit',        pos: V(0, 7.8, -251),        tgt: V(0, 8.6, -300),    mood: 'gallery' },
  { el: '#work',            pos: V(0, 5.6, -292),        tgt: V(0, 6.6, -345),    mood: 'gallery' },
  { el: '#paper',           pos: V(0, 3.4, -340),        tgt: V(0, 8, -384),      mood: 'golden' },
  { el: '#contact',         pos: V(0, 2.8, -352),        tgt: V(0, 8.8, -384),    mood: 'golden' },
];

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const index = (id) => STOPS.findIndex((s) => s.el === id);

export default class Scroll {
  constructor(experience) {
    this.exp = experience;
    this.cam = experience.camera;
    this.world = experience.world;

    this.posCurve = new THREE.CatmullRomCurve3(STOPS.map((s) => s.pos), false, 'centripetal');
    // On a tall phone screen a few stops aim straight at their subject.
    const tall = experience.sizes.aspect < 1;
    this.tgtCurve = new THREE.CatmullRomCurve3(STOPS.map((s) => (tall && s.tall) || s.tgt), false, 'centripetal');
    this._pos = new THREE.Vector3();
    this._tgt = new THREE.Vector3();
    this._look = { x: 0, y: 0, tx: 0, ty: 0 };
    this._paper = false;

    this.I = {
      gate: index('#hero'), story: index('#accert-story'), order: index('#accert-preorder'),
      secA: index('#security'), secB: index('#sec-exit'),
    };

    this.cam.instance.position.copy(STOPS[0].pos);
    this.cam.rig.position.copy(STOPS[0].pos);
    this.cam.rig.target.copy(STOPS[0].tgt);
    this.cam._currentTarget?.copy(STOPS[0].tgt);

    this._initLenis();
    this._initReveals();
    this._initThemes();
    this._initDrag();
    this._measure();
    ScrollTrigger.addEventListener('refresh', () => this._measure());
    this._apply(this.lenis.scroll || window.scrollY || 0, true);

    gsap.to(['.chrome', '.scroll-hint'], { opacity: 1, duration: 1.2, delay: 0.2, stagger: 0.08 });
  }

  _initLenis() {
    this.lenis = new Lenis({ autoRaf: false, lerp: 0.115, wheelMultiplier: 1.0, smoothWheel: !this.exp.reducedMotion });
    window.__lenis = this.lenis;
    this.lenis.on('scroll', () => { ScrollTrigger.update(); this._scrollbar(); });
    this._hintGone = false;
    this.lenis.on('scroll', (e) => {
      const gone = e.scroll > 120;
      if (gone !== this._hintGone) {
        this._hintGone = gone;
        gsap.to('.scroll-hint', { opacity: gone ? 0 : 1, duration: 0.5, overwrite: true });
      }
    });
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length > 1 && document.querySelector(id)) {
          e.preventDefault();
          this.lenis.scrollTo(id, { offset: 0, duration: 1.8 });
        }
      });
    });
  }

  raf(now) { this.lenis.raf(now); }

  _scrollbar() {
    const handle = document.querySelector('.asscrollbar__handle');
    if (!handle) return;
    const limit = this.lenis.limit || 1;
    const trackH = window.innerHeight * 0.18;
    handle.style.height = `${trackH}px`;
    handle.style.transform = `translateY(${(this.lenis.scroll / limit) * (window.innerHeight - trackH)}px)`;
  }

  playIntro() { this._introTween?.play(); }

  _initReveals() {
    const lines = document.querySelectorAll('.hero__title .line > span');
    this._introTween = gsap.from(lines, {
      yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.12, paused: true,
    });
    gsap.from('.hero__foot > *', {
      y: 18, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.1, delay: 0.1,
      paused: false, scrollTrigger: { trigger: '#hero', start: 'top bottom' },
    });

    gsap.utils.toArray('.reveal, .split').forEach((el) => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 90%' },
        y: 28, opacity: 0, duration: 1.1, ease: 'power3.out',
      });
    });

    gsap.utils.toArray('.count').forEach((el) => {
      const to = parseFloat(el.dataset.to) || 0;
      const dec = (el.dataset.to.split('.')[1] || '').length;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: to, duration: 1.7, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
        onUpdate: () => { el.textContent = obj.v.toFixed(dec); },
      });
    });
  }

  /** Ink flips with the light: dark text in bright rooms, pale text in dark ones. */
  _initThemes() {
    gsap.utils.toArray('[data-ink]').forEach((sec) => {
      const apply = (s) => { if (s.isActive) document.body.dataset.ink = sec.dataset.ink; };
      ScrollTrigger.create({
        trigger: sec, start: 'top 55%', end: 'bottom 55%',
        onToggle: apply, onRefresh: apply,
      });
    });
    ScrollTrigger.create({
      trigger: '#paper', start: 'top top', end: 'bottom bottom',
      onToggle: (s) => { this._paper = s.isActive; if (!s.isActive) this.exp.invalidate(2); },
      onRefresh: (s) => { this._paper = s.isActive; },
    });
  }

  /** Hold and drag in the opening view to look around. */
  _initDrag() {
    if (this.exp.reducedMotion) return;
    let down = false, sx = 0, sy = 0;
    window.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a,button,input,textarea,select,label,.menu')) return;
      down = true; sx = e.clientX; sy = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down || (this.lenis.scroll || 0) > window.innerHeight * 0.6) return;
      this._look.tx = ((e.clientX - sx) / innerWidth) * 9;
      this._look.ty = -((e.clientY - sy) / innerHeight) * 4.5;
    }, { passive: true });
    const up = () => { down = false; this._look.tx = 0; this._look.ty = 0; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  _measure() {
    const sy = this.lenis?.scroll ?? window.scrollY ?? 0;
    this.stopY = STOPS.map((s) => {
      const el = document.querySelector(s.el);
      return el ? el.getBoundingClientRect().top + sy : 0;
    });
    for (let i = 1; i < this.stopY.length; i++) {
      if (this.stopY[i] <= this.stopY[i - 1]) this.stopY[i] = this.stopY[i - 1] + 1;
    }
  }

  /** Scroll offset to camera, light and each room's own progress. */
  _apply(y, snap) {
    const Y = this.stopY;
    let i = 0;
    while (i < Y.length - 2 && y >= Y[i + 1]) i++;
    const f = clamp01((y - Y[i]) / (Y[i + 1] - Y[i]));
    const u = (i + f) / (Y.length - 1);

    this.posCurve.getPoint(u, this._pos);
    this.tgtCurve.getPoint(u, this._tgt);
    this.cam.rig.position.copy(this._pos);
    this.cam.rig.target.copy(this._tgt);

    const w = this.world;
    w.atmosphere.blend(STOPS[i].mood, STOPS[i + 1].mood, smooth(f));
    w.cull(this._pos.z);

    const stop = i + f;
    const between = (a, b) => clamp01((stop - a) / (b - a));
    w.gate.setOpen(between(0.1, 1));

    const { story, order, secA, secB } = this.I;
    w.circuit.setLights(between(story + 0.1, order));
    w.circuit.setLaunch(stop > order ? between(order + 0.03, order + 0.6) : 0);
    w.vault.setProgress(between(secA, secB));
    this._changing = STOPS[i].mood !== STOPS[i + 1].mood || i === 0 || (stop >= secA && stop <= secB);

    if (snap) {
      this.cam.instance.position.copy(this._pos);
      this.cam._currentTarget?.copy(this._tgt);
    }
  }

  /** Per-frame hook. Returns true while the world needs drawing. */
  frame(delta) {
    this._apply(this.lenis.scroll || 0);

    const atHero = (this.lenis.scroll || 0) < window.innerHeight * 0.6;
    if (atHero !== this._atHero) {
      this._atHero = atHero;
      document.body.classList.toggle('at-hero', atHero);
    }

    if (!this.exp.reducedMotion) {
      const L = this._look, n = this.world.mouseNDC;
      const k = Math.min(1, delta * 4);
      L.x += (L.tx - L.x) * k;
      L.y += (L.ty - L.y) * k;
      this.cam.rig.target.x += L.x + n.x * 0.9;
      this.cam.rig.target.y += L.y + n.y * 0.5;
      this.cam.rig.position.x += n.x * 0.28;
      this.cam.rig.position.y += n.y * 0.14;
    }

    const live = !this._paper;
    const moving = Math.abs(this.lenis?.velocity || 0) > 0.08;
    // Shadows are the same until a door swings or the sun moves, so only redraw then.
    this._tick = ((this._tick || 0) + 1) % 3;
    const q = this.exp.quality;
    if (q.shadowSize > 0) {
      const settled = this._wasMoving && !moving;
      const during = q.shadowLive && moving && this._changing && this._tick === 0;
      if (this.world.atmosphere.takeShadowDirty() || settled || during) this.exp.renderer.instance.shadowMap.needsUpdate = true;
    }
    this._wasMoving = moving;
    this.exp.setInteractiveQuality?.(live);
    return live;
  }
}
