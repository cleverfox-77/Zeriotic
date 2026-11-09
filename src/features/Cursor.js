/**
 * Cursor.js - circle + click-hold cursor (original implementation).
 * States: default circle, hover expand, hold ring, drag arrows.
 */
export function initCursor() {
  const isFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!isFine) return null;
  let wrap = document.querySelector('.js-cursor');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'cursor js-cursor';
    wrap.innerHTML = `<div class="cursor__wrap js-cursor-wrap">
      <div class="cursor__inner js-cursor-inner"><span class="cursor__circle js-cursor-circle"></span></div>
      <span class="cursor__hold"><span class="cursor__hold-inner js-cursor-hold-inner"></span></span>
      <span class="cursor__click-hold-prompt js-cursor-prompt"><span>Click &amp; Hold</span></span>
      <span class="cursor__drag js-cursor-drag"><svg viewBox="0 0 46 10" fill="none"><path d="M14.1 5.6H2.1L5.3 9.1 4.5 10 0 5l4.5-5 .8.9-3.2 3.5h12V5.6zM31 4.4h12L39.8.9 40.6 0 45.1 5 40.6 10l-.8-.9 3.2-3.5H31V4.4z" fill="#212121"/></svg></span>
      <span class="cursor__progress js-cursor-progress"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="39" fill="none" stroke="#EAEAEA"/><circle class="js-cursor-ring" cx="50" cy="50" r="39" fill="none" stroke="#212121" stroke-dasharray="245" stroke-dashoffset="245"/></svg></span>
    </div>`;
    document.body.appendChild(wrap);
  }
  document.body.classList.add('has-cursor');
  const inner = wrap.querySelector('.js-cursor-inner');
  const circle = wrap.querySelector('.js-cursor-circle');
  const holdInner = wrap.querySelector('.js-cursor-hold-inner');
  const prompt = wrap.querySelector('.js-cursor-prompt');
  const drag = wrap.querySelector('.js-cursor-drag');
  const progress = wrap.querySelector('.js-cursor-progress');
  const ring = wrap.querySelector('.js-cursor-ring');

  let x = -100, y = -100, tx = -100, ty = -100, scale = 1, tScale = 1, hold = 0, holding = false, downT = 0, isDrag = false;
  const HOLD_MS = 800;

  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });

  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    if (t.closest('a, button, [data-cursor], .menu__nav-item')) tScale = 1.9;
    else if (t.closest('.case, .client-card')) tScale = 2.4;
    else if (t.closest('canvas, #webgl')) tScale = 1.6;
    else tScale = 1;
    isDrag = !!t.closest('.world-intro, #hero');
  });
  document.addEventListener('pointerdown', () => { downT = performance.now(); holding = true; hold = 0; });
  document.addEventListener('pointerup', () => { holding = false; hold = 0; ring.style.strokeDashoffset = '245'; prompt.style.opacity = 0; });

  function tick() {
    x += (tx - x) * 0.18; y += (ty - y) * 0.18;
    scale += (tScale - scale) * 0.16;
    wrap.style.transform = `translate(${x - 56}px, ${y - 56}px)`;
    inner.style.transform = `scale(${scale})`;
    circle.style.transform = `scale(${scale})`;
    if (isDrag && !holding) { drag.style.opacity = 1; drag.style.transform = 'scale(1)'; }
    else { drag.style.opacity = 0; drag.style.transform = 'scale(.8)'; }

    if (holding) {
      hold = Math.min(performance.now() - downT, HOLD_MS);
      const k = hold / HOLD_MS;
      ring.style.strokeDashoffset = String(245 * (1 - k));
      prompt.style.opacity = k > 0.05 ? 1 : 0;
      holdInner.style.transform = `scale(${0.2 + k * 0.8})`;
      progress.style.opacity = 1; progress.style.transform = 'scale(1)';
    } else {
      progress.style.opacity = 0; progress.style.transform = 'scale(.8)';
      holdInner.style.transform = 'scale(0)';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return { destroy() { document.body.classList.remove('has-cursor'); wrap.remove(); } };
}
