// A creator-surface material state: the two clipped pattern layers slowly
// exchange territory through a hard, living membrane instead of accumulating
// as translucent overlays.
export const LAYER_TRANSFUSION_UNIFORMS = `
  uniform float uTransfusionEnabled;
  uniform float uTransfusionTime;
  uniform float uTransfusionIntensity;
  uniform float uTransfusionScale;
  uniform float uTransfusionBalance;
  uniform float uTransfusionEdge;
`;

export const LAYER_TRANSFUSION_GLSL = `
  vec2 layerTransfusion(vec2 uv) {
    float scale = max(uTransfusionScale, 0.5);
    float t = uTransfusionTime;

    // Orbiting offsets keep the material morphing in place rather than reading
    // as noise travelling across the skull on a conveyor belt.
    vec2 orbitA = vec2(cos(t * 0.19), sin(t * 0.23)) * 0.72;
    vec2 orbitB = vec2(sin(t * 0.11), cos(t * 0.17)) * 0.46;
    vec2 p = uv * scale;
    float broad = mutationFbm(p + orbitA);
    float folded = mutationFbm(p * 1.93 - orbitA * 0.57 + orbitB + vec2(17.0, 9.0));
    float tissue = broad * 0.78 + folded * 0.34;

    float threshold = mix(-0.42, 0.42, clamp(uTransfusionBalance, 0.0, 1.0));
    float territory = smoothstep(threshold - 0.075, threshold + 0.075, tissue);
    float membraneWidth = mix(0.025, 0.12, clamp(uTransfusionEdge, 0.0, 1.0));
    float membrane = 1.0 - smoothstep(0.0, membraneWidth, abs(tissue - threshold));
    float enabled = step(0.5, uTransfusionEnabled) * clamp(uTransfusionIntensity, 0.0, 1.0);
    return vec2(territory, membrane * enabled);
  }
`;
