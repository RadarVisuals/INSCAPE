import { VEIN_PULSE_GLSL, VEIN_PULSE_UNIFORMS } from './VeinPulseShader.js';
import { CAPTIVE_WEATHER_GLSL, CAPTIVE_WEATHER_UNIFORMS } from './CaptiveWeatherShader.js';
import { LAYER_TRANSFUSION_GLSL, LAYER_TRANSFUSION_UNIFORMS } from './LayerTransfusionShader.js';
import { MUTATION_GEOMETRY_GLSL } from './MutationGeometryShader.js';

export const mutationMeshBitGl = {
  name: 'creator-mutation-mesh',
  fragment: {
    header: `
      precision highp float;

      uniform sampler2D uMaskTexture;
      uniform sampler2D uLineartTexture;
      uniform sampler2D uPattern1Texture;
      uniform sampler2D uPattern2Texture;
      uniform sampler2D uBasePaletteA;
      uniform sampler2D uBasePaletteB;
      uniform sampler2D uPattern1PaletteA;
      uniform sampler2D uPattern1PaletteB;
      uniform sampler2D uPattern2PaletteA;
      uniform sampler2D uPattern2PaletteB;
      uniform float uMode;
      uniform float uAxisX;
      uniform float uAxisY;
      uniform float uSourceX;
      uniform float uSourceY;
      uniform float uMirrorPattern;
      uniform float uSourceRotation;
      uniform float uTime;
      uniform float uWarpIntensity;
      uniform float uWarpMode;
      uniform float uMorphRange;
      uniform float uLayerDivergence;
      uniform vec2 uCursorPosition;
      uniform vec2 uCursorVelocity;
      uniform float uCursorActive;
      uniform float uCursorInfluence;
      uniform float uCursorRadius;
      uniform float uBaseGradientMode;
      uniform float uBaseGradientAngle;
      uniform float uBaseGradientBalance;
      uniform float uBaseOpacity;
      uniform float uPattern1GradientMode;
      uniform float uPattern1GradientAngle;
      uniform float uPattern1GradientBalance;
      uniform float uPattern1Opacity;
      uniform float uPattern1Scale;
      uniform float uPattern2GradientMode;
      uniform float uPattern2GradientAngle;
      uniform float uPattern2GradientBalance;
      uniform float uPattern2Opacity;
      uniform float uPattern2Scale;
      uniform float uNoiseIntensity;
      uniform float uNoiseScale;
      ${VEIN_PULSE_UNIFORMS}
      ${CAPTIVE_WEATHER_UNIFORMS}
      ${LAYER_TRANSFUSION_UNIFORMS}

      ${MUTATION_GEOMETRY_GLSL}

      float mutationHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float mutationNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mutationHash(i), mutationHash(i + vec2(1.0, 0.0)), u.x),
          mix(mutationHash(i + vec2(0.0, 1.0)), mutationHash(i + vec2(1.0)), u.x),
          u.y
        );
      }

      float mutationFbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        mat2 rotation = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 3; ++i) {
          value += amplitude * (mutationNoise(p) * 2.0 - 1.0);
          p = rotation * p * 2.0 + vec2(100.0);
          amplitude *= 0.5;
        }
        return value;
      }

      vec2 mutationPatternUv(vec2 uv, float scale) {
        vec2 scaledUv = (uv - vec2(0.5)) / max(scale, 0.05) + vec2(0.5);
        vec2 flow = vec2(-0.8, -1.2) * uTime;
        float dx = mutationFbm(scaledUv * 25.0 + flow);
        float dy = mutationFbm(scaledUv * 25.0 + flow + vec2(23.0, 47.0));
        return clamp(scaledUv + vec2(dx, dy) * (uWarpIntensity * 0.001), 0.0, 1.0);
      }

      vec2 mutationOrganicFlow(float layerDirection, float layerPhase) {
        float range = max(uMorphRange, 0.0);
        vec2 sharedFlow = vec2(
          sin(uTime * 0.19),
          cos(uTime * 0.13)
        ) * (1.35 * range);
        sharedFlow += vec2(
          sin(uTime * 0.071 + 1.7),
          sin(uTime * 0.097 + 0.4)
        ) * (0.65 * range);

        vec2 layerFlow = vec2(
          sin(layerDirection * uTime * (0.11 + layerPhase * 0.003) + layerPhase),
          cos(layerDirection * uTime * (0.083 + layerPhase * 0.002) + layerPhase * 1.37)
        ) * (1.65 * range);
        return sharedFlow + layerFlow * clamp(uLayerDivergence, 0.0, 1.0);
      }

      vec2 mutationCursorDisplacement(vec2 interactionUv, float layerDirection) {
        vec2 delta = interactionUv - uCursorPosition;
        float radius = max(uCursorRadius, 0.001);
        float distanceFromCursor = length(delta);
        float falloff = 1.0 - smoothstep(radius * 0.18, radius, distanceFromCursor);
        vec2 tangent = vec2(-delta.y, delta.x) / max(distanceFromCursor, 0.001);
        vec2 cursorMotion = clamp(uCursorVelocity * 0.12, vec2(-1.0), vec2(1.0));
        float movement = clamp(length(uCursorVelocity) * 0.16, 0.0, 1.0);
        float layerResponse = mix(1.0, layerDirection, clamp(uLayerDivergence, 0.0, 1.0));
        vec2 stir = tangent * mix(0.35, 1.0, movement) + cursorMotion;
        return stir * falloff * uCursorActive * uCursorInfluence * layerResponse * 0.035;
      }

      vec2 mutationOrganicPatternUv(
        vec2 uv,
        float scale,
        float layerDirection,
        float layerPhase,
        vec2 interactionUv
      ) {
        vec2 scaledUv = (uv - vec2(0.5)) / max(scale, 0.05) + vec2(0.5);
        vec2 flow = mutationOrganicFlow(layerDirection, layerPhase);
        float dx = mutationFbm(scaledUv * 25.0 + flow);
        float dy = mutationFbm(scaledUv * 25.0 + flow + vec2(23.0, 47.0));
        vec2 liquidOffset = vec2(dx, dy) * (uWarpIntensity * 0.001);
        return clamp(
          scaledUv + liquidOffset + mutationCursorDisplacement(interactionUv, layerDirection),
          0.0,
          1.0
        );
      }

      float gradientAmount(vec2 uv, float angle, float balance, float enabled) {
        if (enabled < 0.5) return 0.0;
        vec2 direction = vec2(cos(angle), sin(angle));
        float projected = dot(uv - vec2(0.5), direction) + 0.5;
        float midpoint = clamp(balance, 0.01, 0.99);
        return smoothstep(midpoint - 0.35, midpoint + 0.35, projected);
      }

      vec4 paletteLayer(
        sampler2D paletteA,
        sampler2D paletteB,
        vec2 uv,
        float gradientMode,
        float gradientAngle,
        float gradientBalance,
        float alpha
      ) {
        vec3 colorA = texture(paletteA, vec2(0.5)).rgb;
        vec3 colorB = texture(paletteB, vec2(0.5)).rgb;
        float mixAmount = gradientAmount(uv, gradientAngle, gradientBalance, gradientMode);
        float safeAlpha = clamp(alpha, 0.0, 1.0);
        return vec4(mix(colorA, colorB, mixAmount) * safeAlpha, safeAlpha);
      }

      vec4 overLayer(vec4 foreground, vec4 background) {
        return foreground + background * (1.0 - foreground.a);
      }
      ${LAYER_TRANSFUSION_GLSL}
      ${VEIN_PULSE_GLSL}
      ${CAPTIVE_WEATHER_GLSL}
    `,
    main: `
      vec2 outputUv = vUV * 3.0 - 1.0;
      vec2 geometryUv = outputUv;

      bool mirrorX = uMode > 0.5 && (uMode < 1.5 || uMode > 2.5);
      bool mirrorY = uMode > 1.5;

      if (mirrorX) {
        geometryUv.x = reflectMutationCoordinate(outputUv.x, uAxisX, uSourceX);
      }
      if (mirrorY) {
        geometryUv.y = reflectMutationCoordinate(outputUv.y, uAxisY, uSourceY);
      }

      vec2 sourceUv = inverseRotateMutationUv(geometryUv, uSourceRotation);

      if (sourceUv.x < 0.0 || sourceUv.x > 1.0 ||
          sourceUv.y < 0.0 || sourceUv.y > 1.0) {
        outColor = vec4(0.0);
      } else {
        float maskAlpha = texture(uMaskTexture, sourceUv).a;
        vec2 colorUv = outputUv;
        vec2 patternBaseUv = uMirrorPattern > 0.5 ? sourceUv : fract(outputUv);
        vec2 pattern1Uv = uWarpMode < 0.5
          ? mutationPatternUv(patternBaseUv, uPattern1Scale)
          : mutationOrganicPatternUv(patternBaseUv, uPattern1Scale, 1.0, 0.0, outputUv);
        vec2 pattern2Uv = uWarpMode < 0.5
          ? mutationPatternUv(patternBaseUv, uPattern2Scale)
          : mutationOrganicPatternUv(patternBaseUv, uPattern2Scale, -1.0, 2.39996, outputUv);

        vec4 base = paletteLayer(
          uBasePaletteA, uBasePaletteB, colorUv,
          uBaseGradientMode, uBaseGradientAngle, uBaseGradientBalance, uBaseOpacity
        );
        vec2 transfusion = layerTransfusion(outputUv);
        float transfusionAmount = step(0.5, uTransfusionEnabled) * clamp(uTransfusionIntensity, 0.0, 1.0);
        float territory = transfusion.x;
        float pattern1Ownership = mix(1.0, 1.0 - territory, transfusionAmount);
        float pattern2Ownership = mix(1.0, territory, transfusionAmount);
        float pattern1Alpha = texture(uPattern1Texture, pattern1Uv).a * uPattern1Opacity * pattern1Ownership;
        vec4 pattern1 = paletteLayer(
          uPattern1PaletteA, uPattern1PaletteB, colorUv,
          uPattern1GradientMode, uPattern1GradientAngle, uPattern1GradientBalance, pattern1Alpha
        );
        float pattern2Alpha = texture(uPattern2Texture, pattern2Uv).a * uPattern2Opacity * pattern2Ownership;
        vec4 pattern2 = paletteLayer(
          uPattern2PaletteA, uPattern2PaletteB, colorUv,
          uPattern2GradientMode, uPattern2GradientAngle, uPattern2GradientBalance, pattern2Alpha
        );
        vec4 content = overLayer(pattern2, overLayer(pattern1, base));
        content.rgb *= 1.0 - transfusion.y * 0.7;
        float grit = mutationHash(floor(outputUv * max(uNoiseScale, 1.0)));
        float gritMultiplier = mix(1.0, 0.72 + grit * 0.56, clamp(uNoiseIntensity, 0.0, 1.0));
        content.rgb *= gritMultiplier;
        content = applyCaptiveWeather(content, outputUv);
        content = applyVeinPulse(content, outputUv);
        vec4 clippedContent = content * maskAlpha;
        vec4 lineart = texture(uLineartTexture, sourceUv);
        outColor = lineart + clippedContent * (1.0 - lineart.a);
      }
    `
  }
};
