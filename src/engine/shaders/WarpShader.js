// src/engine/shaders/WarpShader.js

export const WARP_FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp; // Built-in Pixi uniform defining active subregion bounds
uniform float uTime;
uniform float uWarpIntensity;

// Pseudo-random 2D Hash
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D Value Noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0.0, 0.0)), 
                 hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), 
                 hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// 3-Octave Fractional Brownian Motion (Perfectly zero-centered)
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 3; ++i) {
      // Mapping noise value from [0, 1] to signed [-1, 1] keeps the displacement average at 0
      v += a * (noise(p) * 2.0 - 1.0);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vTextureCoord;
  float t = uTime;

  // Keep a constant spatial scale for the warp patterns
  float freq = 25.0;

  // Continuous velocity offset vector (negative values scroll up/left)
  vec2 flowVelocity = vec2(-0.8, -1.2);
  vec2 flowOffset = flowVelocity * t;

  // Apply translation over time to make displacement flow in one direction
  float displacementX = fbm(uv * freq + flowOffset);
  float displacementY = fbm(uv * freq + flowOffset + vec2(23.0, 47.0));

  // Calculate offset vector and scale it relative to user intensity input
  vec2 offset = vec2(displacementX, displacementY) * (uWarpIntensity * 0.001);

  // Clamp coordinates to the subtexture region bounds to eliminate edge bleeding
  vec2 clampedUV = clamp(uv + offset, uInputClamp.xy, uInputClamp.zw);

  finalColor = texture(uTexture, clampedUV);
}
`;