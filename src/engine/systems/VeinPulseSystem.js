export class VeinPulseSystem {
  constructor(targets = []) {
    this.targets = targets;
  }

  update(time, config, reaction) {
    const reactionPulse = reaction.active ? reaction.progress : 0;
    const baseColor = config.color.map((value) => value / 255);
    let color = baseColor;

    if (reaction.active === 'lyx_received') {
      color = [1.0, Math.max(baseColor[1], 0.24), 0.03];
    } else if (reaction.active === 'lsp7_received' || reaction.active === 'lsp8_received') {
      color = [Math.max(baseColor[0], 0.26), 0.08, 1.0];
    }

    for (const target of this.targets) {
      const uniforms = target.shader.resources.mutationUniforms?.uniforms
        ?? target.shader.resources.veinUniforms?.uniforms;
      if (!uniforms) continue;
      uniforms.uVeinEnabled = config.enabled ? 1.0 : 0.0;
      uniforms.uVeinTime = time * config.speed;
      uniforms.uVeinPulse = reactionPulse;
      uniforms.uVeinIntensity = config.intensity + reactionPulse * config.reactionBoost;
      uniforms.uVeinScale = config.scale;
      uniforms.uVeinWidth = config.width;
      uniforms.uVeinCore = config.core;
      uniforms.uVeinColor = color;
      uniforms.uVeinSource = config.source;
    }
  }

  destroy() {
    this.targets = [];
  }
}
