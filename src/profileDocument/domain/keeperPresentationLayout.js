export const KEEPER_BUBBLE_GAP = 152;
export const KEEPER_BUBBLE_MARGIN = 18;
export const KEEPER_BUBBLE_MAX_WIDTH = 316;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
export function resolveKeeperBubblePlacement({
  actorX,
  viewportWidth,
  bubbleWidth = KEEPER_BUBBLE_MAX_WIDTH,
  gap = KEEPER_BUBBLE_GAP,
  margin = KEEPER_BUBBLE_MARGIN
}) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const resolvedMargin = clamp(Number(margin) || 0, 0, width / 2);
  const resolvedBubbleWidth = clamp(Number(bubbleWidth) || 1, 1, Math.max(1, width - resolvedMargin * 2));
  const resolvedActorX = clamp(Number(actorX) || width / 2, 0, width);
  const resolvedGap = Math.max(0, Number(gap) || 0);
  const rightCandidate = resolvedActorX + resolvedGap;
  const leftCandidate = resolvedActorX - resolvedGap - resolvedBubbleWidth;
  const maximumLeft = Math.max(resolvedMargin, width - resolvedMargin - resolvedBubbleWidth);

  if (rightCandidate <= maximumLeft) return { side: 'right', left: rightCandidate };
  if (leftCandidate >= resolvedMargin) return { side: 'left', left: leftCandidate };

  const rightSpace = width - resolvedMargin - resolvedActorX;
  const leftSpace = resolvedActorX - resolvedMargin;
  const side = rightSpace >= leftSpace ? 'right' : 'left';
  const candidate = side === 'right' ? rightCandidate : leftCandidate;
  return { side, left: clamp(candidate, resolvedMargin, maximumLeft) };
}
