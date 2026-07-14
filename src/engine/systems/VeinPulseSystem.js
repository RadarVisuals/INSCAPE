function normalizedColor(config, prefix, fallback) {
  const r = config[`${prefix}ColorR`];
  const g = config[`${prefix}ColorG`];
  const b = config[`${prefix}ColorB`];
  if (![r, g, b].every(Number.isFinite)) return fallback;
  return [r / 255, g / 255, b / 255];
}

export class VeinPulseSystem {
  constructor(targets = []) {
    this.targets = targets;
  }

  update(time, config) {
    const reactionPulse = config.activeReaction ? (config.reactionProgress ?? 0) : 0;
    const baseColor = normalizedColor(config, 'vein', [1.0, 0.08, 0.3]);
    let color = baseColor;

    if (config.activeReaction === 'lyx_received') {
      color = [1.0, Math.max(baseColor[1], 0.24), 0.03];
    } else if (config.activeReaction === 'lsp7_received' || config.activeReaction === 'lsp8_received') {
      color = [Math.max(baseColor[0], 0.26), 0.08, 1.0];
    }

    for (const target of this.targets) {
      const uniforms = target.shader.resources.mutationUniforms?.uniforms
        ?? target.shader.resources.veinUniforms?.uniforms;
      if (!uniforms) continue;
      uniforms.uVeinEnabled = config.veinEnabled === false ? 0.0 : 1.0;
      uniforms.uVeinTime = time * (config.veinSpeed ?? 1.0);
      uniforms.uVeinPulse = reactionPulse;
      uniforms.uVeinIntensity = (config.veinIntensity ?? 0.35) + reactionPulse * (config.veinReactionBoost ?? 0.75);
      uniforms.uVeinScale = config.veinScale ?? 18.0;
      uniforms.uVeinWidth = config.veinWidth ?? 1.0;
      uniforms.uVeinCore = config.veinCore ?? 1.25;
      uniforms.uVeinColor = color;
      uniforms.uVeinSource = [config.veinSourceX ?? 0.5, config.veinSourceY ?? 0.58];
    }
  }

  destroy() {
    this.targets = [];
  }
}
