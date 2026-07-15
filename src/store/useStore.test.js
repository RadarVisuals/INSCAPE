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

test('scene and actor identity synchronize in both directions with flat editor fields', () => {
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  useStore.getState().applyRenderParameters({
    characterId: 'skull_reaper',
    bgPatternStyle: 'stone',
    bgMountainBackId: 1,
    bgWarpIntensity: 77,
    particleWind: -12,
    fogColorG: 33
  });

  let state = useStore.getState();
  assert.equal(state.renderConfig.actor.id, 'skull_reaper');
  assert.equal(state.renderConfig.scene.background.patternStyle, 'stone');
  assert.equal(state.renderConfig.scene.background.mountainBackId, 1);
  assert.equal(state.renderConfig.scene.background.patternWarp.intensity, 77);
  assert.equal(state.renderConfig.scene.atmosphere.particles.wind, -12);
  assert.equal(state.renderConfig.scene.atmosphere.fog.color[1], 33);

  useStore.getState().applyRenderConfig({
    actor: { id: 'abyssal_eye' },
    scene: {
      background: { backdropId: 'orange', scrollSpeed: 95 },
      atmosphere: { particles: { opacity: 0.25 }, fog: { color: [4, 5, 6] } }
    }
  });
  state = useStore.getState();
  assert.equal(state.characterId, 'abyssal_eye');
  assert.equal(state.bgClippingMaskId, 'orange');
  assert.equal(state.bgScrollSpeed, 95);
  assert.equal(state.particleOpacity, 0.25);
  assert.deepEqual([state.fogColorR, state.fogColorG, state.fogColorB], [4, 5, 6]);
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
  store.setParameter('bgPatternStyle', 'stone');
  store.setParameter('particleCount', 145);
  const presetId = useStore.getState().saveActorPreset('test preset');
  const savedPreset = useStore.getState().actorPresets.find((preset) => preset.id === presetId);
  assert.equal(savedPreset.renderConfig.actor.id, 'abyssal_eye');
  assert.equal(savedPreset.renderConfig.scene.background.patternStyle, 'stone');

  useStore.getState().setParameter('characterId', 'skull_reaper');
  useStore.getState().setParameter('mutationMode', 'none');
  useStore.getState().setParameter('floatSpeed', 0.2);
  useStore.getState().setParameter('bgPatternStyle', 'bubble');
  useStore.getState().setParameter('particleCount', 5);
  useStore.getState().applyActorPreset(presetId);

  assert.equal(useStore.getState().mutationMode, 'quad');
  assert.equal(useStore.getState().floatSpeed, 2.4);
  assert.equal(useStore.getState().bgPatternStyle, 'stone');
  assert.equal(useStore.getState().particleCount, 145);
  assert.equal(useStore.getState().renderConfig.scene.background.patternStyle, 'stone');
  assert.equal(useStore.getState().characterId, 'skull_reaper');
  assert.equal(useStore.getState().renderConfig.actor.id, 'skull_reaper');

  useStore.getState().deleteActorPreset(presetId);
});
