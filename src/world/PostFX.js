import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { finalVertex, finalFragment } from '../shaders/FinalPass.js';

/**
 * PostFX.js - a deliberately small image pipeline.
 *
 *   scene, in HDR  ->  soft glow, built at quarter resolution and below  ->  one final pass
 *
 * Tone mapping, colour conversion, anti-aliasing, grain and vignette all live in
 * that one final pass, so the screen is only filled once after the scene.
 */

const GLOW_DOWN = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
    c *= 0.25;
    if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
    c = min(c, vec3(16.0));
    if (uThreshold > 0.0) {
      float peak = max(c.r, max(c.g, c.b));
      c *= smoothstep(uThreshold, uThreshold * 1.4, peak);
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

const GLOW_UP = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
    gl_FragColor = vec4(c * 0.25, 1.0);
  }
`;

export default class PostFX {
  constructor(experience) {
    this.exp = experience;
    const { quality } = experience;

    const hdr = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, { ...hdr, depthBuffer: true, samples: quality.msaa });
    this.glowRT = quality.bloom
      ? [0, 1, 2].map(() => new THREE.WebGLRenderTarget(4, 4, { ...hdr, depthBuffer: false }))
      : [];

    const pass = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({
      vertexShader: finalVertex, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra,
    });

    this.down = pass(GLOW_DOWN, {
      tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 },
    });
    this.up = pass(GLOW_UP, {
      tSrc: { value: null }, uTexel: { value: new THREE.Vector2() },
    }, { transparent: true, blending: THREE.AdditiveBlending });

    const defines = {};
    if (quality.msaa === 0) defines.USE_EDGE_SMOOTHING = 1;
    if (quality.bloom) defines.USE_GLOW = 1;
    this.final = pass(finalFragment, {
      tScene: { value: this.sceneRT.texture },
      tGlow: { value: quality.bloom ? this.glowRT[0].texture : null },
      uTexel: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uAberration: { value: 0.0026 },
      uGrain: { value: quality.grain ? 0.04 : 0 },
      uVignette: { value: 0.22 },
      uExposure: { value: 1 },
      uGlow: { value: 0.42 },
    }, { defines });

    this.quad = new FullScreenQuad(this.final);
    this._size = new THREE.Vector2();
    this.resize();
  }

  _blit(renderer, material, target) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    this.quad.render(renderer);
  }

  /** Bright areas, shrunk and blurred on the way down, added back on the way up. */
  _glow(renderer) {
    const [a, b, c] = this.glowRT;
    const D = this.down.uniforms, U = this.up.uniforms;

    D.tSrc.value = this.sceneRT.texture;
    D.uThreshold.value = 1.05;
    D.uTexel.value.set(0.5 / a.width, 0.5 / a.height);
    this._blit(renderer, this.down, a);

    D.uThreshold.value = 0;
    D.tSrc.value = a.texture;
    D.uTexel.value.set(0.5 / b.width, 0.5 / b.height);
    this._blit(renderer, this.down, b);

    D.tSrc.value = b.texture;
    D.uTexel.value.set(0.5 / c.width, 0.5 / c.height);
    this._blit(renderer, this.down, c);

    U.tSrc.value = c.texture;
    U.uTexel.value.set(0.5 / b.width, 0.5 / b.height);
    this._blit(renderer, this.up, b);

    U.tSrc.value = b.texture;
    U.uTexel.value.set(0.5 / a.width, 0.5 / a.height);
    this._blit(renderer, this.up, a);
  }

  update(elapsed) { this.final.uniforms.uTime.value = elapsed; }

  render() {
    const { scene, camera, renderer } = this.exp;
    const r = renderer.instance;

    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera.instance);

    r.autoClear = false;
    if (this.glowRT.length) this._glow(r);
    this.final.uniforms.uExposure.value = r.toneMappingExposure;
    this._blit(r, this.final, null);
    r.autoClear = true;
  }

  resize() {
    const r = this.exp.renderer.instance;
    r.getDrawingBufferSize(this._size);
    const w = Math.max(2, this._size.x), h = Math.max(2, this._size.y);
    this.sceneRT.setSize(w, h);
    this.final.uniforms.uTexel.value.set(1 / w, 1 / h);
    [4, 8, 16].forEach((d, i) => {
      this.glowRT[i]?.setSize(Math.max(2, Math.round(w / d)), Math.max(2, Math.round(h / d)));
    });
  }
}
