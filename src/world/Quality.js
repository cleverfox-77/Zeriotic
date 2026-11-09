/**
 * Quality.js - picks how much the visitor's graphics chip is asked to do.
 * Built-in laptop graphics are named here on purpose: they often report a
 * friendly name, and treating them like a dedicated card is what makes a page crawl.
 */
export function detectTier(renderer) {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;

  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
  } catch { /* the name is not always available */ }

  const software = /swiftshader|llvmpipe|microsoft basic/.test(gpu);
  const builtIn = /intel|radeon\(tm\) graphics|radeon graphics|vega \d|radeon \d{3}m|mali|adreno|powervr|apple a\d/.test(gpu);

  let tier = 'high';
  if (isMobile || cores <= 4 || mem <= 4 || builtIn) tier = 'medium';
  if (software || (isMobile && (cores <= 4 || mem <= 3))) tier = 'low';

  const pick = (high, medium, low) => (tier === 'high' ? high : tier === 'medium' ? medium : low);

  return {
    tier,
    isMobile,
    reflection: pick(0.45, 0.28, 0),
    shadowSize: pick(2048, 1024, 0),
    shadowLive: tier === 'high',
    motes: pick(700, 320, 120),
    bubbles: pick(90, 56, 30),
    rain: pick(320, 130, 0),
    bloom: tier !== 'low',
    grain: tier !== 'low',
    msaa: pick(4, 0, 0),
    maxPixelRatio: pick(1.5, 1, 1),
  };
}
