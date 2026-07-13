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

      float reflectMutationCoordinate(float outputCoordinate, float axis, float sourceSide) {
        if (sourceSide < 0.5) {
          return outputCoordinate <= axis ? outputCoordinate : 2.0 * axis - outputCoordinate;
        }
        return outputCoordinate >= axis ? outputCoordinate : 2.0 * axis - outputCoordinate;
      }

      vec2 inverseRotateMutationUv(vec2 uv, float angle) {
        float cosine = cos(angle);
        float sine = sin(angle);
        vec2 centered = uv - vec2(0.5);
        return vec2(
          cosine * centered.x + sine * centered.y,
          -sine * centered.x + cosine * centered.y
        ) + vec2(0.5);
      }

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
        vec2 pattern1Uv = mutationPatternUv(patternBaseUv, uPattern1Scale);
        vec2 pattern2Uv = mutationPatternUv(patternBaseUv, uPattern2Scale);

        vec4 base = paletteLayer(
          uBasePaletteA, uBasePaletteB, colorUv,
          uBaseGradientMode, uBaseGradientAngle, uBaseGradientBalance, uBaseOpacity
        );
        float pattern1Alpha = texture(uPattern1Texture, pattern1Uv).a * uPattern1Opacity;
        vec4 pattern1 = paletteLayer(
          uPattern1PaletteA, uPattern1PaletteB, colorUv,
          uPattern1GradientMode, uPattern1GradientAngle, uPattern1GradientBalance, pattern1Alpha
        );
        float pattern2Alpha = texture(uPattern2Texture, pattern2Uv).a * uPattern2Opacity;
        vec4 pattern2 = paletteLayer(
          uPattern2PaletteA, uPattern2PaletteB, colorUv,
          uPattern2GradientMode, uPattern2GradientAngle, uPattern2GradientBalance, pattern2Alpha
        );
        vec4 content = overLayer(pattern2, overLayer(pattern1, base));
        float grit = mutationHash(floor(outputUv * max(uNoiseScale, 1.0)));
        float gritMultiplier = mix(1.0, 0.72 + grit * 0.56, clamp(uNoiseIntensity, 0.0, 1.0));
        content.rgb *= gritMultiplier;
        vec4 clippedContent = content * maskAlpha;
        vec4 lineart = texture(uLineartTexture, sourceUv);
        outColor = lineart + clippedContent * (1.0 - lineart.a);
      }
    `
  }
};
