import * as THREE from 'three';
import { createKit } from './studio/kit.js';
import Atmosphere from './studio/Atmosphere.js';
import { Gate, Answers, Circuit, Vault, Gallery } from './studio/Rooms.js';

/**
 * World.js - one continuous building the camera walks through.
 * Each room is shown only while the camera is near it.
 */

export const ROOM_Z = {
  gate: -14, answers: -74, circuit: -146, vault: -262, gallery: -320, end: -384,
};

export default class World {
  constructor(experience) {
    this.exp = experience;
    this.scene = experience.scene;
    const { quality, renderer, sizes } = experience;

    this.mouseNDC = new THREE.Vector2(0, 0);
    this.kit = createKit(512);
    this.atmosphere = new Atmosphere(this.scene, renderer.instance, sizes, quality);

    this.gate = new Gate(this.kit, { z: ROOM_Z.gate });
    this.answers = new Answers(this.kit, { z: ROOM_Z.answers, count: quality.bubbles });
    this.circuit = new Circuit(this.kit, { z: ROOM_Z.circuit, rain: quality.rain });
    this.vault = new Vault(this.kit, { z: ROOM_Z.vault });
    this.gallery = new Gallery(this.kit, { z: ROOM_Z.gallery });
    this.endGate = new Gate(this.kit, { z: ROOM_Z.end, withWalls: false, stones: false });

    // Each room is drawn only while the camera is between these two z values.
    this.rooms = [
      { room: this.gate, near: 80, far: -70 },
      { room: this.answers, near: 26, far: -132 },
      { room: this.circuit, near: -64, far: -198 },
      { room: this.vault, near: -176, far: -305 },
      { room: this.gallery, near: -250, far: -372 },
      { room: this.endGate, near: -296, far: -900 },
    ];
    this.rooms.forEach(({ room }) => { this.scene.add(room.group); });
    this.circuit.lights.forEach(([light]) => this.scene.add(light));

    window.addEventListener('pointermove', (e) => {
      this.mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    }, { passive: true });
  }

  /** Show only rooms near the camera, and keep the sun's shadow on the nearest one. */
  cull(z) {
    let best = null, bestD = 1e9;
    this.rooms.forEach(({ room, near, far }) => {
      room.group.visible = z < near && z > far;
      const d = Math.abs(room.group.position.z - z);
      if (d < bestD) { bestD = d; best = room; }
    });
    if (best) this.atmosphere.setFocus(best.group.position.z);
    const lit = this.circuit.group.visible;
    this.circuit.lights.forEach(([light, power]) => { light.intensity = lit ? power : 0; });
  }

  /** Prepares every room's shaders ahead of time, so walking in never stalls. */
  warm() {
    const shown = this.rooms.map(({ room }) => room.group.visible);
    this.rooms.forEach(({ room }) => { room.group.visible = true; });
    const r = this.exp.renderer.instance;
    r.setRenderTarget(this.exp.post.sceneRT);
    r.compile(this.scene, this.exp.camera.instance);
    r.setRenderTarget(null);
    this.rooms.forEach(({ room }, i) => { room.group.visible = shown[i]; });
  }

  update(elapsed, delta) {
    const cam = this.exp.camera.instance;
    this.atmosphere.update(elapsed, cam);
    const t = this.exp.reducedMotion ? 0 : elapsed;
    const dt = this.exp.reducedMotion ? 0 : delta;
    this.gate.update(t);
    if (this.answers.group.visible) this.answers.update(t, dt);
    if (this.circuit.group.visible) this.circuit.update(t, dt);
    if (this.vault.group.visible) this.vault.update(t, dt);
    this.endGate.update(t);
  }

  resize() { this.atmosphere.resize(this.exp.sizes); }
}
