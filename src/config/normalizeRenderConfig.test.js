import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RENDER_CONFIG, RENDER_CONFIG_VERSION } from './renderConfig.defaults.js';
import { RENDER_PARAMETER_DEFINITIONS } from './renderConfig.schema.js';
import {
  createRenderConfigFromFlatState,
  normalizeRenderConfig,
  toFlatRenderParameters,
  updateRenderConfigParameter
} from './normalizeRenderConfig.js';

test('default config round-trips through the flat editor compatibility layer', () => {
  const flat = toFlatRenderParameters(DEFAULT_RENDER_CONFIG);
  const restored = createRenderConfigFromFlatState(flat);

  assert.deepEqual(restored, normalizeRenderConfig(DEFAULT_RENDER_CONFIG));
  assert.equal(restored.schemaVersion, RENDER_CONFIG_VERSION);
  assert.equal(RENDER_CONFIG_VERSION, 5);
});

test('normalization clamps numeric input and rejects invalid booleans', () => {
  const normalized = normalizeRenderConfig({
    phenomena: {
      veins: { enabled: 'false', intensity: 99, color: [-20, 42.4, 900] },
      shedSkin: { count: 2.6, lifetime: 'not-a-number' }
    }
  });

  assert.equal(normalized.phenomena.veins.enabled, true);
  assert.equal(normalized.phenomena.veins.intensity, 2);
  assert.deepEqual(normalized.phenomena.veins.color, [0, 42, 255]);
  assert.equal(normalized.phenomena.shedSkin.count, 3);
  assert.equal(normalized.phenomena.shedSkin.lifetime, DEFAULT_RENDER_CONFIG.phenomena.shedSkin.lifetime);
});

test('a flat editor update produces a new validated RenderConfig', () => {
  const original = normalizeRenderConfig(DEFAULT_RENDER_CONFIG);
  const update = updateRenderConfigParameter(original, 'weatherScale', -10);

  assert.equal(update.value, 0.5);
  assert.equal(update.renderConfig.phenomena.weather.scale, 0.5);
  assert.equal(original.phenomena.weather.scale, DEFAULT_RENDER_CONFIG.phenomena.weather.scale);
  assert.equal(updateRenderConfigParameter(original, 'unknownParameter', 1), null);
});

test('actor geometry options and warp values round-trip without changing dropdown semantics', () => {
  const config = createRenderConfigFromFlatState({
    mutationMode: 'quad',
    mutationSourceX: 'right',
    mutationSourceY: 'bottom',
    mutationRotationDirection: 'counterclockwise',
    mutationRotationSpeed: 58,
    warpMode: 'organic'
  });
  const flat = toFlatRenderParameters(config);

  assert.equal(config.actor.geometry.mode, 'quad');
  assert.equal(config.actor.geometry.sourceX, 'right');
  assert.equal(config.actor.geometry.sourceY, 'bottom');
  assert.equal(config.actor.geometry.rotationDirection, 'counterclockwise');
  assert.equal(flat.mutationRotationSpeed, 58);
  assert.equal(flat.warpMode, 'organic');

  const invalid = updateRenderConfigParameter(config, 'mutationMode', 'unknown-mode');
  assert.equal(invalid.value, 'quad');

  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.mutationMode.options, [
    { value: 'none', label: 'Original' },
    { value: 'mirrorX', label: 'Mirror Left / Right' },
    { value: 'mirrorY', label: 'Mirror Top / Bottom' },
    { value: 'quad', label: 'Four Way' }
  ]);
  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.mutationSourceX.options, [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' }
  ]);
  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.mutationSourceY.options, [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' }
  ]);
  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.mutationRotationDirection.options, [
    { value: 'clockwise', label: 'Clockwise' },
    { value: 'counterclockwise', label: 'Counter-clockwise' }
  ]);
});

test('actor completion defaults round-trip through every flat editor alias', () => {
  const flat = toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'actor');
  const restored = createRenderConfigFromFlatState(flat);

  assert.deepEqual(restored.actor.motion, DEFAULT_RENDER_CONFIG.actor.motion);
  assert.deepEqual(restored.actor.eyes, DEFAULT_RENDER_CONFIG.actor.eyes);
  assert.deepEqual(restored.actor.aura, DEFAULT_RENDER_CONFIG.actor.aura);
  assert.deepEqual(restored.actor.searchlight, DEFAULT_RENDER_CONFIG.actor.searchlight);
  assert.equal(flat.floatSpeed, 1);
  assert.equal(flat.autoBlink, true);
  assert.equal(flat.auraColorR, 235);
  assert.equal(flat.searchlightRadius, 150);
});

test('scene defaults round-trip through every flat editor alias', () => {
  const flat = toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'scene');
  const restored = createRenderConfigFromFlatState({
    ...toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'actor'),
    ...flat
  });

  assert.deepEqual(restored.scene, DEFAULT_RENDER_CONFIG.scene);
  assert.equal(flat.bgClippingMaskId, 'moonpurple');
  assert.equal(flat.bgMountainId, 2);
  assert.equal(flat.bgPatternBottomScale, 1);
  assert.equal(flat.particleCount, 80);
  assert.equal(flat.fogColorB, 180);
});

test('scene normalization clamps invalid numbers and normalizes RGB channels', () => {
  const normalized = normalizeRenderConfig({
    scene: {
      background: { scrollSpeed: 999, parallaxSpeed: -99, patternWarp: { bottomScale: 0 } },
      atmosphere: {
        particles: { count: 12.7, size: -5 },
        fog: { opacity: 7, color: [-1, 42.6, 999], swayAmplitude: 'invalid' }
      }
    }
  });

  assert.equal(normalized.scene.background.scrollSpeed, 150);
  assert.equal(normalized.scene.background.parallaxSpeed, -5);
  assert.equal(normalized.scene.background.patternWarp.bottomScale, 0.5);
  assert.equal(normalized.scene.atmosphere.particles.count, 13);
  assert.equal(normalized.scene.atmosphere.particles.size, 0.1);
  assert.equal(normalized.scene.atmosphere.fog.opacity, 1);
  assert.deepEqual(normalized.scene.atmosphere.fog.color, [0, 43, 255]);
  assert.equal(normalized.scene.atmosphere.fog.swayAmplitude, DEFAULT_RENDER_CONFIG.scene.atmosphere.fog.swayAmplitude);
});

test('invalid actor and scene dropdown values fall back without changing option sets', () => {
  const normalized = normalizeRenderConfig({
    actor: { id: 'missing_actor' },
    scene: { background: { backdropId: 'missing', patternStyle: 'missing', mountainFrontId: 99, mountainBackId: 0 } }
  });

  assert.equal(normalized.actor.id, DEFAULT_RENDER_CONFIG.actor.id);
  assert.equal(normalized.scene.background.backdropId, DEFAULT_RENDER_CONFIG.scene.background.backdropId);
  assert.equal(normalized.scene.background.patternStyle, DEFAULT_RENDER_CONFIG.scene.background.patternStyle);
  assert.equal(normalized.scene.background.mountainFrontId, DEFAULT_RENDER_CONFIG.scene.background.mountainFrontId);
  assert.equal(normalized.scene.background.mountainBackId, DEFAULT_RENDER_CONFIG.scene.background.mountainBackId);
  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.characterId.values, ['skull_reaper', 'abyssal_eye']);
  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.bgClippingMaskId.values, [
    'beige', 'black', 'darkblue', 'darkgrey', 'hotpink', 'lightblue',
    'lightgrey', 'orange', 'pastelpurple', 'purple', 'moonpurple'
  ]);
  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.bgPatternStyle.values, ['bubble', 'stone', 'digitalblob', 'zebra']);
  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.bgMountainId.values, [1, 2, 3]);
  assert.deepEqual(RENDER_PARAMETER_DEFINITIONS.bgMountainId.options, RENDER_PARAMETER_DEFINITIONS.bgMountainBackId.options);
});

test('actor completion values are validated by canonical definitions', () => {
  const normalized = normalizeRenderConfig({
    actor: {
      motion: { floatSpeed: 99, flyTiltBias: -99 },
      eyes: { autoBlink: 'false', blinkSpeed: 0 },
      aura: { scale: 9, color: [-5, 42.6, 999] },
      searchlight: { enabled: 'true', width: 0, radius: 999, color: [1.2, 2.8, 3.5] }
    }
  });

  assert.equal(normalized.actor.motion.floatSpeed, 3);
  assert.equal(normalized.actor.motion.flyTiltBias, -20);
  assert.equal(normalized.actor.eyes.autoBlink, true);
  assert.equal(normalized.actor.eyes.blinkSpeed, 0.1);
  assert.equal(normalized.actor.aura.scale, 1.5);
  assert.deepEqual(normalized.actor.aura.color, [0, 43, 255]);
  assert.equal(normalized.actor.searchlight.enabled, false);
  assert.equal(normalized.actor.searchlight.width, 0.1);
  assert.equal(normalized.actor.searchlight.radius, 300);
  assert.deepEqual(normalized.actor.searchlight.color, [1, 3, 4]);
});

test('legacy motion default remains stable outside its editor range', () => {
  const defaults = normalizeRenderConfig(DEFAULT_RENDER_CONFIG);
  assert.equal(defaults.actor.motion.flyMaxScale, 0.2);

  const edited = updateRenderConfigParameter(defaults, 'flyMaxScale', 0.1);
  assert.equal(edited.value, 0.3);
});

test('effects defaults round-trip through every flat editor alias', () => {
  const flat = toFlatRenderParameters(DEFAULT_RENDER_CONFIG, 'effects');
  const restored = createRenderConfigFromFlatState(flat);

  assert.deepEqual(restored.effects, DEFAULT_RENDER_CONFIG.effects);
  assert.equal(flat.aberrationAmount, 0);
  assert.equal(flat.flickerSpeed, 1);
  assert.equal(flat.trailCount, 3);
  assert.equal(flat.trailSpacing, 5);
  assert.equal(flat.scanlineOpacity, 0.15);
  assert.equal(flat.shockwaveThickness, 160);
});

test('effects values are validated by canonical definitions', () => {
  const normalized = normalizeRenderConfig({
    effects: {
      chromaticAberration: { amount: 99, speed: -2, glitchBurstChance: 8 },
      flicker: { intensity: 2, speed: -1 },
      glitch: { screenShakeIntensity: 44 },
      spectralTrail: { count: 1.6, spacing: 8.7, manualAlpha: -1, glitchInfluence: 4 },
      screen: { scanlineOpacity: 2, vignetteOpacity: -1 },
      shockwave: { strength: 3, thickness: 10, duration: 8, pulseCount: 3.6 }
    }
  });

  assert.deepEqual(normalized.effects.chromaticAberration, { amount: 30, speed: 0, glitchBurstChance: 5 });
  assert.deepEqual(normalized.effects.flicker, { intensity: 0.9, speed: 0 });
  assert.equal(normalized.effects.glitch.screenShakeIntensity, 30);
  assert.deepEqual(normalized.effects.spectralTrail, { count: 2, spacing: 9, manualAlpha: 0, glitchInfluence: 1 });
  assert.deepEqual(normalized.effects.screen, { scanlineOpacity: 1, vignetteOpacity: 0 });
  assert.deepEqual(normalized.effects.shockwave, { strength: 2, thickness: 50, duration: 4, pulseCount: 4 });

  assert.equal(RENDER_PARAMETER_DEFINITIONS.trailCount.integer, true);
  assert.equal(RENDER_PARAMETER_DEFINITIONS.trailSpacing.integer, true);
  assert.equal(RENDER_PARAMETER_DEFINITIONS.shockwavePulseCount.integer, true);
  assert.deepEqual(
    {
      label: RENDER_PARAMETER_DEFINITIONS.shockwaveThickness.label,
      min: RENDER_PARAMETER_DEFINITIONS.shockwaveThickness.min,
      max: RENDER_PARAMETER_DEFINITIONS.shockwaveThickness.max,
      step: RENDER_PARAMETER_DEFINITIONS.shockwaveThickness.step
    },
    { label: 'Wavefront Thickness', min: 50, max: 300, step: 10 }
  );
});

test('runtime-only fields are not RenderConfig parameters', () => {
  const config = createRenderConfigFromFlatState({
    pointer: { x: 1, y: 1 },
    elapsed: 42,
    activeReaction: 'lyx_received',
    reactionProgress: 0.75,
    loadingState: 'loading',
    activeShockwaves: [{ radius: 20 }],
    randomGlitchEvents: [{ split: 12 }],
    trailHistory: [{ x: 1, y: 2 }],
    calculatedAnimationValue: 123
  });
  const flat = toFlatRenderParameters(config);

  for (const key of [
    'pointer',
    'elapsed',
    'activeReaction',
    'reactionProgress',
    'loadingState',
    'activeShockwaves',
    'randomGlitchEvents',
    'trailHistory',
    'calculatedAnimationValue'
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(flat, key), false);
    assert.equal(Object.prototype.hasOwnProperty.call(config, key), false);
    assert.equal(updateRenderConfigParameter(config, key, 1), null);
  }
});
