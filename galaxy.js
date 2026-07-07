/* ============================================================
   ZERIOTIC — Hero galaxy
   WebGL · Three.js · GSAP

   A fully procedural spiral galaxy (Andromeda / Milky-Way feel)
   built from ~55k GPU particles. Stars spiral out along curved
   branches; colour lerps from a warm core to the live `--accent`
   CSS var on the rim, so the galaxy recolours with the site
   theme. A custom shader gives every star a soft point-glow plus
   a gentle twinkle. The whole disk is tilted, slowly rotating,
   and reacts to pointer (parallax) and scroll (it tips toward
   edge-on and spins up — choreographed with GSAP ScrollTrigger).
   A bright additive core sprite sells the galactic bulge and a
   far, drifting starfield backdrops the scene.
   ============================================================ */
import * as THREE from 'three';

const canvas = document.getElementById('planetCanvas');
const stage  = document.getElementById('heroStage');
const gsap   = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small  = matchMedia('(max-width: 720px)').matches;

if (canvas && stage) boot();

/* ---- helpers ------------------------------------------------ */
function readAccent(){
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return new THREE.Color(v || '#5de4ff');
}
function stageSize(){
  const r = stage.getBoundingClientRect();
  return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
}
/* soft round sprite so backdrop stars are dots, not squares */
function discTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0,    'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1,    'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* wide soft halo for the galactic core bulge */
function glowTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0,    'rgba(255,255,255,0.95)');
  grd.addColorStop(0.18, 'rgba(255,246,225,0.65)');
  grd.addColorStop(0.45, 'rgba(255,228,190,0.22)');
  grd.addColorStop(1,    'rgba(255,228,190,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boot(){
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
  } catch (err){
    // No WebGL — the CSS radial glow behind the canvas is the fallback.
    console.warn('[galaxy] WebGL unavailable — CSS fallback in use.', err);
    return;
  }

  const { w, h } = stageSize();
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
  camera.position.set(0, 2.1, 7.4);

  // the disk + core + bulge live in one tilted group
  const galaxy = new THREE.Group();
  galaxy.rotation.x = 0.62;     // viewing tilt (Andromeda-like)
  galaxy.rotation.z = 0.10;
  scene.add(galaxy);

  let accent = readAccent();
  const INSIDE = new THREE.Color('#ffd2a1');   // warm core

  /* ---- the spiral disk (custom-shader points) ---------------- */
  const COUNT    = small ? 18000 : 55000;
  const RADIUS   = 6.2;
  const BRANCHES = 4;
  const SPIN     = 1.15;
  const RANDOM   = 0.46;
  const POWER    = 2.6;

  const positions = new Float32Array(COUNT * 3);
  const aMix      = new Float32Array(COUNT);   // 0 core … 1 rim → colour lerp
  const aScale    = new Float32Array(COUNT);   // per-star size jitter
  const aRand     = new Float32Array(COUNT);   // twinkle seed

  for (let i = 0; i < COUNT; i++){
    const i3 = i * 3;
    const r  = Math.pow(Math.random(), 1.7) * RADIUS;     // denser core
    const branch = ((i % BRANCHES) / BRANCHES) * Math.PI * 2;
    const spin   = r * SPIN;

    const spread = (rr) =>
      Math.pow(Math.random(), POWER) * (Math.random() < 0.5 ? 1 : -1) * RANDOM * (rr + 0.35);

    positions[i3]     = Math.cos(branch + spin) * r + spread(r);
    positions[i3 + 1] = spread(r) * 0.42;                 // thin disk
    positions[i3 + 2] = Math.sin(branch + spin) * r + spread(r);

    aMix[i]   = Math.min(1, r / RADIUS);
    aScale[i] = 0.45 + Math.random() * 0.9;
    aRand[i]  = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aMix',   new THREE.BufferAttribute(aMix, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(aScale, 1));
  geo.setAttribute('aRand',  new THREE.BufferAttribute(aRand, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:    { value: 0 },
      uSize:    { value: (small ? 20 : 26) * pr },
      uInside:  { value: INSIDE.clone() },
      uOutside: { value: accent.clone() },
    },
    vertexShader: `
      uniform float uTime; uniform float uSize;
      attribute float aMix; attribute float aScale; attribute float aRand;
      varying float vMix; varying float vRand;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * aScale * (1.0 / -mv.z);
        vMix = aMix; vRand = aRand;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uInside; uniform vec3 uOutside;
      varying float vMix; varying float vRand;
      void main(){
        float d = distance(gl_PointCoord, vec2(0.5));
        float s = 1.0 - smoothstep(0.0, 0.5, d);
        s = pow(s, 5.0);                                   // soft point-glow
        float tw = 0.7 + 0.3 * sin(uTime * 1.6 + vRand * 6.2831);
        vec3 col = mix(uInside, uOutside, vMix);
        gl_FragColor = vec4(col, s * tw);
      }`,
  });

  const disk = new THREE.Points(geo, mat);
  galaxy.add(disk);

  /* ---- bright core bulge (additive sprite) ------------------- */
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xfff0d8,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  core.scale.setScalar(3.4);
  galaxy.add(core);

  /* ---- far drifting starfield -------------------------------- */
  const N = small ? 900 : 1800, sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++){
    const r  = 26 + Math.random() * 44;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    sp[i*3]     = r * Math.sin(ph) * Math.cos(th);
    sp[i*3 + 1] = r * Math.sin(ph) * Math.sin(th);
    sp[i*3 + 2] = r * Math.cos(ph);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.12, sizeAttenuation: true,
    map: discTexture(), transparent: true, opacity: 0.7, depthWrite: false,
  }));
  scene.add(stars);

  /* ---- motion state ----------------------------------------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!reduce){
    window.addEventListener('pointermove', (e) => {
      pointer.tx = e.clientX / window.innerWidth  - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }
  const fx    = { scroll: 0 };                          // 0..1 across hero
  const intro = { s: reduce ? 1 : 0.15, dolly: reduce ? 0 : 1, spin: 0 };

  /* ---- resize ----------------------------------------------- */
  function resize(){
    const { w, h } = stageSize();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    mat.uniforms.uSize.value = (small ? 20 : 26) * ratio;
  }
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);

  /* ---- render loop ------------------------------------------ */
  const clock = new THREE.Clock();
  (function tick(){
    const dt = clock.getDelta();
    mat.uniforms.uTime.value += dt;

    if (!reduce){
      galaxy.rotation.y += dt * (0.045 + fx.scroll * 0.5) + intro.spin * dt;
      stars.rotation.y  += dt * 0.006;
      stars.rotation.x  += dt * 0.0025;
    }

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    galaxy.rotation.x = 0.62 + fx.scroll * 0.55 + pointer.y * 0.25;
    galaxy.rotation.z = 0.10 + pointer.x * 0.18;
    galaxy.scale.setScalar(intro.s);

    camera.position.x = pointer.x * 1.1;
    camera.position.y = 2.1 - fx.scroll * 1.4;
    camera.position.z = 7.4 + intro.dolly * 4.0 + fx.scroll * 2.2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();

  /* ---- accent / theme sync ---------------------------------- */
  new MutationObserver(() => {
    accent = readAccent();
    mat.uniforms.uOutside.value.copy(accent);
  }).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-accent', 'data-theme'],
  });

  /* ---- entrance (GSAP), gated on the loader curtain ---------- */
  let played = false, loaderDone = false;
  function maybeIntro(){
    if (played || !loaderDone) return;
    played = true;
    canvas.classList.add('ready');
    if (reduce || !gsap){ intro.s = 1; intro.dolly = 0; revealChips(true); return; }

    gsap.to(intro, { s: 1,     duration: 2.2, ease: 'power3.out' });
    gsap.to(intro, { dolly: 0, duration: 2.6, ease: 'power2.out' });
    gsap.fromTo(intro, { spin: 0.9 }, { spin: 0, duration: 3.2, ease: 'power2.out' });
    revealChips(false);

    if (ScrollTrigger){
      gsap.to(fx, {
        scroll: 1, ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 1 },
      });
    }
  }
  function revealChips(instant){
    const chips = document.querySelectorAll('.orbit-chip');
    if (!chips.length) return;
    if (instant || !gsap){ chips.forEach(c => (c.style.opacity = '1')); return; }
    gsap.fromTo(chips,
      { opacity: 0, scale: 0.85, y: 14 },
      { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.6 });
    chips.forEach((c, i) => gsap.to(c, {
      y: '+=10', duration: 3 + i * 0.6, ease: 'sine.inOut',
      repeat: -1, yoyo: true, delay: 1.2 + i * 0.3,
    }));
  }

  // Wait for the loader to fade (adds `.out`) so the reveal isn't wasted.
  const loader = document.getElementById('loader');
  if (!loader || loader.classList.contains('out')){
    loaderDone = true; maybeIntro();
  } else {
    new MutationObserver((_, obs) => {
      if (loader.classList.contains('out')){ obs.disconnect(); loaderDone = true; maybeIntro(); }
    }).observe(loader, { attributes: true, attributeFilter: ['class'] });
  }
  // Safety net: never leave the canvas hidden if something stalls.
  setTimeout(() => { loaderDone = true; maybeIntro(); }, 5000);
}
