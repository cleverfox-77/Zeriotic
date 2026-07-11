import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import SplitType from 'split-type';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll.js — the scrollytelling director.
 *
 * Owns:
 *   · Lenis smooth scroll (driven from the single Experience rAF loop)
 *   · the GSAP ScrollTrigger timeline
 *   · a Catmull-Rom camera sweep through the Services beats
 *   · particle-field state changes (World.setState) per scroll beat
 *   · text reveals (SplitType), stat count-ups, the hero intro
 *
 * RENDER POLICY: the particle field must BREATHE, so any section with a live
 * 3D background (hero / manifesto / services / contact) keeps the renderer in
 * continuous mode. The solid studio sections release it — there the GPU only
 * wakes for scroll and reveals.
 */
export default class Scroll {
  constructor(experience) {
    this.exp = experience;
    this.cam = experience.camera;
    this.world = experience.world;

    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---- framings ----
    this.heroRadius = 12.5;
    this.heroTgt = V(0, 0.2, 0);

    this.manifestoPos = V(-3.5, 3.4, 15.5);
    this.manifestoTgt = V(0, 0.4, 0);

    // Services sweep — one slow arc around the field, three beats
    this.capsPts = [
      V(0.0,  2.6, 15.5),   // in from the manifesto pull-back
      V(8.5,  0.6, 12.0),   // 01 web apps — low 3/4
      V(-8.5, 2.2, 13.0),   // 02 commerce — opposite side, far enough to frame the lattice
      V(0.0, -2.2, 14.5),   // 03 SaaS — low frontal, the field spreads as a wave
    ];
    this.capsCurve = new THREE.CatmullRomCurve3(this.capsPts, false, 'catmullrom', 0.35);
    // look-at sits LEFT of the field so the forms render right-of-center,
    // clear of the caption column
    this.capsTgt = V(-2.6, 0.2, 0);
    this._beatStates = ['knot', 'lattice', 'wave'];
    this._beat = -1;

    this.workPos = V(0, 1.0, 17.5);
    this.contactPos = V(0, 0.3, 12.8);

    // live-background flags — any true → continuous rendering (field breathes)
    this._live = {};
    this.heroActive = false;
    this._heroAngle = 0.35;

    // place camera at the hero orbit immediately
    const hp = V(Math.sin(this._heroAngle) * this.heroRadius, 0.8, Math.cos(this._heroAngle) * this.heroRadius);
    this.cam.rig.position.copy(hp);
    this.cam.rig.target.copy(this.heroTgt);
    this.cam.instance.position.copy(hp);

    this._initLenis();
    this._initReveals();
    this._initTimeline();

    // reveal persistent chrome
    gsap.to(['.chrome', '.scroll-hint'], { opacity: 1, duration: 1.2, delay: 0.2, stagger: 0.08 });
  }

  _initLenis() {
    this.lenis = new Lenis({ autoRaf: false, lerp: 0.065, duration: 1.4, wheelMultiplier: 1.0, smoothWheel: true });
    this.lenis.on('scroll', () => { ScrollTrigger.update(); this.exp.invalidate(2); });
    // the SCROLL hint has done its job after the first real scroll
    this._hintGone = false;
    this.lenis.on('scroll', (e) => {
      // overwrite:true also kills the DELAYED intro reveal tween, which would
      // otherwise start later and win the opacity back to 1
      if (!this._hintGone && e.scroll > 120) {
        this._hintGone = true;
        gsap.to('.scroll-hint', { opacity: 0, duration: 0.6, overwrite: true });
      } else if (this._hintGone && e.scroll <= 120) {
        this._hintGone = false;
        gsap.to('.scroll-hint', { opacity: 1, duration: 0.6, overwrite: true });
      }
    });
    // anchor links route through Lenis
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length > 1) { e.preventDefault(); this.lenis.scrollTo(id, { offset: 0, duration: 1.4 }); }
      });
    });
  }

  // called by Experience each rAF
  raf(now) { this.lenis.raf(now); }

  // called by Experience once the preloader has dissolved
  playIntro() { this._introTween?.play(); }

  _initReveals() {
    // Hero title — character-level masked stagger with blur dissolve.
    // Gradient words (.accent) are NOT char-split: background-clip:text doesn't
    // survive being broken into child spans, so they animate as whole words.
    gsap.utils.toArray('.hero__title .word:not(.accent)').forEach((word) => {
      const split = new SplitType(word, { types: 'chars' });
      split.chars?.forEach((c) => { c.style.display = 'inline-block'; });
    });
    this._introTween = gsap.from(
      document.querySelectorAll('.hero__title .char, .hero__title .word.accent'), {
        yPercent: 120, rotateX: -45, opacity: 0, filter: 'blur(4px)',
        duration: 1.0, ease: 'expo.out', stagger: 0.03, paused: true,
      });

    // Section headings — word-by-word reveal. Headings that carry a gradient
    // .accent span are NOT split (background-clip:text doesn't survive being
    // broken into child spans) — they reveal as one block instead.
    gsap.utils.toArray('.sec-head h2, .caption h2, .studio-copy h2, .contact__card h2').forEach((el) => {
      if (el.querySelector('.accent')) {
        // if it also carries .reveal, the generic reveal below owns it —
        // creating a second from-tween here would trap it at opacity 0
        if (!el.classList.contains('reveal')) {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: 'top 80%' },
            y: 34, opacity: 0, duration: 1.1, ease: 'expo.out',
            onStart: () => this.exp.invalidate(2),
          });
        }
        return;
      }
      const split = new SplitType(el, { types: 'words, lines' });
      if (split.words) {
        gsap.from(split.words, {
          scrollTrigger: { trigger: el, start: 'top 80%' },
          yPercent: 100, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06,
          onStart: () => this.exp.invalidate(2),
        });
      }
    });

    // Eyebrow labels — letter-by-letter
    gsap.utils.toArray('.eyebrow span').forEach((el) => {
      const split = new SplitType(el, { types: 'chars' });
      if (split.chars) {
        gsap.from(split.chars, {
          scrollTrigger: { trigger: el, start: 'top 85%' },
          opacity: 0, x: -4, duration: 0.8, ease: 'power2.out', stagger: 0.02,
          onStart: () => this.exp.invalidate(2),
        });
      }
    });

    // Generic reveals — clipPath mask + lift
    gsap.utils.toArray('.reveal').forEach((el) => {
      if (el.closest('.sec-head') && el.tagName === 'H2') return;
      if (el.closest('.eyebrow')) return;
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 88%' },
        y: 26, opacity: 0,
        duration: 1.2, ease: 'power3.out',
        onStart: () => this.exp.invalidate(2),
      });
    });

    // Line-split paragraphs — with blur
    gsap.utils.toArray('.reveal-line').forEach((el) => {
      const split = new SplitType(el, { types: 'lines' });
      gsap.from(split.lines, {
        scrollTrigger: { trigger: el, start: 'top 80%' },
        yPercent: 110, opacity: 0, filter: 'blur(3px)',
        duration: 1.1, ease: 'expo.out', stagger: 0.12,
      });
    });

    // Stat count-ups
    gsap.utils.toArray('.count').forEach((el) => {
      const to = parseInt(el.dataset.to, 10) || 0;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: to, duration: 1.8, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
        onUpdate: () => { el.textContent = Math.round(obj.v); },
      });
    });
  }

  _setCam(pos, tgt, dur = 2.0) {
    gsap.to(this.cam.rig.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease: 'power3.inOut', onUpdate: () => this.exp.invalidate(2) });
    gsap.to(this.cam.rig.target, { x: tgt.x, y: tgt.y, z: tgt.z, duration: dur, ease: 'power3.inOut', onUpdate: () => this.exp.invalidate(2) });
  }

  /** Register a section as having a LIVE 3D background while it's on screen. */
  _liveSection(sel) {
    ScrollTrigger.create({
      trigger: sel, start: 'top bottom', end: 'bottom top',
      onRefresh: (s) => { this._live[sel] = s.isActive; },
      onToggle: (s) => { this._live[sel] = s.isActive; if (s.isActive) this.exp.invalidate(2); },
    });
  }

  _initTimeline() {
    const inv = () => this.exp.invalidate(2);

    // live-background bookkeeping
    ['#hero', '#manifesto', '#services', '#contact'].forEach((s) => this._liveSection(s));

    // HERO — slow orbit while in view
    ScrollTrigger.create({
      trigger: '#hero', start: 'top top', end: 'bottom top',
      onRefresh: (s) => { this.heroActive = s.isActive; if (s.isActive) inv(); },
      onToggle: (s) => { this.heroActive = s.isActive; if (s.isActive) inv(); },
    });

    // NOTE: onEnter only fires when the scroll CROSSES a trigger edge — after a
    // mid-page reload or a #deep-link the page can initialise already inside a
    // section, so every section also mirrors its enter-state in onRefresh.

    // MANIFESTO — pull back and rise; the field re-forms as the studio's ribbon
    const manifestoState = () => {
      this._setCam(this.manifestoPos, this.manifestoTgt, 2.0);
      this.world.setState('ribbon', 2.0);
      this.world.setZVisible(false, 1.4);
      this.world.setDim(1);
    };
    ScrollTrigger.create({
      trigger: '#manifesto', start: 'top 60%',
      onEnter: manifestoState,
      onRefresh: (s) => { if (s.isActive) manifestoState(); },
      onLeaveBack: () => {
        this.world.setState('nebula', 1.8);
        this.world.setZVisible(true, 1.2);
        this.world.setDim(1);
      },
    });

    // SERVICES — scrub the sweep; the field re-forms per discipline.
    // Slightly dimmed so the caption column always wins the contrast fight.
    const servicesState = () => {
      this.world.setDim(0.6, 1.0);
      this.world.setZVisible(false, 0.6);
    };
    ScrollTrigger.create({
      trigger: '#services', start: 'top top', end: 'bottom bottom', scrub: 1.6,
      onEnter: servicesState,
      onEnterBack: servicesState,
      onRefresh: (s) => { if (s.isActive) servicesState(); },
      onUpdate: (self) => {
        const p = self.progress;
        const tmp = this.capsCurve.getPoint(p);
        this.cam.rig.position.copy(tmp);
        this.cam.rig.target.copy(this.capsTgt);
        const beat = Math.min(2, Math.floor(p * 3));
        if (beat !== this._beat) {
          this._beat = beat;
          this.world.setState(this._beatStates[beat]);
        }
        this._capsCaptions(p);
        inv();
      },
      onLeaveBack: () => { this._beat = -1; },
    });

    // WORK — settle wide; crystal shimmer dimmed behind the case studies
    const workState = () => {
      this._setCam(this.workPos, new THREE.Vector3(0, 0, 0), 2.0);
      this.world.setState('crystal', 2.0);
      this.world.setZVisible(false, 0.6);
      this.world.setDim(0.25);
    };
    ScrollTrigger.create({
      trigger: '#work', start: 'top 60%',
      onEnter: workState,
      onRefresh: (s) => { if (s.isActive) workState(); },
      onLeaveBack: () => { this.world.setDim(0.6); },
    });

    // CONTACT — the field converges back into the Z mark behind the card
    const contactState = () => {
      this._setCam(this.contactPos, new THREE.Vector3(0, 0.2, 0), 2.2);
      this.world.setState('zglyph', 2.2);
      this.world.setZVisible(true, 1.6);
      this.world.setDim(1, 1.6);
    };
    ScrollTrigger.create({
      trigger: '#contact', start: 'top 70%',
      onEnter: contactState,
      onRefresh: (s) => { if (s.isActive) contactState(); },
      onLeaveBack: () => {
        this.world.setZVisible(false, 1.0);
        this.world.setDim(0.25);
      },
    });
  }

  /** Cross-fade the three service captions along the scrub progress. */
  _capsCaptions(p) {
    const caps = document.querySelectorAll('.caps__track .caption');
    const seg = 1 / caps.length;
    caps.forEach((c, i) => {
      const mid = (i + 0.5) * seg;
      const d = Math.abs(p - mid);
      const on = d < seg * 0.6;
      const targetOpacity = on ? 1 - d / (seg * 0.6) : 0;
      const targetScale = on ? 0.97 + 0.03 * targetOpacity : 0.97;
      const targetBlur = on ? (1 - targetOpacity) * 2 : 2;
      gsap.to(c, {
        opacity: targetOpacity,
        y: (1 - targetOpacity) * 20,
        scale: targetScale,
        filter: `blur(${targetBlur.toFixed(1)}px)`,
        duration: 0.4, ease: 'power2.out', overwrite: 'auto',
      });
    });
  }

  /** per-frame hook (called by Experience). Returns true if it wants a render. */
  frame(delta) {
    // Continuous mode whenever a live-background section is on screen — the
    // particle drift must not freeze mid-view. Scrubbing/scrolling still swaps
    // SMAA→FXAA via the motion state.
    const live = this.heroActive || Object.values(this._live).some(Boolean);
    const scrolling = Math.abs(this.lenis?.velocity || 0) > 0.08;
    this.exp.setMotionState?.(live || scrolling);
    this.exp.setInteractiveQuality?.(live);

    if (this.heroActive) {
      // slow auto-orbit + pointer parallax
      this._heroAngle += delta * 0.05;
      const ndc = this.world.mouseNDC;
      const r = this.heroRadius;
      this.cam.rig.position.set(
        Math.sin(this._heroAngle) * r + ndc.x * 1.4,
        0.8 + Math.sin(this._heroAngle * 0.7) * 0.4 + ndc.y * 0.9,
        Math.cos(this._heroAngle) * r,
      );
      this.cam.rig.target.copy(this.heroTgt);
    }
    return live;
  }
}
