import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Car.js - a stylised single-seater, sculpted here in code for this page only.
 * It is an original display model and shares nothing with the game's assets.
 * Nose points to -Z.
 */

/** Skin a closed surface over a list of cross sections along Z. */
function loft(sections, segs = 28, xOffset = 0) {
  const pos = [];
  const idx = [];
  const ring = (s) => {
    const out = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const c = Math.cos(a), si = Math.sin(a);
      const e = 2 / (s.p || 3.2);
      const x = Math.sign(c) * Math.pow(Math.abs(c), e) * s.w;
      const y = Math.sign(si) * Math.pow(Math.abs(si), e) * s.h;
      out.push([x + xOffset + (s.x || 0), y + s.y, s.z]);
    }
    return out;
  };
  sections.forEach((s) => ring(s).forEach((v) => pos.push(...v)));
  for (let r = 0; r < sections.length - 1; r++) {
    for (let i = 0; i < segs; i++) {
      const a = r * segs + i, b = r * segs + ((i + 1) % segs);
      const c = (r + 1) * segs + i, d = (r + 1) * segs + ((i + 1) % segs);
      idx.push(a, c, b, b, c, d);
    }
  }
  const capCenter = (k, flip) => {
    const s = sections[k];
    const at = pos.length / 3;
    pos.push((s.x || 0) + xOffset, s.y, s.z);
    for (let i = 0; i < segs; i++) {
      const a = k * segs + i, b = k * segs + ((i + 1) % segs);
      if (flip) idx.push(at, b, a); else idx.push(at, a, b);
    }
  };
  capCenter(0, false);
  capCenter(sections.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function plate(w, thick, chord, x, y, z, pitch = 0) {
  const g = new THREE.BoxGeometry(w, thick, chord);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  g.applyMatrix4(m);
  return g;
}

function bar(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = new THREE.Vector3().subVectors(B, A);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 8);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().addScaledVector(d, 0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

function wheelGeometries(radius, width) {
  // tyre: a rounded profile turned around the axle
  const hw = width / 2;
  const inner = radius * 0.62;
  const pts = [
    [inner, -hw + 0.01], [radius * 0.9, -hw], [radius * 0.985, -hw + 0.05], [radius, -hw * 0.5],
    [radius, hw * 0.5], [radius * 0.985, hw - 0.05], [radius * 0.9, hw], [inner, hw - 0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tyre = new THREE.LatheGeometry(pts, 40);
  tyre.rotateZ(Math.PI / 2);

  const rim = new THREE.CylinderGeometry(inner, inner * 0.92, width * 0.86, 28);
  rim.rotateZ(Math.PI / 2);

  const stripe = new THREE.TorusGeometry(radius * 0.74, radius * 0.018, 6, 48);
  stripe.rotateY(Math.PI / 2);
  stripe.translate(hw + 0.002, 0, 0);
  const stripeIn = stripe.clone();
  stripeIn.translate(-width - 0.004, 0, 0);

  return { tyre, rim, stripe: merge([stripe, stripeIn]) };
}

export default function createCar() {
  const group = new THREE.Group();

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x8c1016, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.07,
  });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xcf9a3e, metalness: 1, roughness: 0.26, clearcoat: 0.6 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.46, metalness: 0.35 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.4, metalness: 0.85 });
  const helmetMat = new THREE.MeshPhysicalMaterial({ color: 0xf0ebe2, roughness: 0.25, clearcoat: 1 });

  // ---- bodywork (built nose towards +Z, the whole car is turned at the end) ----
  const body = loft([
    { z: -2.34, w: 0.1, h: 0.07, y: 0.5, p: 2.4 },
    { z: -1.7, w: 0.24, h: 0.2, y: 0.53, p: 2.6 },
    { z: -1.0, w: 0.31, h: 0.36, y: 0.58, p: 2.8 },
    { z: -0.3, w: 0.36, h: 0.44, y: 0.6, p: 3 },
    { z: 0.2, w: 0.37, h: 0.38, y: 0.55, p: 3.2 },
    { z: 0.8, w: 0.33, h: 0.24, y: 0.42, p: 3.2 },
    { z: 1.45, w: 0.22, h: 0.15, y: 0.34, p: 2.8 },
    { z: 2.15, w: 0.14, h: 0.09, y: 0.26, p: 2.4 },
    { z: 2.82, w: 0.08, h: 0.05, y: 0.2, p: 2.2 },
  ]);
  const sidepod = (side) => loft([
    { z: -1.55, w: 0.06, h: 0.07, y: 0.32, x: side * 0.44, p: 2.2 },
    { z: -0.95, w: 0.26, h: 0.16, y: 0.36, x: side * 0.6, p: 3 },
    { z: -0.25, w: 0.31, h: 0.24, y: 0.4, x: side * 0.68, p: 3.6 },
    { z: 0.42, w: 0.3, h: 0.25, y: 0.42, x: side * 0.68, p: 4 },
    { z: 0.9, w: 0.24, h: 0.17, y: 0.44, x: side * 0.66, p: 4 },
  ]);
  group.add(mesh(merge([body, sidepod(1), sidepod(-1)]), paint));

  // nose stripe and engine cover fin in gold
  const spine = loft([
    { z: -2.0, w: 0.015, h: 0.03, y: 0.78, p: 2 },
    { z: -1.0, w: 0.02, h: 0.1, y: 0.94, p: 2 },
    { z: -0.2, w: 0.022, h: 0.08, y: 1.02, p: 2 },
    { z: 0.2, w: 0.02, h: 0.03, y: 0.94, p: 2 },
  ], 12);
  const nose = loft([
    { z: 0.95, w: 0.1, h: 0.012, y: 0.66, p: 2 },
    { z: 1.5, w: 0.09, h: 0.01, y: 0.49, p: 2 },
    { z: 2.2, w: 0.06, h: 0.01, y: 0.355, p: 2 },
    { z: 2.84, w: 0.03, h: 0.008, y: 0.255, p: 2 },
  ], 10);
  group.add(mesh(merge([spine, nose]), gold));

  // ---- aero, floor and suspension ----
  const aero = [];
  aero.push(plate(1.62, 0.03, 3.3, 0, 0.09, -0.32));
  // front wing, three stacked planes
  aero.push(plate(2.0, 0.022, 0.34, 0, 0.13, 2.9, -0.06));
  aero.push(plate(1.86, 0.018, 0.2, 0, 0.2, 2.72, -0.36));
  aero.push(plate(1.74, 0.016, 0.16, 0, 0.28, 2.6, -0.62));
  aero.push(plate(0.02, 0.26, 0.62, 1.0, 0.2, 2.78));
  aero.push(plate(0.02, 0.26, 0.62, -1.0, 0.2, 2.78));
  // rear wing
  aero.push(plate(1.12, 0.03, 0.34, 0, 1.0, -2.38, 0.14));
  aero.push(plate(1.12, 0.022, 0.18, 0, 1.11, -2.56, 0.5));
  aero.push(plate(0.024, 0.62, 0.62, 0.57, 0.86, -2.4));
  aero.push(plate(0.024, 0.62, 0.62, -0.57, 0.86, -2.4));
  aero.push(plate(1.14, 0.024, 0.24, 0, 0.52, -2.5, 0.2));
  aero.push(plate(0.05, 0.42, 0.1, 0.08, 0.76, -2.24));
  aero.push(plate(0.05, 0.42, 0.1, -0.08, 0.76, -2.24));
  // diffuser
  for (let i = -3; i <= 3; i++) aero.push(plate(0.012, 0.18, 0.5, i * 0.13, 0.16, -2.12, -0.3));
  // airbox and mirrors
  aero.push(loft([
    { z: -0.2, w: 0.08, h: 0.08, y: 1.02, p: 3 },
    { z: 0.14, w: 0.13, h: 0.13, y: 1.04, p: 3 },
    { z: 0.2, w: 0.13, h: 0.13, y: 1.04, p: 3 },
  ], 14));
  aero.push(plate(0.2, 0.05, 0.09, 0.56, 0.74, 0.9));
  aero.push(plate(0.2, 0.05, 0.09, -0.56, 0.74, 0.9));
  aero.push(bar([0.3, 0.6, 0.86], [0.5, 0.73, 0.9], 0.012));
  aero.push(bar([-0.3, 0.6, 0.86], [-0.5, 0.73, 0.9], 0.012));
  // suspension arms
  const arms = [[1, 1.72], [-1, 1.72], [1, -1.72], [-1, -1.72]];
  arms.forEach(([s, z]) => {
    const hx = s * 0.68;
    aero.push(bar([hx, 0.46, z], [s * 0.26, 0.42, z + 0.34], 0.016));
    aero.push(bar([hx, 0.46, z], [s * 0.26, 0.42, z - 0.34], 0.016));
    aero.push(bar([hx, 0.26, z], [s * 0.26, 0.22, z + 0.34], 0.016));
    aero.push(bar([hx, 0.26, z], [s * 0.26, 0.22, z - 0.34], 0.016));
  });
  group.add(mesh(merge(aero), carbon));

  // ---- halo ----
  const haloPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.3, 0.78, -0.02),
    new THREE.Vector3(-0.3, 0.94, 0.3),
    new THREE.Vector3(-0.16, 1.0, 0.68),
    new THREE.Vector3(0, 1.015, 0.78),
    new THREE.Vector3(0.16, 1.0, 0.68),
    new THREE.Vector3(0.3, 0.94, 0.3),
    new THREE.Vector3(0.3, 0.78, -0.02),
  ]);
  const halo = new THREE.TubeGeometry(haloPath, 40, 0.03, 10, false);
  const pylon = bar([0, 0.99, 0.78], [0, 0.6, 0.98], 0.034);
  group.add(mesh(merge([halo, pylon]), gold));

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 18), helmetMat);
  helmet.position.set(0, 0.88, 0.34);
  helmet.scale.set(1, 1, 1.15);
  helmet.castShadow = true;
  group.add(helmet);

  // ---- wheels ----
  this_wheels(group, tyreMat, rimMat, gold);

  // ---- rain light, the one thing that glows ----
  const light = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.05, 0.02),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.4, 0.3) }),
  );
  light.position.set(0, 0.5, -2.62);
  group.add(light);
  group.userData.tail = light;

  group.rotation.y = Math.PI;
  return group;
}

function this_wheels(group, tyreMat, rimMat, gold) {
  const wheels = [];
  const front = wheelGeometries(0.36, 0.31);
  const rear = wheelGeometries(0.365, 0.42);
  [[0.86, 1.72, front], [-0.86, 1.72, front], [0.86, -1.72, rear], [-0.86, -1.72, rear]].forEach(([x, z, geo]) => {
    const w = new THREE.Group();
    const t = mesh(geo.tyre, tyreMat);
    const r = mesh(geo.rim, rimMat);
    const s = mesh(geo.stripe, gold);
    w.add(t, r, s);
    w.position.set(x, 0.365, z);
    group.add(w);
    wheels.push(w);
  });
  group.userData.wheels = wheels;
}

function mesh(g, m) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

/** Merge pieces that came from different primitives, keeping only what they share. */
function merge(list) {
  list.forEach((g) => { g.deleteAttribute('uv'); });
  return mergeGeometries(list);
}
