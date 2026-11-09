/**
 * FinalPass.js - the only full-screen pass after the scene.
 * Adds the glow, smooths edges where no hardware anti-aliasing is in use, maps
 * the HDR image to the screen, then applies grain and vignette.
 */
export const finalVertex = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const finalFragment = /* glsl */`
  precision highp float;
  uniform sampler2D tScene, tGlow;
  uniform vec2 uTexel;
  uniform float uTime, uAberration, uGrain, uVignette, uExposure, uGlow;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec3 rrtOdt(vec3 v){
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 filmic(vec3 c){
    const mat3 toAces = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 fromAces = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    c *= uExposure / 0.6;
    return clamp(fromAces * rrtOdt(toAces * c), 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c){
    return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
  }

  #ifdef USE_EDGE_SMOOTHING
  float luma(vec3 c){ return sqrt(dot(min(c, vec3(1.0)), vec3(0.299, 0.587, 0.114))); }
  vec3 smoothEdges(vec2 uv){
    vec3 m = texture2D(tScene, uv).rgb;
    float M = luma(m);
    float NW = luma(texture2D(tScene, uv + vec2(-1.0, -1.0) * uTexel).rgb);
    float NE = luma(texture2D(tScene, uv + vec2( 1.0, -1.0) * uTexel).rgb);
    float SW = luma(texture2D(tScene, uv + vec2(-1.0,  1.0) * uTexel).rgb);
    float SE = luma(texture2D(tScene, uv + vec2( 1.0,  1.0) * uTexel).rgb);
    float lo = min(M, min(min(NW, NE), min(SW, SE)));
    float hi = max(M, max(max(NW, NE), max(SW, SE)));
    if (hi - lo < max(0.05, hi * 0.14)) return m;
    vec2 d = vec2(-((NW + NE) - (SW + SE)), (NW + SW) - (NE + SE));
    float cut = max((NW + NE + SW + SE) * 0.03125, 0.0078125);
    d = clamp(d / (min(abs(d.x), abs(d.y)) + cut), -8.0, 8.0) * uTexel;
    vec3 a = 0.5 * (texture2D(tScene, uv + d * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScene, uv + d * (2.0 / 3.0 - 0.5)).rgb);
    vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv - d * 0.5).rgb + texture2D(tScene, uv + d * 0.5).rgb);
    float L = luma(b);
    return (L < lo || L > hi) ? a : b;
  }
  #endif

  void main(){
    vec2 dir = vUv - 0.5;
    float r2 = dot(dir, dir);
    vec3 col;

    #ifdef USE_EDGE_SMOOTHING
      col = smoothEdges(vUv);
    #else
      vec2 off = dir * uAberration * (1.0 + r2 * 2.0);
      col.r = texture2D(tScene, vUv + off).r;
      col.g = texture2D(tScene, vUv).g;
      col.b = texture2D(tScene, vUv - off).b;
    #endif
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);

    #ifdef USE_GLOW
      col += texture2D(tGlow, vUv).rgb * uGlow;
    #endif

    col = toSRGB(filmic(col));
    col += (hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5) * uGrain;
    col *= mix(1.0, smoothstep(0.9, 0.25, r2 * (1.0 + uVignette * 2.0)), uVignette);

    gl_FragColor = vec4(col, 1.0);
  }
`;
