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

const PALETTES = {
  nebula:  [0x9d7bff, 0x4fe3c1],
  ribbon:  [0xb18cff, 0x7cc7ff],
  knot:    [0x7c5cff, 0x4fe3c1],
  lattice: [0x4fe3c1, 0x6ea8ff],
  wave:    [0x6ea8ff, 0x9d7bff],
  crystal: [0x8fa9ff, 0xff7ad9],
  zglyph:  [0xb18cff, 0x4fe3c1],
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
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,                 // the chrome Z occludes the field — real depth
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uMorph, uTime, uSize, uDim, uPixelRatio;
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

          // ambient drift — the field breathes even at rest
          float t = uTime * 0.45 + aRand.x * 6.2831;
          pos.x += sin(t + pos.y * 0.55)        * (0.10 + 0.14 * aRand.y);
          pos.y += cos(t * 0.86 + pos.x * 0.50) * (0.08 + 0.12 * aRand.z);
          pos.z += sin(t * 0.71 + pos.x * 0.35) * (0.10 + 0.12 * aRand.x);

          // pointer repulsion — the field parts around the cursor
          vec3 d = pos - uMouse;
          float dist = length(d);
          float push = smoothstep(3.2, 0.0, dist);
          pos += (d / max(dist, 0.001)) * push * 1.5;

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
    mat.transparent = true;
    gsap.to(mat, { opacity: on ? 1 : 0, duration, ease: 'sine.inOut', onUpdate: () => this.exp.invalidate(2) });
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
    // just TWO lights — they only exist to pour the brand plasma into the chrome
    const violet = new THREE.PointLight(0x9d7bff, 60, 60, 1.8);
    violet.position.set(-8, 5, 7);
    const mint = new THREE.PointLight(0x4fe3c1, 45, 60, 1.8);
    mint.position.set(8, -4, 8);
    this.scene.add(violet, mint);
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

    // the sculpture floats, breathes, and leans toward the cursor
    if (this.zGroup) {
      this.zGroup.position.y = Math.sin(elapsed * 0.55) * 0.2;
      this.zGroup.rotation.y = elapsed * 0.14 + this.mouseNDC.x * 0.22;
      this.zGroup.rotation.x = -this.mouseNDC.y * 0.12;
    }

    // shard orbits (stateless — derived from elapsed, cheap for 26 instances)
    if (this.shards) {
      const d = new THREE.Object3D();
      for (let i = 0; i < this._shardSpecs.length; i++) {
        const s = this._shardSpecs[i];
        const a = s.a0 + elapsed * s.speed;
        d.position.set(Math.cos(a) * s.r, s.y + Math.sin(elapsed * 0.3 + s.a0) * 0.5, Math.sin(a) * s.r);
        d.rotation.set(s.tumble + elapsed * 0.15, a, s.tumble);
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
