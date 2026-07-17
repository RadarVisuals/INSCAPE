import assert from 'node:assert/strict'; import test from 'node:test';
import { createEmptySignalDocument, decodeSignalDocument, loadSignalDocument, saveSignalDocument, signalStorageKey } from './signalStorage.js';
const A = '0xf3c189819fd5b042f692983bfbfd57ab607ee709'; const B = '0x1234567890abcdef1234567890abcdef12345678';
const memory = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

test('corrupt storage recovers with safe notification defaults', () => {
  const decoded = decodeSignalDocument('{broken', A); assert.equal(decoded.initialized, false); assert.equal(decoded.settings.audio, false); assert.equal(decoded.settings.notifications, true);
});
test('signal persistence is isolated by normalized profile address', () => {
  const storage = memory(); const document = createEmptySignalDocument(A); document.initialized = true; saveSignalDocument(storage, document);
  assert.equal(loadSignalDocument(storage, A).initialized, true); assert.equal(loadSignalDocument(storage, B).initialized, false); assert.notEqual(signalStorageKey(A), signalStorageKey(B));
});
test('notification preferences persist independently of history', () => {
  const storage = memory(); const document = createEmptySignalDocument(A); document.settings.notifications = false; saveSignalDocument(storage, document);
  assert.equal(loadSignalDocument(storage, A).settings.notifications, false);
});
