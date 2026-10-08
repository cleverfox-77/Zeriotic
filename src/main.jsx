import './tailwind.css';
import './style.css';
import 'atropos/css';
import Atropos from 'atropos';
import Experience from './Experience.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.jsx';
import { initAllTelemetry } from './ui/telemetry.js';

/** Initialize Anime.js UI Telemetry (Accert One tachometer & OctaDezx voice waveforms) */
initAllTelemetry();

/** Mount Shadcn React UI */
const uiRoot = document.getElementById('react-ui-layer');
if (uiRoot) {
  createRoot(uiRoot).render(<App />);
}

/** Cookieless analytics — fires once per event name per page load. */
const _tracked = new Set();
function track(name, props) {
  if (_tracked.has(name)) return;
  _tracked.add(name);
  window.plausible?.trackEvent?.(name, { props });
}
window.__track = track;  // exposed for Scroll.js

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

/** Dynamic availability — auto-computes current + next quarter so it's never stale. */
(function setAvailability() {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const year = now.getFullYear();
  const current = `Q${q} ${year}`;
  const next = q === 4 ? `Q1 ${year + 1}` : `Q${q + 1} ${year}`;
  document.querySelectorAll('[data-availability]').forEach((el) => {
    el.textContent = `Available ${current} / ${next}`;
  });
})();

/** Contact form → the nodemailer API (server/index.js). Falls back to a plain
 *  mailto suggestion if the API is unreachable. */
(function contactForm() {
  const form = document.getElementById('enquiry');
  const status = document.getElementById('form-status');
  if (!form) return;
  form.addEventListener('focusin', () => track('contact_start'), { once: true });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn');
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name?.trim() || !/.+@.+\..+/.test(data.email || '') || !data.message?.trim()) {
      status.textContent = 'Please fill name, email and message.';
      return;
    }
    if (!data.type || !data.budget) {
      status.textContent = 'Please select a project type and budget range.';
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
      status.innerHTML = 'Sent — <a href="https://cal.com/zeriotic/discovery" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">book a discovery call →</a>';
      form.reset();
      track('contact_submit');
      setTimeout(() => { btn.disabled = false; btn.innerHTML = original; }, 6000);
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
  let timer = null;
  let visible = false;

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

  const tick = () => {
    if (!visible || document.hidden) return;
    idx = (idx + 1) % MESSAGES.length;
    render();
  };

  const start = () => { if (!timer) timer = setInterval(tick, 2600); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  const obs = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !document.hidden) start();
    else stop();
  }, { threshold: 0.1 });
  obs.observe(log);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });
})();

document.querySelectorAll('.hero__acts .btn').forEach((btn) => {
  btn.addEventListener('click', () => track('cta_hero', { label: btn.textContent.trim() }));
});
