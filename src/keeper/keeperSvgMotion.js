import { stepKeeperOctopusPose } from './keeperOctopusMotion.js';
import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// The authored silhouette faces upward for locomotion, without mirroring.
// Keep the upper 90-degree cone level; bank progressively for sideways and
// downward travel. The periodic mapping stays continuous through straight down.
function bankAngle(vx, vy) {
  const direction = Math.atan2(vx, -vy), angle = Math.abs(direction);
  if (angle <= Math.PI / 4) return 0;
  const sideways = 35 * Math.PI / 180;
  const bank = angle <= Math.PI / 2 ? (angle - Math.PI / 4) * sideways / (Math.PI / 4)
    : sideways + (Math.PI - sideways) * ((angle - Math.PI / 2) / (Math.PI / 2)) ** 1.3;
  return Math.sign(direction) * bank;
}

// Shared dock travel drives the pose; heading is not an instruction to flip
// the face. Tentacles trail actual velocity, and eyes lead with the destination.
export function stepKeeperSvgPose(pose, rig, motion, dt, options = {}) {
  if (options.reducedMotion) return stepKeeperOctopusPose(pose, rig, motion, dt, options);
  const swim = options.swim || KEEPER_SWIM_DEFAULTS;
  const vx = motion.vx || 0, vy = motion.vy || 0, speed = Math.hypot(vx, vy);
  const amount = clamp(speed / (swim.speed * .3), 0, 1);
  const heading = Number.isFinite(motion.heading) ? motion.heading : Math.atan2(vy, vx);
  const pointer = speed > 12 ? { x: motion.x + Math.cos(heading) * 400, y: motion.y + Math.sin(heading) * 400 } : options.pointer;
  const fan = rig.tentacles.reduce((sum, tentacle) => {
    const x = tentacle.tip.x - tentacle.root.x, y = tentacle.tip.y - tentacle.root.y, length = Math.hypot(x, y);
    return { x: sum.x + x / length, y: sum.y + y / length };
  }, { x: 0, y: 0 });
  return stepKeeperOctopusPose(pose, rig, motion, dt, { ...options, pointer,
    orientation: { angle: speed > .01 ? bankAngle(vx, vy) * amount : 0, scaleX: 1,
      rearWorld: speed > .01 ? Math.atan2(-vy, -vx) : Math.PI / 2, trail: true, fanCenter: Math.atan2(fan.y, fan.x) },
  });
}
