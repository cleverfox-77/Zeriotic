/* ============================================================
   ZERIOTIC — Hero planet
   WebGL · Three.js · GSAP

   The "model" is an equirectangular surface map
   (planet/pluto-2k.jpg) wrapped onto a sphere — far lighter than
   shipping a mesh, and lets us light it in real time. A fresnel
   atmosphere, a broad halo and a parallaxing starfield sell the
   depth. Atmosphere + rim light read the live `--accent` CSS var,
   so the planet recolours with the site's theme/accent. Entrance
   and scroll motion are choreographed with GSAP.
   ============================================================ */
import * as THREE from 'three';

const canvas = document.getElementById('planetCanvas');
const stage  = document.getElementById('heroStage');
const gsap   = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
/* soft round sprite so stars are dots, not squares */
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

function boot(){
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
  } catch (err){
    // No WebGL — the CSS radial glow behind the canvas is the fallback.
    console.warn('[planet] WebGL unavailable — CSS fallback in use.', err);
    return;
  }

  const { w, h } = stageSize();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
  camera.position.set(0, 0, 3.6);

  // planet + atmosphere share one tilted group (gives it an axis)
  const group = new THREE.Group();
  group.rotation.z = 0.18;
  group.rotation.x = 0.12;
  scene.add(group);

  let accent = readAccent();
  const geo = new THREE.SphereGeometry(1, 96, 96);

  /* ---- planet ---- */
  let texReady = false;
  const tex = new THREE.TextureLoader().load('planet/pluto-2k.jpg', () => {
    texReady = true; maybeIntro();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const planet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: tex, bumpMap: tex, bumpScale: 0.02,
    metalness: 0.04, roughness: 0.95,
  }));
  group.add(planet);

  /* ---- atmosphere (fresnel rim + broad halo) ---- */
  const makeAtm = (power, intensity, scale) => {
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: accent.clone() },
        uPower: { value: power },
        uInt:   { value: intensity },
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main(){
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uPower; uniform float uInt;
        varying vec3 vN; varying vec3 vV;
        void main(){
          float f = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), uPower);
          gl_FragColor = vec4(uColor, f * uInt);
        }`,
      transparent: true, blending: THREE.AdditiveBlending,
      side: THREE.BackSide, depthWrite: false,
    }));
    mesh.scale.setScalar(scale);
    return mesh;
  };
  const atmInner = makeAtm(3.0, 0.72, 1.17);
  const atmOuter = makeAtm(2.2, 0.26, 1.50);
  group.add(atmInner, atmOuter);

  /* ---- lights ---- */
  const sun = new THREE.DirectionalLight(0xffffff, 2.7);
  sun.position.set(-3.2, 1.4, 2.2);
  const rim = new THREE.DirectionalLight(accent.clone(), 1.25);
  rim.position.set(2.6, -0.6, -2.4);
  scene.add(sun, rim, new THREE.AmbientLight(0xffffff, 0.13));

  /* ---- stars ---- */
  const N = 1700, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++){
    const r  = 14 + Math.random() * 26;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i*3]     = r * Math.sin(ph) * Math.cos(th);
    pos[i*3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i*3 + 2] = r * Math.cos(ph);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.08, sizeAttenuation: true,
    map: discTexture(), transparent: true, opacity: 0.85, depthWrite: false,
  }));
  scene.add(stars);

  /* ---- motion state ---- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!reduce){
    window.addEventListener('pointermove', (e) => {
      pointer.tx = e.clientX / window.innerWidth  - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }
  const fx    = { scroll: 0 };                        // 0..1 across hero (ScrollTrigger)
  const intro = { s: reduce ? 1 : 0.55, dolly: reduce ? 0 : 1 };

  /* ---- resize ---- */
  // Distance that frames the planet at the current aspect. A perspective
  // camera frames by VERTICAL fov, so a tall/narrow stage would otherwise
  // zoom in and clip the sphere left/right — pull back when aspect < 1.
  let fitDist = 3.6;
  function resize(){
    const { w, h } = stageSize();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const halfMin = Math.tan((camera.fov * Math.PI / 180) / 2) * Math.min(aspect, 1);
    fitDist = Math.min(14, Math.max(3.0, 1.18 / halfMin)); // 1.18 ≈ planet + rim margin
  }
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);

  /* ---- render loop ---- */
  const clock = new THREE.Clock();
  (function tick(){
    const dt = clock.getDelta();
    if (!reduce){
      planet.rotation.y += dt * 0.06 + fx.scroll * dt * 0.5;
      stars.rotation.y  += dt * 0.005;
      stars.rotation.x  += dt * 0.002;
    }
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    camera.position.x = pointer.x * fitDist * 0.14;
    camera.position.y = -pointer.y * fitDist * 0.10 + fx.scroll * fitDist * 0.13;
    camera.position.z = fitDist * (1 + intro.dolly * 0.4);
    camera.lookAt(0, 0, 0);

    group.scale.setScalar(intro.s);
    group.position.y = -fx.scroll * fitDist * 0.10;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();

  /* ---- accent / theme sync ---- */
  new MutationObserver(() => {
    accent = readAccent();
    atmInner.material.uniforms.uColor.value.copy(accent);
    atmOuter.material.uniforms.uColor.value.copy(accent);
    rim.color.copy(accent);
  }).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-accent', 'data-theme'],
  });

  /* ---- entrance (GSAP), gated on texture + loader curtain ---- */
  let played = false, loaderDone = false;
  function maybeIntro(){
    if (played || !texReady || !loaderDone) return;
    played = true;
    canvas.classList.add('ready');
    if (reduce || !gsap){ intro.s = 1; intro.dolly = 0; revealChips(true); return; }
    gsap.to(intro, { s: 1,     duration: 1.6, ease: 'power3.out' });
    gsap.to(intro, { dolly: 0, duration: 2.0, ease: 'power2.out' });
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
      { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.4 });
    chips.forEach((c, i) => gsap.to(c, {
      y: '+=10', duration: 3 + i * 0.6, ease: 'sine.inOut',
      repeat: -1, yoyo: true, delay: 1 + i * 0.3,
    }));
  }

  // The loader fades by adding `.out`; wait for it so the reveal isn't wasted.
  const loader = document.getElementById('loader');
  if (!loader || loader.classList.contains('out')){
    loaderDone = true; maybeIntro();
  } else {
    new MutationObserver((_, obs) => {
      if (loader.classList.contains('out')){ obs.disconnect(); loaderDone = true; maybeIntro(); }
    }).observe(loader, { attributes: true, attributeFilter: ['class'] });
  }
  // Safety net: never leave the canvas hidden if something stalls.
  setTimeout(() => { loaderDone = true; texReady = texReady || true; maybeIntro(); }, 5000);
}
