export class CaptiveWeatherSystem {
  constructor(targets = []) {
    this.targets = targets;
  }

  update(time, config, reactionModifiers) {
    const reactionBoost = reactionModifiers.phenomena?.weather?.intensityBoost ?? 0;

    for (const target of this.targets) {
      const uniforms = target.shader.resources.mutationUniforms?.uniforms
        ?? target.shader.resources.weatherUniforms?.uniforms;
      if (!uniforms) continue;
      uniforms.uWeatherEnabled = config.enabled ? 1.0 : 0.0;
      uniforms.uWeatherTime = time;
      uniforms.uWeatherIntensity = config.intensity + reactionBoost;
      uniforms.uWeatherScale = config.scale;
      uniforms.uWeatherSpeed = config.speed;
      uniforms.uWeatherColor = config.color.map((value) => value / 255);
    }
  }

  destroy() {
    this.targets = [];
  }
}
