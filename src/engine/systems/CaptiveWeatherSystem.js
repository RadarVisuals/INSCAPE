function normalizedWeatherColor(config) {
  const values = [config.weatherColorR, config.weatherColorG, config.weatherColorB];
  if (!values.every(Number.isFinite)) return [0.16, 0.02, 0.28];
  return values.map((value) => value / 255);
}

export class CaptiveWeatherSystem {
  constructor(targets = []) {
    this.targets = targets;
  }

  update(time, config) {
    const reactionBoost = config.activeReaction ? (config.reactionProgress ?? 0) * 0.34 : 0;

    for (const target of this.targets) {
      const uniforms = target.shader.resources.mutationUniforms?.uniforms
        ?? target.shader.resources.weatherUniforms?.uniforms;
      if (!uniforms) continue;
      uniforms.uWeatherEnabled = config.weatherEnabled === false ? 0.0 : 1.0;
      uniforms.uWeatherTime = time;
      uniforms.uWeatherIntensity = (config.weatherIntensity ?? 0.28) + reactionBoost;
      uniforms.uWeatherScale = config.weatherScale ?? 2.2;
      uniforms.uWeatherSpeed = config.weatherSpeed ?? 0.55;
      uniforms.uWeatherColor = normalizedWeatherColor(config);
    }
  }

  destroy() {
    this.targets = [];
  }
}
