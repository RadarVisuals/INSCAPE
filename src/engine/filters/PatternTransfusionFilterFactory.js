import { Filter, UniformGroup, defaultFilterVert } from 'pixi.js';

const PATTERN_TRANSFUSION_FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uEnabled;
uniform float uTime;
uniform float uIntensity;
uniform float uScale;
uniform float uBalance;
uniform float uEdge;

float transfusionHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float transfusionNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(transfusionHash(i), transfusionHash(i + vec2(1.0, 0.0)), u.x),
             mix(transfusionHash(i + vec2(0.0, 1.0)), transfusionHash(i + vec2(1.0)), u.x), u.y);
}

float transfusionFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rotation = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 3; ++i) {
    value += amplitude * (transfusionNoise(p) * 2.0 - 1.0);
    p = rotation * p * 2.0 + vec2(100.0);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec4 pattern = texture(uTexture, vTextureCoord);
  if (uEnabled < 0.5 || uIntensity <= 0.001) {
    finalColor = pattern;
    return;
  }

  float scale = max(uScale, 0.5);
  vec2 orbitA = vec2(cos(uTime * 0.19), sin(uTime * 0.23)) * 0.72;
  vec2 orbitB = vec2(sin(uTime * 0.11), cos(uTime * 0.17)) * 0.46;
  vec2 p = vTextureCoord * scale;
  float broad = transfusionFbm(p + orbitA);
  float folded = transfusionFbm(p * 1.93 - orbitA * 0.57 + orbitB + vec2(17.0, 9.0));
  float tissue = broad * 0.78 + folded * 0.34;
  float threshold = mix(-0.42, 0.42, clamp(uBalance, 0.0, 1.0));
  float territory = smoothstep(threshold - 0.075, threshold + 0.075, tissue);
  float membraneWidth = mix(0.025, 0.12, clamp(uEdge, 0.0, 1.0));
  float membrane = 1.0 - smoothstep(0.0, membraneWidth, abs(tissue - threshold));
  float amount = clamp(uIntensity, 0.0, 1.0);

  // The animated-actor renderer owns a flattened pattern and a painted base.
  // Removing pattern territory exposes that base; the narrow membrane remains
  // as a dark, graphic seam between the two material states.
  float ownership = mix(1.0, 1.0 - territory, amount);
  float coverage = max(ownership, membrane * amount * 0.82);
  vec3 membraneInk = pattern.rgb * mix(1.0, 0.18, membrane * amount * 0.72);
  finalColor = vec4(membraneInk * coverage, pattern.a * coverage);
}
`;

export function createPatternTransfusionFilter() {
  const uniforms = new UniformGroup({
    uEnabled: { value: 1.0, type: 'f32' },
    uTime: { value: 0.0, type: 'f32' },
    uIntensity: { value: 0.78, type: 'f32' },
    uScale: { value: 3.4, type: 'f32' },
    uBalance: { value: 0.5, type: 'f32' },
    uEdge: { value: 0.38, type: 'f32' }
  }, false, true);

  return Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: PATTERN_TRANSFUSION_FRAGMENT_SHADER
    },
    resources: { transfusionUniforms: uniforms }
  });
}
