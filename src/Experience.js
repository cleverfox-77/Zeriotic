import * as THREE from 'three';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Sizes from './utils/Sizes.js';
import Time from './utils/Time.js';
import Renderer from './world/Renderer.js';
import Camera from './world/Camera.js';
import Resources from './world/Resources.js';
import Environment from './world/Environment.js';
import World from './world/World.js';
import PostFX from './world/PostFX.js';
import { detectTier } from './world/Quality.js';
import Preloader from './story/Preloader.js';
import Scroll from './story/Scroll.js';

/**
 * Experience.js — the orchestrator.
 *
 * RENDER POLICY: ON-DEMAND. The composer renders only when
 *   · invalidate(n) was called (scroll, tween, hover, resize), OR
 *   · the damped camera is still settling toward its rig, OR
 *   · a live section (hero / manifesto / services / contact) is on screen —
 *     the particle field breathes there, so those render continuously.
 * When the user reads a solid section, the GPU goes idle.
 *
 * ADAPTIVE QUALITY: continuous sections run a closed-loop dynamic-resolution
 * scaler driven by REAL GPU frame timings (timer queries where available), so
 * the experience holds 60fps at the highest resolution each GPU can sustain.
 */
export default class Experience {
  constructor(canvas) {
    this.canvas = canvas;
    this.sizes = new Sizes();
    this.time = new Time();
    this.scene = new THREE.Scene();
    this.renderer = new Renderer(this);
    this.camera = new Camera(this);
    this.quality = detectTier(this.renderer.instance);
    // Apply the tier's render-resolution cap before any render target is sized.
    this.sizes.maxPR = this.quality.maxPixelRatio;
    this.sizes.update();
    this.renderer.resize();

    this._renderFrames = 1;     // render the first frame

    // ---- Dynamic resolution scaler (continuous-motion sections only) ----
    // Discrete render-scale buckets. We START at full resolution and only step
    // DOWN if this GPU can't render a frame inside the budget, then recover UP
    // when it can. Driven by a real GPU TIMER QUERY where supported — NOT rAF
    // deltas, which are pinned to vsync and can't reveal headroom.
    this._drsScales = [0.6, 0.72, 0.82, 0.9, 1.0];
    this._drsIdx = this._drsScales.length - 1;   // full res until proven otherwise
    this._drsCleanStreak = 0;
    this._drsCooldown = 0;
    this._gpuSamples = [];
    this._rafSamples = [];                       // fallback path: wall-clock frame intervals
    this._gpuQuery = null;                       // single in-flight TIME_ELAPSED query
    try {
      const gl = this.renderer.instance.getContext();
      this._gpuTimer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    } catch { this._gpuTimer = null; }

    // ---- Preloader + resource pipeline ----
    this.preloader = new Preloader(() => this._onLoaded());
    this.resources = new Resources();
    this.resources.on('progress', (f) => this.preloader.setProgress(f));
    this.resources.on('ready', () => this._buildScene());
    this.resources.load();

    // ---- WebGL context loss resilience ----
    this._contextLost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this._contextLost = true;
      this._showContextOverlay(true);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this._contextLost = false;
      this._showContextOverlay(false);
      // Re-apply renderer state — Three.js re-creates the internal GL state
      this.renderer.resize();
      this.post?.resize();
      this.invalidate(5);
    });

    // ---- Accessibility: prefers-reduced-motion ----
    this.reducedMotion = false;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = mq.matches;
    mq.addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
      this.invalidate(3);
    });

    this.sizes.on('resize', () => this._resize());

    // single rAF loop
    this._lastNow = performance.now();
    const loop = (now) => { this._tick(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  invalidate(frames = 2) { this._renderFrames = Math.max(this._renderFrames, frames); }

  /**
   * Motion = ANY camera movement (continuous orbit OR active scroll-scrub).
   * During motion we swap the costly 3-pass SMAA for a single cheap FXAA pass;
   * the moment movement rests we restore SMAA and render one crisp frame.
   */
  setMotionState(moving) {
    if (moving === this._motion) return;
    this._motion = moving;
    this.post?.setMotionAA(moving);
    if (!moving) this.invalidate(2);     // draw a crisp SMAA frame now the camera has settled
  }

  /**
   * Live sections render every frame. Here we arm the dynamic-resolution
   * scaler, which holds the HIGHEST resolution the GPU can sustain and only
   * steps down on genuinely weaker hardware. Only fires on transitions.
   */
  setInteractiveQuality(on) {
    if (on === this._interactive) return;
    this._interactive = on;
    if (on) {
      this._gpuSamples.length = 0;
      this._rafSamples.length = 0;
      this._drsCleanStreak = 0;
      this._drsCooldown = 12;     // skip a few warmup frames before the first adjustment
      // No GPU timer (Safari/Firefox) → can't detect headroom, so optimistically
      // probe one bucket up on each entry; the rAF down-guard pulls back if needed.
      if (!this._gpuTimer && this._drsIdx < this._drsScales.length - 1) this._drsIdx++;
      this._applyRenderScale(this._drsScales[this._drsIdx]);
    } else if (this.sizes.renderScale !== 1.0) {
      // Restore full crispness for the on-demand still frames.
      this._applyRenderScale(1.0);
    }
    this.invalidate(2);
  }

  _applyRenderScale(scale) {
    if (this.sizes.renderScale === scale) return;
    this.sizes.renderScale = scale;
    this.sizes.update();
    this.renderer.resize();
    this.post?.resize();
  }

  /**
   * Render the composer wrapped in a GPU timer query so the scaler can read
   * real per-frame GPU work (ms), independent of vsync.
   */
  _renderProbed() {
    const gl = this.renderer.instance;
    const ext = this._gpuTimer;
    const ctx = gl.getContext();

    // Harvest the previous query if it has resolved (non-blocking).
    if (this._gpuQuery) {
      const available = ctx.getQueryParameter(this._gpuQuery, ctx.QUERY_RESULT_AVAILABLE);
      const disjoint = ctx.getParameter(ext.GPU_DISJOINT_EXT);
      if (available) {
        if (!disjoint) this._gpuSamples.push(ctx.getQueryParameter(this._gpuQuery, ctx.QUERY_RESULT) / 1e6);
        ctx.deleteQuery(this._gpuQuery);
        this._gpuQuery = null;
      }
    }

    if (!this._gpuQuery) {
      const q = ctx.createQuery();
      ctx.beginQuery(ext.TIME_ELAPSED_EXT, q);
      this.post.render();
      ctx.endQuery(ext.TIME_ELAPSED_EXT);
      this._gpuQuery = q;
    } else {
      this.post.render();          // a query is still pending — just render normally
    }
  }

  /**
   * Closed-loop dynamic resolution — runs only while a live section is active.
   * Budget band (11ms ↔ 15ms) gives wide hysteresis so it settles without
   * oscillating: step DOWN above ~15ms, step UP below ~11ms.
   */
  _drsTick() {
    if (!this._interactive) return;
    if (this._drsCooldown > 0) { this._drsCooldown--; return; }
    if (this._gpuSamples.length < 18) return;
    const sorted = this._gpuSamples.slice().sort((a, b) => a - b);
    this._gpuSamples.length = 0;
    const median = sorted[sorted.length >> 1];

    let i = this._drsIdx;
    if (median > 15) {
      if (i > 0) i--;                                // GPU over budget → reduce
      this._drsCleanStreak = 0;
    } else if (median < 11) {
      this._drsCleanStreak++;                        // headroom — bank it
      if (this._drsCleanStreak >= 2 && i < this._drsScales.length - 1) {
        i++; this._drsCleanStreak = 0;
      }
    } else {
      this._drsCleanStreak = 0;                      // in the dead band → hold
    }

    if (i !== this._drsIdx) {
      this._drsIdx = i;
      this._applyRenderScale(this._drsScales[i]);
      this._drsCooldown = 24;                        // settle at the new scale before re-measuring
    }
  }

  /**
   * Fallback scaler for browsers without GPU timer queries. rAF deltas are
   * vsync-quantised so they can't reveal headroom — but a median frame interval
   * past ~22ms reliably means dropped frames, so we can at least step DOWN.
   */
  _drsTickRAF(frameMs) {
    if (this._drsCooldown > 0) { this._drsCooldown--; return; }
    this._rafSamples.push(frameMs);
    if (this._rafSamples.length < 40) return;
    const sorted = this._rafSamples.slice().sort((a, b) => a - b);
    this._rafSamples.length = 0;
    const median = sorted[sorted.length >> 1];
    if (median > 22 && this._drsIdx > 0) {           // dropping frames → reduce
      this._drsIdx--;
      this._applyRenderScale(this._drsScales[this._drsIdx]);
      this._drsCooldown = 40;
    }
  }

  _buildScene() {
    this.environment = new Environment(this);
    this.world = new World(this);
    this.post = new PostFX(this);
    this.scroll = new Scroll(this);

    this._ready = true;
    this.invalidate(3);
  }

  _onLoaded() {
    // preloader finished dissolving; nudge a few frames + a refresh for ScrollTrigger
    this.invalidate(3);
    if (this.scroll) {
      ScrollTrigger.refresh();   // recompute trigger geometry now the DOM is final
      this.scroll.playIntro();
    }
  }

  _tick(now) {
    const frameMs = now - this._lastNow;
    const delta = Math.min(frameMs / 1000, 0.05);
    this._lastNow = now;

    if (!this._ready) return;
    if (this._contextLost) return;      // GL context dead — skip until restored

    // smooth scroll + controllers may request frames
    this.scroll.raf(now);
    let want = this.scroll.frame(delta);

    const camMoving = this.camera.update(delta);
    const shouldRender = this._renderFrames > 0 || camMoving || want;

    if (shouldRender) {
      this.camera.instance.updateMatrixWorld();
      this.world.update(this.time.elapsed);
      this.post.update(this.time.elapsed);
      // During continuous motion, time the GPU (if supported) so the scaler can
      // hold quality at the highest sustainable resolution.
      if (this._interactive && this._gpuTimer) {
        this._renderProbed();
        this._drsTick();
      } else {
        this.post.render();
        if (this._interactive) this._drsTickRAF(frameMs);
      }
      if (this._renderFrames > 0) this._renderFrames--;
    }
  }

  /** Show/hide a minimal overlay when the WebGL context is lost. */
  _showContextOverlay(show) {
    let el = document.getElementById('webgl-ctx-lost');
    if (show && !el) {
      el = document.createElement('div');
      el.id = 'webgl-ctx-lost';
      el.style.cssText = 'position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(0,0,0,.7);pointer-events:none;';
      el.innerHTML = '<span style="font-family:var(--font-mono);font-size:.72rem;color:var(--accent);letter-spacing:.1em;text-transform:uppercase">Restoring 3D view…</span>';
      document.body.appendChild(el);
    } else if (!show && el) {
      el.remove();
    }
  }

  _resize() {
    this.renderer.resize();
    this.camera.resize();
    this.post?.resize();
    this.world?.resize?.();
    this.invalidate(2);
  }
}
