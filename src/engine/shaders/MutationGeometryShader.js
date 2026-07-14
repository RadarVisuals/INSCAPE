export const MUTATION_GEOMETRY_GLSL = `
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
`;

export const ACTOR_MUTATION_FRAGMENT_HEADER = `
precision highp float;

uniform sampler2D uSourceTexture;
uniform float uMode;
uniform float uAxisX;
uniform float uAxisY;
uniform float uSourceX;
uniform float uSourceY;
uniform float uSourceRotation;

${MUTATION_GEOMETRY_GLSL}
`;

export const ACTOR_MUTATION_FRAGMENT_MAIN = `
  // The output workspace is three times the source dimensions. Its middle
  // third is the authored actor's native 0..1 texture space.
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
    outColor = texture(uSourceTexture, sourceUv);
  }
`;
