// A composable character-surface shader stage kept beneath authored line art.
export const VEIN_PULSE_UNIFORMS = `
  uniform float uVeinEnabled;
  uniform float uVeinTime;
  uniform float uVeinPulse;
  uniform float uVeinIntensity;
  uniform float uVeinScale;
  uniform float uVeinWidth;
  uniform float uVeinCore;
  uniform vec3 uVeinColor;
  uniform vec2 uVeinSource;
`;

export const VEIN_PULSE_GLSL = `
  float veinBranchDistance(vec2 p, float scale) {
    vec2 warped = p * scale;
    float bend = mutationFbm(warped * 0.72 + vec2(uVeinTime * 0.07, -uVeinTime * 0.04));
    float radius = length(warped);
    float angle = atan(warped.y, warped.x);
    float arteries = abs(sin(angle * 3.0 + radius * 0.72 + bend * 2.6));
    float branches = abs(sin(angle * 7.0 - radius * 1.34 - bend * 3.4));
    float capillaries = abs(sin(warped.x * 1.17 + warped.y * 0.38 + bend * 3.0));
    return min(arteries, min(branches * 1.18, capillaries * 1.34));
  }

  vec4 applyVeinPulse(vec4 surface, vec2 uv) {
    if (uVeinEnabled < 0.5 || uVeinIntensity <= 0.001) return surface;

    vec2 delta = uv - uVeinSource;
    float organicDistance = length(delta) + mutationFbm(uv * 7.0 + vec2(4.0, 11.0)) * 0.075;
    float hasPulse = step(0.001, uVeinPulse);
    float elapsed = 1.0 - clamp(uVeinPulse, 0.0, 1.0);
    float frontRadius = mix(0.02, 1.15, elapsed);
    float waveFront = (1.0 - smoothstep(0.0, 0.085, abs(organicDistance - frontRadius))) * hasPulse;
    float wake = (1.0 - smoothstep(frontRadius - 0.42, frontRadius, organicDistance)) * hasPulse;
    float heartbeat = pow(max(0.0, sin(uVeinTime * 1.12)), 12.0);
    float ambient = 0.035 + heartbeat * 0.17;
    float distanceToBranch = veinBranchDistance(uv - uVeinSource, max(uVeinScale, 1.0));
    float width = max(uVeinWidth, 0.2);
    float channel = 1.0 - smoothstep(0.028 * width, 0.15 * width, distanceToBranch);
    float core = 1.0 - smoothstep(0.01 * width, 0.047 * width, distanceToBranch);
    float circulation = max(ambient, max(wake * 0.48, waveFront));
    float intensity = clamp(uVeinIntensity, 0.0, 2.0);
    float pressure = channel * circulation * intensity;

    surface.rgb *= 1.0 - clamp(pressure * 0.38, 0.0, 0.52);
    vec3 emission = clamp(uVeinColor * core * circulation * intensity * max(uVeinCore, 0.0), 0.0, 1.0);
    surface.rgb = 1.0 - (1.0 - surface.rgb) * (1.0 - emission * surface.a);
    return surface;
  }
`;

// Standalone overlay program for the legacy/animated actor pipeline. It emits
// only the colored circulation layer; the actor's ink and eyes remain separate
// Pixi children above this mesh.
export const veinPulseOverlayBitGl = {
  name: 'vein-pulse-overlay',
  fragment: {
    header: `
      precision highp float;
      uniform sampler2D uMaskTexture;
      ${VEIN_PULSE_UNIFORMS}

      float overlayVeinHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float overlayVeinNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(overlayVeinHash(i), overlayVeinHash(i + vec2(1.0, 0.0)), u.x),
                   mix(overlayVeinHash(i + vec2(0.0, 1.0)), overlayVeinHash(i + vec2(1.0)), u.x), u.y);
      }

      float overlayVeinFbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 3; ++i) {
          value += amplitude * (overlayVeinNoise(p) * 2.0 - 1.0);
          p = p * 2.03 + vec2(17.0, 29.0);
          amplitude *= 0.5;
        }
        return value;
      }
    `,
    main: `
      vec2 uv = vUV;
      float maskAlpha = texture(uMaskTexture, uv).a;
      if (uVeinEnabled < 0.5 || uVeinIntensity <= 0.001 || maskAlpha <= 0.001) {
        outColor = vec4(0.0);
      } else {
        vec2 p = (uv - uVeinSource) * max(uVeinScale, 1.0);
        float bend = overlayVeinFbm(p * 0.72 + vec2(uVeinTime * 0.07, -uVeinTime * 0.04));
        float veinRadius = length(p);
        float veinAngle = atan(p.y, p.x);
        float arteries = abs(sin(veinAngle * 3.0 + veinRadius * 0.72 + bend * 2.6));
        float branches = abs(sin(veinAngle * 7.0 - veinRadius * 1.34 - bend * 3.4));
        float capillaries = abs(sin(p.x * 1.17 + p.y * 0.38 + bend * 3.0));
        float branchDistance = min(arteries, min(branches * 1.18, capillaries * 1.34));
        float width = max(uVeinWidth, 0.2);
        float channel = 1.0 - smoothstep(0.028 * width, 0.15 * width, branchDistance);
        float core = 1.0 - smoothstep(0.01 * width, 0.047 * width, branchDistance);

        float organicDistance = length(uv - uVeinSource) + overlayVeinFbm(uv * 7.0 + vec2(4.0, 11.0)) * 0.075;
        float hasPulse = step(0.001, uVeinPulse);
        float radius = mix(0.02, 1.15, 1.0 - clamp(uVeinPulse, 0.0, 1.0));
        float front = (1.0 - smoothstep(0.0, 0.085, abs(organicDistance - radius))) * hasPulse;
        float wake = (1.0 - smoothstep(radius - 0.42, radius, organicDistance)) * hasPulse;
        float heartbeat = pow(max(0.0, sin(uVeinTime * 1.12)), 12.0);
        float ambient = 0.035 + heartbeat * 0.17;
        float circulation = max(ambient, max(wake * 0.48, front));
        float intensity = clamp(uVeinIntensity, 0.0, 2.0);
        float channelAlpha = channel * circulation * intensity;
        float coreLight = core * circulation * intensity * max(uVeinCore, 0.0);
        float alpha = maskAlpha * clamp(channelAlpha * 0.72 + coreLight * 0.18, 0.0, 0.88);
        vec3 color = uVeinColor * (channelAlpha * 0.72 + coreLight * 1.42);
        outColor = vec4(color * maskAlpha, alpha);
      }
    `
  }
};
