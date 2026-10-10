# DESIGN.md — Zeriotic Design System

> Visual Language, Design Tokens, Spatial 3D, and Motion Guidelines for Zeriotic.
> Conforms to the Google Stitch / awesome-design-md specification.

---

## 1. Design Philosophy

Zeriotic is a premium digital engineering studio, WebGL laboratory, and cybersecurity defense consultancy. The interface reflects the precision of an aerospace cockpit and the stark elegance of a high-performance terminal.

- **Obsidian Void**: Deep `#050508` pure void canvas. No muddy grays.
- **Plasma Ember & Quantum Copper**: Primary energetic accent `#ff5500` and warm metallic copper `#ff9163`.
- **Cybernetic Cyan**: Defensive telemetry highlight `#00f0ff` used exclusively for real-time security matrices, encryption indicators, and live telemetry pulses.
- **Monospace Dominance**: JetBrains Mono across headers, body, numbers, and telemetry. Everything speaks code and precision telemetry.
- **Hairline Precision**: Subtle borders (`rgba(197, 196, 194, 0.12)`) and calibrated hover states (`rgba(255, 85, 0, 0.4)`).
- **Physical Depth**: Multi-layer 3D parallax tilt (Atropos), WebGL particle clouds (Three.js), and procedural GLSL vertex shaders.

---

## 2. Color Tokens

```css
:root {
  /* Canvas & Backgrounds */
  --bg-void: #050508;
  --bg-card: #0a0a0f;
  --bg-card-hover: #0e0e16;
  --bg-terminal: #07070b;

  /* Typography & Ink */
  --ink-primary: #ffffff;
  --ink-secondary: #c5c4c2;
  --ink-muted: #6f6e6c;

  /* Primary Energetic Accents */
  --accent-plasma: #ff5500;
  --accent-copper: #ff9163;
  --accent-ember: #ff3300;

  /* Defensive & Telemetry Accents */
  --accent-cyan: #00f0ff;
  --accent-emerald: #00ffaa;
  --accent-warning: #ffb84d;
  --accent-threat: #ff2a2a;

  /* Structural Hairlines */
  --hairline-subtle: rgba(197, 196, 194, 0.12);
  --hairline-strong: rgba(197, 196, 194, 0.28);
  --hairline-plasma: rgba(255, 85, 0, 0.35);
  --hairline-cyan: rgba(0, 240, 255, 0.35);
}
```

---

## 3. Typography Scale

- **Display 01**: `clamp(2.5rem, 6vw, 5.5rem)`, weight `800`, letter-spacing `-0.04em`, line-height `1.05`.
- **Section Heading (H2)**: `clamp(1.8rem, 3.5vw, 3rem)`, weight `700`, letter-spacing `-0.03em`.
- **Terminal Header (H3)**: `1.25rem`, weight `600`, letter-spacing `-0.01em`.
- **Eyebrow / Status**: `0.7rem`, monospace, uppercase, letter-spacing `0.18em`, color `var(--accent-plasma)`.
- **Body Regular**: `0.95rem`, line-height `1.75`, color `var(--ink-secondary)`.
- **Telemetry Monospace**: `0.72rem`, monospace, letter-spacing `0.08em`.

---

## 4. 3D WebGL & Spatial Architecture

The background canvas runs an on-demand, adaptive WebGL2 pipeline managed by Three.js:
1. **Cosmic Mark & Sculpture**: Chrome iridescent Z mark rendered as thin-film physical material with real-time environment reflection.
2. **Particle Field Morphing**:
   - `nebula`: Ambient cosmological drift.
   - `ribbon`: Sculptural studio geometry.
   - `knot` / `lattice` / `wave`: Mathematical discipline formations.
   - `accertFormula`: High-downforce Formula chassis with aerodynamic vortex slipstreams.
   - `neuralWeb`: Multi-ring concentric synaptic constellation for OctaDezx.
   - `cyberShield`: Multi-layered cryptographic defense vault and packet-filtering perimeter.
3. **Hardware Adaptation**: Disjoint timer query monitoring for closed-loop dynamic resolution scaling (0.6x to 1.0x).
4. **Motion Fallback**: Strict compliance with `prefers-reduced-motion: reduce`.

---

## 5. UI Components & Telemetry Widgets

1. **Atropos 3D Parallax Cards**: Active depth layers with 3-tier Z-offsets (`data-atropos-offset="-2"`, `2`, `5`).
2. **Cockpit & Terminal Chrome**: Top browser bar (`● realtime`, window controls, telemetry tags).
3. **Threat Matrix & Telemetry HUD**: Live SVG wave clusters, segmented LED tachometers, and cryptographic checksum trackers powered by Anime.js.
4. **Glassmorphic Reticles**: Border radius `4px` - `6px`, subtle inner glow `inset 0 0 60px rgba(255, 85, 0, 0.03)`.
