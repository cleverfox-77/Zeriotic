import * as THREE from 'three';

/**
 * Renderer.js — the WebGLRenderer.
 *
 *  · ACESFilmicToneMapping + sRGB output  → cinematic, gamma-correct color
 *  · powerPreference 'high-performance'   → ask the OS for the discrete GPU
 *  · pixelRatio capped (via Sizes)        → bounded fill-rate cost
 *  · NO shadow maps — the void scene is lit by IBL + additive particles
 *
 * NOTE: antialias is left OFF on purpose — SMAA in the post stack does the
 * AA so we don't pay for MSAA *and* a post AA pass.
 */
export default class Renderer {
  constructor(experience) {
    this.exp = experience;
    const { canvas } = experience;

    this.instance = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      alpha: false,
    });

    this.instance.setClearColor(0x050508, 1);
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.0;
    this.instance.shadowMap.enabled = false;

    this.resize();
  }

  resize() {
    const { sizes } = this.exp;
    this.instance.setSize(sizes.width, sizes.height);
    this.instance.setPixelRatio(sizes.pixelRatio);
  }
}
