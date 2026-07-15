export function createTrailRenderTransformSnapshot(actorContainer, visualContainer) {
  return {
    x: actorContainer.position.x,
    y: actorContainer.position.y,
    scaleX: actorContainer.scale.x * visualContainer.scale.x,
    scaleY: actorContainer.scale.y * visualContainer.scale.y,
    rotation: actorContainer.rotation + visualContainer.rotation
  };
}

export function recordTrailTransform(history, renderTransform, spacing) {
  history.unshift({
    x: renderTransform.x,
    y: renderTransform.y,
    scaleX: renderTransform.scaleX,
    scaleY: renderTransform.scaleY,
    rotation: renderTransform.rotation
  });

  const maxHistoryNeeded = spacing * 3 + 2;
  if (history.length > maxHistoryNeeded) history.pop();
}

export function getTrailPresentation(history, index, config, runtime) {
  const reactionTrailIntensity = runtime.reactionModifiers.trail?.intensity;
  const activeReactionProgress = Number.isFinite(reactionTrailIntensity)
    ? Math.max(0, Math.min(1, reactionTrailIntensity))
    : 0;
  const motionPulse = (runtime.screenShakeIntensity / 30) * (runtime.isGlitchActive ? 1.0 : 0.25);
  const dynamicAlpha = Math.max(motionPulse, activeReactionProgress) * config.glitchInfluence;
  const targetBaseAlpha = Math.max(config.manualAlpha, dynamicAlpha);

  if (index >= config.count || targetBaseAlpha <= 0.01) return null;

  const historyIndex = (index + 1) * config.spacing - 1;
  const historicalTransform = history[historyIndex];
  if (!historicalTransform) return null;

  const scaleExpansion = 1.0 + (index + 1) * 0.04;
  const driftOffsetY = (index + 1) * -8;
  const stepDecay = 1.0 - (index * 0.25);

  return {
    x: historicalTransform.x,
    y: historicalTransform.y + driftOffsetY,
    scaleX: historicalTransform.scaleX * scaleExpansion,
    scaleY: historicalTransform.scaleY * scaleExpansion,
    rotation: historicalTransform.rotation,
    alpha: Math.max(0, Math.min(1.0, targetBaseAlpha * stepDecay))
  };
}
