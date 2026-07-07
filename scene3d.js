/* ============================================================
   ZERIOTIC — section sculptures
   WebGL · Three.js · GLTF

   A single fixed canvas pinned to the right of the viewport that
   carries a rotating, champagne-metal abstract sculpture. The
   form swaps as you scroll between sections (knot · blob · crystal
   · ribbon), each Blender-made and loaded as GLB. A PMREM'd
   RoomEnvironment gives the metal its soft studio reflections.
   Pointer adds parallax; scroll adds spin. Hidden in the hero
   (the galaxy is the star there) and on small screens.
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('scene3d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small  = matchMedia('(max-width: 760px)').matches;

if (canvas) boot();

function size(){
  const r = canvas.getBoundingClientRect();
  return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
}

function boot(){
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true,
      powerPreference:'high-performance' });
  } catch(e){ console.warn('[scene3d] no WebGL'); return; }

  const { w, h } = size();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
  camera.position.set(0, 0, 7);

  // soft studio reflections for the metal
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xfff4e2, 1.5); key.position.set(-3, 4, 5);
  const rim = new THREE.DirectionalLight(0xcdb79b, 1.1); rim.position.set(4, -2, -3);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));

  // champagne metal
  const metal = new THREE.MeshStandardMaterial({
    color: 0xb6a085, metalness: 1.0, roughness: 0.26, envMapIntensity: 1.15,
  });

  const pivot = new THREE.Group();
  // desktop: bias into the right margin · mobile: centred, nudged up over the
  // section header whitespace (full-width canvas)
  pivot.position.x = small ? 0 : 1.4;
  pivot.position.y = small ? 0.9 : 0;
  scene.add(pivot);
  const FIT = small ? 1.7 : 2.35;   // normalised target size

  /* ---- load the four sculptures ---- */
  const FILES = ['models/knot.glb','models/blob.glb','models/crystal.glb','models/ribbon.glb'];
  const holders = [];                         // index → Group (one per sculpture)
  const loader  = new GLTFLoader();
  FILES.forEach((f, i) => {
    loader.load(f, (gltf) => {
      const root = gltf.scene;
      root.traverse(o => { if (o.isMesh){ o.material = metal; o.castShadow = false; } });
      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      root.position.sub(c);                                   // centre on origin
      const holder = new THREE.Group();
      holder.userData.base = FIT / Math.max(s.x, s.y, s.z);   // normalised scale
      holder.scale.setScalar(0.0001);
      holder.add(root);
      pivot.add(holder);
      holders[i] = holder;
    }, undefined, (err) => console.warn('[scene3d] load failed', f, err));
  });

  /* ---- which sculpture per section (−1 = hide: those sections own
         their own right-side visual, so we keep them clean) ---- */
  const MAP = { services:0, work:-1, process:3, voices:2, studio:1, contact:0 };
  let target = -1;                                            // -1 = none (hero)
  Object.keys(MAP).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) target = MAP[id]; });
    }, { threshold: 0.32 }).observe(el);
  });
  const hero = document.getElementById('hero');
  if (hero) new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting && e.intersectionRatio > 0.55) target = -1; });
  }, { threshold:[0.55] }).observe(hero);

  /* ---- pointer + scroll ---- */
  const ptr = { x:0, y:0, tx:0, ty:0 };
  if (!reduce) window.addEventListener('pointermove', (e) => {
    ptr.tx = e.clientX / window.innerWidth  - 0.5;
    ptr.ty = e.clientY / window.innerHeight - 0.5;
  }, { passive:true });
  let scrollT = 0;
  window.addEventListener('scroll', () => { scrollT = window.scrollY; }, { passive:true });

  function resize(){
    const { w, h } = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);

  /* ---- loop ---- */
  const clock = new THREE.Clock();
  let spin = 0;
  (function tick(){
    const dt = Math.min(clock.getDelta(), 0.05);
    ptr.x += (ptr.tx - ptr.x) * 0.05;
    ptr.y += (ptr.ty - ptr.y) * 0.05;
    spin += dt * (reduce ? 0 : 0.35);

    holders.forEach((hd, i) => {
      if (!hd) return;
      const want = (i === target) ? hd.userData.base : 0;
      const cur  = hd.scale.x;
      hd.scale.setScalar(cur + (want - cur) * 0.12);
      if (i === target){
        hd.rotation.y = spin + ptr.x * 0.6 + scrollT * 0.0006;
        hd.rotation.x = Math.sin(spin * 0.5) * 0.12 - ptr.y * 0.4;
        hd.position.y = Math.sin(spin * 0.8) * 0.12;
      }
    });
    pivot.rotation.z = ptr.x * 0.05;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}
