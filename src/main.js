import './style.css';
import 'atropos/css';
import Atropos from 'atropos';
import Experience from './Experience.js';

/**
 * Zeriotic — entry point.
 * One Experience instance owns the entire WebGL + scroll pipeline.
 */

/** Capability gate — some visitors (corporate machines, weak GPUs, locked-down
 *  browsers) can't run WebGL2. Rather than show them a blank canvas, we reveal
 *  the static poster fallback and let the page work as an ordinary scroll pitch. */
function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) {
    return false;
  }
}

if (webglSupported()) {
  window.experience = new Experience(document.getElementById('webgl'));
} else {
  document.documentElement.classList.add('no-webgl');
  const pre = document.getElementById('preloader');
  if (pre) pre.style.display = 'none';
  const fb = document.getElementById('webgl-fallback');
  if (fb) fb.removeAttribute('aria-hidden');
  // Scroll.js normally reveals the chrome; it never runs here, so reveal it now.
  document.querySelectorAll('.chrome, .scroll-hint').forEach((el) => { el.style.opacity = '1'; });
}

/** Atropos — 3D parallax tilt on the case-study devices. Pointer-only flourish;
 *  touch devices simply get the flat card. */
document.querySelectorAll('.atropos.case-tilt').forEach((el) => {
  Atropos({ el, activeOffset: 36, rotateXMax: 9, rotateYMax: 9, shadow: false, highlight: true });
});

/** Contact form → the nodemailer API (server/index.js). Falls back to a plain
 *  mailto suggestion if the API is unreachable. */
(function contactForm() {
  const form = document.getElementById('enquiry');
  const status = document.getElementById('form-status');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn');
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name?.trim() || !/.+@.+\..+/.test(data.email || '') || !data.message?.trim()) {
      status.textContent = 'Please fill name, email and message.';
      return;
    }
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Sending…';
    status.textContent = '';
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || 'send failed');
      btn.innerHTML = 'Received ✓';
      status.textContent = "Sent — we'll reply within 24 hours.";
      form.reset();
      setTimeout(() => { btn.disabled = false; btn.innerHTML = original; }, 4000);
    } catch {
      btn.disabled = false;
      btn.innerHTML = original;
      status.textContent = 'Could not send — email us directly at hello@zeriotic.com.';
    }
  });
})();

/** The OctaDezx case-study chat loops a tiny scripted conversation. Runs with
 *  or without WebGL — it's plain DOM. */
(function chatLoop() {
  const log = document.getElementById('octa-log');
  if (!log) return;
  const MESSAGES = [
    ['Do you ship to Berlin?', 'Yes — 3-day express via DHL, €12 flat.'],
    ['Any discount for 50+ units?', '20% on orders above 50 — I can draft the quote.'],
    ['Is the leather vegan?', 'Our Nova line uses plant-based leather. Full spec →'],
  ];
  let idx = 0;
  const render = () => {
    log.innerHTML = '';
    for (let i = 0; i <= idx; i++) {
      const [u, a] = MESSAGES[i];
      const q = document.createElement('div'); q.className = 'chat__u'; q.textContent = u;
      const r = document.createElement('div'); r.className = 'chat__a'; r.textContent = a;
      log.append(q, r);
    }
    const t = document.createElement('div'); t.className = 'chat__typing mono'; t.textContent = 'typing…';
    log.append(t);
  };
  render();
  setInterval(() => { idx = (idx + 1) % MESSAGES.length; render(); }, 2600);
})();
