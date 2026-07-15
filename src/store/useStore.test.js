import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RENDER_CONFIG } from '../config/renderConfig.defaults.js';
import { useStore } from './useStore.js';

test('editor parameter writes stay synchronized with the actor RenderConfig', () => {
  useStore.getState().setParameter('mutationAxisX', 99);
  assert.equal(useStore.getState().mutationAxisX, 0.95);
  assert.equal(useStore.getState().renderConfig.actor.geometry.axisX, 0.95);

  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  assert.equal(useStore.getState().mutationAxisX, 0.5);
  assert.equal(useStore.getState().renderConfig.actor.geometry.axisX, 0.5);
});

test('completed actor scopes synchronize in both directions with flat editor fields', () => {
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  const updates = {
    floatAmpX: 222,
    autoBlink: false,
    auraColorG: 17,
    searchlightLength: 1.75
  };

  useStore.getState().applyRenderParameters(updates);
  let state = useStore.getState();
  assert.equal(state.renderConfig.actor.motion.floatAmpX, 222);
  assert.equal(state.renderConfig.actor.eyes.autoBlink, false);
  assert.equal(state.renderConfig.actor.aura.color[1], 17);
  assert.equal(state.renderConfig.actor.searchlight.length, 1.75);

  useStore.getState().applyRenderConfig({
    actor: {
      motion: { flyHoverPause: 4.5 },
      eyes: { pupilWander: 2.5 },
      aura: { opacity: 0.25 },
      searchlight: { enabled: true }
    }
  });
  state = useStore.getState();
  assert.equal(state.flyHoverPause, 4.5);
  assert.equal(state.pupilWander, 2.5);
  assert.equal(state.auraOpacity, 0.25);
  assert.equal(state.searchlightActive, true);
});

test('runtime state writes do not enter RenderConfig', () => {
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  const before = useStore.getState().renderConfig;

  useStore.getState().setParameter('activeReaction', 'lyx_received');
  useStore.getState().setParameter('reactionProgress', 0.5);

  assert.equal(useStore.getState().activeReaction, 'lyx_received');
  assert.equal(useStore.getState().reactionProgress, 0.5);
  assert.strictEqual(useStore.getState().renderConfig, before);
});

test('actor presets restore render configuration and actor state without changing actor identity', () => {
  const store = useStore.getState();
  store.setParameter('characterId', 'abyssal_eye');
  store.setParameter('mutationMode', 'quad');
  store.setParameter('floatSpeed', 2.4);
  const presetId = useStore.getState().saveActorPreset('test preset');

  useStore.getState().setParameter('mutationMode', 'none');
  useStore.getState().setParameter('floatSpeed', 0.2);
  useStore.getState().applyActorPreset(presetId);

  assert.equal(useStore.getState().mutationMode, 'quad');
  assert.equal(useStore.getState().floatSpeed, 2.4);
  assert.equal(useStore.getState().characterId, 'abyssal_eye');

  useStore.getState().deleteActorPreset(presetId);
});
