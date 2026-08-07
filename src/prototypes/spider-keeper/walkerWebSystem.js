const TAU = Math.PI * 2;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const mix = (from, to, amount) => from + ((to - from) * amount);

function webPoint(web, ring, index) {
  const anchor = web.anchors[index];
  const wobble = Math.sin((index * 2.17) + (ring * 4.3) + web.seed) * 1.8;
  return {
    x: mix(web.hub.x, anchor.x, ring) + wobble,
    y: mix(web.hub.y, anchor.y, ring) - wobble,
  };
}

function drawPartialLine(context, from, to, progress) {
  if (progress <= 0) return;
  context.moveTo(from.x, from.y);
  context.lineTo(mix(from.x, to.x, clamp(progress, 0, 1)), mix(from.y, to.y, clamp(progress, 0, 1)));
}

function makeWeb(center, legs, now) {
  const anchors = legs
    .map((leg) => leg.step?.to || leg.foot)
    .map((point) => ({ x: point.x, y: point.y }))
    .sort((first, second) => (
      Math.atan2(first.y - center.y, first.x - center.x)
      - Math.atan2(second.y - center.y, second.x - center.x)
    ));
  const seed = Math.random() * TAU;
  return {
    center: { ...center },
    hub: {
      x: center.x + (Math.cos(seed) * 5),
      y: center.y + (Math.sin(seed) * 5),
    },
    anchors,
    seed,
    startedAt: now,
    finishedAt: null,
    progress: 0,
  };
}

export function makeWalkerWebSystem() {
  return {
    webs: [],
    idleSince: null,
    lastWebAt: -Infinity,
    lastWebPosition: null,
  };
}

export function updateWalkerWebSystem(system, options) {
  const { now, center, legs, activity, enabled, reducedMotion } = options;
  for (const web of system.webs) {
    web.progress = reducedMotion ? 1 : clamp((now - web.startedAt) / 3.1, 0, 1);
    if (web.progress >= 1 && web.finishedAt === null) web.finishedAt = now;
  }
  system.webs = system.webs.filter((web) => web.finishedAt === null || now - web.finishedAt < 48);

  if (!enabled || activity > 7 || legs.some((leg) => leg.step)) {
    system.idleSince = null;
    return system.webs.some((web) => web.progress < 1) ? 0.28 : 0;
  }

  if (system.idleSince === null) system.idleSince = now;
  const farFromLast = !system.lastWebPosition
    || Math.hypot(center.x - system.lastWebPosition.x, center.y - system.lastWebPosition.y) > 82;
  if (
    now - system.idleSince > 1.65
    && now - system.lastWebAt > 9
    && farFromLast
    && legs.length >= 4
  ) {
    system.webs.push(makeWeb(center, legs, now));
    if (system.webs.length > 3) system.webs.shift();
    system.lastWebAt = now;
    system.lastWebPosition = { ...center };
  }

  return system.webs.some((web) => web.progress < 1) ? 0.32 : 0;
}

export function drawWalkerWebs(context, system, now) {
  for (const web of system.webs) {
    if (web.anchors.length < 3) continue;
    const ageAfterFinish = web.finishedAt === null ? 0 : now - web.finishedAt;
    const alpha = clamp(1 - (ageAfterFinish / 48), 0, 1);
    const spokeProgress = clamp(web.progress * 1.9, 0, 1);
    const ringProgress = clamp((web.progress - 0.38) / 0.62, 0, 1);

    context.save();
    context.strokeStyle = `rgba(245, 243, 235, ${0.19 * alpha})`;
    context.lineWidth = 0.65;
    context.beginPath();
    for (let index = 0; index < web.anchors.length; index += 1) {
      const local = clamp((spokeProgress * web.anchors.length) - index, 0, 1);
      drawPartialLine(context, web.hub, web.anchors[index], local);
    }
    context.stroke();

    const rings = [0.24, 0.43, 0.63, 0.82];
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
      const localRing = clamp((ringProgress * rings.length) - ringIndex, 0, 1);
      if (localRing <= 0) continue;
      context.strokeStyle = `rgba(245, 243, 235, ${(0.12 + ringIndex * 0.018) * alpha})`;
      context.beginPath();
      const segmentProgress = localRing * web.anchors.length;
      for (let index = 0; index < web.anchors.length; index += 1) {
        const from = webPoint(web, rings[ringIndex], index);
        const to = webPoint(web, rings[ringIndex], (index + 1) % web.anchors.length);
        drawPartialLine(context, from, to, segmentProgress - index);
      }
      context.stroke();
    }

    context.fillStyle = `rgba(250, 248, 240, ${0.32 * alpha * spokeProgress})`;
    context.beginPath();
    context.arc(web.hub.x, web.hub.y, 1.35, 0, TAU);
    context.fill();
    context.restore();
  }
}
