import './style.css';
import './chapters.css';
import './preorder.js';
import { initArt } from './ui/art.js';

/** Cookieless analytics, once per event name per page load. */
const tracked = new Set();
function track(name, props) {
  if (tracked.has(name)) return;
  tracked.add(name);
  window.plausible?.trackEvent?.(name, { props });
}
window.__track = track;

initArt();

function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

function showChrome() {
  document.querySelectorAll('.chrome, .scroll-hint').forEach((el) => { el.style.opacity = '1'; });
}

function dropPreloader() {
  const p = document.getElementById('preloader');
  if (p) p.style.display = 'none';
  document.body.classList.remove('is-loading');
}

if (webglSupported() && document.getElementById('webgl')) {
  const boot = () => {
    import('./Experience.js')
      .then((m) => { window.experience = new m.default(document.getElementById('webgl')); })
      .catch(() => { dropPreloader(); document.documentElement.classList.add('no-webgl'); });
  };
  boot();
  showChrome();
} else {
  document.documentElement.classList.add('no-webgl');
  document.body.dataset.ink = 'ink';
  dropPreloader();
  document.getElementById('webgl-fallback')?.removeAttribute('aria-hidden');
  showChrome();
}

/** Keeps the availability line current. */
(function availability() {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const y = now.getFullYear();
  const next = q === 4 ? `Q1 ${y + 1}` : `Q${q + 1} ${y}`;
  document.querySelectorAll('[data-availability]').forEach((el) => {
    el.textContent = `Available Q${q} ${y} / ${next}`;
  });
})();

/** Contact form to the mail endpoint, falling back to plain email. */
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
      status.textContent = 'Please fill in name, email and message.';
      return;
    }
    if (!data.type || !data.budget) {
      status.textContent = 'Please select a project type and budget range.';
      return;
    }
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Sending';
    status.textContent = '';
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error('send failed');
      btn.textContent = 'Received';
      status.textContent = 'Message sent. We will reply within 24 hours.';
      form.reset();
      track('contact_submit');
      setTimeout(() => { btn.disabled = false; btn.innerHTML = original; }, 6000);
    } catch {
      btn.disabled = false;
      btn.innerHTML = original;
      status.textContent = 'Could not send. Please email hello@zeriotic.com directly.';
    }
  });
})();

import('./features/Cursor.js').then(({ initCursor }) => initCursor()).catch(() => {});
import('./utils/Sound.js').then(({ initSound }) => initSound()).catch(() => {});

/** Page transition cover for links to the project pages. */
(function pageCover() {
  const cover = document.getElementById('p-cover');
  if (!cover) return;
  const internal = (a) => {
    try {
      if ((a.getAttribute('href') || '').startsWith('#')) return false;
      const u = new URL(a.href, location.href);
      return u.origin === location.origin && (u.pathname.endsWith('.html') || /^\/(work|blog|compare|privacy)/.test(u.pathname));
    } catch { return false; }
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || !internal(a)) return;
    e.preventDefault();
    import('gsap').then(({ default: gsap }) => {
      gsap.timeline()
        .set(cover, { transformOrigin: 'bottom' })
        .to(cover, { scaleY: 1, duration: 0.45, ease: 'power3.inOut' })
        .add(() => { window.location.href = a.href; });
    }).catch(() => { window.location.href = a.href; });
  });
})();

/** Fullscreen menu. */
(function menu() {
  const toggle = document.querySelector('.js-menu-toggle');
  const panel = document.querySelector('.js-menu');
  if (!toggle || !panel) return;
  const set = (open) => {
    panel.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    panel.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    if (window.__lenis) { if (open) window.__lenis.stop(); else window.__lenis.start(); }
  };
  toggle.addEventListener('click', () => set(!panel.classList.contains('open')));
  panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
})();
