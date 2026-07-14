export const SHED_SKIN_TRAIL_FRAGMENT_SHADER = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform float uProgress;
uniform float uTime;
uniform float uDissolve;
uniform vec2 uDirection;
uniform vec3 uTint;
uniform float uTintStrength;

float shedHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float shedNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(shedHash(i), shedHash(i + vec2(1.0, 0.0)), u.x),
             mix(shedHash(i + vec2(0.0, 1.0)), shedHash(i + vec2(1.0)), u.x), u.y);
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 direction = normalize(uDirection + vec2(0.0001));
  float stretch = uProgress * 0.018;
  vec4 body = texture(uTexture, clamp(uv + direction * stretch, uInputClamp.xy, uInputClamp.zw));
  vec4 echo = texture(uTexture, clamp(uv - direction * stretch * 0.55, uInputClamp.xy, uInputClamp.zw));
  body = max(body, echo * (1.0 - uProgress) * 0.45);

  float grain = shedNoise(uv * 24.0 + direction * uTime * 0.7);
  float threads = shedNoise(vec2(uv.x * 46.0, uv.y * 8.0 - uTime * 0.35));
  float threshold = uProgress * mix(0.35, 1.15, clamp(uDissolve, 0.0, 1.0));
  float survival = smoothstep(threshold - 0.14, threshold + 0.12, grain * 0.72 + threads * 0.28);
  float contourPhase = smoothstep(0.18, 0.72, uProgress);
  float luminance = dot(body.rgb, vec3(0.299, 0.587, 0.114));
  vec3 colorized = uTint * (0.32 + luminance * 0.9) * body.a;
  vec3 shedColor = mix(body.rgb, colorized, clamp(uTintStrength + contourPhase * 0.18, 0.0, 1.0));
  float fade = pow(1.0 - uProgress, 1.35);
  finalColor = vec4(shedColor * survival * fade, body.a * survival * fade);
}
`;
