/**
 * Quality.js — cheap GPU tiering.
 * We never benchmark synchronously (that would block the preloader). Instead we
 * read coarse signals — renderer string, memory, mobile UA — to pick a tier
 * that decides the particle budget and which post passes run. The render loop
 * can still DOWNGRADE at runtime if it sees sustained long frames.
 */
export function detectTier(renderer) {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;

  // Try to read the unmasked GPU name (best-effort; often blocked).
  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
  } catch { /* ignore */ }

  const weakGpu = /(intel|swiftshader|mali|adreno 5|apple a[0-9]\b)/.test(gpu);

  let tier = 'high';
  if (isMobile || cores <= 4 || mem <= 4 || weakGpu) tier = 'medium';
  if (isMobile && (cores <= 4 || mem <= 3)) tier = 'low';

  return {
    tier,
    isMobile,
    // The particle field is the main GPU cost — vertex-bound, so it scales
    // almost linearly with count. These budgets hold 60fps on their tiers.
    particles: tier === 'high' ? 120000 : tier === 'medium' ? 60000 : 30000,
    // feature toggles consumed by PostFX
    bloom: true,                       // the plasma glow IS the look — always on
    dof: false,
    grain: true,
    ssao: false,
    // Post is fill-rate bound; CSS-pixel rendering + SMAA reads as intentionally
    // cinematic on the dark scene and locks a steady 60fps.
    maxPixelRatio: tier === 'low' ? 1 : 1.0,
    bloomDownscale: 2,                 // half-res bloom everywhere (bloom is blurry anyway)
  };
}
