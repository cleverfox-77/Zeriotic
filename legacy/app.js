/* ============================================================ */
/*  ZERIOTIC — interactions                                     */
/* ============================================================ */

/* -------- Tweaks state (persisted via EDITMODE) -------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "cyan",
  "shape": "stack"
}/*EDITMODE-END*/;

const tweaks = { ...TWEAK_DEFAULTS };
function applyTweaks(){
  document.documentElement.setAttribute("data-theme", tweaks.theme);
  document.documentElement.setAttribute("data-accent", tweaks.accent);
  document.documentElement.setAttribute("data-shape", tweaks.shape);
  document.querySelectorAll(".tw-seg").forEach(seg => {
    const key = seg.getAttribute("data-key");
    seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.val === tweaks[key]));
  });
}
applyTweaks();

/* -------- Loader -------- */
(function loader(){
  const el = document.getElementById("loader");
  const bar = document.getElementById("loader-bar-fill");
  const pct = document.getElementById("loader-pct");
  const stat = document.getElementById("loader-status");
  const states = ["INITIALISING", "LOADING SHADERS", "COMPOSING GRID", "READY"];
  let p = 0;
  const tick = () => {
    p = Math.min(100, p + 3 + Math.random() * 8);
    bar.style.right = (100 - p) + "%";
    pct.textContent = String(Math.floor(p)).padStart(3, "0");
    stat.textContent = states[Math.min(states.length - 1, Math.floor(p / 30))];
    if (p < 100) setTimeout(tick, 60 + Math.random()*80);
    else setTimeout(() => { el.classList.add("done"); kickHeroReveal(); }, 280);
  };
  setTimeout(tick, 200);
})();

/* -------- Hero word reveal -------- */
function kickHeroReveal(){
  const words = document.querySelectorAll("#hero .reveal-word");
  words.forEach((w, i) => {
    w.style.setProperty("--d", (0.05 + i * 0.08) + "s");
    requestAnimationFrame(() => w.classList.add("on"));
  });
  document.querySelectorAll("#hero .reveal").forEach((el, i) => {
    setTimeout(() => el.classList.add("on"), 600 + i * 120);
  });
}

/* -------- Reveal on scroll -------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const target = e.target;
    if (target.classList.contains("reveal")) target.classList.add("on");
    if (target.classList.contains("reveal-word")) {
      // stagger among siblings within same parent
      const parent = target.closest(".section-head, .hero-title, .section-title");
      if (parent) {
        parent.querySelectorAll(".reveal-word").forEach((w, i) => {
          w.style.setProperty("--d", (i * 0.08) + "s");
          w.classList.add("on");
        });
      } else {
        target.classList.add("on");
      }
    }
    io.unobserve(target);
  });
}, { threshold: 0.2 });
document.querySelectorAll(".reveal, .reveal-word").forEach(el => {
  if (el.closest("#hero")) return;
  io.observe(el);
});

/* -------- Custom cursor + magnetic buttons -------- */
(function cursor(){
  const c = document.getElementById("cursor");
  const label = document.getElementById("cursor-label");
  const dot = document.getElementById("cursor-dot");
  let tx = 0, ty = 0, cx = 0, cy = 0, dx = 0, dy = 0;
  const touch = matchMedia("(hover: none)").matches;
  if (touch) return;
  window.addEventListener("mousemove", e => { tx = e.clientX; ty = e.clientY; dx = e.clientX; dy = e.clientY; });
  function loop(){
    cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
    c.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    dot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  const targets = "a, button, [data-cursor], .magnetic, .svc, .tech-cell, .case, .voice, .team-member, .proc-step, .stat";
  document.addEventListener("mouseover", e => {
    const t = e.target.closest(targets);
    if (!t) return;
    c.classList.add("hover");
    label.textContent = t.getAttribute("data-cursor") || "";
  });
  document.addEventListener("mouseout", e => {
    if (!e.target.closest(targets)) return;
    c.classList.remove("hover");
    label.textContent = "";
  });
})();

/* -------- Magnetic buttons -------- */
document.querySelectorAll(".magnetic").forEach(el => {
  let rect;
  el.addEventListener("mouseenter", () => { rect = el.getBoundingClientRect(); });
  el.addEventListener("mousemove", e => {
    if (!rect) rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width/2;
    const my = e.clientY - rect.top - rect.height/2;
    el.style.transform = `translate(${mx*0.25}px, ${my*0.4}px)`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "";
    rect = null;
  });
});

/* -------- Scroll-driven 3D scene -------- */
(function scene(){
  const scene = document.getElementById("scene");
  if (!scene) return;
  const plates = [...scene.querySelectorAll(".scene-plate")];
  const rings  = [...scene.querySelectorAll(".scene-ring")];
  let mx = 0.5, my = 0.5;
  window.addEventListener("mousemove", e => {
    mx = e.clientX / window.innerWidth;
    my = e.clientY / window.innerHeight;
  }, { passive: true });

  function render(){
    const sy = window.scrollY;
    const progress = Math.min(1, sy / (window.innerHeight * 1.2));
    const rotX = -12 + (my - 0.5) * -18 + progress * -30;
    const rotY = 18 + (mx - 0.5) * 26 + progress * 20;

    plates.forEach((p, i) => {
      const z = -240 + i * 60;
      const scale = 1 - i * 0.04 + progress * 0.12;
      const pRotY = rotY + (i - 2.5) * 4 + progress * 10 * (i + 1) * 0.3;
      const pRotX = rotX + i * 2;
      const offsetY = progress * (-40 - i * 12);
      p.style.transform = `translate3d(${(i-2.5) * 8}px, ${offsetY}px, ${z}px) rotateX(${pRotX}deg) rotateY(${pRotY}deg) scale(${scale})`;
      p.style.opacity = String(Math.max(0.3, 1 - i * 0.12));
    });

    rings.forEach((r, i) => {
      const spin = sy * 0.05 + (i ? -progress * 120 : progress * 120);
      r.style.transform = `rotateX(${70 + progress * -10}deg) rotateZ(${spin}deg)`;
    });

    requestAnimationFrame(render);
  }
  render();
})();

/* -------- Stat counters -------- */
(function stats(){
  const counters = document.querySelectorAll(".count");
  const obs = new IntersectionObserver((es) => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const to = parseFloat(el.dataset.to);
      const dur = 1400;
      const t0 = performance.now();
      function step(now){
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.floor(to * eased)).padStart(2, "0");
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => obs.observe(c));
})();

/* -------- Tweaks panel wiring (host) -------- */
(function tweaksUI(){
  const panel = document.getElementById("tweaks");
  const close = document.getElementById("tweaks-close");

  window.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.type === "__activate_edit_mode") panel.classList.remove("hidden");
    if (d.type === "__deactivate_edit_mode") panel.classList.add("hidden");
  });
  try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch {}

  close?.addEventListener("click", () => panel.classList.add("hidden"));

  panel.querySelectorAll(".tw-seg").forEach(seg => {
    const key = seg.getAttribute("data-key");
    seg.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        tweaks[key] = btn.dataset.val;
        applyTweaks();
        try {
          window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: btn.dataset.val } }, "*");
        } catch {}
      });
    });
  });
})();
