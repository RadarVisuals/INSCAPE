// Grid widths per millisecond; exact integration makes coasting independent
// of refresh rate. It never accelerates or reverses the release direction.
export function coastGrid(velocity, milliseconds) {
  const decay = Math.exp(-Math.max(0, milliseconds) / 360);
  const next = velocity * decay;
  return { distance: velocity * 360 * (1 - decay), velocity: Math.abs(next) < .000015 ? 0 : next };
}
