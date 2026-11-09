import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Environment.js - lighting for a clean ivory editorial scene (UNSEEN-inspired).
 * Light canvas #F6F1EB, soft studio IBL, warm ember accents.
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
  }
}
