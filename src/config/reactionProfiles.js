import { DEFAULT_RENDER_CONFIG, DEFAULT_REACTION_DURATION } from './renderConfig.defaults.js';

const EASINGS = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut']);
const DECAYS = new Set(['out', 'in']);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, fallback, min = -Infinity, max = Infinity) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
};
const optionalFinite = (value, fallback, min = -Infinity, max = Infinity) => {
  if (value === undefined && fallback === undefined) return undefined;
  return finite(value, fallback, min, max);
};
const optionalBoolean = (value, fallback) => {
  if (value === undefined && fallback === undefined) return undefined;
  return typeof value === 'boolean' ? value : fallback;
};

function normalizeSimpleChannel(candidate, fallback, fields) {
  if (!isRecord(candidate) && !isRecord(fallback)) return undefined;
  const source = isRecord(candidate) ? candidate : {};
  const base = isRecord(fallback) ? fallback : {};
  if (source.enabled === false) return { enabled: false };
  const channel = {};
  const enabled = optionalBoolean(source.enabled, base.enabled);
  if (enabled !== undefined) channel.enabled = enabled;
  for (const [key, limits] of Object.entries(fields)) {
    const value = optionalFinite(source[key], base[key], limits[0], limits[1]);
    if (value !== undefined) channel[key] = value;
  }
  return channel;
}

function normalizeColorRule(candidate, fallback) {
  if (!isRecord(candidate) && !isRecord(fallback)) return undefined;
  const normalizeTriplet = (values, baseValues) => [0, 1, 2].map((index) => {
    const value = values?.[index];
    const base = baseValues?.[index] ?? null;
    if (value === null) return null;
    if (value === undefined) return base;
    return finite(value, base, 0, 255);
  });
  return {
    target: normalizeTriplet(candidate?.target, fallback?.target),
    minimum: normalizeTriplet(candidate?.minimum, fallback?.minimum)
  };
}

function normalizePhenomena(candidate, fallback) {
  if (!isRecord(candidate) && !isRecord(fallback)) return undefined;
  const source = isRecord(candidate) ? candidate : {};
  const base = isRecord(fallback) ? fallback : {};
  if (source.enabled === false) return { enabled: false };
  const result = {};
  const enabled = optionalBoolean(source.enabled, base.enabled);
  if (enabled !== undefined) result.enabled = enabled;

  const veins = normalizeSimpleChannel(source.veins, base.veins, {
    pulse: [0, 1],
    reactionBoostMultiplier: [0, 10]
  });
  if (veins) {
    const color = normalizeColorRule(source.veins?.color, base.veins?.color);
    if (color) veins.color = color;
    result.veins = veins;
  }
  const weather = normalizeSimpleChannel(source.weather, base.weather, {
    intensityBoost: [-10, 10]
  });
  if (weather) result.weather = weather;
  return result;
}

function normalizeChannels(candidate, fallback) {
  const source = isRecord(candidate) ? candidate : {};
  const base = isRecord(fallback) ? fallback : {};
  const channels = {};
  const definitions = {
    aura: { opacity: [0, 10], scale: [0, 10] },
    particles: { count: [0, 10000], speed: [0, 100] },
    warp: { intensity: [0, 1000] },
    chromaticAberration: { amount: [0, 1000], speed: [0, 100], glitchBurstChance: [0, 100] },
    flicker: { intensity: [0, 1], speed: [0, 100] },
    screenShake: { intensity: [0, 1000] },
    trail: { intensity: [0, 10] },
    shockwave: {}
  };
  for (const [key, fields] of Object.entries(definitions)) {
    const channel = normalizeSimpleChannel(source[key], base[key], fields);
    if (!channel) continue;
    if (key === 'chromaticAberration') {
      const instantSpeed = optionalBoolean(source[key]?.instantSpeed, base[key]?.instantSpeed);
      const instantGlitch = optionalBoolean(source[key]?.instantGlitchBurstChance, base[key]?.instantGlitchBurstChance);
      if (instantSpeed !== undefined) channel.instantSpeed = instantSpeed;
      if (instantGlitch !== undefined) channel.instantGlitchBurstChance = instantGlitch;
    }
    channels[key] = channel;
  }
  const phenomena = normalizePhenomena(source.phenomena, base.phenomena);
  if (phenomena) channels.phenomena = phenomena;
  return channels;
}

function normalizeProfile(candidate, fallback) {
  const source = isRecord(candidate) ? candidate : {};
  const base = isRecord(fallback) ? fallback : {};
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : (base.enabled ?? true),
    duration: finite(source.duration, base.duration ?? DEFAULT_REACTION_DURATION, 0.001, 3600),
    easing: EASINGS.has(source.easing) ? source.easing : (EASINGS.has(base.easing) ? base.easing : 'linear'),
    decay: DECAYS.has(source.decay) ? source.decay : (DECAYS.has(base.decay) ? base.decay : 'out'),
    channels: normalizeChannels(source.channels, base.channels)
  };
}

export function normalizeReactionsConfig(candidate = {}) {
  const defaults = DEFAULT_RENDER_CONFIG.reactions;
  const source = isRecord(candidate) ? candidate : {};
  const events = { ...defaults.events };
  if (isRecord(source.events)) {
    for (const [eventId, profileId] of Object.entries(source.events)) {
      if (!eventId.trim()) continue;
      if (profileId === null) delete events[eventId];
      else if (typeof profileId === 'string' && profileId.trim()) events[eventId] = profileId;
    }
  }

  const profiles = {};
  const profileIds = new Set([
    ...Object.keys(defaults.profiles),
    ...Object.keys(isRecord(source.profiles) ? source.profiles : {})
  ]);
  for (const profileId of profileIds) {
    if (!profileId.trim()) continue;
    profiles[profileId] = normalizeProfile(source.profiles?.[profileId], defaults.profiles[profileId]);
  }
  const assignedEvents = Object.fromEntries(
    Object.entries(events).filter(([, profileId]) => Object.hasOwn(profiles, profileId))
  );
  return { events: assignedEvents, profiles };
}

function ease(value, easing) {
  if (easing === 'easeIn') return value * value;
  if (easing === 'easeOut') return 1 - ((1 - value) * (1 - value));
  if (easing === 'easeInOut') return value < 0.5
    ? 2 * value * value
    : 1 - ((-2 * value + 2) ** 2) / 2;
  return value;
}

export function resolveReactionProgress(profile, elapsed) {
  if (!profile?.enabled) return 0;
  const timeRatio = Math.max(0, Math.min(1, finite(elapsed, 0) / profile.duration));
  const eased = ease(timeRatio, profile.easing);
  return profile.decay === 'in' ? eased : 1 - eased;
}

const lerp = (baseline, target, progress) => baseline + (target - baseline) * progress;
const activeChannel = (channel) => channel && channel.enabled !== false;
const resolveTarget = (baseline, channel, key, progress, instant = false) => (
  channel[key] === undefined ? baseline : lerp(baseline, channel[key], instant && progress > 0 ? 1 : progress)
);

function resolveVeinColor(baseline, rule) {
  if (!rule) return baseline;
  return baseline.map((value, index) => {
    const target = rule.target[index];
    const minimum = rule.minimum[index];
    const targeted = target === null ? value : target;
    return minimum === null ? targeted : Math.max(targeted, minimum);
  });
}

export function resolveReactionFrame(renderConfig, eventId, elapsed = 0) {
  const reactions = renderConfig?.reactions ?? DEFAULT_RENDER_CONFIG.reactions;
  const profileId = typeof eventId === 'string' ? reactions.events?.[eventId] : null;
  const profile = profileId ? reactions.profiles?.[profileId] : null;
  if (!profile?.enabled) {
    return { active: null, profileId: null, elapsed: 0, progress: 0, duration: 0, complete: true, modifiers: {} };
  }

  const progress = resolveReactionProgress(profile, elapsed);
  const channels = profile.channels ?? {};
  const modifiers = {};
  const actor = renderConfig.actor;
  const particles = renderConfig.scene.atmosphere.particles;
  const effects = renderConfig.effects;

  if (activeChannel(channels.aura)) modifiers.aura = {
    opacity: resolveTarget(actor.aura.opacity, channels.aura, 'opacity', progress),
    scale: resolveTarget(actor.aura.scale, channels.aura, 'scale', progress)
  };
  if (activeChannel(channels.particles)) modifiers.particles = {
    count: resolveTarget(particles.count, channels.particles, 'count', progress),
    speed: resolveTarget(particles.speed, channels.particles, 'speed', progress)
  };
  if (activeChannel(channels.warp)) modifiers.warp = {
    intensity: resolveTarget(actor.warp.intensity, channels.warp, 'intensity', progress)
  };
  if (activeChannel(channels.chromaticAberration)) modifiers.chromaticAberration = {
    amount: resolveTarget(effects.chromaticAberration.amount, channels.chromaticAberration, 'amount', progress),
    speed: resolveTarget(effects.chromaticAberration.speed, channels.chromaticAberration, 'speed', progress, channels.chromaticAberration.instantSpeed),
    glitchBurstChance: resolveTarget(effects.chromaticAberration.glitchBurstChance, channels.chromaticAberration, 'glitchBurstChance', progress, channels.chromaticAberration.instantGlitchBurstChance)
  };
  if (activeChannel(channels.flicker)) modifiers.flicker = {
    intensity: resolveTarget(effects.flicker.intensity, channels.flicker, 'intensity', progress),
    speed: resolveTarget(effects.flicker.speed, channels.flicker, 'speed', progress)
  };
  if (activeChannel(channels.screenShake)) modifiers.screenShake = {
    intensity: resolveTarget(effects.glitch.screenShakeIntensity, channels.screenShake, 'intensity', progress)
  };
  if (activeChannel(channels.trail)) modifiers.trail = {
    enabled: channels.trail.enabled ?? true,
    intensity: (channels.trail.intensity ?? 1) * progress
  };
  if (activeChannel(channels.shockwave)) modifiers.shockwave = { enabled: channels.shockwave.enabled ?? true };

  if (activeChannel(channels.phenomena)) {
    modifiers.phenomena = {};
    if (activeChannel(channels.phenomena.veins)) {
      const veins = channels.phenomena.veins;
      modifiers.phenomena.veins = {
        pulse: (veins.pulse ?? 0) * progress,
        intensityBoost: renderConfig.phenomena.veins.reactionBoost * (veins.reactionBoostMultiplier ?? 0) * progress,
        color: progress > 0 ? resolveVeinColor(renderConfig.phenomena.veins.color, veins.color) : renderConfig.phenomena.veins.color
      };
    }
    if (activeChannel(channels.phenomena.weather)) {
      modifiers.phenomena.weather = {
        intensityBoost: (channels.phenomena.weather.intensityBoost ?? 0) * progress
      };
    }
  }

  return {
    active: eventId,
    profileId,
    elapsed,
    progress,
    duration: profile.duration,
    complete: elapsed >= profile.duration,
    modifiers
  };
}
