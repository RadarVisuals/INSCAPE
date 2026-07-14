// Internal suspended ink only. Exterior material is handled by the connected
// world-space boundary exhale system so the actor mask is never projected.
export const CAPTIVE_WEATHER_UNIFORMS = `
  uniform float uWeatherEnabled;
  uniform float uWeatherTime;
  uniform float uWeatherIntensity;
  uniform float uWeatherScale;
  uniform float uWeatherSpeed;
  uniform vec3 uWeatherColor;
`;

export const CAPTIVE_WEATHER_GLSL = `
  vec3 captiveInkProfile(vec2 uv) {
    float scale = max(uWeatherScale, 0.5);
    vec2 orbit = vec2(cos(uWeatherTime * 0.13), sin(uWeatherTime * 0.17));
    vec2 drift = orbit * 0.42 * uWeatherSpeed;
    float broad = mutationFbm(uv * scale * 2.45 + drift);
    float detail = mutationFbm(uv * scale * 6.8 - drift * 1.7 + vec2(19.0));
    float pores = mutationFbm(uv * scale * 13.0 + drift.yx + vec2(7.0, 31.0));
    float field = broad * 0.82 + detail * 0.28;

    // Tight thresholds create graphic pools, cut-outs and filaments. There is
    // deliberately no blur or broad alpha ramp here.
    float body = smoothstep(0.055, 0.145, field);
    float holes = smoothstep(0.47, 0.61, pores);
    body *= 1.0 - holes * 0.82;
    float rim = 1.0 - smoothstep(0.018, 0.075, abs(field - 0.10));
    float filamentField = abs(detail + broad * 0.46);
    float filaments = 1.0 - smoothstep(0.025, 0.085, filamentField);
    filaments *= smoothstep(-0.18, 0.18, broad);
    return vec3(body, rim, filaments);
  }

  vec4 applyCaptiveWeather(vec4 surface, vec2 uv) {
    if (uWeatherEnabled < 0.5 || uWeatherIntensity <= 0.001) return surface;
    vec3 ink = captiveInkProfile(uv);
    float intensity = clamp(uWeatherIntensity, 0.0, 1.5);
    vec3 suspendedInk = mix(surface.rgb * 0.16, uWeatherColor * surface.a, 0.58);
    surface.rgb = mix(surface.rgb, suspendedInk, clamp(ink.x * intensity * 0.74, 0.0, 0.88));

    // A hard colored meniscus gives the ink presence without a glow filter.
    vec3 emission = clamp(uWeatherColor * (ink.y * 0.62 + ink.z * 0.34) * intensity, 0.0, 0.92);
    surface.rgb = 1.0 - (1.0 - surface.rgb) * (1.0 - emission * surface.a);
    return surface;
  }

`;

// Standalone internal overlay for animated actors. Unlike a filter on
// the whole head, this never processes their line art or eye sprites.
export const captiveWeatherOverlayBitGl = {
  name: 'captive-weather-overlay',
  fragment: {
    header: `
      precision highp float;
      uniform sampler2D uMaskTexture;
      ${CAPTIVE_WEATHER_UNIFORMS}

      float overlayWeatherHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float overlayWeatherNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(overlayWeatherHash(i), overlayWeatherHash(i + vec2(1.0, 0.0)), u.x),
                   mix(overlayWeatherHash(i + vec2(0.0, 1.0)), overlayWeatherHash(i + vec2(1.0)), u.x), u.y);
      }

      float overlayWeatherFbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 3; ++i) {
          value += amplitude * (overlayWeatherNoise(p) * 2.0 - 1.0);
          p = p * 2.03 + vec2(23.0, 41.0);
          amplitude *= 0.5;
        }
        return value;
      }

      vec3 overlayInkProfile(vec2 uv) {
        float scale = max(uWeatherScale, 0.5);
        vec2 orbit = vec2(cos(uWeatherTime * 0.13), sin(uWeatherTime * 0.17));
        vec2 drift = orbit * 0.42 * uWeatherSpeed;
        float broad = overlayWeatherFbm(uv * scale * 2.45 + drift);
        float detail = overlayWeatherFbm(uv * scale * 6.8 - drift * 1.7 + vec2(19.0));
        float pores = overlayWeatherFbm(uv * scale * 13.0 + drift.yx + vec2(7.0, 31.0));
        float field = broad * 0.82 + detail * 0.28;
        float body = smoothstep(0.055, 0.145, field);
        body *= 1.0 - smoothstep(0.47, 0.61, pores) * 0.82;
        float rim = 1.0 - smoothstep(0.018, 0.075, abs(field - 0.10));
        float filaments = 1.0 - smoothstep(0.025, 0.085, abs(detail + broad * 0.46));
        filaments *= smoothstep(-0.18, 0.18, broad);
        return vec3(body, rim, filaments);
      }

    `,
    main: `
      vec2 uv = vUV;
      float maskAlpha = texture(uMaskTexture, uv).a;
      if (uWeatherEnabled < 0.5 || uWeatherIntensity <= 0.001) {
        outColor = vec4(0.0);
      } else {
        vec3 ink = overlayInkProfile(uv);
        float intensity = clamp(uWeatherIntensity, 0.0, 1.5);
        float internalAlpha = maskAlpha * clamp((ink.x * 0.7 + ink.y * 0.42 + ink.z * 0.22) * intensity, 0.0, 0.9);
        vec3 inkColor = mix(uWeatherColor * 0.24, uWeatherColor, clamp(ink.y + ink.z * 0.35, 0.0, 1.0));
        outColor = vec4(inkColor * internalAlpha, internalAlpha);
      }
    `
  }
};
