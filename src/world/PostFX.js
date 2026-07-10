import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { FinalShader } from '../shaders/FinalPass.js';

/**
 * PostFX.js — the EffectComposer stack, tier-aware.
 *
 * Order (cheap → expensive, then resolve):
 *   RenderPass → UnrealBloomPass → OutputPass(tonemap/sRGB)
 *   → SMAAPass/FXAA (AA) → FinalPass (CA + grain + vignette)
 *
 * PERFORMANCE:
 *   · Bloom resolution is downscaled (quality.bloomDownscale).
 *   · SMAA (best quality) for stills; a single cheap FXAA pass swaps in during
 *     continuous motion — motion masks FXAA's softer edges. Mutually exclusive.
 *   · The whole composer renders ON DEMAND (see Experience) — never idly.
 */
export default class PostFX {
  constructor(experience) {
    this.exp = experience;
    const { renderer, scene, camera, sizes, quality } = experience;

    this.composer = new EffectComposer(renderer.instance);
    this.composer.setPixelRatio(sizes.pixelRatio);
    this.composer.setSize(sizes.width, sizes.height);

    this.composer.addPass(new RenderPass(scene, camera.instance));

    // ---- Bloom: the plasma glow on particle cores + chrome highlights ----
    if (quality.bloom) {
      const res = new THREE.Vector2(
        sizes.width / quality.bloomDownscale,
        sizes.height / quality.bloomDownscale,
      );
      this.bloom = new UnrealBloomPass(res, 0.32, 0.55, 0.6);
      this.composer.addPass(this.bloom);
    }

    // Tone mapping + sRGB happen here so post math above stays in linear space.
    this.composer.addPass(new OutputPass());

    // ---- Anti-aliasing ----
    this.smaa = new SMAAPass(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio);
    this.composer.addPass(this.smaa);

    this.fxaa = new ShaderPass(FXAAShader);
    this.fxaa.enabled = false;
    this.composer.addPass(this.fxaa);

    // ---- Combined final grade (chromatic aberration + grain + vignette) ----
    this.final = new ShaderPass(FinalShader);
    this.final.uniforms.uGrain.value = quality.grain ? 0.045 : 0.0;
    this.composer.addPass(this.final);

    this._updateFXAAResolution();
  }

  /** Swap between SMAA (still, best quality) and FXAA (continuous motion, cheap). */
  setMotionAA(on) {
    if (!this.smaa || !this.fxaa) return;
    this.smaa.enabled = !on;
    this.fxaa.enabled = on;
  }

  _updateFXAAResolution() {
    if (!this.fxaa) return;
    const { sizes } = this.exp;
    const w = sizes.width * sizes.pixelRatio;
    const h = sizes.height * sizes.pixelRatio;
    this.fxaa.material.uniforms['resolution'].value.set(1 / w, 1 / h);
  }

  setVignette(value) { this.final.uniforms.uVignette.value = value; }
  resetVignette() { this.final.uniforms.uVignette.value = 0.32; }

  update(elapsed) { this.final.uniforms.uTime.value = elapsed; }

  render() { this.composer.render(); }

  resize() {
    const { sizes, quality } = this.exp;
    this.composer.setPixelRatio(sizes.pixelRatio);
    this.composer.setSize(sizes.width, sizes.height);
    if (this.bloom) this.bloom.setSize(sizes.width / quality.bloomDownscale, sizes.height / quality.bloomDownscale);
    this._updateFXAAResolution();
  }
}
