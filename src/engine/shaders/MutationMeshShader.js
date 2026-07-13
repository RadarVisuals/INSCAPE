export const mutationMeshBitGl = {
  name: 'creator-mutation-mesh',
  fragment: {
    header: `
      precision highp float;

      uniform sampler2D uMaskTexture;
      uniform sampler2D uLineartTexture;
      uniform sampler2D uBaseTexture;
      uniform sampler2D uPatternTexture;
      uniform float uMode;
      uniform float uAxisX;
      uniform float uAxisY;
      uniform float uSourceX;
      uniform float uSourceY;
      uniform float uMirrorPattern;
      uniform float uSourceRotation;

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
        vec2 patternUv = uMirrorPattern > 0.5 ? sourceUv : fract(outputUv);
        vec4 base = texture(uBaseTexture, sourceUv);
        vec4 pattern = texture(uPatternTexture, patternUv);
        vec4 content = pattern + base * (1.0 - pattern.a);
        vec4 clippedContent = content * maskAlpha;
        vec4 lineart = texture(uLineartTexture, sourceUv);
        outColor = lineart + clippedContent * (1.0 - lineart.a);
      }
    `
  }
};
