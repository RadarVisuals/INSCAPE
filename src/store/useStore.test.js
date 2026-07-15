import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RENDER_CONFIG } from '../config/renderConfig.defaults.js';
import { decodeActorPresets } from './slices/createActorPresetSlice.js';
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

test('effects configuration synchronizes in both directions with flat editor fields', () => {
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  useStore.getState().applyRenderParameters({
    aberrationAmount: 18.5,
    flickerSpeed: 2.4,
    glitchShakeIntensity: 11,
    trailCount: 1.8,
    trailManualAlpha: 0.35,
    scanlineOpacity: 0.45,
    shockwavePulseCount: 4.4
  });

  let state = useStore.getState();
  assert.equal(state.renderConfig.effects.chromaticAberration.amount, 18.5);
  assert.equal(state.renderConfig.effects.flicker.speed, 2.4);
  assert.equal(state.renderConfig.effects.glitch.screenShakeIntensity, 11);
  assert.equal(state.renderConfig.effects.spectralTrail.count, 2);
  assert.equal(state.renderConfig.effects.spectralTrail.manualAlpha, 0.35);
  assert.equal(state.renderConfig.effects.screen.scanlineOpacity, 0.45);
  assert.equal(state.renderConfig.effects.shockwave.pulseCount, 4);

  useStore.getState().applyRenderConfig({
    effects: {
      chromaticAberration: { glitchBurstChance: 3.2 },
      flicker: { intensity: 0.55 },
      spectralTrail: { spacing: 12 },
      screen: { vignetteOpacity: 0.2 },
      shockwave: { strength: 1.7, thickness: 230 }
    }
  });
  state = useStore.getState();
  assert.equal(state.aberrationGlitch, 3.2);
  assert.equal(state.flickerIntensity, 0.55);
  assert.equal(state.trailSpacing, 12);
  assert.equal(state.vignetteOpacity, 0.2);
  assert.equal(state.shockwaveStrength, 1.7);
  assert.equal(state.shockwaveThickness, 230);
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

test('actor presets restore canonical effects and synchronized flat aliases', () => {
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  useStore.getState().applyRenderParameters({
    aberrationSpeed: 6.5,
    trailSpacing: 11,
    vignetteOpacity: 0.75,
    shockwaveDuration: 3.2
  });
  const presetId = useStore.getState().saveActorPreset('effects preset');

  useStore.getState().applyRenderParameters({
    aberrationSpeed: 0.5,
    trailSpacing: 2,
    vignetteOpacity: 0.1,
    shockwaveDuration: 0.5
  });
  useStore.getState().setParameter('activeReaction', 'lsp8_received');
  useStore.getState().applyActorPreset(presetId);

  const state = useStore.getState();
  assert.equal(state.renderConfig.effects.chromaticAberration.speed, 6.5);
  assert.equal(state.renderConfig.effects.spectralTrail.spacing, 11);
  assert.equal(state.renderConfig.effects.screen.vignetteOpacity, 0.75);
  assert.equal(state.renderConfig.effects.shockwave.duration, 3.2);
  assert.equal(state.aberrationSpeed, 6.5);
  assert.equal(state.trailSpacing, 11);
  assert.equal(state.vignetteOpacity, 0.75);
  assert.equal(state.shockwaveDuration, 3.2);
  assert.equal(state.activeReaction, 'lsp8_received');

  useStore.getState().deleteActorPreset(presetId);
  useStore.getState().setParameter('activeReaction', null);
});

test('store and presets retain validated reaction assignments without flattening runtime state', () => {
  useStore.getState().applyRenderConfig({
    ...DEFAULT_RENDER_CONFIG,
    reactions: {
      ...DEFAULT_RENDER_CONFIG.reactions,
      events: { ...DEFAULT_RENDER_CONFIG.reactions.events, arbitrary_event: 'custom_profile' },
      profiles: {
        ...DEFAULT_RENDER_CONFIG.reactions.profiles,
        custom_profile: {
          duration: 3,
          easing: 'linear',
          decay: 'out',
          channels: { warp: { intensity: 64 }, trail: { enabled: true, intensity: 0.4 } }
        }
      },
      activeReaction: 'must_not_persist',
      reactionProgress: 0.5
    }
  });

  const presetId = useStore.getState().saveActorPreset('reaction profile preset');
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  assert.equal(useStore.getState().renderConfig.reactions.events.arbitrary_event, undefined);

  useStore.getState().applyActorPreset(presetId);
  const state = useStore.getState();
  assert.equal(state.renderConfig.reactions.events.arbitrary_event, 'custom_profile');
  assert.equal(state.renderConfig.reactions.profiles.custom_profile.channels.warp.intensity, 64);
  assert.equal(state.renderConfig.reactions.profiles.custom_profile.channels.trail.intensity, 0.4);
  assert.equal(Object.hasOwn(state.renderConfig.reactions, 'activeReaction'), false);
  assert.equal(Object.hasOwn(state.renderConfig.reactions, 'reactionProgress'), false);

  useStore.getState().deleteActorPreset(presetId);
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
});

test('corrupt or incompatible actor presets fail safely', () => {
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  const before = useStore.getState().renderConfig;
  const corruptPresets = [
    { id: 'missing-version', name: 'Missing version', renderConfig: { actor: {} } },
    { id: 'future', name: 'Future', renderConfig: { schemaVersion: 999 } },
    { id: 'valid', name: 'Valid', renderConfig: DEFAULT_RENDER_CONFIG, values: { activeReaction: 'must-not-load' } }
  ];

  assert.deepEqual(decodeActorPresets(JSON.stringify(corruptPresets)).map((preset) => preset.id), ['valid']);
  useStore.setState({ actorPresets: corruptPresets });
  assert.equal(useStore.getState().applyActorPreset('missing-version'), false);
  assert.equal(useStore.getState().applyActorPreset('future'), false);
  assert.strictEqual(useStore.getState().renderConfig, before);

  useStore.setState({ actorPresets: [] });
});

test('saved presets contain only metadata and a detached canonical document', () => {
  useStore.getState().applyRenderConfig(DEFAULT_RENDER_CONFIG);
  const source = useStore.getState().renderConfig;
  const presetId = useStore.getState().saveActorPreset('document boundary preset');
  const preset = useStore.getState().actorPresets.find((candidate) => candidate.id === presetId);

  assert.deepEqual(Object.keys(preset).sort(), ['createdAt', 'id', 'name', 'renderConfig', 'updatedAt']);
  assert.notStrictEqual(preset.renderConfig, source);
  assert.notStrictEqual(preset.renderConfig.actor.aura.color, source.actor.aura.color);
  assert.equal(Object.hasOwn(preset, 'values'), false);

  useStore.getState().deleteActorPreset(presetId);
});
