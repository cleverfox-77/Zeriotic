import * as THREE from 'three';
import { box, wall, circleHole, archHole, slitHole, strut, signTexture } from './kit.js';
import createCar from './Car.js';

/**
 * Rooms.js - one room per thing the studio makes. Each object means something:
 *   Gate     the studio mark at architectural scale, and the door you walk through
 *   Answers  customer messages passing a check before they reach anyone
 *   Circuit  the start of a race at dusk, lights out as you scroll
 *   Vault    layers of defence, probed, then opened
 *   Gallery  a quiet arcade for the client work
 */

const damp = (x) => THREE.MathUtils.clamp(x, 0, 1);
const ease = (x) => x * x * (3 - 2 * x);

/* ------------------------------------------------------------------ the gate */
export class Gate {
  constructor(kit, { z, facing = 1, withWalls = true, stones = true }) {
    this.group = new THREE.Group();
    this.group.position.z = z;
    if (facing < 0) this.group.rotation.y = Math.PI;
    const g = this.group;

    const R = 8;
    const cy = R + 1.4;
    g.add(wall(120, 40, 2.2, [circleHole(0, cy, R)], kit.plaster));

    // reveal ring: a thin deep lip that catches the light around the opening
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.06, 0.14, 12, 96), kit.stone);
    ring.position.set(0, cy, 1.15);
    g.add(ring);

    // the mark's square and diagonal, hung in the opening as a pivoting door
    this.door = new THREE.Group();
    this.door.position.set(0, cy, 0);
    const side = R * 1.02;
    const t = 0.42;
    const frame = new THREE.Group();
    [[0, side / 2, side + t, t], [0, -side / 2, side + t, t]].forEach(([x, y, w, h]) => {
      const m = box(w, h, 0.5, kit.ember);
      m.castShadow = true;
      m.position.set(x, y, 0);
      frame.add(m);
    });
    [[side / 2, 0, t, side], [-side / 2, 0, t, side]].forEach(([x, y, w, h]) => {
      const m = box(w, h, 0.5, kit.ember);
      m.position.set(x, y, 0);
      frame.add(m);
    });
    const diagLen = Math.hypot(side, side);
    const diag = box(diagLen, 0.72, 0.5, kit.emberSoft);
    diag.rotation.z = Math.PI / 4;
    frame.add(diag);
    this.door.add(frame);
    g.add(this.door);

    if (withWalls) {
      const slits = [];
      for (let i = -4; i <= 4; i++) slits.push(slitHole(i * 6.4, 2.2, 1.0, 20));
      [-1, 1].forEach((s) => {
        const w = wall(66, 30, 1.6, slits, kit.plaster);
        w.rotation.y = Math.PI / 2;
        w.position.set(s * 24, 0, 32);
        g.add(w);
      });
    }

    if (stones) {
      const geo = new THREE.CylinderGeometry(1, 1.06, 0.34, 24);
      const N = 11;
      const inst = new THREE.InstancedMesh(geo, kit.stone, N);
      const d = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        const k = i / (N - 1);
        d.position.set(Math.sin(k * 7.1) * 1.3, 0.1, 30 - k * 29);
        const s = 1.15 + (i % 3) * 0.24;
        d.scale.set(s, 1, s * 0.9);
        d.rotation.y = i * 1.7;
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
      }
      inst.castShadow = inst.receiveShadow = true;
      g.add(inst);
    }
  }

  /** 0 = closed, 1 = swung open edge-on so the way through is clear. */
  setOpen(p) { this.door.rotation.y = ease(damp(p)) * Math.PI * 0.5; }

  update(t) { this.door.position.y = 9.4 + Math.sin(t * 0.5) * 0.06; }
}

/* --------------------------------------------------------------- the answers */
export class Answers {
  constructor(kit, { z, count }) {
    this.group = new THREE.Group();
    this.group.position.z = z;
    const g = this.group;

    // the hall
    [-1, 1].forEach((s) => {
      const arches = [];
      for (let i = -2; i <= 2; i++) arches.push(archHole(i * 11, 0, 5.6, 14));
      const w = wall(64, 26, 1.6, arches, kit.plaster);
      w.rotation.y = Math.PI / 2;
      w.position.x = s * 26;
      g.add(w);
    });
    const back = wall(60, 26, 1.6, [archHole(0, 0, 7, 17)], kit.plaster);
    back.position.z = -30;
    g.add(back);

    // the check: an octahedron that every message has to pass through
    this.octa = new THREE.Group();
    this.octa.position.set(0, 6.4, -6);
    const R = 3.5;
    const geo = new THREE.OctahedronGeometry(R, 0);
    const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff4e6, transparent: true, opacity: 0.14, depthWrite: false, fog: false }));
    this.octa.add(shell);
    const edges = new THREE.EdgesGeometry(geo);
    const p = edges.attributes.position;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 2) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1);
      const s = strut(a, b, 0.065, kit.ember, 8);
      s.castShadow = false;
      this.octa.add(s);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), kit.white);
    this.octa.add(core);
    this.core = core;
    g.add(this.octa);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 0.5, 48), kit.stone);
    plinth.position.set(0, 0.25, -6);
    plinth.castShadow = plinth.receiveShadow = true;
    g.add(plinth);

    // speech bubbles
    const s = new THREE.Shape();
    const W = 1.0, H = 0.62, r = 0.26;
    s.moveTo(-W + r, -H);
    s.lineTo(-0.2, -H); s.lineTo(-0.5, -H - 0.3); s.lineTo(-0.46, -H);
    s.lineTo(W - r, -H);
    s.absarc(W - r, -H + r, r, -Math.PI / 2, 0);
    s.lineTo(W, H - r);
    s.absarc(W - r, H - r, r, 0, Math.PI / 2);
    s.lineTo(-W + r, H);
    s.absarc(-W + r, H - r, r, Math.PI / 2, Math.PI);
    s.lineTo(-W, -H + r);
    s.absarc(-W + r, -H + r, r, Math.PI, Math.PI * 1.5);
    const bubble = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 10 });
    bubble.center();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.bubbles = new THREE.InstancedMesh(bubble, mat, count);
    this.bubbles.castShadow = true;
    this.bubbles.frustumCulled = false;
    g.add(this.bubbles);

    this.specs = [];
    for (let i = 0; i < count; i++) {
      this.specs.push({
        u: Math.random(), speed: 0.018 + Math.random() * 0.016,
        y: 4.2 + Math.random() * 4.2, z: -6 + (Math.random() - 0.5) * 7,
        s: 0.62 + Math.random() * 0.5, wob: Math.random() * 6.28,
        bad: Math.random() < 0.14,
      });
    }
    this._d = new THREE.Object3D();
    this._c = new THREE.Color();
    this._in = new THREE.Color(0x868d9c);
    this._ok = new THREE.Color(0xff5a12);
    this._bad = new THREE.Color(0x24262c);
    this.setBubbleFrame(0);
  }

  setBubbleFrame(t, dt = 0) {
    const d = this._d, c = this._c;
    this.specs.forEach((b, i) => {
      b.u += b.speed * dt;
      if (b.u > 1) b.u -= 1;
      const x = -30 + b.u * 60;
      const toCentre = Math.abs(x) / 30;
      const pull = ease(1 - damp(toCentre * 1.8));
      let y = THREE.MathUtils.lerp(b.y, 6.4, pull) + Math.sin(t * 0.9 + b.wob) * 0.14;
      let z = THREE.MathUtils.lerp(b.z, -6, pull);
      let scale = b.s * (1 - pull * 0.45);
      let rotX = Math.sin(t * 0.7 + b.wob) * 0.08;
      if (x < 0) {
        c.copy(this._in);
      } else if (b.bad) {
        // rejected at the check: goes dark and drops into the water
        const fall = damp(x / 18);
        y = THREE.MathUtils.lerp(y, -0.8, ease(fall));
        rotX += fall * 2.2;
        scale *= 1 - fall * 0.5;
        c.copy(this._bad);
      } else {
        c.copy(this._ok).lerp(this._in, 0.0);
      }
      d.position.set(x, y, z);
      d.rotation.set(rotX, 0, Math.sin(t * 0.6 + b.wob) * 0.06);
      d.scale.setScalar(scale);
      d.updateMatrix();
      this.bubbles.setMatrixAt(i, d.matrix);
      this.bubbles.setColorAt(i, c);
    });
    this.bubbles.instanceMatrix.needsUpdate = true;
    if (this.bubbles.instanceColor) this.bubbles.instanceColor.needsUpdate = true;
  }

  update(t, dt) {
    this.octa.rotation.y = t * 0.16;
    this.octa.position.y = 6.4 + Math.sin(t * 0.6) * 0.14;
    this.core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.1);
    this.setBubbleFrame(t, dt);
  }
}

/* --------------------------------------------------------------- the circuit */
export class Circuit {
  constructor(kit, { z, rain }) {
    this.group = new THREE.Group();
    this.group.position.z = z;
    const g = this.group;

    // Everything below sits just above the water plane, which reads as wet tarmac here.
    const lineMat = new THREE.MeshLambertMaterial({ color: 0xe9e4da });
    const strip = (w, l, x, zz) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.012, zz);
      g.add(m);
    };
    const L = 240;
    strip(0.22, L, -7.6, -60);
    strip(0.22, L, 7.6, -60);

    // grid boxes
    for (let i = 0; i < 5; i++) {
      [-2.7, 2.7].forEach((x, s) => {
        const zz = 7 + i * 9 + s * 4.5;
        strip(3.6, 0.14, x, zz);
        strip(0.14, 1.1, x - 1.75, zz + 0.5);
        strip(0.14, 1.1, x + 1.75, zz + 0.5);
      });
    }

    // kerbs, red and white
    const kerbGeo = new THREE.BoxGeometry(0.9, 0.06, 2.2);
    const kerbRed = new THREE.MeshLambertMaterial({ color: 0xa81d18 });
    const kerbWhite = new THREE.MeshLambertMaterial({ color: 0xd9d4ca });
    const N = 90;
    const red = new THREE.InstancedMesh(kerbGeo, kerbRed, N);
    const white = new THREE.InstancedMesh(kerbGeo, kerbWhite, N);
    const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      [red, white].forEach((inst, k) => {
        d.position.set((i % 2 ? 1 : -1) * 8.3, 0.03, 40 - i * 2.2 * 2 - k * 2.2);
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
      });
    }
    g.add(red, white);

    // barriers with boards carrying the studio's own names
    const boardTex = [signTexture('ACCERT ONE'), signTexture('ZERIOTIC', { fg: '#f3ece2' })];
    [-1, 1].forEach((s, si) => {
      const b = box(0.5, 1.15, L, kit.graphite);
      b.position.set(s * 11.6, 0.58, -60);
      g.add(b);
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(26, 1.0),
          new THREE.MeshBasicMaterial({ map: boardTex[(i + si) % 2], color: new THREE.Color(1.1, 1.1, 1.1), fog: false }),
        );
        m.rotation.y = -s * Math.PI / 2;
        m.position.set(s * 11.33, 0.6, 26 - i * 30);
        g.add(m);
      }
    });

    // grandstands: dark blocks with a thin line of crowd lights
    const standMat = new THREE.MeshLambertMaterial({ color: 0x0f1014 });
    [-1, 1].forEach((s) => {
      for (let i = 0; i < 5; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(14, 11, 40), standMat);
        st.position.set(s * 24, 5.5, 18 - i * 46);
        g.add(st);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 38), kit.glow(1, 0.72, 0.42, 2.2));
        stripe.position.set(s * 16.96, 9.4, 18 - i * 46);
        g.add(stripe);
      }
    });

    // floodlights along the back straight
    const lampMat = kit.glow(1, 0.86, 0.62, 12);
    for (let i = 0; i < 12; i++) {
      [-1, 1].forEach((s) => {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), lampMat);
        lamp.position.set(s * 13.6, 11.5, 8 - i * 20);
        g.add(lamp);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 11.5, 6), kit.graphite);
        pole.position.set(s * 13.6, 5.75, 8 - i * 20);
        g.add(pole);
      });
    }

    // the start gantry: five pairs of red lights
    const gantryZ = -3;
    const beam = box(21, 1.0, 0.6, kit.graphite);
    beam.position.set(0, 6.8, gantryZ);
    g.add(beam);
    [-10.2, 10.2].forEach((x) => {
      const p = box(0.5, 7, 0.5, kit.graphite);
      p.position.set(x, 3.5, gantryZ);
      g.add(p);
    });
    this.lamps = [];
    this.lampOn = new THREE.Color(14, 0.5, 0.25);
    this.lampOff = new THREE.Color(0.14, 0.02, 0.02);
    for (let i = 0; i < 5; i++) {
      const pair = [];
      [0.2, -0.2].forEach((y) => {
        const m = new THREE.Mesh(
          new THREE.CircleGeometry(0.15, 18),
          new THREE.MeshBasicMaterial({ color: this.lampOff.clone() }),
        );
        m.position.set(-2.4 + i * 1.2, 6.8 + y, gantryZ + 0.32);
        g.add(m);
        pair.push(m);
      });
      this.lamps.push(pair);
    }

    // the car
    this.car = createCar();
    this.carHome = 12;
    this.car.position.set(-2.7, 0.012, this.carHome);
    g.add(this.car);

    // a low, warm light that picks the car out of the dusk
    this.key = new THREE.SpotLight(0xffb078, 90, 40, 0.55, 0.7, 1.4);
    this.key.position.set(5, 7, z + this.carHome + 6);
    this.key.target = this.car;
    this.rim = new THREE.PointLight(0xff6a2a, 55, 26, 1.6);
    this.rim.position.set(-5.5, 2.6, z + this.carHome - 7);
    // These two stay in the scene at all times: changing how many lights exist
    // would force every surface shader to be rebuilt when entering this room.
    this.lights = [[this.key, 90], [this.rim, 55]];

    // rain
    this.rainMesh = null;
    if (rain > 0) {
      const geo = new THREE.BoxGeometry(0.008, 0.7, 0.008);
      const mat = new THREE.MeshBasicMaterial({ color: 0xbfc9d6, transparent: true, opacity: 0.32, depthWrite: false, fog: false });
      this.rainMesh = new THREE.InstancedMesh(geo, mat, rain);
      this.rainMesh.frustumCulled = false;
      this.rainMesh.renderOrder = 4;
      this.drops = [];
      for (let i = 0; i < rain; i++) {
        this.drops.push({ x: (Math.random() - 0.5) * 36, y: Math.random() * 14, z: 40 - Math.random() * 44, v: 26 + Math.random() * 14 });
      }
      this.rainMesh.layers.set(1);
      g.add(this.rainMesh);
      this._d = new THREE.Object3D();
    }
    this.launch = 0;
  }

  /** p runs 0..1 across the "lights" stretch of the page: on one by one, then out. */
  setLights(p) {
    const lit = p * 6;
    const out = p >= 0.92;
    this.lamps.forEach((pair, i) => {
      const on = !out && lit > i + 0.6;
      pair.forEach((m) => m.material.color.copy(on ? this.lampOn : this.lampOff));
    });
  }

  /** 0..1, the car pulls away down the straight. */
  setLaunch(p) {
    this.launch = damp(p);
    const k = this.launch * this.launch;
    this.car.position.z = this.carHome - k * 135;
  }

  update(t, dt) {
    const v = 6 + this.launch * 60;
    this.car.userData.wheels.forEach((w) => { w.rotation.x -= v * dt * (this.launch > 0 ? 1 : 0); });
    if (this.rainMesh) {
      const d = this._d;
      this.drops.forEach((r, i) => {
        r.y -= r.v * dt;
        if (r.y < 0) r.y += 14;
        d.position.set(r.x, r.y, r.z);
        d.rotation.set(0.05, 0, 0.05);
        d.updateMatrix();
        this.rainMesh.setMatrixAt(i, d.matrix);
      });
      this.rainMesh.instanceMatrix.needsUpdate = true;
    }
  }
}

/* ----------------------------------------------------------------- the vault */
export class Vault {
  constructor(kit, { z }) {
    this.group = new THREE.Group();
    this.group.position.z = z;
    const g = this.group;
    const R = 11;
    const cy = R + 0.9;
    this.cy = cy;

    g.add(wall(120, 48, 3.5, [circleHole(0, cy, R)], kit.graphite));

    const collar = new THREE.Mesh(new THREE.TorusGeometry(R + 0.35, 0.6, 18, 128), kit.steel);
    collar.position.set(0, cy, 1.9);
    collar.castShadow = true;
    g.add(collar);

    // door: pivots on its right-hand edge
    this.hinge = new THREE.Group();
    this.hinge.position.set(R, cy, 0.6);
    g.add(this.hinge);
    this.door = new THREE.Group();
    this.door.position.x = -R;
    this.hinge.add(this.door);

    const slab = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 2.0, 96), kit.steel);
    slab.rotation.x = Math.PI / 2;
    slab.castShadow = slab.receiveShadow = true;
    this.door.add(slab);

    // the rings are the layers of defence, each one turns on its own
    this.rings = [];
    [[9.3, 0.42], [7.0, 0.36], [4.9, 0.32]].forEach(([r, t], i) => {
      const ring = new THREE.Group();
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, t, 14, 112), i === 1 ? kit.steelLight : kit.steel);
      band.position.z = 1.1;
      band.castShadow = true;
      ring.add(band);
      const teeth = 24 - i * 6;
      const geo = new THREE.BoxGeometry(0.42, 0.9, 0.5);
      const inst = new THREE.InstancedMesh(geo, kit.steelLight, teeth);
      const d = new THREE.Object3D();
      for (let k = 0; k < teeth; k++) {
        const a = (k / teeth) * Math.PI * 2;
        d.position.set(Math.cos(a) * r, Math.sin(a) * r, 1.42);
        d.rotation.z = a - Math.PI / 2;
        d.updateMatrix();
        inst.setMatrixAt(k, d.matrix);
      }
      ring.add(inst);
      this.door.add(ring);
      this.rings.push(ring);
    });

    // locking bolts: pull back as the door is cleared to open
    const boltN = 16;
    this.bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 2.6, 16), kit.steelLight, boltN);
    this.boltN = boltN;
    this.boltR = R - 0.1;
    this.bolts.castShadow = true;
    this.door.add(this.bolts);
    this._d = new THREE.Object3D();
    this.setBolts(1);

    // the wheel
    this.wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.2, 14, 72), kit.steelLight);
    this.wheel.add(rim);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 2.3, Math.sin(a) * 2.3, 0), 0.13, kit.steelLight, 10);
      this.wheel.add(b);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 32), kit.steel);
    hub.rotation.x = Math.PI / 2;
    this.wheel.add(hub);
    this.wheel.position.z = 1.75;
    this.door.add(this.wheel);

    // status ring: ember while locked
    this.statusMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.1, 0.12) });
    const status = new THREE.Mesh(new THREE.TorusGeometry(R - 0.42, 0.05, 8, 160), this.statusMat);
    status.position.z = 1.15;
    this.door.add(status);

    this.door.position.y = 0;

    // probing beams: an attacker feeling for a way in
    this.beams = [];
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 0.5, 0.2), transparent: true, opacity: 0.8, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), beamMat);
      b.frustumCulled = false;
      g.add(b);
      this.beams.push({ b, phase: i * 2.1 });
    }

    // side columns give the dark room some depth
    for (let i = 0; i < 4; i++) {
      [-1, 1].forEach((s) => {
        const c = box(2.4, 34, 2.4, kit.graphite);
        c.position.set(s * 21, 17, 10 + i * 14);
        g.add(c);
      });
    }
    this.opened = 0;
  }

  setBolts(p) {
    const d = this._d;
    for (let i = 0; i < this.boltN; i++) {
      const a = (i / this.boltN) * Math.PI * 2 + 0.2;
      const r = this.boltR - (1 - p) * 2.2;
      d.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      d.rotation.set(0, 0, a - Math.PI / 2);
      d.updateMatrix();
      this.bolts.setMatrixAt(i, d.matrix);
    }
    this.bolts.instanceMatrix.needsUpdate = true;
  }

  /** Scroll across the section: the rings turn; near the end the door opens. */
  setProgress(p) {
    this.rings[0].rotation.z = p * 2.6;
    this.rings[1].rotation.z = -p * 3.6;
    this.rings[2].rotation.z = p * 5.0;
    this.wheel.rotation.z = -p * 8.5;
    const unlock = damp((p - 0.72) / 0.14);
    const swing = damp((p - 0.84) / 0.16);
    this.setBolts(1 - unlock);
    this.hinge.rotation.y = ease(swing) * Math.PI * 0.62;
    this.statusMat.color.setRGB(5 - unlock * 4.4, 1.1 + unlock * 2.6, 0.12 + unlock * 1.6);
    this.opened = swing;
  }

  update(t) {
    const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    this.beams.forEach(({ b, phase }) => {
      const a = t * 0.4 + phase;
      from.set(-20 + phase * 4, 3 + phase * 3, 30);
      to.set(Math.cos(a * 0.9) * 8.5, this.cy + Math.sin(a * 1.3) * 8.5, 2.1);
      dir.subVectors(to, from);
      const len = dir.length();
      b.position.copy(from).addScaledVector(dir, 0.5);
      b.scale.set(1, len, 1);
      b.quaternion.setFromUnitVectors(up, dir.normalize());
      b.visible = this.opened < 0.05;
    });
  }
}

/* --------------------------------------------------------------- the gallery */
export class Gallery {
  constructor(kit, { z }) {
    this.group = new THREE.Group();
    this.group.position.z = z;
    [-1, 1].forEach((s) => {
      const arches = [];
      for (let i = -3; i <= 3; i++) arches.push(archHole(i * 12, 0, 7, 18));
      const w = wall(88, 30, 1.6, arches, kit.plaster);
      w.rotation.y = Math.PI / 2;
      w.position.x = s * 17;
      this.group.add(w);
    });
  }
}
