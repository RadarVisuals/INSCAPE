import assert from 'node:assert/strict'; import test from 'node:test';
import { createEmptySignalDocument } from '../storage/signalStorage.js'; import { mergeSignalSnapshot } from './signalState.js';
const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const signal = (id, timestamp) => ({ id, type: 'UNKNOWN_ACTIVITY', timestamp, profileAddress: PROFILE, seen: false, read: false });

test('first live synchronization establishes a baseline without reactions', () => {
  const merged = mergeSignalSnapshot(createEmptySignalDocument(PROFILE), [signal('a', 1), signal('b', 2)]);
  assert.equal(merged.document.initialized, true); assert.equal(merged.reactions.length, 0); assert.deepEqual(merged.document.history.map((s) => s.id), ['b', 'a']);
});
test('later synchronization suppresses duplicates and reacts to a controlled number', () => {
  const first = mergeSignalSnapshot(createEmptySignalDocument(PROFILE), [signal('a', 1)]).document;
  const next = mergeSignalSnapshot(first, [signal('a', 1), signal('b', 3), signal('c', 2), signal('d', 4)]);
  assert.deepEqual(next.newSignals.map((s) => s.id), ['b', 'c', 'd']); assert.deepEqual(next.reactions.map((s) => s.id), ['d', 'b']);
});
