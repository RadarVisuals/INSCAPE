// src/engine/shaders/ShockwaveShader.js

export const SHOCKWAVE_FRAGMENT_SHADER = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;

uniform vec2 uCenter;          // Center in screen pixels (gl_FragCoord space: bottom-left origin)
uniform vec2 uScreenSize;      // Screen dimensions in pixels [width, height]
uniform float uRadii[5];       // Array of active wavefront radii (in pixels)
uniform float uActiveWaveCount;// Number of currently executing wave ripples
uniform float uThickness;      // Width of the refractive wavefront ring (in pixels)
uniform float uAmplitude;      // Displacement amount (in pixels)

void main() {
  vec2 uv = vTextureCoord;
  
  // Isotropic distance calculation in absolute screen pixels
  float dist = distance(gl_FragCoord.xy, uCenter);

  vec2 offset = vec2(0.0);
  int activeCount = int(uActiveWaveCount);

  // Iteratively compute up to 5 overlapping wave fronts within a single pass
  for (int i = 0; i < 5; i++) {
    if (i >= activeCount) {
      break;
    }
    
    float r = uRadii[i];
    
    // Check if the current pixel coordinate falls within this wave's refract ring bounds
    if (dist >= r - uThickness && dist <= r) {
      float progress = (r - dist) / uThickness; // Normalized progress inside ring (0.0 to 1.0)
      float wave = sin(progress * 3.14159265);
      
      // Calculate radial screen space direction
      vec2 dir = normalize(gl_FragCoord.xy - uCenter);
      
      // Map vertical coordinate offset. Y is top-down in UV coordinates, but bottom-up in gl_FragCoord
      vec2 uvDir = vec2(dir.x, -dir.y);
      
      // Attenuate wavefront impact as it expands towards the screen boundaries
      float dampening = 1.0 - clamp(r / (uScreenSize.x * 0.85), 0.0, 1.0);
      
      // Accumulate displacements translated into UV fraction offset
      offset += uvDir * wave * (uAmplitude / uScreenSize) * dampening;
    }
  }

  vec2 clampedUV = clamp(uv - offset, uInputClamp.xy, uInputClamp.zw);
  finalColor = texture(uTexture, clampedUV);
}
`;