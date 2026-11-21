import test from 'node:test';
import assert from 'node:assert/strict';
import { animateLatticeProductionFocus, latticeProductionFocusOpeningProgress, LATTICE_PRODUCTION_FOCUS_OPENING_MS } from './latticeProductionFocusArtworkMotion.js';

function clock() {
  let now = 0, id = 0;
  const frames = new Map();
  return { env: { performance: { now: () => now }, requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key) },
    advance(time) { now = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now)); }, pending: () => frames.size };
}
test('inspection return starts at the visible opening pose and completes only after its final paint', () => {
  const c = clock(); let pose = 0, completed = 0;
  const stop = animateLatticeProductionFocus({ from: 0, to: 1, paint: p => { pose = p; }, env: c.env });
  c.advance(230);
  assert.equal(pose, latticeProductionFocusOpeningProgress(.5));
  const interrupted = pose; stop();
  animateLatticeProductionFocus({ from: interrupted, to: 0, paint: p => { pose = p; }, complete: () => completed++, env: c.env });
  assert.equal(pose, interrupted);
  c.advance(230 + LATTICE_PRODUCTION_FOCUS_OPENING_MS);
  assert.equal(pose, 0); assert.equal(completed, 0);
  c.advance(707); assert.equal(completed, 1); assert.equal(c.pending(), 0);
});
test('inspection reduced motion finishes synchronously and disposed motion never completes', () => {
  const c = clock(), values = []; let completed = 0;
  animateLatticeProductionFocus({ from: 0, to: 1, reducedMotion: true, paint: p => values.push(p), complete: () => completed++, env: c.env });
  assert.deepEqual(values, [1]); assert.equal(completed, 1); assert.equal(c.pending(), 0);
  const stop = animateLatticeProductionFocus({ from: 1, to: 0, paint: p => values.push(p), complete: () => completed++, env: c.env });
  stop(); c.advance(1000); assert.equal(completed, 1); assert.deepEqual(values, [1, 1]);
});
