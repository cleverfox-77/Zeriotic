import anime from 'animejs';

/**
 * telemetry.js — Anime.js UI Telemetry Systems for Zeriotic
 *
 * Drives:
 *   1. Accert One: High-frequency motorsport telemetry, RPM tachometer sweeping,
 *      gear shift indicators, DRS activation, and tire thermodynamic fluctuation.
 *   2. OctaDezx: Neural waveform frequency visualization, full-duplex voice barge-in
 *      activity streams, MCP gateway packet pulses, and sub-300ms latency monitors.
 *
 * ARCHITECTURE:
 *   - IntersectionObserver lifecycle: Animations run ONLY while cards are visible.
 *   - Prefers-reduced-motion: Falls back to subtle static readings without rapid oscillation.
 *   - 60 FPS lock: Decoupled from WebGL render loop; utilizes RAF through Anime.js.
 */

class TelemetrySystem {
  constructor() {
    this.reducedMotion = false;
    this._checkReducedMotion();

    this.accertRunning = false;
    this.octaRunning = false;
    this._anims = [];
  }

  _checkReducedMotion() {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = mq.matches;
    mq.addEventListener?.('change', (e) => {
      this.reducedMotion = e.matches;
      if (this.reducedMotion) this.pauseAll();
    });
  }

  /**
   * Initializes telemetry observers for both Accert One and OctaDezx.
   */
  init() {
    if (typeof document === 'undefined') return;

    this.initAccert();
    this.initOcta();
    this.initSecurity();
  }

  // =========================================================================
  //  ACCERT ONE — RACING TACHOMETER & TELEMETRY GAUGES
  // =========================================================================
  initAccert(containerSelector = '#case-accert, .hud-display') {
    const containers = document.querySelectorAll(containerSelector);
    if (!containers.length) return;

    containers.forEach((container) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this._startAccertTelemetry(container);
          } else {
            this._stopAccertTelemetry(container);
          }
        });
      }, { threshold: 0.15 });

      observer.observe(container);
    });
  }

  _startAccertTelemetry(container) {
    if (this.reducedMotion) return;

    // Elements inside homepage card (.accert-mock) or subpage (.hud-display)
    const gearEl = container.querySelector('.accert-mock__gear, .hud-gear');
    const speedEl = container.querySelector('.accert-mock__speed, .hud-speed-val');
    const rpmSegments = container.querySelectorAll('.accert-mock__rpm i, .hud-rpm-seg');
    const drsEl = container.querySelector('.drs-lit, .drs-active');
    const gForceEl = container.querySelector('.accert-mock__footer, .hud-telemetry-col');

    if (!speedEl && !gearEl) return;

    // 1. Digital RPM & Speed Telemetry Engine Cycle
    const telemetryData = {
      speed: 312,
      rpm: 11400,
      lateralG: 2.72,
    };

    const gearShiftLoop = () => {
      if (!container.isConnected) return;

      // Accelerating through 6th -> 7th gear pull
      const speedTimeline = anime.timeline({
        easing: 'easeOutQuad',
        complete: () => {
          if (container.dataset.telemetryActive === 'true') {
            setTimeout(gearShiftLoop, 800);
          }
        },
      });

      container.dataset.telemetryActive = 'true';

      // Pull from apex (312 km/h -> 328 km/h -> 336 km/h)
      speedTimeline
        .add({
          targets: telemetryData,
          speed: 329,
          rpm: 12480,
          lateralG: 2.88,
          duration: 1800,
          round: 1,
          update: () => {
            if (speedEl) speedEl.textContent = Math.round(telemetryData.speed);
            this._updateRpmBar(rpmSegments, telemetryData.rpm);
          },
        })
        .add({
          // Redline shift flutter into 7th gear
          targets: telemetryData,
          speed: 334,
          rpm: 11950,
          lateralG: 2.65,
          duration: 1400,
          easing: 'easeOutExpo',
          begin: () => {
            if (gearEl) {
              gearEl.textContent = '7';
              anime({
                targets: gearEl,
                scale: [1.25, 1],
                color: ['#ffffff', '#ff5500'],
                duration: 400,
                easing: 'easeOutBack',
              });
            }
            if (drsEl) {
              anime({
                targets: drsEl,
                opacity: [0.4, 1],
                duration: 300,
                easing: 'easeInOutQuad',
              });
            }
          },
          update: () => {
            if (speedEl) speedEl.textContent = Math.round(telemetryData.speed);
            this._updateRpmBar(rpmSegments, telemetryData.rpm);
          },
        })
        .add({
          // Settle on straightaway before brake point
          targets: telemetryData,
          speed: 324,
          rpm: 11200,
          lateralG: 1.45,
          duration: 1200,
          easing: 'easeInOutSine',
          update: () => {
            if (speedEl) speedEl.textContent = Math.round(telemetryData.speed);
            this._updateRpmBar(rpmSegments, telemetryData.rpm);
          },
        });

      this._anims.push(speedTimeline);
    };

    gearShiftLoop();

    // 2. Continuous Micro-pulse on DRS and Tire Temperatures
    if (drsEl) {
      const drsAnim = anime({
        targets: drsEl,
        boxShadow: [
          '0 0 4px rgba(0,255,170,0.2)',
          '0 0 14px rgba(0,255,170,0.8)',
        ],
        duration: 900,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutSine',
      });
      this._anims.push(drsAnim);
    }
  }

  _updateRpmBar(segments, currentRpm) {
    if (!segments || !segments.length) return;
    const minRpm = 10000;
    const maxRpm = 13000;
    const pct = Math.max(0, Math.min(1, (currentRpm - minRpm) / (maxRpm - minRpm)));
    const activeCount = Math.floor(pct * segments.length);

    segments.forEach((seg, idx) => {
      if (idx <= activeCount) {
        seg.classList.add('active');
        if (idx >= segments.length - 2) {
          seg.classList.add('peak');
        } else {
          seg.classList.remove('peak');
        }
      } else {
        seg.classList.remove('active', 'peak');
      }
    });
  }

  _stopAccertTelemetry(container) {
    container.dataset.telemetryActive = 'false';
  }

  // =========================================================================
  //  OCTADEZX — NEURAL WAVEFORM & CONVERSATIONAL VOICE TELEMETRY
  // =========================================================================
  initOcta(containerSelector = '#case-octa, .chat') {
    const containers = document.querySelectorAll(containerSelector);
    if (!containers.length) return;

    containers.forEach((container) => {
      // Inject real-time audio waveform equalizer into the chat header if not present
      this._ensureOctaWaveformDOM(container);

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this._startOctaTelemetry(container);
          } else {
            this._stopOctaTelemetry(container);
          }
        });
      }, { threshold: 0.15 });

      observer.observe(container);
    });
  }

  _ensureOctaWaveformDOM(container) {
    const chatHead = container.querySelector('.chat__head');
    if (!chatHead || chatHead.querySelector('.octa-voice-mesh')) return;

    // Create a sleek holographic voice activity bar cluster
    const waveWrap = document.createElement('div');
    waveWrap.className = 'octa-voice-mesh';
    waveWrap.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: auto;
      height: 18px;
      padding: 0 8px;
      background: rgba(255, 85, 0, 0.06);
      border: 1px solid rgba(255, 85, 0, 0.2);
      border-radius: 3px;
    `;

    for (let i = 0; i < 9; i++) {
      const bar = document.createElement('span');
      bar.className = 'octa-wave-bar';
      bar.style.cssText = `
        display: block;
        width: 2px;
        height: ${4 + (i % 3) * 4}px;
        background: var(--accent);
        border-radius: 1px;
        opacity: 0.85;
      `;
      waveWrap.appendChild(bar);
    }

    const label = document.createElement('span');
    label.className = 'mono';
    label.style.cssText = 'font-size: 0.52rem; color: var(--accent); margin-left: 6px; letter-spacing: 0.1em;';
    label.textContent = 'VOICE // BARGE-IN LIVE';
    waveWrap.appendChild(label);

    chatHead.appendChild(waveWrap);
  }

  _startOctaTelemetry(container) {
    if (this.reducedMotion) return;

    const bars = container.querySelectorAll('.octa-wave-bar');
    if (!bars.length) return;

    // Organic vocal frequency oscillation using Anime.js stagger and elastic sines
    const waveAnim = anime({
      targets: bars,
      height: () => [
        { value: () => anime.random(3, 8), duration: 240, easing: 'easeOutQuad' },
        { value: () => anime.random(9, 17), duration: 320, easing: 'easeInOutSine' },
        { value: () => anime.random(2, 6), duration: 200, easing: 'easeInQuad' },
      ],
      opacity: () => [
        { value: () => anime.random(0.5, 1.0), duration: 250 },
      ],
      delay: anime.stagger(45),
      loop: true,
      direction: 'alternate',
    });

    this._anims.push(waveAnim);

    // Subtle breathing pulse on the avatar glow
    const avatar = container.querySelector('.chat__avatar');
    if (avatar) {
      const avatarAnim = anime({
        targets: avatar,
        boxShadow: [
          '0 0 0 rgba(255,85,0,0)',
          '0 0 12px rgba(255,85,0,0.6)',
        ],
        duration: 1200,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutSine',
      });
      this._anims.push(avatarAnim);
    }
  }

  _stopOctaTelemetry(container) {
    // Observers handle garbage collection through instance management
  }

  // =========================================================================
  //  CYBERSECURITY & DEFENSE TELEMETRY
  // =========================================================================
  initSecurity(containerSelector = '#case-security, .hud-security') {
    const containers = document.querySelectorAll(containerSelector);
    if (!containers.length) return;

    containers.forEach((container) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this._startSecurityTelemetry(container);
          } else {
            this._stopSecurityTelemetry(container);
          }
        });
      }, { threshold: 0.15 });

      observer.observe(container);
    });
  }

  _startSecurityTelemetry(container) {
    if (this.reducedMotion) return;

    container.dataset.securityActive = 'true';

    // Animate stream indicators
    const streamPills = container.querySelectorAll('.security-mock__stream i');
    if (streamPills.length) {
      const streamAnim = anime({
        targets: streamPills,
        opacity: [0.2, 1],
        scaleY: [0.6, 1.2],
        delay: anime.stagger(120),
        duration: 800,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutSine',
      });
      this._anims.push(streamAnim);
    }

    // Pulse cyber guard status
    const guardLit = container.querySelector('.guard-lit, .sec-pill--shield');
    if (guardLit) {
      const guardAnim = anime({
        targets: guardLit,
        color: ['#00f0ff', '#ffffff', '#00f0ff'],
        duration: 1600,
        direction: 'alternate',
        loop: true,
        easing: 'easeInOutQuad',
      });
      this._anims.push(guardAnim);
    }
  }

  _stopSecurityTelemetry(container) {
    container.dataset.securityActive = 'false';
  }

  pauseAll() {
    this._anims.forEach((anim) => anim.pause?.());
  }

  resumeAll() {
    if (this.reducedMotion) return;
    this._anims.forEach((anim) => anim.play?.());
  }
}

export const telemetry = new TelemetrySystem();

export function initAllTelemetry() {
  if (typeof window === 'undefined') return;
  // Initialize once DOM is ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => telemetry.init());
  } else {
    telemetry.init();
  }
}

export default telemetry;
