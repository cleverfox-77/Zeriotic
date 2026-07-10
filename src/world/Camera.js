import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Camera.js — a single PerspectiveCamera plus a small "rig" abstraction.
 *
 * The scroll story writes into `rig.position` and `rig.target` (plain Vector3s);
 * every frame we lerp the real camera toward the rig so that even step changes
 * feel like a physically damped, stabilised rig rather than a hard cut.
 */
export default class Camera {
  constructor(experience) {
    this.exp = experience;
    const { sizes, scene } = experience;

    this.instance = new THREE.PerspectiveCamera(38, sizes.aspect, 0.1, 200);
    this.instance.position.set(0, 0.8, 13);
    scene.add(this.instance);

    // Rig = where we WANT the camera to be. Damped toward each frame.
    this.rig = {
      position: this.instance.position.clone(),
      target: new THREE.Vector3(0, 0.2, 0),
    };
    this._currentTarget = this.rig.target.clone();
    this._baseDamping = 0.055; // 0 = frozen, 1 = instant
    this.damping = this._baseDamping;
  }

  /** Returns true while still settling, so the loop knows to keep rendering. */
  update() {
    const cam = this.instance;
    const before = cam.position.distanceToSquared(this.rig.position)
                 + this._currentTarget.distanceToSquared(this.rig.target);

    cam.position.lerp(this.rig.position, this.damping);
    this._currentTarget.lerp(this.rig.target, this.damping);
    cam.lookAt(this._currentTarget);

    return before > 1e-6;     // still moving?
  }

  setDamping(value) { this.damping = value; }
  resetDamping() { this.damping = this._baseDamping; }

  /** Animate FOV for cinematic dolly-zoom. */
  animateFOV(target, duration = 1.5) {
    gsap.to(this.instance, {
      fov: target, duration, ease: 'power2.inOut',
      onUpdate: () => {
        this.instance.updateProjectionMatrix();
        this.exp.invalidate(2);
      },
    });
  }
  resetFOV(duration = 1.5) { this.animateFOV(38, duration); }

  resize() {
    this.instance.aspect = this.exp.sizes.aspect;
    this.instance.updateProjectionMatrix();
  }
}
