import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Identity handoff uses only the existing Pixi application renderer and canvas', () => {
  const engineSource = readFileSync(new URL('./PixiEngine.js', import.meta.url), 'utf8');
  const canvasSource = readFileSync(new URL('../components/Canvas/ArtCanvas.jsx', import.meta.url), 'utf8');
  const actorSource = readFileSync(new URL('./entities/ActorEntity.js', import.meta.url), 'utf8');

  assert.equal(engineSource.match(/new Application\(/g)?.length, 1);
  assert.equal(canvasSource.match(/<canvas/g)?.length ?? 0, 0);
  assert.match(actorSource, /this\.renderer\.render\(\{/);
  assert.match(engineSource, /startResidentHandoff\(bounds, options = \{\}\)/);
  assert.match(engineSource, /this\.syncResidentHandoff\(\)/);
  assert.match(engineSource, /isResidentRepresentedByAvatar\(\)/);
  assert.doesNotMatch(engineSource, /setResidentHabitat|syncResidentHabitat/);
});
