import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalPublicationOrigin } from '../domain/publicationOrigin.js';
import { publicationUploadEndpoint, DEVELOPMENT_PUBLICATION_SERVICE } from './publicationUploadEndpoint.js';

test('only exact loopback origins can use the hosted development publication service', () => {
  for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://[::1]:5173', 'https://localhost:7443']) {
    assert.equal(isLocalPublicationOrigin(origin), true);
    assert.equal(publicationUploadEndpoint(origin, { development: true }), `${DEVELOPMENT_PUBLICATION_SERVICE}/api/profile-publications`);
    assert.equal(publicationUploadEndpoint(origin, { development: false }), '/api/profile-publications');
  }
  for (const origin of ['https://inscape.example', 'http://localhost.evil.example', 'http://127.0.0.1.evil.example',
    'http://192.168.1.2:5173', 'http://127.0.0.1:5173/path', 'http://user@localhost:5173', 'null', null, undefined]) {
    assert.equal(isLocalPublicationOrigin(origin), false);
    assert.equal(publicationUploadEndpoint(origin, { development: true }), '/api/profile-publications');
  }
});

test('the development upload service can be configured without changing the local origin', () => {
  const origin = 'http://127.0.0.1:5173';
  assert.equal(publicationUploadEndpoint(origin, { development: true, serviceOrigin: 'https://service.example' }), 'https://service.example/api/profile-publications');
  for (const serviceOrigin of ['http://service.example', 'https://user:password@service.example', 'https://service.example/path', 'https://service.example?query=1']) {
    assert.throws(() => publicationUploadEndpoint(origin, { development: true, serviceOrigin }));
  }
});
