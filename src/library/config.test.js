import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePublicHttpsEndpoint, normalizePublicHttpsEndpointList } from './config.js';

test('normalizes safe public HTTPS endpoints', () => {
  assert.equal(normalizePublicHttpsEndpoint(' https://gateway.example/ipfs/// '), 'https://gateway.example/ipfs/');
  assert.equal(normalizePublicHttpsEndpoint('http://gateway.example/ipfs/'), null);
  assert.equal(normalizePublicHttpsEndpoint('not a URL'), null);
  assert.equal(normalizePublicHttpsEndpoint('https://user:secret@gateway.example/ipfs/'), null);
});

test('filters unsafe and duplicate fallback endpoints', () => {
  assert.equal(normalizePublicHttpsEndpointList([
    'https://one.example/ipfs/',
    'http://unsafe.example/ipfs/',
    'https://one.example/ipfs',
    'https://two.example/ipfs/'
  ].join(',')), 'https://one.example/ipfs/,https://two.example/ipfs/');
});
