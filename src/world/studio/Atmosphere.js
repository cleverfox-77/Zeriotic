import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { noiseCanvas } from './kit.js';

/**
 * Atmosphere.js - the sky, the water, the sun and the drifting motes.
 * One set of values is blended by scroll, so walking between rooms feels like
 * the hour changing rather than a cut.
 */

const c = (hex) => new THREE.Color(hex);

export const MOODS = {
  morning: {
    top: c(0x6fa6d4), horizon: c(0xf8d4ae), sunColor: c(0xffe6c4), sun: 2.7, hemi: 2.1, env: 0.3,
    fog: c(0xecd9c2), fogD: 0.0058, deep: c(0xa9bcc4), distort: 0.02, sunDir: [-0.82, 0.44, 0.36], ground: c(0xbfa98e), exposure: 0.92,
  },
  daylight: {
    top: c(0x79aad6), horizon: c(0xf6e2cb), sunColor: c(0xfff0da), sun: 2.5, hemi: 2.3, env: 0.32,
    fog: c(0xe9dccb), fogD: 0.0072, deep: c(0xb4c3c8), distort: 0.016, sunDir: [0.66, 0.58, 0.48], ground: c(0xc9b7a0), exposure: 0.92,
  },
  dusk: {
    top: c(0x161a2a), horizon: c(0xd9531a), sunColor: c(0xff9a55), sun: 2.1, hemi: 0.9, env: 0.5,
    fog: c(0x35201c), fogD: 0.0125, deep: c(0x0c0b0d), distort: 0.006, sunDir: [0.05, 0.1, -0.99], ground: c(0x1b1412), exposure: 1.02,
  },
  vault: {
    top: c(0x08090c), horizon: c(0x16181e), sunColor: c(0xb7c6d8), sun: 0.85, hemi: 0.7, env: 0.42,
    fog: c(0x0b0c10), fogD: 0.02, deep: c(0x07080b), distort: 0.008, sunDir: [-0.4, 0.75, 0.5], ground: c(0x101114), exposure: 1.0,
  },
  gallery: {
    top: c(0x86b1d8), horizon: c(0xf7e8d6), sunColor: c(0xfff1dc), sun: 2.6, hemi: 2.4, env: 0.34,
    fog: c(0xebe1d3), fogD: 0.0095, deep: c(0xc1cdce), distort: 0.014, sunDir: [-0.6, 0.62, 0.32], ground: c(0xd2c2ad), exposure: 0.94,
  },
  golden: {
    top: c(0x5f86ad), horizon: c(0xffa95e), sunColor: c(0xffb873), sun: 2.8, hemi: 1.7, env: 0.3,
    fog: c(0xe3ad80), fogD: 0.0072, deep: c(0x8f7a6d), distort: 0.02, sunDir: [-0.34, 0.26, 0.9], ground: c(0xa8876a), exposure: 0.95,
  },
};

export default class Atmosphere {
  constructor(scene, renderer, sizes, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.sunDir = new THREE.Vector3(...MOODS.morning.sunDir).normalize();
    this.current = {
      top: MOODS.morning.top.clone(), horizon: MOODS.morning.horizon.clone(),
      sunColor: MOODS.morning.sunColor.clone(), fog: MOODS.morning.fog.clone(),
      deep: MOODS.morning.deep.clone(), ground: MOODS.morning.ground.clone(),
      sun: 3, hemi: 1, env: 0.7, fogD: 0.01, distort: 0.02, exposure: 1,
    };

    scene.fog = new THREE.FogExp2(this.current.fog.getHex(), this.current.fogD);
    this._sky();
    this._lights();
    this._water(sizes);
    this._motes();
  }

  _sky() {
    const geo = new THREE.SphereGeometry(460, 32, 20);
    this.skyUniforms = {
      uTop: { value: this.current.top },
      uHorizon: { value: this.current.horizon },
      uSunColor: { value: this.current.sunColor },
      uSunDir: { value: this.sunDir },
      uTime: { value: 0 },
      tCloud: { value: this._cloudTexture() },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyUniforms,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uHorizon, uSunColor, uSunDir; uniform float uTime; uniform sampler2D tCloud;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float y = max(d.y, 0.0);
          vec3 col = mix(uHorizon, uTop, pow(y, 0.55));
          vec2 cp = d.xz / (0.18 + y) * 0.16 + vec2(uTime * 0.0009, uTime * 0.0003);
          float c = texture2D(tCloud, cp).r * 0.62 + texture2D(tCloud, cp * 2.3 + 0.37).r * 0.38;
          float cl = smoothstep(0.55, 0.78, c);
          col = mix(col, mix(uHorizon, vec3(1.0), 0.65), cl * smoothstep(0.02, 0.3, y) * 0.42);
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(s, 900.0) * 7.0 + pow(s, 28.0) * 0.28 + pow(s, 4.0) * 0.12);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(this.current.top, this.current.ground, 1);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(this.current.sunColor, 3);
    const s = this.quality.shadowSize;
    if (s > 0) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(s, s);
      const cam = this.sun.shadow.camera;
      cam.left = -46; cam.right = 46; cam.top = 46; cam.bottom = -46;
      cam.near = 1; cam.far = 180;
      this.sun.shadow.bias = -0.0009;
      this.sun.shadow.normalBias = 0.04;
      this.sun.shadow.radius = 5;
    }
    this.scene.add(this.sun, this.sun.target);
    this.focusZ = 1e9;
  }

  _water(sizes) {
    const scale = this.quality.reflection;
    this.waterUniforms = null;
    if (scale > 0) {
      const shader = {
        name: 'StudioWater',
        uniforms: {
          color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
          uTime: { value: 0 }, uDistort: { value: 0.02 }, uDeep: { value: new THREE.Color() },
          uFog: { value: new THREE.Color() }, uFogD: { value: 0.01 }, tRipple: { value: null },
        },
        vertexShader: /* glsl */`
          uniform mat4 textureMatrix;
          varying vec4 vProj; varying vec3 vWorld;
          void main(){
            vProj = textureMatrix * vec4(position, 1.0);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */`
          uniform sampler2D tDiffuse, tRipple; uniform vec3 color, uDeep, uFog; uniform float uTime, uDistort, uFogD;
          varying vec4 vProj; varying vec3 vWorld;
          void main(){
            vec2 p = vWorld.xz;
            vec2 g = (texture2D(tRipple, p * 0.05 + vec2(uTime * 0.012, uTime * 0.007)).rg - 0.5)
                   + (texture2D(tRipple, p * 0.15 - vec2(uTime * 0.02, -uTime * 0.013)).rg - 0.5) * 0.7;
            vec3 toCam = cameraPosition - vWorld;
            float dist = length(toCam);
            vec3 V = toCam / dist;
            vec4 uv = vProj;
            float fade = 1.0 / (1.0 + dist * 0.035);
            uv.xy += g * uDistort * uv.w * fade * 3.2;
            vec3 refl = texture2DProj(tDiffuse, uv).rgb;
            float fres = 0.34 + 0.66 * pow(1.0 - max(V.y, 0.0), 3.0);
            vec3 col = mix(uDeep, refl, fres);
            float f = 1.0 - exp(-uFogD * uFogD * dist * dist);
            col = mix(col, uFog, f);
            gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      };
      const w = Math.round(sizes.width * sizes.pixelRatio * scale);
      const h = Math.round(sizes.height * sizes.pixelRatio * scale);
      this.water = new Reflector(new THREE.PlaneGeometry(900, 1500), {
        textureWidth: w, textureHeight: h, clipBias: 0.002, shader, multisample: 0,
      });
      this.waterUniforms = this.water.material.uniforms;
      this.waterUniforms.tRipple.value = this._rippleTexture();
      this.reflectScale = scale;
    } else {
      this.water = new THREE.Mesh(
        new THREE.PlaneGeometry(900, 1500),
        new THREE.MeshStandardMaterial({ color: this.current.deep, roughness: 0.32, metalness: 0.15 }),
      );
    }
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 0, -240);
    this.scene.add(this.water);
  }

  _motes() {
    const N = this.quality.motes;
    this.moteBox = 30;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = Math.random() * this.moteBox;
      pos[i * 3 + 1] = Math.random() * this.moteBox * 0.55;
      pos[i * 3 + 2] = Math.random() * this.moteBox;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.moteUniforms = {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: this.moteBox },
      uColor: { value: new THREE.Color(0xfff2df) }, uPx: { value: Math.min(sizes_pr(), 2) }, uAlpha: { value: 0.55 },
    };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: this.moteUniforms, fog: false,
      vertexShader: /* glsl */`
        uniform float uTime, uBox, uPx; uniform vec3 uCam; attribute float aSeed; varying float vA;
        void main(){
          vec3 p = position;
          float t = uTime * (0.08 + aSeed * 0.12);
          p += vec3(sin(t + aSeed*20.)*1.4, sin(t*.7 + aSeed*9.)*.8 + t*.6, cos(t*.9 + aSeed*13.)*1.4);
          vec3 half_ = vec3(uBox, uBox*.55, uBox) * .5;
          vec3 box = vec3(uBox, uBox*.55, uBox);
          p = mod(p - uCam + half_, box) - half_ + uCam;
          p.y = max(p.y, 0.15);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float s = 0.5 + aSeed * 1.5;
          gl_PointSize = s * uPx * (24.0 / max(-mv.z, 1.2));
          vA = smoothstep(26.0, 7.0, -mv.z) * smoothstep(0.4, 2.2, -mv.z) * (0.35 + aSeed*.65);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uAlpha; varying float vA;
        void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.0,d) * vA * uAlpha; if(a<.004) discard; gl_FragColor = vec4(uColor, a); }
      `,
    });
    this.motes = new THREE.Points(g, m);
    this.motes.frustumCulled = false;
    this.motes.layers.set(1);
    this.scene.add(this.motes);
  }

  _cloudTexture() {
    const t = new THREE.CanvasTexture(noiseCanvas(256, [[5, 0.6], [12, 0.5], [30, 0.3]], 1.25, 11));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /** A small tiling image of surface slopes, so ripples cost two lookups per pixel. */
  _rippleTexture() {
    const size = 256;
    const c = noiseCanvas(size, [[9, 0.55], [22, 0.45], [54, 0.3]], 1.1, 5);
    const d = c.getContext('2d').getImageData(0, 0, size, size).data;
    const h = (x, y) => d[(((y + size) % size) * size + ((x + size) % size)) * 4];
    const out = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        out[i] = Math.max(0, Math.min(255, 128 + (h(x + 1, y) - h(x - 1, y)) * 2.4));
        out[i + 1] = Math.max(0, Math.min(255, 128 + (h(x, y + 1) - h(x, y - 1)) * 2.4));
        out[i + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }

  /** Swaps the mirrored water for a plain surface on machines that cannot keep up. */
  dropReflection() {
    if (!this.waterUniforms) return;
    const plane = new THREE.Mesh(this.water.geometry, new THREE.MeshBasicMaterial({ color: this.current.deep.clone() }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.copy(this.water.position);
    this.water.getRenderTarget().dispose();
    this.scene.remove(this.water);
    this.scene.add(plane);
    this.water = plane;
    this.waterUniforms = null;
  }

  /** Blend two moods. Colours are lerped in place, so uniforms stay bound. */
  blend(a, b, f) {
    const A = MOODS[a], B = MOODS[b], C = this.current;
    C.top.copy(A.top).lerp(B.top, f);
    C.horizon.copy(A.horizon).lerp(B.horizon, f);
    C.sunColor.copy(A.sunColor).lerp(B.sunColor, f);
    C.fog.copy(A.fog).lerp(B.fog, f);
    C.deep.copy(A.deep).lerp(B.deep, f);
    C.ground.copy(A.ground).lerp(B.ground, f);
    C.sun = THREE.MathUtils.lerp(A.sun, B.sun, f);
    C.hemi = THREE.MathUtils.lerp(A.hemi, B.hemi, f);
    C.env = THREE.MathUtils.lerp(A.env, B.env, f);
    C.fogD = THREE.MathUtils.lerp(A.fogD, B.fogD, f);
    C.distort = THREE.MathUtils.lerp(A.distort, B.distort, f);
    C.exposure = THREE.MathUtils.lerp(A.exposure, B.exposure, f);
    this.sunDir.set(
      THREE.MathUtils.lerp(A.sunDir[0], B.sunDir[0], f),
      THREE.MathUtils.lerp(A.sunDir[1], B.sunDir[1], f),
      THREE.MathUtils.lerp(A.sunDir[2], B.sunDir[2], f),
    ).normalize();

    this.scene.fog.color.copy(C.fog);
    this.scene.fog.density = C.fogD;
    this.scene.environmentIntensity = C.env;
    this.hemi.color.copy(C.top);
    this.hemi.groundColor.copy(C.ground);
    this.hemi.intensity = C.hemi;
    this.sun.color.copy(C.sunColor);
    this.sun.intensity = C.sun;
    this.renderer.toneMappingExposure = C.exposure;
    if (this.waterUniforms) {
      this.waterUniforms.uDeep.value.copy(C.deep);
      this.waterUniforms.uFog.value.copy(C.fog);
      this.waterUniforms.uFogD.value = C.fogD;
      this.waterUniforms.uDistort.value = C.distort;
    } else {
      this.water.material.color.copy(C.deep);
    }
    this.moteUniforms.uAlpha.value = THREE.MathUtils.lerp(0.5, 0.2, 1 - Math.min(C.hemi / 1.6, 1));
  }

  /** Move the sun's shadow region to the room the camera is in. */
  setFocus(z) {
    if (Math.abs(z - this.focusZ) < 12) return;
    this.focusZ = z;
    this._placeSun();
    this._shadowDirty = true;
  }

  _placeSun() {
    const f = new THREE.Vector3(0, 6, this.focusZ);
    this.sun.position.copy(f).addScaledVector(this.sunDir, 90);
    this.sun.target.position.copy(f);
    this.sun.target.updateMatrixWorld();
  }

  /** True once after the sun has moved to another room. */
  takeShadowDirty() {
    const d = this._shadowDirty;
    this._shadowDirty = false;
    return d;
  }

  update(elapsed, camera) {
    this.skyUniforms.uTime.value = elapsed;
    this.sky.position.copy(camera.position);
    this.moteUniforms.uTime.value = elapsed;
    this.moteUniforms.uCam.value.copy(camera.position);
    if (this.waterUniforms) this.waterUniforms.uTime.value = elapsed;
    if (this.focusZ < 1e8) this._placeSun();
  }

  resize(sizes) {
    if (this.water.getRenderTarget) {
      const s = this.reflectScale;
      this.water.getRenderTarget().setSize(
        Math.round(sizes.width * sizes.pixelRatio * s),
        Math.round(sizes.height * sizes.pixelRatio * s),
      );
    }
  }
}

function sizes_pr() { return window.devicePixelRatio || 1; }
