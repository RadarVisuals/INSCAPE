import { KEEPER_SWIM_DEFAULTS, KEEPER_SWIM_FIELDS } from './keeperSwim.js';

const mix = (a, b, amount) => a + (b - a) * amount;
const turn = (from, to, amount) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount;
const rotate = (x, y, angle) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) });
export function createKeeperRigPose(rig) {
  const body = rig.parts.find(part => part.id === 'body');
  const ranks = direction => {
    const result = Array(rig.parts.length).fill(0);
    // Order the fan around its rear axis, independent of SVG group order or
    // numbering. Mirrored source artwork has the opposite clockwise leader.
    rig.parts.map((part, index) => ({ part, index,
      angle: Math.atan2(-(part.y - body.y) * direction, -(part.x - body.x) * direction) }))
      .filter(({ part }) => part.id !== 'body').sort((a, b) => b.angle - a.angle)
      .forEach(({ index }, rank) => { result[index] = rank + 1; });
    return result;
  };
  return { angle: 0, compression: 0, elapsed: 0,
    clockwiseRanks: { right: ranks(1), left: ranks(-1) },
    turns: [{ time: 0, clockwise: 0, counterclockwise: 0 }],
    parts: rig.parts.map(part => ({ x: part.x, y: part.y, angle: 0, heading: 0 })) };
}

function rotationAt(turns, time, direction) {
  if (time <= turns[0].time) return turns[0][direction];
  let left = 0, right = turns.length - 1;
  while (right - left > 1) {
    const middle = (left + right) >> 1;
    if (turns[middle].time < time) left = middle; else right = middle;
  }
  const a = turns[left], b = turns[right];
  return a.time === b.time ? b[direction] : mix(a[direction], b[direction], Math.min(1, (time - a.time) / (b.time - a.time)));
}

// Independent figure-eights and speed-driven gathering share a polar pose.
// Delayed head headings move each tentacle around the body rather than cutting
// straight across its face. All history is temporary and bounded by the rig size.
export function stepKeeperRigPose(pose, rig, motion, dt, { faces = 'right', reducedMotion = false, swim = KEEPER_SWIM_DEFAULTS } = {}) {
  if (reducedMotion) return pose;
  const delta = Math.max(0, Math.min(dt, .05)), speed = Math.hypot(motion.vx, motion.vy);
  if (!delta) return pose;
  pose.elapsed += delta;
  const heading = motion.heading ?? (speed > 8 ? Math.atan2(motion.vy, motion.vx) : null);
  const previousAngle = pose.angle;
  // Times describe roughly 90% response to a settled target, in seconds.
  if (heading !== null) pose.angle = turn(pose.angle, heading - (faces === 'left' ? Math.PI : 0), 1 - Math.exp(-delta * Math.LN10 / swim.turnSeconds));
  const previousTurn = pose.turns.at(-1), change = pose.angle - previousAngle;
  // Delay each direction's angular travel separately. Reversing a turn reverses
  // the sequence of its new motion without reassigning old, in-flight delays.
  pose.turns.push({ time: pose.elapsed, clockwise: previousTurn.clockwise + Math.max(0, change),
    counterclockwise: previousTurn.counterclockwise + Math.min(0, change) });
  const historyLength = KEEPER_SWIM_FIELDS.staggerSeconds.max * (rig.parts.length - 1) + .05;
  while (pose.turns.length > 2 && pose.turns[1].time < pose.elapsed - historyLength) pose.turns.shift();
  const target = Math.min(1, speed / swim.speed);
  const response = target > pose.compression ? swim.gatherSeconds : swim.spreadSeconds;
  pose.compression = mix(pose.compression, target, 1 - Math.exp(-delta * Math.LN10 / response));
  const body = rig.parts.find(part => part.id === 'body'), direction = faces === 'left' ? -1 : 1;
  const expression = motion.expression;
  const surprise = expression?.gesture === 'startled' ? expression.amount : 0;
  const tilt = expression?.gesture === 'curious' ? expression.amount * .22 * direction : 0;
  const headPosition = rotate(body.x, body.y, pose.angle);
  const tentacles = rig.parts.length - 1;
  rig.parts.forEach((part, index) => {
    const current = pose.parts[index], head = part.id === 'body';
    let point = headPosition, angle = pose.angle + tilt;
    if (!head) {
      const clockwiseRank = pose.clockwiseRanks[faces][index];
      const delayed = rotationAt(pose.turns, pose.elapsed - clockwiseRank * swim.staggerSeconds, 'clockwise')
        + rotationAt(pose.turns, pose.elapsed - (tentacles + 1 - clockwiseRank) * swim.staggerSeconds, 'counterclockwise');
      // A short angular ease also makes live stagger edits continuous. Gathering
      // has no second positional easing stage to silently slow its control down.
      current.heading = mix(current.heading, delayed, 1 - Math.exp(-delta * 24));
      const restX = part.x - body.x, restY = part.y - body.y;
      const tuckedX = -direction * (body.width * .38 + part.width * .32), tuckedY = restY * .3;
      const restAngle = Math.atan2(restY, restX), tuckedAngle = Math.atan2(tuckedY, tuckedX);
      const bearing = turn(restAngle, tuckedAngle, pose.compression);
      const reach = mix(Math.hypot(restX, restY), Math.hypot(tuckedX, tuckedY), pose.compression) * (1 + surprise * .3);
      const clock = pose.elapsed * (.7 + index * .037) + index * 2.17, amplitude = .012 * (1 - pose.compression * .65);
      const relative = rotate(Math.cos(bearing) * reach + Math.sin(clock) * amplitude,
        Math.sin(bearing) * reach + Math.sin(clock * 2) * amplitude * .7, current.heading);
      point = { x: headPosition.x + relative.x, y: headPosition.y + relative.y };
      angle = current.heading + bearing - restAngle + Math.sin(clock) * .07 * (1 - pose.compression * .5) + surprise * Math.sign(restY) * .16;
      if (speed > 0) {
        const trail = .02 * pose.compression * (1 + index * .09);
        point.x -= motion.vx / speed * trail; point.y -= motion.vy / speed * trail;
      }
    }
    current.x = point.x; current.y = point.y; current.angle = angle;
    const radius = Math.hypot(current.x, current.y), limit = .49 - Math.hypot(part.width, part.height) / 2;
    if (radius > limit) { current.x *= limit / radius; current.y *= limit / radius; }
  });
  return pose;
}
