import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_RENDER_CONFIG, DEFAULT_REACTION_DURATION } from './renderConfig.defaults.js';
import { normalizeRenderConfig } from './normalizeRenderConfig.js';
import { resolveReactionFrame, resolveReactionProgress } from './reactionProfiles.js';

test('canonical default profiles reproduce all existing event targets and tuning', () => {
  const lyx = resolveReactionFrame(DEFAULT_RENDER_CONFIG, 'lyx_received', 0);
  assert.equal(lyx.duration, DEFAULT_REACTION_DURATION);
  assert.equal(lyx.progress, 1);
  assert.deepEqual(lyx.modifiers.aura, { opacity: 1, scale: 1.35 });
  assert.deepEqual(lyx.modifiers.particles, { count: 300, speed: 4.5 });
  assert.deepEqual(lyx.modifiers.warp, { intensity: 50 });
  assert.deepEqual(lyx.modifiers.screenShake, { intensity: 25 });
  assert.deepEqual(lyx.modifiers.trail, { enabled: true, intensity: 1 });
  assert.deepEqual(lyx.modifiers.shockwave, { enabled: true });
  assert.deepEqual(lyx.modifiers.phenomena.veins, {
    pulse: 1,
    intensityBoost: 0.75,
    color: [255, 61.2, 7.65]
  });
  assert.deepEqual(lyx.modifiers.phenomena.weather, { intensityBoost: 0.34 });

  const lsp7 = resolveReactionFrame(DEFAULT_RENDER_CONFIG, 'lsp7_received', 0);
  assert.deepEqual(lsp7.modifiers.warp, { intensity: 90 });
  assert.deepEqual(lsp7.modifiers.chromaticAberration, { amount: 30, speed: 8, glitchBurstChance: 0 });
  assert.deepEqual(lsp7.modifiers.flicker, { intensity: 0.85, speed: 1 });
  assert.equal(lsp7.modifiers.screenShake, undefined);
  assert.deepEqual(lsp7.modifiers.phenomena.veins.color, [255, 20.4, 255]);

  const lsp8 = resolveReactionFrame(DEFAULT_RENDER_CONFIG, 'lsp8_received', 0);
  assert.deepEqual(lsp8.modifiers.screenShake, { intensity: 25 });
  assert.deepEqual(lsp8.modifiers.chromaticAberration, lsp7.modifiers.chromaticAberration);
});

test('arbitrary event identifiers resolve assigned reusable profiles without consumer changes', () => {
  const config = normalizeRenderConfig({
    reactions: {
      events: { 'future.collection/reveal': 'gentle_reveal' },
      profiles: {
        gentle_reveal: {
          duration: 4,
          easing: 'easeInOut',
          decay: 'out',
          channels: {
            aura: { opacity: 0.8 },
            warp: { intensity: 42 },
            trail: { enabled: true, intensity: 0.25 }
          }
        }
      }
    }
  });
  const resolved = resolveReactionFrame(config, 'future.collection/reveal', 0);

  assert.equal(resolved.profileId, 'gentle_reveal');
  assert.equal(resolved.duration, 4);
  assert.equal(resolved.modifiers.aura.opacity, 0.8);
  assert.equal(resolved.modifiers.warp.intensity, 42);
  assert.equal(resolved.modifiers.trail.intensity, 0.25);
});

test('missing and disabled channels preserve every scoped baseline value', () => {
  const config = normalizeRenderConfig({
    actor: { aura: { opacity: 0.37 }, warp: { intensity: 33 } },
    effects: { spectralTrail: { manualAlpha: 0.45 } },
    reactions: {
      events: { quiet_event: 'quiet' },
      profiles: {
        quiet: {
          duration: 2,
          channels: {
            aura: { enabled: false },
            trail: { enabled: false },
            shockwave: { enabled: false }
          }
        }
      }
    }
  });
  const resolved = resolveReactionFrame(config, 'quiet_event', 0);

  assert.equal(resolved.modifiers.aura, undefined);
  assert.equal(resolved.modifiers.warp, undefined);
  assert.equal(resolved.modifiers.trail, undefined);
  assert.equal(resolved.modifiers.shockwave, undefined);
  assert.equal(config.actor.aura.opacity, 0.37);
  assert.equal(config.actor.warp.intensity, 33);
  assert.equal(config.effects.spectralTrail.manualAlpha, 0.45);
});

test('reaction progress applies configured easing and decay without mutating baseline config', () => {
  const profile = { enabled: true, duration: 4, easing: 'easeIn', decay: 'out' };
  assert.equal(resolveReactionProgress(profile, 0), 1);
  assert.equal(resolveReactionProgress(profile, 2), 0.75);
  assert.equal(resolveReactionProgress(profile, 4), 0);

  const config = normalizeRenderConfig(DEFAULT_RENDER_CONFIG);
  const before = structuredClone(config);
  const half = resolveReactionFrame(config, 'lyx_received', DEFAULT_REACTION_DURATION / 2);
  assert.equal(half.progress, 0.5);
  assert.equal(half.modifiers.aura.opacity, 0.75);
  assert.equal(half.modifiers.particles.count, 190);
  assert.deepEqual(config, before);
});

test('zero baselines interpolate directly to positive aura, particle, and warp targets', () => {
  const config = normalizeRenderConfig({
    actor: { aura: { opacity: 0 }, warp: { intensity: 0 } },
    scene: { atmosphere: { particles: { count: 0, speed: 0 } } },
    reactions: {
      events: { zero_baseline_event: 'zero_baseline_profile' },
      profiles: {
        zero_baseline_profile: {
          duration: 2,
          easing: 'linear',
          decay: 'out',
          channels: {
            aura: { opacity: 0.8 },
            particles: { count: 120, speed: 4 },
            warp: { intensity: 60 }
          }
        }
      }
    }
  });

  const baseline = resolveReactionFrame(config, 'zero_baseline_event', 2);
  assert.equal(baseline.progress, 0);
  assert.equal(baseline.modifiers.aura.opacity, 0);
  assert.deepEqual(baseline.modifiers.particles, { count: 0, speed: 0 });
  assert.deepEqual(baseline.modifiers.warp, { intensity: 0 });

  const halfway = resolveReactionFrame(config, 'zero_baseline_event', 1);
  assert.equal(halfway.progress, 0.5);
  assert.equal(halfway.modifiers.aura.opacity, 0.4);
  assert.deepEqual(halfway.modifiers.particles, { count: 60, speed: 2 });
  assert.deepEqual(halfway.modifiers.warp, { intensity: 30 });

  const target = resolveReactionFrame(config, 'zero_baseline_event', 0);
  assert.equal(target.progress, 1);
  assert.equal(target.modifiers.aura.opacity, 0.8);
  assert.deepEqual(target.modifiers.particles, { count: 120, speed: 4 });
  assert.deepEqual(target.modifiers.warp, { intensity: 60 });
});

test('normalization strips runtime state from RenderConfig reactions', () => {
  const config = normalizeRenderConfig({
    reactions: {
      activeEvent: 'runtime_only',
      elapsed: 1,
      progress: 0.5,
      activeShockwaves: [{}],
      trailHistory: [{}],
      randomGlitchEvents: [{}],
      calculatedValues: {},
      events: { custom: 'profile' },
      profiles: { profile: { duration: 1, channels: { aura: { opacity: 0.9 }, calculatedOpacity: 123 } } }
    }
  });

  for (const key of ['activeEvent', 'elapsed', 'progress', 'activeShockwaves', 'trailHistory', 'randomGlitchEvents', 'calculatedValues']) {
    assert.equal(Object.hasOwn(config.reactions, key), false);
  }
  assert.equal(Object.hasOwn(config.reactions.profiles.profile.channels, 'calculatedOpacity'), false);
});

test('rendering consumers contain no canonical event-name branching', async () => {
  const consumers = [
    '../engine/PixiEngine.js',
    '../engine/entities/ActorEntity.js',
    '../engine/entities/StageEntity.js',
    '../engine/systems/EffectsSystem.js',
    '../engine/systems/ParticleSystem.js',
    '../engine/systems/RenderTextureManager.js',
    '../engine/systems/TrailSystem.js',
    '../engine/systems/trailRuntime.js',
    '../engine/systems/VeinPulseSystem.js',
    '../engine/systems/CaptiveWeatherSystem.js',
    '../engine/systems/FlightDynamics.js',
    '../engine/systems/ShockwaveSystem.js'
  ];
  const sources = await Promise.all(consumers.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  for (const source of sources) {
    assert.doesNotMatch(source, /lyx_received|lsp7_received|lsp8_received/);
  }
});
