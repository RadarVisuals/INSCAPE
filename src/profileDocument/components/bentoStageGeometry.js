// Percentages stay relative to the stage as it responds to its container.
// Clamp a partly clipped/missing source so even the animation starts in bounds.
export function stageCardInsets(stage, card) {
  if (!card || !(stage.width > 0 && stage.height > 0)) return '0% 0% 0% 0%';
  const clamp = value => Math.max(0, Math.min(1, value));
  const left = clamp((card.left - stage.left) / stage.width);
  const top = clamp((card.top - stage.top) / stage.height);
  const right = Math.max(left, clamp((card.right - stage.left) / stage.width));
  const bottom = Math.max(top, clamp((card.bottom - stage.top) / stage.height));
  return `${top * 100}% ${(1 - right) * 100}% ${(1 - bottom) * 100}% ${left * 100}%`;
}
