import * as THREE from 'three';
import gsap from 'gsap';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

/**
 * World.js — the Zeriotic void: one chrome sculpture, one particle field.
 *
 * Contents:
 *   · the Z         the studio mark as a 21 KB GLB, dressed in iridescent
 *                   chrome. Floats, slow-turns, and tilts toward the pointer.
 *   · particles     ONE draw call of `quality.particles` GPU points. Every
 *                   particle owns a `position` (from) and `aTo` (to) — the
 *                   vertex shader morphs between them with per-particle stagger,
 *                   ambient sine drift and pointer repulsion. Scroll beats call
 *                   setState() to retarget the whole field: nebula → ribbon →
 *                   knot → lattice → wave → crystal → the Z itself.
 *                   The ribbon and crystal are the studio's own Blender
 *                   sculptures, sampled into points.
 *   · shards        26 instanced octahedra in dark chrome, orbiting slowly.
 *   · accent lights 2 colored points that pour the brand plasma into the metal.
 *
 * PERFORMANCE: everything animated lives in the vertex shader; the CPU only
 * touches buffers on section changes (a single memcpy per transition).
 */

// Ember system — every state stays in the orange/amber family (the site's
// single accent, after kvs.services), varied by temperature instead of hue.
const PALETTES = {
  nebula:  [0xff5500, 0xffb380],
  ribbon:  [0xff7733, 0xffd9b3],
  knot:    [0xff4400, 0xff9163],
  lattice: [0xffaa55, 0xff5500],
  wave:    [0xff8844, 0xfff1e0],
  crystal: [0xff5500, 0xffffff],
  zglyph:  [0xff5500, 0xffffff],
  // per-case-study palettes — still in the orange/amber family, varied by temperature
  stitchTorus:    [0xff6633, 0xffcc99],   // Variant3D: warm thread tones
  signalGrid:     [0xff4400, 0xff8855],   // Mira INC: electric pulse
  tokyoLattice:   [0xffaa66, 0xfff0dd],   // Melem Tokyo: warm paper/wood
  neuralWeb:      [0xff5500, 0xffe6cc],   // OctaDezx: multi-layered synaptic glow
  accertFormula:  [0xff3300, 0xffb84d],   // Accert One: aerodynamic velocity ember & copper
  accertVelocity: [0xff4400, 0xffaa00],   // Accert One: slipstream thermal glow
  cyberShield:    [0x00f0ff, 0xff5500],   // Cybersecurity & AI Defense: cybernetic cyan & plasma ember
};

export default class World {
  constructor(experience) {
    if (import.meta.env.DEV) window.__THREE = THREE;
    this.exp = experience;
    this.scene = experience.scene;
    this.count = experience.quality.particles;

    this.mouseNDC = new THREE.Vector2(0, 0);   // read by Scroll for camera parallax
    this._mouseWorld = new THREE.Vector3(1e4, 1e4, 1e4);
    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    this._addSculpture();
    this._addParticles();
    this._addShards();
    this._addAccentLights();
    this._bindPointer();
  }

  // ---------------------------------------------------------------- sculpture
  _addSculpture() {
    const gltf = this.exp.resources.items.heroZ;
    this.zGroup = new THREE.Group();

    let geo = null;
    gltf?.scene.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; });
    if (geo) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.16,
        envMapIntensity: 1.35,
        // thin-film iridescence — the holographic sheen that sells "chrome, but alive"
        iridescence: 0.9,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [120, 480],
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
        // transparent from birth — flipping `transparent` on a compiled material
        // is ignored by the cached program state, which made fade-outs no-ops
        transparent: true,
        opacity: 1,
      });
      this.zMesh = new THREE.Mesh(geo, mat);
      this.zMesh.frustumCulled = true;
      this.zGroup.add(this.zMesh);
    }
    this.zGroup.scale.setScalar(0.85);
    this.scene.add(this.zGroup);
  }

  /** Pull the first mesh out of a loaded GLB, normalised to a given max size. */
  _gltfMesh(key, fit = 7) {
    const gltf = this.exp.resources.items[key];
    let mesh = null;
    gltf?.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return null;
    const geo = mesh.geometry.clone();
    geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    const s = geo.boundingBox.getSize(new THREE.Vector3());
    const k = fit / Math.max(s.x, s.y, s.z);
    geo.translate(-c.x, -c.y, -c.z);
    geo.scale(k, k, k);
    return new THREE.Mesh(geo);
  }

  // ---------------------------------------------------------------- particles
  _addParticles() {
    const N = this.count;

    // ---- morph targets (Float32Array xyz per particle) ----
    this._targets = {
      nebula:  this._targetNebula(N),
      knot:    this._targetKnot(N),
      lattice: this._targetLattice(N),
      wave:    this._targetWave(N),
      zglyph:  this._targetFromMesh(this.zMesh, N, 1.75, 0.08),
      ribbon:  this._targetFromMesh(this._gltfMesh('ribbon', 8.5), N, 1, 0.06),
      crystal: this._targetFromMesh(this._gltfMesh('crystal', 7), N, 1, 0.05),
      // per-case-study morph targets — each case gets its own signature shape
      stitchTorus:    this._targetStitchTorus(N),
      signalGrid:     this._targetSignalGrid(N),
      tokyoLattice:   this._targetTokyoLattice(N),
      neuralWeb:      this._targetNeuralWeb(N),
      accertFormula:  this._targetAccertFormula(N),
      accertVelocity: this._targetAccertFormula(N),
      cyberShield:    this._targetCyberShield(N),
    };

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._targets.nebula.slice(), 3));
    geo.setAttribute('aTo', new THREE.BufferAttribute(this._targets.nebula.slice(), 3));
    const rand = new Float32Array(N * 4);
    for (let i = 0; i < N * 4; i++) rand[i] = Math.random();
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));

    this._uniforms = {
      uMorph:  { value: 1 },
      uTime:   { value: 0 },
      uSize:   { value: 0.3 },
      uDim:    { value: 1 },
      uPixelRatio: { value: Math.min(this.exp.sizes.pixelRatio, 2) },
      uMouse:  { value: this._mouseWorld },
      uColorA: { value: new THREE.Color(PALETTES.nebula[0]) },
      uColorB: { value: new THREE.Color(PALETTES.nebula[1]) },
      uReducedMotion: { value: 0 },   // 1 when prefers-reduced-motion is active
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,                 // the chrome Z occludes the field — real depth
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uMorph, uTime, uSize, uDim, uPixelRatio, uReducedMotion;
        uniform vec3 uMouse;
        attribute vec3 aTo;
        attribute vec4 aRand;
        varying float vAlpha;
        varying float vMix;
        varying float vCore;
        void main() {
          // staggered morph — every particle departs on its own beat
          float m = clamp(uMorph * 1.3 - aRand.w * 0.3, 0.0, 1.0);
          m = m * m * (3.0 - 2.0 * m);
          vec3 pos = mix(position, aTo, m);

          // ambient drift — the field breathes even at rest (disabled under reduced motion)
          float motionScale = 1.0 - uReducedMotion;
          float t = uTime * 0.45 + aRand.x * 6.2831;
          pos.x += sin(t + pos.y * 0.55)        * (0.10 + 0.14 * aRand.y) * motionScale;
          pos.y += cos(t * 0.86 + pos.x * 0.50) * (0.08 + 0.12 * aRand.z) * motionScale;
          pos.z += sin(t * 0.71 + pos.x * 0.35) * (0.10 + 0.12 * aRand.x) * motionScale;

          // pointer repulsion — the field parts around the cursor
          vec3 d = pos - uMouse;
          float dist = length(d);
          float push = smoothstep(3.2, 0.0, dist);
          pos += (d / max(dist, 0.001)) * push * 1.5 * motionScale;

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uPixelRatio * (0.5 + aRand.y) * (140.0 / max(-mv.z, 0.1));
          // additive over 100k+ points stacks fast — keep individual sparks faint,
          // and fade with camera distance so the field has DEPTH instead of static
          float fade = smoothstep(-30.0, -9.0, mv.z);
          vAlpha = uDim * (0.02 + 0.09 * aRand.z) * (0.2 + 0.8 * fade);
          vMix = aRand.x;
          vCore = aRand.w;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColorA, uColorB;
        varying float vAlpha;
        varying float vMix;
        varying float vCore;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float a = smoothstep(0.5, 0.06, d) * vAlpha;
          if (a < 0.004) discard;
          vec3 col = mix(uColorA, uColorB, vMix);
          col += vec3(0.5) * smoothstep(0.16, 0.0, d) * vCore;  // hot plasma core
          gl_FragColor = vec4(col, a);
        }
      `,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;   // positions live in the shader
    this.points.renderOrder = 1;
    this.scene.add(this.points);

    this._state = 'nebula';
  }

  // ---- target generators ----
  _targetNebula(N) {
    const a = new Float32Array(N * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      v.randomDirection();
      // a finite, flattened DISC around the sculpture — the camera orbits well
      // outside it, so the frame keeps clean black margins instead of static
      const halo = Math.random() < 0.3;
      const r = halo ? 3.2 + Math.random() * 1.2
                     : 4.2 + Math.pow(Math.random(), 2.2) * 3.4;
      a[i * 3]     = v.x * r;
      a[i * 3 + 1] = v.y * r * 0.38;
      a[i * 3 + 2] = v.z * r * 0.7;
    }
    return a;
  }

  _targetFromMesh(mesh, N, scale, jitter) {
    if (!mesh) return this._targetNebula(N);
    const a = new Float32Array(N * 3);
    const sampler = new MeshSurfaceSampler(mesh).build();
    const p = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      sampler.sample(p);
      a[i * 3]     = p.x * scale + (Math.random() - 0.5) * jitter;
      a[i * 3 + 1] = p.y * scale + (Math.random() - 0.5) * jitter;
      a[i * 3 + 2] = p.z * scale + (Math.random() - 0.5) * jitter;
    }
    return a;
  }

  _targetKnot(N) {
    const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(2.6, 0.78, 200, 32));
    const a = this._targetFromMesh(mesh, N, 1, 0.08);
    mesh.geometry.dispose();
    return a;
  }

  _targetLattice(N) {
    const a = new Float32Array(N * 3);
    const G = 10, S = 1.1, off = ((G - 1) * S) / 2;
    for (let i = 0; i < N; i++) {
      a[i * 3]     = Math.floor(Math.random() * G) * S - off + (Math.random() - 0.5) * 0.08;
      a[i * 3 + 1] = Math.floor(Math.random() * G) * S - off + (Math.random() - 0.5) * 0.08;
      a[i * 3 + 2] = Math.floor(Math.random() * G) * S - off + (Math.random() - 0.5) * 0.08;
    }
    return a;
  }

  _targetWave(N) {
    const a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 20;
      const y = Math.sin(x * 0.55) * 0.8 + Math.cos(z * 0.65) * 0.6 + Math.sin((x + z) * 0.3) * 0.5 - 1.2;
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    }
    return a;
  }

  /** Variant3D — knitwear stitch: a torus with tight radial ribbing. */
  _targetStitchTorus(N) {
    const a = new Float32Array(N * 3);
    const R = 3.2, r = 1.1;
    for (let i = 0; i < N; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      // stitch-like ribbing: perturb the minor radius with high-frequency sine
      const rr = r + Math.sin(v * 12) * 0.12 + Math.sin(u * 8) * 0.06;
      a[i * 3]     = (R + rr * Math.cos(v)) * Math.cos(u);
      a[i * 3 + 1] = (R + rr * Math.cos(v)) * Math.sin(u);
      a[i * 3 + 2] = rr * Math.sin(v);
    }
    return a;
  }

  /** Mira INC — AI signal grid: a 3D grid with sine-perturbed heights. */
  _targetSignalGrid(N) {
    const a = new Float32Array(N * 3);
    const gridSize = 16, spacing = 0.65;
    const off = ((gridSize - 1) * spacing) / 2;
    for (let i = 0; i < N; i++) {
      const gx = Math.floor(Math.random() * gridSize) * spacing - off;
      const gz = Math.floor(Math.random() * gridSize) * spacing - off;
      // signal waveform: layered sine waves create an organic AI-feel surface
      const gy = Math.sin(gx * 0.8) * 1.2 + Math.cos(gz * 0.6) * 0.8
               + Math.sin((gx + gz) * 0.4) * 0.6;
      a[i * 3]     = gx + (Math.random() - 0.5) * 0.06;
      a[i * 3 + 1] = gy + (Math.random() - 0.5) * 0.06;
      a[i * 3 + 2] = gz + (Math.random() - 0.5) * 0.06;
    }
    return a;
  }

  /** Melem Tokyo — editorial commerce: an asymmetric lattice evoking Japanese grid layouts. */
  _targetTokyoLattice(N) {
    const a = new Float32Array(N * 3);
    // asymmetric spacing: wider on x, tighter on y, moderate on z
    const GX = 8, GY = 12, GZ = 6;
    const SX = 1.4, SY = 0.7, SZ = 1.0;
    const offX = ((GX - 1) * SX) / 2, offY = ((GY - 1) * SY) / 2, offZ = ((GZ - 1) * SZ) / 2;
    for (let i = 0; i < N; i++) {
      // 70% on grid edges (wireframe look), 30% on faces
      const edge = Math.random() < 0.7;
      let x = Math.floor(Math.random() * GX) * SX - offX;
      let y = Math.floor(Math.random() * GY) * SY - offY;
      let z = Math.floor(Math.random() * GZ) * SZ - offZ;
      if (!edge) {
        x += (Math.random() - 0.5) * SX * 0.8;
        y += (Math.random() - 0.5) * SY * 0.8;
      }
      a[i * 3] = x + (Math.random() - 0.5) * 0.04;
      a[i * 3 + 1] = y + (Math.random() - 0.5) * 0.04;
      a[i * 3 + 2] = z + (Math.random() - 0.5) * 0.04;
    }
    return a;
  }

  /**
   * OctaDezx — AI autonomous platform:
   * Multi-layered synaptic cluster with nested dual-shell icosahedral core,
   * interconnected radial dendrites, 3 gyroscopic orbital data telemetry rings,
   * 8 peripheral MCP (Model Context Protocol) gateway nodes with beamed conduits,
   * and ambient synaptic spark cloud.
   */
  _targetNeuralWeb(N) {
    const a = new Float32Array(N * 3);

    // 1. Dual-shell icosahedral geometry: Inner Nucleus (r=2.2) and Outer Cortical Shell (r=4.2)
    const innerGeo = new THREE.IcosahedronGeometry(2.2, 0);
    const outerGeo = new THREE.IcosahedronGeometry(4.2, 1);
    const inPos = innerGeo.attributes.position;
    const outPos = outerGeo.attributes.position;

    // Collect outer edges
    const outerEdges = [];
    for (let i = 0; i < outPos.count; i += 3) {
      outerEdges.push([i, i + 1], [i + 1, i + 2], [i + 2, i]);
    }
    // Collect inner edges
    const innerEdges = [];
    for (let i = 0; i < inPos.count; i += 3) {
      innerEdges.push([i, i + 1], [i + 1, i + 2], [i + 2, i]);
    }

    // 8 MCP satellite nodes positioned around the perimeter at r ~ 4.8
    const mcpNodes = [];
    for (let k = 0; k < 8; k++) {
      const angle = (k / 8) * Math.PI * 2;
      const elev = (k % 2 === 0 ? 1 : -1) * 1.35;
      const rPlane = 4.8;
      mcpNodes.push(new THREE.Vector3(
        Math.cos(angle) * rPlane,
        elev,
        Math.sin(angle) * rPlane
      ));
    }

    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3();

    for (let i = 0; i < N; i++) {
      const role = Math.random();

      if (role < 0.28) {
        // Cortical outer web edges
        const [ei0, ei1] = outerEdges[i % outerEdges.length];
        v0.fromBufferAttribute(outPos, ei0);
        v1.fromBufferAttribute(outPos, ei1);
        const t = Math.random();
        a[i * 3]     = v0.x + (v1.x - v0.x) * t + (Math.random() - 0.5) * 0.07;
        a[i * 3 + 1] = v0.y + (v1.y - v0.y) * t + (Math.random() - 0.5) * 0.07;
        a[i * 3 + 2] = v0.z + (v1.z - v0.z) * t + (Math.random() - 0.5) * 0.07;
      } else if (role < 0.45) {
        // Inner synaptic nucleus & radial bridges to outer shell
        if (Math.random() < 0.60) {
          // Inner core edges
          const [ei0, ei1] = innerEdges[i % innerEdges.length];
          v0.fromBufferAttribute(inPos, ei0);
          v1.fromBufferAttribute(inPos, ei1);
          const t = Math.random();
          a[i * 3]     = v0.x + (v1.x - v0.x) * t + (Math.random() - 0.5) * 0.05;
          a[i * 3 + 1] = v0.y + (v1.y - v0.y) * t + (Math.random() - 0.5) * 0.05;
          a[i * 3 + 2] = v0.z + (v1.z - v0.z) * t + (Math.random() - 0.5) * 0.05;
        } else {
          // Radial dendrite bridge from inner vertex outward
          const vi = Math.floor(Math.random() * inPos.count);
          v0.fromBufferAttribute(inPos, vi);
          const vo = Math.floor(Math.random() * outPos.count);
          v1.fromBufferAttribute(outPos, vo);
          const t = Math.random();
          a[i * 3]     = v0.x + (v1.x - v0.x) * t + (Math.random() - 0.5) * 0.06;
          a[i * 3 + 1] = v0.y + (v1.y - v0.y) * t + (Math.random() - 0.5) * 0.06;
          a[i * 3 + 2] = v0.z + (v1.z - v0.z) * t + (Math.random() - 0.5) * 0.06;
        }
      } else if (role < 0.72) {
        // Gyroscopic orbital data rings (3 concentric / tilted telemetry orbits)
        const ringChoice = Math.random();
        const theta = Math.random() * Math.PI * 2;
        if (ringChoice < 0.38) {
          // Ring 1: Equatorial XZ ring with harmonic wave (radius 5.3)
          const r = 5.3 + (Math.random() - 0.5) * 0.22;
          a[i * 3]     = Math.cos(theta) * r;
          a[i * 3 + 1] = Math.sin(theta * 8) * 0.22 + (Math.random() - 0.5) * 0.08;
          a[i * 3 + 2] = Math.sin(theta) * r;
        } else if (ringChoice < 0.70) {
          // Ring 2: Tilted 52 deg on X (radius 5.8)
          const r = 5.8 + (Math.random() - 0.5) * 0.24;
          const lx = Math.cos(theta) * r;
          const lz = Math.sin(theta) * r;
          const rotAngle = 0.90; // ~52 deg
          a[i * 3]     = lx;
          a[i * 3 + 1] = -lz * Math.sin(rotAngle) + Math.sin(theta * 6) * 0.15;
          a[i * 3 + 2] =  lz * Math.cos(rotAngle);
        } else {
          // Ring 3: Tilted -48 deg on Z and 35 deg on Y (radius 6.3)
          const r = 6.3 + (Math.random() - 0.5) * 0.26;
          const lx = Math.cos(theta) * r;
          const ly = Math.sin(theta) * r;
          const rotZ = -0.84;
          const rotY = 0.61;
          const x1 = lx * Math.cos(rotZ) - ly * Math.sin(rotZ);
          const y1 = lx * Math.sin(rotZ) + ly * Math.cos(rotZ);
          a[i * 3]     = x1 * Math.cos(rotY);
          a[i * 3 + 1] = y1;
          a[i * 3 + 2] = -x1 * Math.sin(rotY) + (Math.random() - 0.5) * 0.08;
        }
      } else if (role < 0.90) {
        // MCP (Model Context Protocol) Gateway Nodes & beamed conduits
        const nodeIdx = Math.floor(Math.random() * mcpNodes.length);
        const node = mcpNodes[nodeIdx];
        if (Math.random() < 0.65) {
          // High-density spherical spark cluster at the MCP port
          const phi = Math.random() * Math.PI * 2;
          const costh = Math.random() * 2 - 1;
          const sinth = Math.sqrt(Math.max(0, 1 - costh * costh));
          const pr = 0.38 * Math.pow(Math.random(), 0.5);
          a[i * 3]     = node.x + pr * sinth * Math.cos(phi);
          a[i * 3 + 1] = node.y + pr * costh;
          a[i * 3 + 2] = node.z + pr * sinth * Math.sin(phi);
        } else {
          // Beamed telemetry conduit line connecting MCP node into inner core
          const t = Math.random();
          a[i * 3]     = node.x * (1 - t) + (Math.random() - 0.5) * 0.08;
          a[i * 3 + 1] = node.y * (1 - t) + (Math.random() - 0.5) * 0.08;
          a[i * 3 + 2] = node.z * (1 - t) + (Math.random() - 0.5) * 0.08;
        }
      } else {
        // Synaptic ambient spark field
        const phi = Math.random() * Math.PI * 2;
        const costh = Math.random() * 2 - 1;
        const sinth = Math.sqrt(Math.max(0, 1 - costh * costh));
        const pr = Math.pow(Math.random(), 2.0) * 4.4;
        a[i * 3]     = pr * sinth * Math.cos(phi);
        a[i * 3 + 1] = pr * costh * 0.75;
        a[i * 3 + 2] = pr * sinth * Math.sin(phi);
      }
    }

    innerGeo.dispose();
    outerGeo.dispose();
    return a;
  }

  /**
   * Accert One — aerodynamic formula racecar chassis silhouette:
   * Aerodynamic streamlines and wheel vertices (sampling an F1 / hypercar contour procedurally in 3D:
   * nose cone, front wing cascade & endplates, cockpit halo, airbox shark fin,
   * sculpted undercut sidepods, dual-plane rear wing with DRS flap, rear diffuser strakes,
   * 4 wheels with tire treads and suspension wishbones, plus velocity slipstreams / wake vortices).
   */
  _targetAccertFormula(N) {
    const a = new Float32Array(N * 3);

    // Orientation: pitched and yawed for a dynamic 3/4 wind-tunnel profile
    const yaw = -0.46;    // ~ -26.3 deg
    const pitch = 0.06;   // ~ +3.4 deg rake
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const offY = -0.20;

    function put(idx, lx, ly, lz) {
      const y1 = ly * cosP - lz * sinP;
      const z1 = ly * sinP + lz * cosP;
      const x2 = lx * cosY + z1 * sinY;
      const z2 = -lx * sinY + z1 * cosY;
      a[idx * 3]     = x2;
      a[idx * 3 + 1] = y1 + offY;
      a[idx * 3 + 2] = z2;
    }

    for (let i = 0; i < N; i++) {
      const p = Math.random();

      if (p < 0.20) {
        // 1. Nose Cone & Monocoque Body (z from -2.6 to +4.3)
        const z = -2.6 + Math.random() * 6.9;
        if (z >= 1.2) {
          // Forward tapered nose cone
          const t = (4.3 - z) / 3.1; // 0 at tip, 1 at cockpit
          const w = 0.09 + Math.pow(t, 1.3) * 0.65;
          const h = 0.07 + Math.pow(t, 1.2) * 0.48;
          const ang = Math.random() * Math.PI * 2;
          const lx = Math.cos(ang) * w + (Math.random() - 0.5) * 0.03;
          const ly = Math.sin(ang) * h * 0.75 + 0.10 * (1 - t) + (Math.random() - 0.5) * 0.03;
          put(i, lx, ly, z);
        } else {
          // Monocoque cockpit chassis & tea-tray floor
          if (Math.random() < 0.25) {
            // Flat carbon underfloor plank
            const lx = (Math.random() - 0.5) * 1.5;
            put(i, lx, -0.24 + (Math.random() - 0.5) * 0.03, z);
          } else {
            const w = 0.74 - (1.2 - z) * 0.06;
            const ang = Math.random() * Math.PI * 2;
            const lx = Math.cos(ang) * w * 0.52 + (Math.random() - 0.5) * 0.04;
            const ly = Math.sin(ang) * 0.36 + 0.10 + (Math.random() - 0.5) * 0.04;
            put(i, lx, ly, z);
          }
        }
      } else if (p < 0.28) {
        // 2. Cockpit Opening & Titanium Halo Safety Structure
        if (Math.random() < 0.30) {
          // Center forward mounting pylon
          const t = Math.random();
          const ly = 0.35 + t * 0.60;
          const lz = 1.35 - t * 0.25;
          const lx = (Math.random() - 0.5) * 0.07;
          put(i, lx, ly, lz);
        } else if (Math.random() < 0.70) {
          // Curved protective halo hoop
          const u = Math.random() * Math.PI;
          const lx = Math.cos(u) * 0.44;
          const lz = 0.85 - Math.sin(u) * 0.65;
          const ly = 0.94 - (1 - Math.sin(u)) * 0.22 + (Math.random() - 0.5) * 0.04;
          put(i, lx, ly, lz);
        } else {
          // Cockpit rim edge
          const u = Math.random() * Math.PI * 2;
          const lx = Math.cos(u) * 0.38;
          const lz = 0.75 + Math.sin(u) * 0.55;
          put(i, lx, 0.42 + (Math.random() - 0.5) * 0.04, lz);
        }
      } else if (p < 0.40) {
        // 3. Airbox Intake, Engine Cover & Shark Fin Spine
        if (Math.random() < 0.25) {
          // Overhead triangular airbox intake
          const u = Math.random();
          const lx = (Math.random() - 0.5) * 0.26 * (1 - u);
          const ly = 0.98 + u * 0.32;
          const lz = 0.22 + (Math.random() - 0.5) * 0.15;
          put(i, lx, ly, lz);
        } else {
          // Razor-thin aerodynamic shark fin spine
          const lz = 0.1 - Math.random() * 2.7;
          const t = (0.1 - lz) / 2.7;
          const topY = 1.26 - Math.pow(t, 1.1) * 0.72;
          const ly = 0.38 + Math.random() * (topY - 0.38);
          const lx = (Math.random() - 0.5) * 0.05;
          put(i, lx, ly, lz);
        }
      } else if (p < 0.56) {
        // 4. Undercut Sidepods & Downwash Radiator Inlets
        const side = Math.random() < 0.5 ? -1 : 1;
        const lz = -2.2 + Math.random() * 3.4; // -2.2 to 1.2
        const tz = (1.2 - lz) / 3.4;
        const width = 0.52 + (1 - Math.pow(tz, 1.4)) * 0.80;
        const ang = (Math.random() - 0.5) * Math.PI * 0.8;
        const lx = side * (width + Math.sin(ang) * 0.18);
        const ly = -0.16 + (1 - tz) * 0.46 * Math.random() + Math.cos(ang) * 0.12;
        put(i, lx, ly, lz);
      } else if (p < 0.68) {
        // 5. Front Wing Cascade, Diveplanes & Endplates
        if (Math.random() < 0.72) {
          // Multi-tier front wing flaps spanning x ± 2.3
          const lx = (Math.random() - 0.5) * 4.6;
          const flap = Math.floor(Math.random() * 3);
          const lz = 4.15 + flap * 0.18 + (Math.random() - 0.5) * 0.05;
          const ly = -0.18 + flap * 0.08 + Math.abs(lx) * 0.04;
          put(i, lx, ly, lz);
        } else {
          // Vertical wing endplates at outer tips
          const side = Math.random() < 0.5 ? -1 : 1;
          const lx = side * (2.28 + (Math.random() - 0.5) * 0.06);
          const ly = -0.22 + Math.random() * 0.50;
          const lz = 4.05 + Math.random() * 0.65;
          put(i, lx, ly, lz);
        }
      } else if (p < 0.82) {
        // 6. Dual-Plane Rear Wing, DRS Flap, Swan-Neck Pylons & Diffuser
        const choice = Math.random();
        if (choice < 0.40) {
          // Upper wing & DRS flap spanning x ± 1.65
          const lx = (Math.random() - 0.5) * 3.3;
          const lz = -3.65 + (Math.random() - 0.5) * 0.22;
          const ly = 1.24 + Math.random() * 0.26;
          put(i, lx, ly, lz);
        } else if (choice < 0.62) {
          // Lower beam wing & rear diffuser strakes
          if (Math.random() < 0.5) {
            const lx = (Math.random() - 0.5) * 3.1;
            const lz = -3.35 + (Math.random() - 0.5) * 0.16;
            const ly = 0.42 + Math.random() * 0.18;
            put(i, lx, ly, lz);
          } else {
            // Diffuser upswept kick
            const lz = -2.2 - Math.random() * 1.5;
            const td = (-2.2 - lz) / 1.5;
            const lx = (Math.random() - 0.5) * 1.8 * (0.6 + td * 0.4);
            const ly = -0.25 + td * 0.52;
            put(i, lx, ly, lz);
          }
        } else if (choice < 0.82) {
          // Rear wing vertical endplates
          const side = Math.random() < 0.5 ? -1 : 1;
          const lx = side * (1.65 + (Math.random() - 0.5) * 0.06);
          const ly = 0.26 + Math.random() * 1.28;
          const lz = -3.10 - Math.random() * 0.95;
          put(i, lx, ly, lz);
        } else {
          // Twin swan-neck pylons
          const side = Math.random() < 0.5 ? -1 : 1;
          const lx = side * 0.24;
          const ly = 0.42 + Math.random() * 0.92;
          const lz = -3.18 - (ly - 0.42) * 0.38;
          put(i, lx, ly, lz);
        }
      } else if (p < 0.94) {
        // 7. Four Wheels with Tire Treads, Rims & Suspension A-arms
        const wheelIdx = Math.floor(Math.random() * 4);
        let cx = 0, cz = 0, cy = 0, r = 0, w = 0;
        if (wheelIdx === 0) { cx = -1.82; cz =  2.55; cy = 0.05; r = 0.48; w = 0.40; } // Front Left
        if (wheelIdx === 1) { cx =  1.82; cz =  2.55; cy = 0.05; r = 0.48; w = 0.40; } // Front Right
        if (wheelIdx === 2) { cx = -1.90; cz = -2.35; cy = 0.08; r = 0.54; w = 0.52; } // Rear Left
        if (wheelIdx === 3) { cx =  1.90; cz = -2.35; cy = 0.08; r = 0.54; w = 0.52; } // Rear Right

        if (Math.random() < 0.70) {
          // Outer tire tread and sidewall
          const th = Math.random() * Math.PI * 2;
          const rad = r * (0.86 + Math.random() * 0.14);
          const lx = cx + (Math.random() - 0.5) * w;
          const ly = cy + Math.sin(th) * rad;
          const lz = cz + Math.cos(th) * rad;
          put(i, lx, ly, lz);
        } else {
          // Suspension carbon wishbone struts connecting wheel hub to chassis
          const t = Math.random();
          const chassisX = (cx > 0 ? 1 : -1) * 0.65;
          const chassisY = cy + 0.18 * (Math.random() < 0.5 ? 1 : -1);
          const chassisZ = cz + (Math.random() - 0.5) * 0.4;
          const lx = cx + (chassisX - cx) * t + (Math.random() - 0.5) * 0.04;
          const ly = cy + (chassisY - cy) * t + (Math.random() - 0.5) * 0.04;
          const lz = cz + (chassisZ - cz) * t + (Math.random() - 0.5) * 0.04;
          put(i, lx, ly, lz);
        }
      } else {
        // 8. Aerodynamic Velocity Slipstreams & Wake Vortices (trailing behind)
        const lz = -3.8 - Math.random() * 5.2; // trailing back to -9.0
        const t = (-3.8 - lz) / 5.2;
        const type = Math.random();
        if (type < 0.50) {
          // Rear wing endplate spiral vortex
          const side = Math.random() < 0.5 ? -1 : 1;
          const coil = t * 16.0;
          const vRadius = 0.12 + t * 0.55;
          const lx = side * (1.65 + Math.cos(coil) * vRadius);
          const ly = 1.35 + Math.sin(coil) * vRadius;
          put(i, lx, ly, lz);
        } else if (type < 0.80) {
          // High-velocity underfloor ground-effect suction streaks
          const lx = (Math.random() - 0.5) * (1.8 + t * 0.8);
          const ly = -0.24 + Math.sin(t * 8.0) * 0.06;
          put(i, lx, ly, lz);
        } else {
          // Halo rooster-tail wake plume
          const lx = (Math.random() - 0.5) * (0.35 + t * 0.65);
          const ly = 1.08 + Math.sin(t * 6.0) * 0.18 + t * 0.25;
          put(i, lx, ly, lz);
        }
      }
    }

    return a;
  }

  // ---- Cybersecurity & AI Agent Defense: Procedural 3D Aegis Shield & Vault Core ----
  _targetCyberShield(N) {
    const a = new Float32Array(N * 3);
    const put = (idx, x, y, z) => {
      a[idx * 3]     = x;
      a[idx * 3 + 1] = y;
      a[idx * 3 + 2] = z;
    };

    // Hexagon vertices generator
    const getHexVertex = (r, k) => {
      const angle = (k / 6) * Math.PI * 2;
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    };

    for (let i = 0; i < N; i++) {
      const p = Math.random();

      if (p < 0.38) {
        // 1. Convex Curved Cryptographic Aegis Shield Surface & Laser Perimeter
        // Height spans from y = -3.4 (bottom apex) to y = +3.0 (top crest)
        const y = -3.4 + Math.random() * 6.4;
        let maxWidth;
        if (y >= 0) {
          // Upper crest: broad with subtle parabolic roll-off
          const ty = y / 3.0;
          maxWidth = 3.2 * (1.0 - 0.22 * ty * ty);
        } else {
          // Lower taper: sharp elegant gothic aegis curvature to apex
          const ty = (y + 3.4) / 3.4;
          maxWidth = 3.2 * Math.pow(Math.max(0, ty), 0.78);
        }

        const isBorder = Math.random() < 0.32;
        let x;
        if (isBorder) {
          // Sharp glowing perimeter contour
          const side = Math.random() < 0.5 ? -1 : 1;
          x = side * (maxWidth + (Math.random() - 0.5) * 0.12);
        } else {
          // Distributed across interior convex shield facet
          x = (Math.random() * 2 - 1) * maxWidth;
        }

        // Parabolic forward convexity: z bows outward toward viewer
        const z = 1.8 - 0.16 * (x * x) - 0.10 * (y * y) + (Math.random() - 0.5) * 0.08;
        put(i, x, y, z);

      } else if (p < 0.64) {
        // 2. Central Hexagonal Cryptographic Vault Core & Key Lattice
        const tier = Math.random();
        let rHex = 0.9;
        if (tier < 0.35) rHex = 0.9;
        else if (tier < 0.70) rHex = 1.8;
        else rHex = 2.6;

        if (Math.random() < 0.75) {
          // Along hexagonal wireframe perimeter edges
          const edge = Math.floor(Math.random() * 6);
          const [x0, y0] = getHexVertex(rHex, edge);
          const [x1, y1] = getHexVertex(rHex, (edge + 1) % 6);
          const t = Math.random();
          const lx = x0 + (x1 - x0) * t + (Math.random() - 0.5) * 0.06;
          const ly = y0 + (y1 - y0) * t + (Math.random() - 0.5) * 0.06;
          const lz = 1.35 + (3.0 - rHex) * 0.18 + (Math.random() - 0.5) * 0.06;
          put(i, lx, ly, lz);
        } else if (Math.random() < 0.70) {
          // Radial cryptographic cipher spokes radiating to center
          const vert = Math.floor(Math.random() * 6);
          const [x0, y0] = getHexVertex(rHex, vert);
          const t = Math.random();
          const lx = x0 * t + (Math.random() - 0.5) * 0.05;
          const ly = y0 * t + (Math.random() - 0.5) * 0.05;
          const lz = 1.5 - t * 0.2 + (Math.random() - 0.5) * 0.05;
          put(i, lx, ly, lz);
        } else {
          // High-density cipher seed core (inner crypto enclave)
          const phi = Math.random() * Math.PI * 2;
          const costh = Math.random() * 2 - 1;
          const sinth = Math.sqrt(Math.max(0, 1 - costh * costh));
          const pr = 0.42 * Math.pow(Math.random(), 0.6);
          put(i,
            pr * sinth * Math.cos(phi),
            pr * costh,
            1.65 + pr * sinth * Math.sin(phi)
          );
        }

      } else if (p < 0.86) {
        // 3. Dual Gyroscopic Orbital Firewall Rings (Interception Perimeters)
        const ringType = Math.random();
        const theta = Math.random() * Math.PI * 2;

        if (ringType < 0.52) {
          // Ring 1: Primary Firewall Orbit (Radius 4.8, tilted 26 deg)
          const r = 4.8 + (Math.random() - 0.5) * 0.18;
          const lx = Math.cos(theta) * r;
          const lz = Math.sin(theta) * r;
          const tilt = 0.45; // ~26 deg
          const ly = -lz * Math.sin(tilt) + Math.sin(theta * 10) * 0.18;
          const lzRot = lz * Math.cos(tilt);
          put(i, lx, ly, lzRot);
        } else {
          // Ring 2: Polar Defense Orbit (Radius 5.4, tilted -55 deg & Y rotated)
          const r = 5.4 + (Math.random() - 0.5) * 0.22;
          const lx = Math.cos(theta) * r;
          const ly = Math.sin(theta) * r;
          const rotZ = -0.92;
          const rotY = 0.65;
          const x1 = lx * Math.cos(rotZ) - ly * Math.sin(rotZ);
          const y1 = lx * Math.sin(rotZ) + ly * Math.cos(rotZ);
          const xFinal = x1 * Math.cos(rotY);
          const zFinal = -x1 * Math.sin(rotY) + Math.cos(theta * 14) * 0.15;
          put(i, xFinal, y1, zFinal);
        }

      } else {
        // 4. Kinetic Threat Deflection Sprays & Interceptor Spark Trails
        // Vectors splashing off the aegis shield and dissipating safely into the void
        const side = Math.random() < 0.5 ? -1 : 1;
        const splashT = Math.random();
        const startY = -2.8 + Math.random() * 5.6;
        const startX = side * (2.8 + Math.random() * 0.8);
        const startZ = 1.4;

        // Radiate outward and backward away from shield front
        const lx = startX + side * splashT * 2.4 + (Math.random() - 0.5) * 0.25;
        const ly = startY + (Math.random() - 0.5) * splashT * 1.8;
        const lz = startZ - splashT * 3.6 + (Math.random() - 0.5) * 0.35;
        put(i, lx, ly, lz);
      }
    }

    return a;
  }

  /**
   * Retarget the whole field. Freezes the current in-flight positions into the
   * `position` (from) buffer, points `aTo` at the new target, and tweens uMorph.
   */
  setState(name, duration = 1.8) {
    if (name === this._state || !this._targets[name]) return;
    this._state = name;

    const geo = this.points.geometry;
    const from = geo.attributes.position.array;
    const to = geo.attributes.aTo.array;
    let k = this._uniforms.uMorph.value;
    k = Math.min(Math.max(k * 1.3 - 0.15, 0), 1);   // matches the shader's mean stagger
    k = k * k * (3 - 2 * k);
    for (let i = 0; i < from.length; i++) from[i] = from[i] + (to[i] - from[i]) * k;
    to.set(this._targets[name]);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aTo.needsUpdate = true;

    this._uniforms.uMorph.value = 0;
    gsap.to(this._uniforms.uMorph, {
      value: 1, duration, ease: 'power2.inOut',
      onUpdate: () => this.exp.invalidate(2),
    });

    // palette ride-along
    const [a, b] = PALETTES[name];
    const ca = new THREE.Color(a), cb = new THREE.Color(b);
    gsap.to(this._uniforms.uColorA.value, { r: ca.r, g: ca.g, b: ca.b, duration, ease: 'sine.inOut' });
    gsap.to(this._uniforms.uColorB.value, { r: cb.r, g: cb.g, b: cb.b, duration, ease: 'sine.inOut' });
  }

  /** Fade the whole field (behind solid DOM sections) without killing it. */
  setDim(v, duration = 1.2) {
    gsap.to(this._uniforms.uDim, { value: v, duration, ease: 'sine.inOut', onUpdate: () => this.exp.invalidate(2) });
  }

  /** Fade the chrome sculpture itself (hidden while the field forms other shapes). */
  setZVisible(on, duration = 1.0) {
    if (!this.zMesh) return;
    const mat = this.zMesh.material;
    if (on) this.zMesh.visible = true;
    mat.depthWrite = on;   // a ghosted Z must not punch a depth hole in the field
    gsap.to(mat, {
      opacity: on ? 1 : 0, duration, ease: 'sine.inOut', overwrite: true,
      onUpdate: () => this.exp.invalidate(2),
      onComplete: () => { if (!on) this.zMesh.visible = false; this.exp.invalidate(2); },
    });
  }

  // ------------------------------------------------------------------ shards
  _addShards() {
    const COUNT = 26;
    const geo = new THREE.OctahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x17171d, metalness: 1.0, roughness: 0.22, envMapIntensity: 1.3,
    });
    this.shards = new THREE.InstancedMesh(geo, mat, COUNT);
    this.shards.frustumCulled = false;   // they orbit through the frustum edge
    this._shardSpecs = [];
    for (let i = 0; i < COUNT; i++) {
      this._shardSpecs.push({
        r: 6.5 + Math.random() * 9,
        a0: Math.random() * Math.PI * 2,
        y: (Math.random() - 0.5) * 9,
        s: 0.1 + Math.random() * 0.38,
        speed: (0.02 + Math.random() * 0.05) * (Math.random() < 0.5 ? 1 : -1),
        tumble: Math.random() * Math.PI * 2,
      });
    }
    this.scene.add(this.shards);
  }

  // ----------------------------------------------------------- accent lights
  _addAccentLights() {
    // just TWO lights — they only exist to pour the brand ember into the chrome
    const ember = new THREE.PointLight(0xff5500, 60, 60, 1.8);
    ember.position.set(-8, 5, 7);
    const warm = new THREE.PointLight(0xfff1e0, 45, 60, 1.8);
    warm.position.set(8, -4, 8);
    this.scene.add(ember, warm);
  }

  // ----------------------------------------------------------------- pointer
  _bindPointer() {
    window.addEventListener('pointermove', (e) => {
      this.mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this._raycaster.setFromCamera(this.mouseNDC, this.exp.camera.instance);
      const hit = new THREE.Vector3();
      if (this._raycaster.ray.intersectPlane(this._plane, hit)) {
        this._mouseWorld.copy(hit);
      }
      this.exp.invalidate(2);
    }, { passive: true });
  }

  // ------------------------------------------------------------------ update
  update(elapsed) {
    this._uniforms.uTime.value = elapsed;

    // sync reduced-motion preference from the experience
    this._uniforms.uReducedMotion.value = this.exp.reducedMotion ? 1 : 0;
    const motionScale = this.exp.reducedMotion ? 0 : 1;

    // the sculpture floats, breathes, and leans toward the cursor
    if (this.zGroup) {
      this.zGroup.position.y = Math.sin(elapsed * 0.55) * 0.2 * motionScale;
      this.zGroup.rotation.y = elapsed * 0.14 * motionScale + this.mouseNDC.x * 0.22 * motionScale;
      this.zGroup.rotation.x = -this.mouseNDC.y * 0.12 * motionScale;
    }

    // shard orbits (stateless — derived from elapsed, cheap for 26 instances)
    if (this.shards) {
      const d = new THREE.Object3D();
      for (let i = 0; i < this._shardSpecs.length; i++) {
        const s = this._shardSpecs[i];
        const a = s.a0 + elapsed * s.speed * motionScale;
        d.position.set(Math.cos(a) * s.r, s.y + Math.sin(elapsed * 0.3 + s.a0) * 0.5 * motionScale, Math.sin(a) * s.r);
        d.rotation.set(s.tumble + elapsed * 0.15 * motionScale, a, s.tumble);
        d.scale.setScalar(s.s);
        d.updateMatrix();
        this.shards.setMatrixAt(i, d.matrix);
      }
      this.shards.instanceMatrix.needsUpdate = true;
    }
  }

  resize() {
    if (this._uniforms) this._uniforms.uPixelRatio.value = Math.min(this.exp.sizes.pixelRatio, 2);
  }
}
