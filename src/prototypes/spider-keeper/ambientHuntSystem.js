const TAU = Math.PI * 2;

const HUNT_PROFILES = Object.freeze({
  walker: { standoff: 108, patience: 1.15, catchChance: 0.9, lungeTime: 0.68 },
  crawler: { standoff: 138, patience: 1.4, catchChance: 0.76, lungeTime: 0.82 },
  manta: { standoff: 182, patience: 1.65, catchChance: 0.58, lungeTime: 1.05 },
  jelly: { standoff: 152, patience: 1.85, catchChance: 0.52, lungeTime: 1.1 },
  serpent: { standoff: 122, patience: 1.05, catchChance: 0.81, lungeTime: 0.7 },
});

const randomBetween = (minimum, maximum) => minimum + (Math.random() * (maximum - minimum));
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
const mix = (from, to, amount) => from + ((to - from) * amount);
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function setPhase(system, phase, now) {
  system.phase = phase;
  system.phaseStarted = now;
}

function schedule(system, now, minimum = 7, maximum = 14, retainPosition = false) {
  system.retainArea = retainPosition && system.huntArea ? { ...system.huntArea } : null;
  system.huntArea = null;
  system.prey = null;
  system.directive = null;
  system.retainPosition = retainPosition;
  system.nextSpawn = now + randomBetween(minimum, maximum);
  setPhase(system, 'dormant', now);
}

function spawnPrey(system, now, width, height, keeper) {
  const margin = 42;
  let position = { x: width * 0.25, y: height * 0.25 };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    position = {
      x: randomBetween(margin, Math.max(margin, width - margin)),
      y: randomBetween(margin, Math.max(margin, height - margin)),
    };
    if (distance(position, keeper) > Math.min(240, Math.max(width, height) * 0.28)) break;
  }
  const angle = randomBetween(0, TAU);
  system.prey = {
    x: position.x,
    y: position.y,
    vx: Math.cos(angle) * randomBetween(9, 17),
    vy: Math.sin(angle) * randomBetween(9, 17),
    heading: angle,
    turnAt: now + randomBetween(0.5, 1.4),
    bornAt: now,
    noticeAt: now + randomBetween(2.1, 4.2),
    scale: 1,
    alpha: 1,
    winged: Math.random() > 0.54,
    seed: randomBetween(0, TAU),
  };
  system.huntArea = { x: position.x, y: position.y };
  setPhase(system, 'wandering', now);
}

function steerPrey(prey, now, delta, width, height, speedScale = 1) {
  if (now >= prey.turnAt) {
    const angle = Math.atan2(prey.vy, prey.vx) + randomBetween(-0.9, 0.9);
    const speed = randomBetween(8, 17) * speedScale;
    prey.vx = Math.cos(angle) * speed;
    prey.vy = Math.sin(angle) * speed;
    prey.turnAt = now + randomBetween(0.45, 1.35);
  }
  prey.x += prey.vx * delta;
  prey.y += prey.vy * delta;
  const margin = 28;
  if (prey.x < margin || prey.x > width - margin) prey.vx *= -1;
  if (prey.y < margin || prey.y > height - margin) prey.vy *= -1;
  prey.x = Math.max(margin, Math.min(width - margin, prey.x));
  prey.y = Math.max(margin, Math.min(height - margin, prey.y));
  prey.heading = Math.atan2(prey.vy, prey.vx);
}

function standoffPoint(prey, keeper, range) {
  const dx = keeper.x - prey.x;
  const dy = keeper.y - prey.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: prey.x + ((dx / length) * range),
    y: prey.y + ((dy / length) * range),
  };
}

function flee(system, keeper, now) {
  if (!system.prey) return;
  const dx = system.prey.x - keeper.x;
  const dy = system.prey.y - keeper.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  system.prey.vx = (dx / length) * randomBetween(115, 155);
  system.prey.vy = (dy / length) * randomBetween(115, 155);
  system.directive = null;
  setPhase(system, 'fleeing', now);
}

export function makeAmbientHunt(now = 0) {
  return {
    phase: 'dormant',
    phaseStarted: now,
    nextSpawn: now + randomBetween(5, 9),
    prey: null,
    directive: null,
    willCatch: false,
    missPoint: null,
    retainPosition: false,
    retainArea: null,
    huntArea: null,
  };
}

export function interruptAmbientHunt(system, keeper, now) {
  if (system.prey && !['wandering', 'fleeing'].includes(system.phase)) flee(system, keeper, now);
}

export function updateAmbientHunt(system, options) {
  const {
    now, delta, width, height, keeper, creature, enabled, dockPhase, userIdle,
  } = options;
  const profile = HUNT_PROFILES[creature] || HUNT_PROFILES.walker;
  system.directive = null;

  if (!enabled || dockPhase !== 'free') {
    if (system.prey) schedule(system, now, 8, 14, false);
    system.nextSpawn = Math.max(system.nextSpawn, now + 5);
    return { target: null, energy: 0 };
  }

  if (system.phase === 'dormant') {
    if (userIdle >= 4 && now >= system.nextSpawn) spawnPrey(system, now, width, height, keeper);
  } else if (system.phase === 'wandering') {
    steerPrey(system.prey, now, delta, width, height);
    if (userIdle >= 4 && now >= system.prey.noticeAt) setPhase(system, 'noticed', now);
  } else if (system.phase === 'noticed') {
    steerPrey(system.prey, now, delta, width, height, 0.7);
    const dx = system.prey.x - keeper.x;
    const dy = system.prey.y - keeper.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    system.directive = { x: keeper.x + ((dx / length) * 11), y: keeper.y + ((dy / length) * 11) };
    if (now - system.phaseStarted >= 1.05) setPhase(system, 'stalking', now);
  } else if (system.phase === 'stalking') {
    steerPrey(system.prey, now, delta, width, height, 0.48);
    system.directive = standoffPoint(system.prey, keeper, profile.standoff);
    if (distance(keeper, system.prey) <= profile.standoff + 18 || now - system.phaseStarted > 5.5) {
      setPhase(system, 'poised', now);
    }
  } else if (system.phase === 'poised') {
    steerPrey(system.prey, now, delta, width, height, 0.24);
    system.directive = standoffPoint(system.prey, keeper, profile.standoff * 0.92);
    if (now - system.phaseStarted >= profile.patience) {
      system.willCatch = Math.random() < profile.catchChance;
      const side = Math.random() > 0.5 ? 1 : -1;
      const dx = system.prey.x - keeper.x;
      const dy = system.prey.y - keeper.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      system.missPoint = {
        x: system.prey.x + ((-dy / length) * 42 * side),
        y: system.prey.y + ((dx / length) * 42 * side),
      };
      setPhase(system, 'lunging', now);
    }
  } else if (system.phase === 'lunging') {
    const progress = Math.min(1, (now - system.phaseStarted) / profile.lungeTime);
    system.directive = system.willCatch ? { x: system.prey.x, y: system.prey.y } : system.missPoint;
    if (progress > 0.55 && !system.willCatch) {
      const awayX = system.prey.x - keeper.x;
      const awayY = system.prey.y - keeper.y;
      const length = Math.max(1, Math.hypot(awayX, awayY));
      system.prey.vx = (awayX / length) * 145;
      system.prey.vy = (awayY / length) * 145;
      system.prey.x += system.prey.vx * delta;
      system.prey.y += system.prey.vy * delta;
    }
    if (progress >= 1 || (system.willCatch && distance(keeper, system.prey) < 22)) {
      if (system.willCatch) setPhase(system, 'caught', now);
      else flee(system, keeper, now);
    }
  } else if (system.phase === 'caught') {
    const amount = 1 - Math.exp(-10 * delta);
    system.prey.x = mix(system.prey.x, keeper.x, amount);
    system.prey.y = mix(system.prey.y, keeper.y, amount);
    const progress = Math.min(1, (now - system.phaseStarted) / 1.45);
    system.prey.scale = 1 - (progress * 0.88);
    system.prey.alpha = 1 - (progress * 0.8);
    system.directive = { x: keeper.x, y: keeper.y };
    if (progress >= 1) schedule(system, now, 10, 18, true);
  } else if (system.phase === 'fleeing') {
    system.directive = { x: keeper.x, y: keeper.y };
    system.prey.x += system.prey.vx * delta;
    system.prey.y += system.prey.vy * delta;
    system.prey.alpha = Math.max(0, 1 - ((now - system.phaseStarted) / 1.5));
    if (
      system.prey.alpha <= 0
      || system.prey.x < -30 || system.prey.x > width + 30
      || system.prey.y < -30 || system.prey.y > height + 30
    ) schedule(system, now, 9, 17, true);
  }

  const retainPosition = system.retainPosition;
  const retainArea = system.retainArea;
  system.retainPosition = false;
  system.retainArea = null;
  return {
    target: system.directive,
    energy: system.prey ? 0.45 : 0,
    retainPosition,
    retainArea,
  };
}

export function drawAmbientHunt(context, system, now) {
  const prey = system.prey;
  if (!prey || prey.alpha <= 0) return;
  const flutter = Math.sin((now * 19) + prey.seed);
  context.save();
  context.translate(prey.x, prey.y);
  context.rotate(prey.heading + (Math.PI / 2));
  context.scale(prey.scale, prey.scale);
  context.globalAlpha = prey.alpha;

  if (prey.winged) {
    context.fillStyle = 'rgba(245, 243, 235, 0.22)';
    context.beginPath();
    context.ellipse(-4.5 - (flutter * 1.4), 0, 4.8, 2.2, -0.35, 0, TAU);
    context.ellipse(4.5 + (flutter * 1.4), 0, 4.8, 2.2, 0.35, 0, TAU);
    context.fill();
  }

  context.strokeStyle = 'rgba(245, 243, 235, 0.6)';
  context.lineWidth = 0.75;
  for (const side of [-1, 1]) {
    for (const y of [-2.5, 0, 2.5]) {
      context.beginPath();
      context.moveTo(side * 1.5, y);
      context.lineTo(side * (5.5 + Math.abs(flutter)), y + (side * 2));
      context.stroke();
    }
  }
  context.fillStyle = 'rgba(250, 248, 240, 0.92)';
  context.beginPath();
  context.ellipse(0, 0, 2.3, 5.2, 0, 0, TAU);
  context.fill();
  context.fillStyle = '#050606';
  context.beginPath();
  context.arc(0, -3.5, 1.2, 0, TAU);
  context.fill();

  if (system.phase === 'caught') {
    const impact = clamp(1 - ((now - system.phaseStarted) / 0.34), 0, 1);
    const pulse = ((now - system.phaseStarted) * 2.4) % 1;
    context.strokeStyle = `rgba(245, 243, 235, ${0.24 * (1 - pulse)})`;
    context.beginPath();
    context.arc(0, 0, 5 + (pulse * 16), 0, TAU);
    context.stroke();
    context.strokeStyle = `rgba(250, 248, 240, ${0.78 * impact})`;
    context.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * TAU;
      context.moveTo(Math.cos(angle) * 7, Math.sin(angle) * 7);
      context.lineTo(Math.cos(angle) * (10 + impact * 5), Math.sin(angle) * (10 + impact * 5));
    }
    context.stroke();
  }
  context.restore();
}

export function drawAmbientNoticeMark(context, system, keeper, now) {
  if (system.phase !== 'noticed' || !system.prey) return;
  const age = now - system.phaseStarted;
  const appear = clamp(age / 0.14, 0, 1);
  const fade = clamp((1.05 - age) / 0.28, 0, 1);
  const scale = (0.72 + (appear * 0.28)) * fade;
  const dx = keeper.x - system.prey.x;
  const dy = keeper.y - system.prey.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const x = keeper.x + ((dx / length) * 25) + 8;
  const y = keeper.y + ((dy / length) * 25) - 14;

  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.strokeStyle = 'rgba(250, 248, 240, 0.92)';
  context.fillStyle = 'rgba(250, 248, 240, 0.96)';
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(0, 1);
  context.stroke();
  context.beginPath();
  context.arc(0, 6, 1.45, 0, TAU);
  context.fill();
  context.restore();
}

export function ambientHuntLabel(phase) {
  return ({
    dormant: 'QUIET', wandering: 'LIFE DETECTED', noticed: 'NOTICED', stalking: 'STALKING',
    poised: 'WATCHING', lunging: 'STRIKING', caught: 'FEEDING', fleeing: 'PREY ESCAPED',
  })[phase] || 'QUIET';
}
