/**
 * FinalPass.js — a single fragment shader that folds together THREE cheap
 * screen-space effects that would otherwise be three separate full-screen passes:
 *
 *   1. Chromatic aberration  (radial RGB split)
 *   2. Film grain            (animated luminance noise)
 *   3. Vignette              (corner falloff to focus the eye on the sculpture)
 *
 * Collapsing them into one pass means one texture read + one write instead of
 * three — a meaningful saving at 4K. Intensity uniforms let the story dial each
 * effect up during motion and back down when reading.
 */
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0018 },
    uGrain: { value: 0.045 },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uAberration, uGrain, uVignette;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

    void main(){
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float r2 = dot(dir, dir);

      // 1. chromatic aberration scales with distance from centre
      vec2 off = dir * uAberration * (1.0 + r2 * 2.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      // 2. film grain (animated, luminance-weighted so darks stay clean-ish)
      float n = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5;
      col += n * uGrain;

      // 3. vignette
      float vig = smoothstep(0.9, 0.25, r2 * (1.0 + uVignette * 2.0));
      col *= mix(1.0, vig, uVignette);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
