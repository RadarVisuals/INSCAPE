import { clamp, distanceBetween, lerp, snapToGrid } from './spiderMotion.js';

export const MANTA_DEFAULTS = Object.freeze({
  speed: 185,
  wingspan: 150,
  distortion: 22,
  gridSize: 72,
  rippleStrength: 18,
  steering: 3.2,
});

export const MANTA_RANGES = Object.freeze({
  speed: { min: 60, max: 360, step: 10 },
  wingspan: { min: 80, max: 240, step: 4 },
  distortion: { min: 0, max: 48, step: 2 },
  gridSize: { min: 44, max: 104, step: 4 },
  rippleStrength: { min: 0, max: 36, step: 2 },
  steering: { min: 1, max: 8, step: 0.2 },
});

export const JELLY_DEFAULTS = Object.freeze({
  tendrilCount: 8,
  bellRadius: 38,
  tetherLength: 126,
  speed: 150,
  elasticity: 18,
  pulseSpeed: 1.8,
});

export const JELLY_RANGES = Object.freeze({
  tendrilCount: { min: 4, max: 14, step: 1 },
  bellRadius: { min: 22, max: 68, step: 2 },
  tetherLength: { min: 70, max: 210, step: 4 },
  speed: { min: 50, max: 320, step: 10 },
  elasticity: { min: 0, max: 42, step: 2 },
  pulseSpeed: { min: 0, max: 4, step: 0.1 },
});

const MANTA_RIPPLE_LIFETIME = 2.8;
const MANTA_RIPPLE_INTERVAL = 0.38;

function easedVelocity(state, target, delta, speed, steering, reducedMotion) {
  const dx = target.x - state.position.x;
  const dy = target.y - state.position.y;
  const distance = Math.max(0.0001, Math.hypot(dx, dy));
  const arrival = clamp(distance / 120, 0, 1);
  const desiredX = distance > 3 ? (dx / distance) * speed * arrival : 0;
  const desiredY = distance > 3 ? (dy / distance) * speed * arrival : 0;
  const response = reducedMotion ? 1 : 1 - Math.exp(-steering * delta);
  state.velocity.x = lerp(state.velocity.x, desiredX, response);
  state.velocity.y = lerp(state.velocity.y, desiredY, response);
  state.position.x += state.velocity.x * delta;
  state.position.y += state.velocity.y * delta;
  const activity = Math.hypot(state.velocity.x, state.velocity.y);
  if (activity > 1) state.heading = Math.atan2(state.velocity.y, state.velocity.x);
  return activity;
}

export function makeManta(center) {
  return {
    position: { ...center },
    velocity: { x: 0, y: 0 },
    heading: -Math.PI / 2,
    activity: 0,
    finPhase: 0,
    rippleClock: 0,
    ripples: [],
  };
}

export function updateManta(state, target, delta, tuning, reducedMotion) {
  const activity = easedVelocity(state, target, delta, tuning.speed, tuning.steering, reducedMotion);
  state.activity = activity;
  state.finPhase += delta * (0.8 + (activity / Math.max(1, tuning.speed)) * 3.4);
  state.rippleClock += delta;

  if (!reducedMotion && activity > 24 && state.rippleClock > MANTA_RIPPLE_INTERVAL) {
    state.rippleClock = 0;
    state.ripples.push({
      x: state.position.x - (Math.cos(state.heading) * tuning.wingspan * 0.18),
      y: state.position.y - (Math.sin(state.heading) * tuning.wingspan * 0.18),
      age: 0,
    });
    if (state.ripples.length > 7) state.ripples.shift();
  }
  for (const ripple of state.ripples) ripple.age += delta;
  state.ripples = state.ripples.filter((ripple) => ripple.age < MANTA_RIPPLE_LIFETIME);
  return activity;
}

function mantaInfluence(x, y, manta, tuning, output, transform, surfacePresence) {
  const dx = x - manta.position.x;
  const dy = y - manta.position.y;
  const localX = (dx * transform.cosine) - (dy * transform.sine);
  const localY = (dx * transform.sine) + (dy * transform.cosine);
  const normalizedDistance = (
    (localX * localX) / transform.longRadiusSquared
    + (localY * localY) / transform.wideRadiusSquared
  );
  const field = normalizedDistance > 4 ? 0 : Math.exp(-2.1 * normalizedDistance);
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bodyRipple = Math.sin((distance * 0.11) - (manta.finPhase * 3.2)) * tuning.rippleStrength * field * 0.2;
  const bodyPush = ((tuning.distortion * field) + bodyRipple) * surfacePresence;
  let offsetX = (dx / distance) * bodyPush;
  let offsetY = (dy / distance) * bodyPush;

  for (const ripple of manta.ripples) {
    const progress = ripple.age / MANTA_RIPPLE_LIFETIME;
    const rippleX = x - ripple.x;
    const rippleY = y - ripple.y;
    const radius = 20 + (progress * tuning.wingspan * 2.65);
    const influenceLimit = radius + 120;
    if (Math.abs(rippleX) > influenceLimit || Math.abs(rippleY) > influenceLimit) continue;
    const rippleDistance = Math.max(1, Math.hypot(rippleX, rippleY));
    const distanceFromFront = rippleDistance - radius;
    if (Math.abs(distanceFromFront) > 120) continue;
    const envelope = Math.exp(-Math.pow(distanceFromFront / 46, 2));
    const wave = Math.cos(distanceFromFront * 0.15)
      * tuning.rippleStrength
      * 0.72
      * Math.pow(1 - progress, 1.15)
      * envelope
      * surfacePresence;
    offsetX += (rippleX / rippleDistance) * wave;
    offsetY += (rippleY / rippleDistance) * wave;
  }

  output.x = x + offsetX;
  output.y = y + offsetY;
  return output;
}

export function drawMantaUnder(context, manta, tuning) {
  for (const ripple of manta.ripples) {
    const progress = ripple.age / MANTA_RIPPLE_LIFETIME;
    const radius = 20 + (progress * tuning.wingspan * 2.65);
    const energy = Math.pow(1 - progress, 1.15);
    for (let band = 0; band < 3; band += 1) {
      const bandRadius = radius - (band * 13);
      if (bandRadius <= 0) continue;
      context.strokeStyle = `rgba(239, 237, 228, ${energy * (0.14 - band * 0.032)})`;
      context.lineWidth = band === 0 ? 1.15 : 0.75;
      context.beginPath();
      context.ellipse(
        ripple.x,
        ripple.y,
        bandRadius,
        bandRadius * 0.72,
        manta.heading,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  }

  const span = tuning.wingspan;
  const flap = Math.sin(manta.finPhase) * span * 0.055;
  context.save();
  context.translate(manta.position.x, manta.position.y);
  context.rotate(manta.heading);
  const waterGlow = context.createRadialGradient(0, 0, span * 0.08, 0, 0, span * 0.82);
  waterGlow.addColorStop(0, 'rgba(231, 235, 229, 0.12)');
  waterGlow.addColorStop(0.5, 'rgba(214, 221, 217, 0.055)');
  waterGlow.addColorStop(1, 'rgba(214, 221, 217, 0)');
  context.fillStyle = waterGlow;
  context.beginPath();
  context.ellipse(0, 0, span * 0.88, span * 0.62, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(0, 0, 0, 0.9)';
  context.strokeStyle = 'rgba(239, 237, 228, 0.16)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(span * 0.48, 0);
  context.bezierCurveTo(span * 0.18, -span * 0.08, span * 0.08, -span * 0.49 - flap, -span * 0.34, -span * 0.42 - flap);
  context.bezierCurveTo(-span * 0.18, -span * 0.14, -span * 0.42, -span * 0.06, -span * 0.68, 0);
  context.bezierCurveTo(-span * 0.42, span * 0.06, -span * 0.18, span * 0.14, -span * 0.34, span * 0.42 + flap);
  context.bezierCurveTo(span * 0.08, span * 0.49 + flap, span * 0.18, span * 0.08, span * 0.48, 0);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = 'rgba(239, 237, 228, 0.2)';
  context.lineWidth = 0.8;
  context.beginPath();
  context.moveTo(span * 0.38, 0);
  context.bezierCurveTo(span * 0.08, -span * 0.02, -span * 0.2, -span * 0.04, -span * 0.56, 0);
  context.stroke();
  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(span * 0.18, side * span * 0.035);
    context.quadraticCurveTo(-span * 0.02, side * span * 0.2, -span * 0.3, side * (span * 0.35 + flap * 0.4));
    context.stroke();
  }
  context.strokeStyle = 'rgba(239, 237, 228, 0.28)';
  context.beginPath();
  context.moveTo(-span * 0.58, 0);
  context.quadraticCurveTo(
    -span * 0.82,
    Math.sin(manta.finPhase * 1.6) * span * 0.06,
    -span * 1.06,
    Math.sin(manta.finPhase * 1.6 + 0.8) * span * 0.1,
  );
  context.stroke();
  context.fillStyle = 'rgba(242, 240, 232, 0.46)';
  for (const side of [-1, 1]) {
    context.beginPath();
    context.arc(span * 0.27, side * span * 0.055, 1.25, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export function drawMantaGrid(context, width, height, manta, tuning, surfacePresence = 1) {
  const spacing = tuning.gridSize;
  const sample = 14;
  const point = { x: 0, y: 0 };
  const longRadius = tuning.wingspan * 0.62;
  const wideRadius = tuning.wingspan * 0.46;
  const transform = {
    cosine: Math.cos(-manta.heading),
    sine: Math.sin(-manta.heading),
    longRadiusSquared: longRadius * longRadius,
    wideRadiusSquared: wideRadius * wideRadius,
  };
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(244, 242, 234, 0.48)';

  for (let y = 0; y <= height + spacing; y += spacing) {
    context.beginPath();
    for (let x = 0; x <= width + sample; x += sample) {
      mantaInfluence(x, y, manta, tuning, point, transform, surfacePresence);
      if (x === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  for (let x = 0; x <= width + spacing; x += spacing) {
    context.beginPath();
    for (let y = 0; y <= height + sample; y += sample) {
      mantaInfluence(x, y, manta, tuning, point, transform, surfacePresence);
      if (y === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.stroke();
  }
}

function radialAnchor(center, index, count, radius) {
  const angle = (-Math.PI / 2) + ((index / count) * Math.PI * 2);
  return snapToGrid({
    x: center.x + (Math.cos(angle) * radius),
    y: center.y + (Math.sin(angle) * radius),
  }, 68);
}

export function makeJelly(center, tuning = JELLY_DEFAULTS) {
  return {
    position: { ...center },
    velocity: { x: 0, y: 0 },
    heading: 0,
    activity: 0,
    anchors: Array.from({ length: tuning.tendrilCount }, (_, index) => ({
      position: radialAnchor(center, index, tuning.tendrilCount, tuning.tetherLength),
      from: null,
      target: null,
      progress: 0,
    })),
    nextRelease: 0,
  };
}

export function updateJelly(state, target, delta, tuning, reducedMotion) {
  state.activity = easedVelocity(state, target, delta, tuning.speed, 2.7, reducedMotion);
  state.nextRelease = Math.max(0, state.nextRelease - delta);

  if (state.anchors.length !== tuning.tendrilCount) {
    state.anchors = makeJelly(state.position, tuning).anchors;
  }

  for (let index = 0; index < state.anchors.length; index += 1) {
    const anchor = state.anchors[index];
    const ideal = radialAnchor(state.position, index, state.anchors.length, tuning.tetherLength);
    if (!anchor.target && distanceBetween(anchor.position, ideal) > 52 && state.nextRelease <= 0) {
      anchor.from = { ...anchor.position };
      anchor.target = ideal;
      anchor.progress = 0;
      state.nextRelease = 0.07;
    }
    if (anchor.target) {
      anchor.progress = reducedMotion ? 1 : Math.min(1, anchor.progress + (delta * 3.8));
      const eased = 1 - Math.pow(1 - anchor.progress, 3);
      anchor.position.x = lerp(anchor.from.x, anchor.target.x, eased);
      anchor.position.y = lerp(anchor.from.y, anchor.target.y, eased);
      if (anchor.progress >= 1) {
        anchor.position = anchor.target;
        anchor.from = null;
        anchor.target = null;
      }
    }
  }
  return state.activity;
}

export function drawJellyShadow(context, jelly, tuning) {
  context.save();
  context.translate(jelly.position.x + 18, jelly.position.y + 24);
  context.rotate(jelly.heading);
  for (let layer = 3; layer >= 0; layer -= 1) {
    const expansion = 1 + (layer * 0.18);
    context.fillStyle = `rgba(0, 0, 0, ${0.19 - layer * 0.032})`;
    context.beginPath();
    context.ellipse(
      0,
      0,
      tuning.bellRadius * 1.18 * expansion,
      tuning.bellRadius * 0.72 * expansion,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
}

export function drawJelly(context, jelly, now, tuning) {
  const pulse = 1 + (Math.sin(now * tuning.pulseSpeed * Math.PI * 2) * 0.065);
  const bellRadius = tuning.bellRadius * pulse;
  const motionEnergy = clamp(jelly.activity / Math.max(1, tuning.speed), 0, 1);

  for (let index = 0; index < jelly.anchors.length; index += 1) {
    const anchor = jelly.anchors[index];
    const angle = (-Math.PI / 2) + ((index / jelly.anchors.length) * Math.PI * 2);
    const start = {
      x: jelly.position.x + (Math.cos(angle) * bellRadius * 0.65),
      y: jelly.position.y + (Math.sin(angle) * bellRadius * 0.65),
    };
    const dx = anchor.position.x - start.x;
    const dy = anchor.position.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const wave = Math.sin((now * (1.1 + motionEnergy * 1.8)) - (index * 0.82))
      * tuning.elasticity
      * (0.28 + motionEnergy * 0.72);
    const middle = {
      x: lerp(start.x, anchor.position.x, 0.55) + (nx * wave),
      y: lerp(start.y, anchor.position.y, 0.55) + (ny * wave),
    };

    const tension = clamp((length - tuning.tetherLength * 0.72) / Math.max(1, tuning.tetherLength), 0, 1);
    context.strokeStyle = anchor.target
      ? 'rgba(250, 248, 240, 0.88)'
      : `rgba(239, 237, 228, ${0.38 + tension * 0.3})`;
    context.lineWidth = anchor.target ? 1.35 : 0.78 + (tension * 0.34);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(middle.x, middle.y, anchor.position.x, anchor.position.y);
    context.stroke();
    context.fillStyle = '#f5f3eb';
    context.beginPath();
    context.arc(anchor.position.x, anchor.position.y, anchor.target ? 3 : 2.1, 0, Math.PI * 2);
    context.fill();
    if (!anchor.target && tension > 0.25) {
      context.strokeStyle = `rgba(245, 243, 235, ${tension * 0.28})`;
      context.lineWidth = 0.7;
      context.beginPath();
      context.arc(anchor.position.x, anchor.position.y, 4 + tension * 2, 0, Math.PI * 2);
      context.stroke();
    }
  }

  const gradient = context.createRadialGradient(
    jelly.position.x - bellRadius * 0.25,
    jelly.position.y - bellRadius * 0.3,
    2,
    jelly.position.x,
    jelly.position.y,
    bellRadius,
  );
  gradient.addColorStop(0, 'rgba(250, 248, 240, 0.48)');
  gradient.addColorStop(0.56, 'rgba(225, 229, 224, 0.16)');
  gradient.addColorStop(1, 'rgba(225, 229, 224, 0.025)');
  context.fillStyle = gradient;
  context.strokeStyle = 'rgba(248, 246, 238, 0.72)';
  context.lineWidth = 1.1;
  context.beginPath();
  context.ellipse(jelly.position.x, jelly.position.y, bellRadius, bellRadius * 0.82, jelly.heading, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.strokeStyle = 'rgba(248, 246, 238, 0.28)';
  context.lineWidth = 0.75;
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    context.beginPath();
    context.moveTo(jelly.position.x, jelly.position.y);
    context.quadraticCurveTo(
      jelly.position.x + (Math.cos(angle + 0.22) * bellRadius * 0.52),
      jelly.position.y + (Math.sin(angle + 0.22) * bellRadius * 0.42),
      jelly.position.x + (Math.cos(angle) * bellRadius * 0.88),
      jelly.position.y + (Math.sin(angle) * bellRadius * 0.72),
    );
    context.stroke();
  }
  context.fillStyle = 'rgba(250, 248, 240, 0.22)';
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2 + (now * 0.18);
    context.beginPath();
    context.ellipse(
      jelly.position.x + (Math.cos(angle) * bellRadius * 0.28),
      jelly.position.y + (Math.sin(angle) * bellRadius * 0.22),
      bellRadius * 0.12,
      bellRadius * 0.2,
      angle,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.fillStyle = 'rgba(250, 248, 240, 0.72)';
  context.beginPath();
  context.arc(jelly.position.x, jelly.position.y, 3.6, 0, Math.PI * 2);
  context.fill();
}
