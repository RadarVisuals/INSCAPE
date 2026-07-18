import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_RENDER_CONFIG, RENDER_CONFIG_VERSION } from './renderConfig.defaults.js';
import { RENDER_CONFIG_MIGRATIONS } from './renderConfig.migrations.js';
import {
  cloneRenderConfigDocument,
  decodeRenderConfigDocument,
  parseRenderConfigDocument,
  RenderConfigDocumentError,
  serializeRenderConfigDocument
} from './renderConfigDocument.js';

test('RenderConfig documents serialize and parse round-trip safely', () => {
  const serialized = serializeRenderConfigDocument(DEFAULT_RENDER_CONFIG);
  const parsed = parseRenderConfigDocument(serialized);

  assert.deepEqual(parsed, DEFAULT_RENDER_CONFIG);
  assert.equal(parsed.schemaVersion, RENDER_CONFIG_VERSION);
  assert.doesNotThrow(() => JSON.parse(serialized));
});

test('parsed and cloned documents share no mutable arrays or objects', () => {
  const source = {
    ...DEFAULT_RENDER_CONFIG,
    actor: {
      ...DEFAULT_RENDER_CONFIG.actor,
      aura: { ...DEFAULT_RENDER_CONFIG.actor.aura, color: [1, 2, 3] }
    }
  };
  const parsed = parseRenderConfigDocument(source);
  const cloned = cloneRenderConfigDocument(parsed);

  source.actor.aura.color[0] = 99;
  parsed.actor.aura.color[1] = 88;
  assert.deepEqual(cloned.actor.aura.color, [1, 2, 3]);
  assert.deepEqual(parsed.actor.aura.color, [1, 88, 3]);
  assert.notStrictEqual(parsed.actor, cloned.actor);
  assert.notStrictEqual(parsed.reactions.profiles.lyx_received.channels, cloned.reactions.profiles.lyx_received.channels);
});

test('invalid JSON and missing schema versions are rejected with diagnostics', () => {
  const invalidJson = decodeRenderConfigDocument('{ nope');
  const missingVersion = decodeRenderConfigDocument({ actor: {} });

  assert.equal(invalidJson.ok, false);
  assert.equal(invalidJson.diagnostics[0].code, 'invalid_json');
  assert.equal(missingVersion.ok, false);
  assert.equal(missingVersion.diagnostics[0].code, 'missing_schema_version');
  assert.throws(() => parseRenderConfigDocument({ actor: {} }), RenderConfigDocumentError);
});

test('v5 migrates deterministically while future and unregistered legacy versions are rejected', () => {
  const future = decodeRenderConfigDocument({ schemaVersion: RENDER_CONFIG_VERSION + 1 });
  const legacy = decodeRenderConfigDocument({ schemaVersion: 4 });
  const v5 = decodeRenderConfigDocument({ ...DEFAULT_RENDER_CONFIG, schemaVersion: 5, scene: { ...DEFAULT_RENDER_CONFIG.scene, environment: undefined } });

  assert.equal(future.ok, false);
  assert.equal(future.diagnostics[0].code, 'unsupported_future_schema_version');
  assert.equal(legacy.ok, false);
  assert.equal(legacy.diagnostics[0].code, 'unsupported_schema_version');
  assert.equal(v5.ok, true);
  assert.deepEqual(v5.value.scene.environment, { type: 'illustrated', shaderId: 'neural-field' });
  assert.deepEqual(Object.keys(RENDER_CONFIG_MIGRATIONS), ['5', '6']);
});

test('unknown and runtime fields are removed while corrected values are diagnosed', () => {
  const result = decodeRenderConfigDocument({
    ...DEFAULT_RENDER_CONFIG,
    wallet: { account: '0x123' },
    pointer: { x: 1, y: 2 },
    activeReaction: 'lyx_received',
    reactionProgress: 0.5,
    actor: {
      ...DEFAULT_RENDER_CONFIG.actor,
      geometry: { ...DEFAULT_RENDER_CONFIG.actor.geometry, axisX: 99, calculatedRotation: 42 }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.actor.geometry.axisX, 0.95);
  for (const key of ['wallet', 'pointer', 'activeReaction', 'reactionProgress']) {
    assert.equal(Object.hasOwn(result.value, key), false);
  }
  assert.equal(Object.hasOwn(result.value.actor.geometry, 'calculatedRotation'), false);
  assert.ok(result.diagnostics.some(({ code, path }) => code === 'unknown_field' && path === 'pointer'));
  assert.ok(result.diagnostics.some(({ code, path }) => code === 'invalid_value' && path === 'actor.geometry.axisX'));
});

test('custom reaction assignments and profiles survive the document boundary', () => {
  const parsed = parseRenderConfigDocument({
    ...DEFAULT_RENDER_CONFIG,
    reactions: {
      events: { custom_event: 'custom_profile' },
      profiles: {
        custom_profile: {
          enabled: true,
          duration: 4,
          easing: 'easeOut',
          decay: 'out',
          channels: { warp: { intensity: 61 }, trail: { enabled: true, intensity: 0.45 } }
        }
      }
    }
  });

  assert.equal(parsed.reactions.events.custom_event, 'custom_profile');
  assert.equal(parsed.reactions.profiles.custom_profile.channels.warp.intensity, 61);
  assert.equal(parsed.reactions.profiles.custom_profile.channels.trail.intensity, 0.45);
});

test('the public v5 mock fixture migrates to the current RenderConfig document', () => {
  const fixture = readFileSync(new URL('../../public/fixtures/mock-render-config.v5.json', import.meta.url), 'utf8');
  const parsed = parseRenderConfigDocument(fixture);

  assert.equal(parsed.schemaVersion, 6);
  assert.equal(parsed.scene.environment.type, 'illustrated');
  assert.equal(parsed.actor.id, 'skull_reaper');
  assert.equal(parsed.reactions.events.preview_received, 'preview_pulse');
});
