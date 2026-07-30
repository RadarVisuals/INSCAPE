import assert from 'node:assert/strict';
import test from 'node:test';
import { preloadIdentityProfileImage } from './preloadIdentityProfileImage.js';

test('profile image handoff resolves only after decode', async () => {
  const events = [];
  class ImageStub {
    set src(value) { this.value = value; queueMicrotask(() => this.onload()); }
    async decode() { events.push('decode'); }
  }
  assert.equal(await preloadIdentityProfileImage('https://cdn.example/profile.webp', ImageStub), 'https://cdn.example/profile.webp');
  assert.deepEqual(events, ['decode']);
});

test('profile image handoff fails locally without blocking the dossier', async () => {
  class ImageStub { set src(_value) { queueMicrotask(() => this.onerror()); } }
  assert.equal(await preloadIdentityProfileImage('https://cdn.example/missing.webp', ImageStub), null);
  assert.equal(await preloadIdentityProfileImage(null, ImageStub), null);
});

test('profile image handoff has a bounded unresolved fallback', async () => {
  class ImageStub { set src(_value) {} }
  assert.equal(await preloadIdentityProfileImage('https://cdn.example/stalled.webp', ImageStub, 5), null);
});
