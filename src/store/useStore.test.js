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
