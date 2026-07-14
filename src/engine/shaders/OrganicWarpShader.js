// src/engine/shaders/OrganicWarpShader.js

export const ORGANIC_WARP_FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform float uTime;
uniform float uWarpIntensity;
uniform float uMorphRange;
uniform float uLayerDivergence;
uniform float uLayerDirection;
uniform float uLayerPhase;
uniform vec2 uCursorPosition;
uniform vec2 uCursorVelocity;
uniform float uCursorActive;
uniform float uCursorInfluence;
uniform float uCursorRadius;

float organicHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float organicNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(organicHash(i), organicHash(i + vec2(1.0, 0.0)), u.x),
    mix(organicHash(i + vec2(0.0, 1.0)), organicHash(i + vec2(1.0)), u.x),
    u.y
  );
}

// This is deliberately the same three-octave displacement character as Classic Warp.
float organicFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rotation = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 3; ++i) {
    value += amplitude * (organicNoise(p) * 2.0 - 1.0);
    p = rotation * p * 2.0 + shift;
    amplitude *= 0.5;
  }
  return value;
}

vec2 organicFlow(float t) {
  float range = max(uMorphRange, 0.0);
  vec2 sharedFlow = vec2(
    sin(t * 0.19),
    cos(t * 0.13)
  ) * (1.35 * range);
  sharedFlow += vec2(
    sin(t * 0.071 + 1.7),
    sin(t * 0.097 + 0.4)
  ) * (0.65 * range);

  vec2 layerFlow = vec2(
    sin(uLayerDirection * t * (0.11 + uLayerPhase * 0.003) + uLayerPhase),
    cos(uLayerDirection * t * (0.083 + uLayerPhase * 0.002) + uLayerPhase * 1.37)
  ) * (1.65 * range);

  return sharedFlow + layerFlow * clamp(uLayerDivergence, 0.0, 1.0);
}

vec2 cursorDisplacement(vec2 uv) {
  vec2 cursorUv = mix(uInputClamp.xy, uInputClamp.zw, uCursorPosition);
  vec2 delta = uv - cursorUv;
  float radius = max(uCursorRadius, 0.001);
  float distanceFromCursor = length(delta);
  float falloff = 1.0 - smoothstep(radius * 0.18, radius, distanceFromCursor);
  vec2 tangent = vec2(-delta.y, delta.x) / max(distanceFromCursor, 0.001);
  vec2 cursorMotion = clamp(uCursorVelocity * 0.12, vec2(-1.0), vec2(1.0));
  float movement = clamp(length(uCursorVelocity) * 0.16, 0.0, 1.0);

  // At high divergence, alternating layers stir against one another.
  float layerResponse = mix(1.0, uLayerDirection, clamp(uLayerDivergence, 0.0, 1.0));
  vec2 stir = tangent * mix(0.35, 1.0, movement) + cursorMotion;
  return stir * falloff * uCursorActive * uCursorInfluence * layerResponse * 0.035;
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 flowOffset = organicFlow(uTime);
  float displacementX = organicFbm(uv * 25.0 + flowOffset);
  float displacementY = organicFbm(uv * 25.0 + flowOffset + vec2(23.0, 47.0));
  vec2 liquidOffset = vec2(displacementX, displacementY) * (uWarpIntensity * 0.001);
  vec2 offset = liquidOffset + cursorDisplacement(uv);
  vec2 clampedUv = clamp(uv + offset, uInputClamp.xy, uInputClamp.zw);
  finalColor = texture(uTexture, clampedUv);
}
`;
