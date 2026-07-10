import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Environment.js — lighting for a void-black studio scene.
 *
 * The chrome sculpture is lit ENTIRELY by image-based lighting: a procedural
 * RoomEnvironment baked once through PMREMGenerator. That gives the metal its
 * long, soft studio reflections with zero HDR download and zero shadow cost.
 * Two colored accent lights (added in World) put the brand's plasma tint into
 * the reflections.
 *
 * The visible background is a hand-graded void — near-black with the faintest
 * violet breath at the horizon so the black never reads as "off".
 */
export default class Environment {
  constructor(experience) {
    this.exp = experience;
    this.scene = experience.scene;
    this._setup();
  }

  _setup() {
    const { renderer } = this.exp;

    // ---- IBL: procedural studio, baked once ----
    const pmrem = new THREE.PMREMGenerator(renderer.instance);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 1.0;
    pmrem.dispose();

    // ---- Visible background: graded void ----
    this.scene.background = this._makeGradient();

    // Gentle depth fade so far shards/particle fringes dissolve into the void.
    this.scene.fog = new THREE.FogExp2(0x050508, 0.016);
  }

  _makeGradient() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    // Equirect background: v≈0 zenith · v≈0.5 horizon · v≈1 nadir.
    g.addColorStop(0.00, '#040407');   // zenith — pure void
    g.addColorStop(0.42, '#07070d');
    g.addColorStop(0.52, '#0c0a16');   // the faintest violet breath at the horizon
    g.addColorStop(0.62, '#070710');
    g.addColorStop(1.00, '#040406');   // nadir
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }
}
