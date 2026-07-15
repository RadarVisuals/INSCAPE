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

test('runtime-only fields are not RenderConfig parameters', () => {
  const config = createRenderConfigFromFlatState({
    pointer: { x: 1, y: 1 },
    elapsed: 42,
    activeReaction: 'lyx_received',
    reactionProgress: 0.75
  });
  const flat = toFlatRenderParameters(config);

  for (const key of ['pointer', 'elapsed', 'activeReaction', 'reactionProgress']) {
    assert.equal(Object.prototype.hasOwnProperty.call(flat, key), false);
    assert.equal(updateRenderConfigParameter(config, key, 1), null);
  }
});
