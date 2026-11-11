// Release chooses one exact Grid seam. The same trajectory lands there without
// a second correction, overshoot or spring. Positions are continuous rail units.
export function gridLanding(position, velocity) {
  const projected = position + velocity * 360;
  const target = Math.sign(projected) * Math.round(Math.abs(projected)) || 0;
  const distance = target - position;
  const duration = Math.max(360, Math.min(975, Math.abs(distance) * 1500));
  // Keep the release speed when it points toward the chosen seam, bounded to
  // a monotonic curve. A held release starts gently from zero speed.
  const tangent = distance ? Math.max(0, Math.min(1, velocity * duration / (3 * distance))) : 0;
  return {
    target, duration, distance,
    easing: `cubic-bezier(0.3333333333333333, ${tangent}, 0.6666666666666666, 1)`,
    sample(milliseconds) {
      const progress = Math.max(0, Math.min(1, milliseconds / duration));
      const remaining = 1 - progress;
      return {
        distance: distance * (3 * remaining ** 2 * progress * tangent + 3 * remaining * progress ** 2 + progress ** 3),
        velocity: distance / duration * (3 * tangent * remaining ** 2 + 6 * (1 - tangent) * remaining * progress),
        done: progress === 1,
      };
    },
  };
}
