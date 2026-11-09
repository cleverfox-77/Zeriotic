/**
 * art.js - cover art for the client project cards, painted on load.
 * Each one is drawn from what the project is about, not a stock image.
 */

const painters = {
  /** Variant3D: rows of knit stitches. */
  knit(ctx, w, h) {
    ctx.fillStyle = '#E9DFD2';
    ctx.fillRect(0, 0, w, h);
    const sw = w / 26, sh = sw * 0.72;
    for (let row = -1; row < h / sh + 2; row++) {
      for (let col = -1; col < w / sw + 2; col++) {
        const x = col * sw, y = row * sh + (Math.sin(col * 0.5 + row * 0.2) * sh * 0.1);
        const band = Math.sin(row * 0.32 + col * 0.09);
        ctx.strokeStyle = band > 0.35 ? '#FF5A12' : band > -0.3 ? '#B9AC9B' : '#2A2622';
        ctx.lineCap = 'round';
        ctx.lineWidth = sw * 0.3;
        ctx.beginPath();
        ctx.moveTo(x + sw * 0.1, y);
        ctx.quadraticCurveTo(x + sw * 0.28, y + sh * 0.95, x + sw * 0.5, y + sh * 1.2);
        ctx.quadraticCurveTo(x + sw * 0.72, y + sh * 0.95, x + sw * 0.9, y);
        ctx.stroke();
      }
    }
  },

  /** Mira: a field of signal lines bending around a point. */
  signal(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#15161C');
    g.addColorStop(1, '#2A1A14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.62, cy = h * 0.46;
    ctx.lineWidth = Math.max(1, w / 720);
    for (let i = 0; i < 62; i++) {
      const k = i / 61;
      ctx.strokeStyle = `rgba(255, ${Math.round(120 + 110 * k)}, ${Math.round(40 + 150 * k)}, ${0.2 + 0.6 * k})`;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const base = h * (k * 1.3 - 0.15);
        const dx = x - cx, dy = base - cy;
        const d = Math.sqrt(dx * dx + dy * dy) + 1;
        const y = base + Math.sin(x * 0.012 + i * 0.3) * h * 0.02 + (dy / d) * Math.exp(-d / (h * 0.3)) * h * 0.26;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },

  /** Melem Tokyo: a poster on a city grid. */
  poster(ctx, w, h) {
    ctx.fillStyle = '#F2EAE0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(33,33,33,.13)';
    ctx.lineWidth = 1;
    const step = w / 14;
    for (let x = step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = '#E2361A';
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.42, h * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#17161A';
    ctx.font = `${Math.round(h * 0.34)}px "Inter Tight", Arial, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Melem', w * 0.06, h * 0.86);
    ctx.font = `500 ${Math.round(h * 0.038)}px "Inter Tight", Arial, sans-serif`;
    ctx.fillText('TOKYO', w * 0.07, h * 0.93);
  },
};

function paint(canvas) {
  const fn = painters[canvas.dataset.art];
  if (!fn) return;
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, Math.round(r.width * dpr));
  const h = Math.max(200, Math.round(r.height * dpr));
  canvas.width = w;
  canvas.height = h;
  fn(canvas.getContext('2d'), w, h);
}

export function initArt() {
  const all = () => document.querySelectorAll('canvas[data-art]').forEach(paint);
  all();
  document.fonts?.ready.then(all);
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(all, 200); }, { passive: true });
}
