export class VeinPulseSystem {
  constructor(targets = []) {
    this.targets = targets;
  }

  update(time, config, reactionModifiers) {
    const modifiers = reactionModifiers.phenomena?.veins;
    const reactionPulse = modifiers?.pulse ?? 0;
    const color = (modifiers?.color ?? config.color).map((value) => value / 255);

    for (const target of this.targets) {
      const uniforms = target.shader.resources.mutationUniforms?.uniforms
        ?? target.shader.resources.veinUniforms?.uniforms;
      if (!uniforms) continue;
      uniforms.uVeinEnabled = config.enabled ? 1.0 : 0.0;
      uniforms.uVeinTime = time * config.speed;
      uniforms.uVeinPulse = reactionPulse;
      uniforms.uVeinIntensity = config.intensity + (modifiers?.intensityBoost ?? 0);
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
