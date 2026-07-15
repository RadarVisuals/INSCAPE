import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RENDER_CONFIG, RENDER_CONFIG_VERSION } from './renderConfig.defaults.js';
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
});
