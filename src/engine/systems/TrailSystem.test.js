import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTrailRenderTransformSnapshot,
  getTrailPresentation,
  recordTrailTransform
} from './trailRuntime.js';

const config = {
  count: 1,
  spacing: 2,
  manualAlpha: 0,
  glitchInfluence: 0.6
};

const transform = {
  x: 10,
  y: 20,
  scaleX: 0.4,
  scaleY: 0.4,
  rotation: 0.2
};

test('actor render snapshot combines base scale with signed visual facing', () => {
  const snapshot = createTrailRenderTransformSnapshot(
    {
      position: { x: -15, y: 40 },
      scale: { x: 0.5, y: 0.5 },
      rotation: 0
    },
    {
      scale: { x: -0.6, y: 1 },
      rotation: 0.35
    }
  );

  assert.deepEqual(snapshot, {
    x: -15,
    y: 40,
    scaleX: -0.3,
    scaleY: 0.5,
    rotation: 0.35
  });
});

test('active reaction progress reveals trails and decays without becoming a persistent override', () => {
  const history = [];
  const inactive = {
    isGlitchActive: false,
    screenShakeIntensity: 0,
    reactionModifiers: {}
  };

  recordTrailTransform(history, transform, config.spacing);
  recordTrailTransform(history, transform, config.spacing);
  let presentation = getTrailPresentation(history, 0, config, {
    ...inactive,
    reactionModifiers: { trail: { enabled: true, intensity: 1 } }
  });
  assert.equal(presentation.alpha, 0.6);

  presentation = getTrailPresentation(history, 0, config, {
    ...inactive,
    reactionModifiers: { trail: { enabled: true, intensity: 0.5 } }
  });
  assert.equal(presentation.alpha, 0.3);

  assert.equal(getTrailPresentation(history, 0, config, inactive), null);

  presentation = getTrailPresentation(history, 0, { ...config, manualAlpha: 0.4 }, inactive);
  assert.equal(presentation.alpha, 0.4);

  assert.equal(getTrailPresentation(history, 0, config, inactive), null);
});

test('historical trails preserve signed scale, rendered position, and rotation', () => {
  const history = [];
  const runtime = {
    isGlitchActive: false,
    screenShakeIntensity: 0,
    reactionModifiers: { trail: { enabled: true, intensity: 1 } }
  };
  const historicalTransform = {
    x: -35,
    y: 72,
    scaleX: -0.25,
    scaleY: 0.5,
    rotation: -0.4
  };

  recordTrailTransform(history, historicalTransform, config.spacing);
  recordTrailTransform(history, transform, config.spacing);

  const presentation = getTrailPresentation(history, 0, config, runtime);
  assert.equal(presentation.x, -35);
  assert.equal(presentation.y, 64);
  assert.equal(presentation.scaleX, -0.25 * 1.04);
  assert.equal(presentation.scaleY, 0.5 * 1.04);
  assert.equal(presentation.rotation, -0.4);
});
