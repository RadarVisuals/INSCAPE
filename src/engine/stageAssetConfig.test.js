import test from 'node:test';
import assert from 'node:assert/strict';
import { didStageAssetConfigurationChange, getAssetReloadScope } from './stageAssetConfig.js';

function createRig(patternStyle = 'bubble') {
  return {
    environment: { type: 'illustrated', shaderId: 'neural-field' },
    illustratedIdentity: { backdropId: 'moonpurple', patternStyle, mountainFrontId: 2, mountainBackId: 3 },
    keys: {
      bg_clipping_mask: 'bg_clipping_mask_moonpurple',
      bg_pat_1: `bg_pat_1_${patternStyle}`,
      bg_pat_2: `bg_pat_2_${patternStyle}`,
      bg_mountain: 'bg_mountain_02',
      bg_mountain_back: 'bg_mountain_back_03',
      char_clipping_mask: 'char_clipping_mask_abyssal_eye'
    },
    isPanoramaMode: false,
    hasBgPat1: true,
    hasBgPat2: true
  };
}

test('unchanged stage asset configuration preserves stage resources', () => {
  assert.equal(didStageAssetConfigurationChange(createRig(), createRig()), false);
});

test('environment type and shader identity rebuild only the stage', () => {
  const illustrated = createRig();
  const shader = { ...createRig(), environment: { type: 'shader', shaderId: 'neural-field' },
    hasBgPat1: false, hasBgPat2: false };
  assert.deepEqual(getAssetReloadScope(illustrated, shader), {
    actorChanged: false, backgroundPatternChanged: false, stageChanged: true
  });
  assert.equal(didStageAssetConfigurationChange(shader, { ...shader }), false);
});

test('illustrated identity remains authored and stable while a shader is active', () => {
  const shader = { ...createRig(), environment: { type: 'shader', shaderId: 'neural-field' } };
  const changedBackdrop = { ...shader, keys: { ...shader.keys, bg_clipping_mask: 'bg_clipping_mask_black' },
    illustratedIdentity: { ...shader.illustratedIdentity, backdropId: 'black' } };
  assert.equal(didStageAssetConfigurationChange(shader, changedBackdrop), false);
  assert.deepEqual(changedBackdrop.illustratedIdentity, { backdropId: 'black', patternStyle: 'bubble', mountainFrontId: 2, mountainBackId: 3 });
});

test('changing resolved background pattern keys rebuilds stage resources', () => {
  const currentRig = createRig('bubble');

  for (const patternStyle of ['stone', 'digitalblob']) {
    assert.equal(didStageAssetConfigurationChange(currentRig, createRig(patternStyle)), true);
  }
});

test('initial and non-pattern stage asset changes still rebuild stage resources', () => {
  const currentRig = createRig();
  const nextRig = createRig();
  nextRig.keys.bg_mountain = 'bg_mountain_01';

  assert.equal(didStageAssetConfigurationChange(null, currentRig), true);
  assert.equal(didStageAssetConfigurationChange(currentRig, nextRig), true);
});

test('scene-only asset changes do not request an actor rebuild', () => {
  const currentRig = createRig('bubble');
  const sceneChanges = [
    createRig('stone'),
    { ...createRig(), keys: { ...createRig().keys, bg_clipping_mask: 'bg_clipping_mask_orange' } },
    { ...createRig(), keys: { ...createRig().keys, bg_mountain: 'bg_mountain_01' } }
  ];

  for (const nextRig of sceneChanges) {
    assert.deepEqual(getAssetReloadScope(currentRig, nextRig), {
      actorChanged: false,
      backgroundPatternChanged: nextRig.keys.bg_pat_1 !== currentRig.keys.bg_pat_1,
      stageChanged: true
    });
  }
});

test('actor identity changes request an actor rebuild', () => {
  const currentRig = createRig();
  const nextRig = createRig();
  nextRig.keys.char_clipping_mask = 'char_clipping_mask_skull_reaper';

  assert.deepEqual(getAssetReloadScope(currentRig, nextRig), {
    actorChanged: true,
    backgroundPatternChanged: false,
    stageChanged: false
  });
});
