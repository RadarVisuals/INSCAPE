// Screen-pixel velocity, measured over a recent gesture window. Old movement
// must not cause a delayed fling after the pointer has come to rest.
export function workbenchPanVelocity(samples, releasedAt) {
  const recent = samples.filter(point => Number.isFinite(point.time) && Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.time >= releasedAt - 100 && point.time <= releasedAt);
  const first = recent[0], last = recent.at(-1);
  if (!first || releasedAt - last.time > 64 || last.time - first.time < 8) return { x: 0, y: 0 };
  const x = (last.x - first.x) / (last.time - first.time), y = (last.y - first.y) / (last.time - first.time);
  const factor = Math.min(1, 2.5 / Math.hypot(x, y));
  return { x: x * factor, y: y * factor };
}

// Elapsed-time exponential decay is independent of the display's refresh rate.
// It changes only the session camera; modules and authored geometry are absent.
export function workbenchPanCoast(camera, velocity) {
  if (!Number.isFinite(velocity?.x) || !Number.isFinite(velocity?.y)) return null;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed < .08) return null;
  const factor = Math.min(1, 2.5 / speed), decay = 180;
  const duration = Math.min(700, decay * Math.log(Math.min(speed, 2.5) / .03));
  const at = elapsed => {
    const distance = decay * -Math.expm1(-Math.max(0, Math.min(duration, elapsed)) / decay);
    return { scale: camera.scale, offset: { x: camera.offset.x + velocity.x * factor * distance,
      y: camera.offset.y + velocity.y * factor * distance } };
  };
  return { duration, at, end: at(duration) };
}
