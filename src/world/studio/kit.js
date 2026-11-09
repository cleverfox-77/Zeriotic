import * as THREE from 'three';

/**
 * kit.js - shared building blocks for the studio world.
 * Everything is generated at load: no model files, no image files.
 */

// Layered soft noise on a canvas. Each octave is a tiny random image drawn
// upscaled and wrapped, so the result tiles without a visible seam.
export function noiseCanvas(size, octaves, contrast = 1, seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  octaves.forEach(([cells, alpha]) => {
    const t = document.createElement('canvas');
    t.width = t.height = cells;
    const tctx = t.getContext('2d');
    const img = tctx.createImageData(cells, cells);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (rnd() - 0.5) * 255 * contrast;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    ctx.globalAlpha = alpha;
    const step = size;
    for (let x = -step; x <= step; x += step) {
      for (let y = -step; y <= step; y += step) ctx.drawImage(t, x, y, step, step);
    }
  });
  ctx.globalAlpha = 1;
  return c;
}

function tex(canvas, repeat, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createKit(maxTexture = 512) {
  const size = Math.min(maxTexture, 1024);
  const coarse = noiseCanvas(size, [[6, 0.5], [14, 0.35], [40, 0.22], [120, 0.14]], 0.9, 3);
  const fine = noiseCanvas(size, [[60, 0.4], [180, 0.35], [360, 0.25]], 1, 7);

  // Lift the mottling towards white: plaster should read as a calm surface.
  const lift = coarse.getContext('2d');
  lift.globalAlpha = 0.82;
  lift.fillStyle = '#ffffff';
  lift.fillRect(0, 0, size, size);
  // A fine surface texture, painted in rather than computed per pixel.
  lift.globalCompositeOperation = 'multiply';
  lift.globalAlpha = 0.14;
  lift.drawImage(fine, 0, 0);
  lift.globalCompositeOperation = 'source-over';
  lift.globalAlpha = 1;

  // ExtrudeGeometry UVs are in world units, so these repeats are per metre.
  const mottle = tex(coarse, 0.09, true);

  // Walls are matte, so the cheapest lit material looks the same as the costly one.
  const plaster = new THREE.MeshLambertMaterial({ color: 0xf1e7da, map: mottle });
  const stone = new THREE.MeshLambertMaterial({ color: 0xd4c8b8, map: mottle });
  const graphite = new THREE.MeshLambertMaterial({ color: 0x1a1b1f, map: mottle });
  const steel = new THREE.MeshStandardMaterial({ color: 0x34363c, metalness: 0.92, roughness: 0.36 });
  const steelLight = new THREE.MeshStandardMaterial({ color: 0x70737b, metalness: 0.95, roughness: 0.28 });

  // Colours above 1.0 are what the bloom pass picks up.
  const glow = (r, g, b, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r * k, g * k, b * k), toneMapped: true, fog: false });
  const ember = glow(1.0, 0.2, 0.015, 1.25);
  const emberSoft = glow(1.0, 0.3, 0.04, 1.05);
  const white = glow(1, 0.93, 0.84, 1.9);

  return {
    plaster, stone, graphite, steel, steelLight, ember, emberSoft, white, glow,
  };
}

/** A wall in the XY plane, built from a shape, with any holes punched through it. */
export function wall(w, h, depth, holes = [], material) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  holes.forEach((p) => s.holes.push(p));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 48 });
  g.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function circleHole(cx, cy, r) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

/** Tall rounded-top opening, the arch used across the world. */
export function archHole(cx, baseY, w, h) {
  const r = w / 2;
  const p = new THREE.Path();
  p.moveTo(cx - r, baseY);
  p.lineTo(cx - r, baseY + h - r);
  p.absarc(cx, baseY + h - r, r, Math.PI, 0, true);
  p.lineTo(cx + r, baseY);
  p.closePath();
  return p;
}

export function slitHole(cx, baseY, w, h) {
  const p = new THREE.Path();
  p.moveTo(cx - w / 2, baseY);
  p.lineTo(cx - w / 2, baseY + h);
  p.lineTo(cx + w / 2, baseY + h);
  p.lineTo(cx + w / 2, baseY);
  p.closePath();
  return p;
}

/** A shadow-casting, shadow-receiving box. */
export function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A solid cylinder between two points. */
export function strut(a, b, radius, material, segments = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(radius, radius, dir.length(), segments);
  const m = new THREE.Mesh(g, material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/**
 * Canvas sign texture, used for the trackside boards. Only ever shows the
 * studio's own names.
 */
export function signTexture(text, { bg = '#120d0a', fg = '#ff5a12', w = 2048, h = 80 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `600 ${Math.round(h * 0.56)}px "Inter Tight", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tracked = text.split('').join(' ');
  const gap = w / 3;
  for (let i = 0; i < 3; i++) ctx.fillText(tracked, gap * (i + 0.5), h * 0.54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
