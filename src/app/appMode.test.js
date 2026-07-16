import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPLICATION_MODES,
  createApplicationModeUrl,
  resolveApplicationMode
} from './appMode.js';

test('public mode is the default and Atelier requires its explicit query value', () => {
  assert.equal(resolveApplicationMode({ search: '' }), APPLICATION_MODES.PUBLIC);
  assert.equal(resolveApplicationMode({ search: '?mode=public' }), APPLICATION_MODES.PUBLIC);
  assert.equal(resolveApplicationMode({ search: '?mode=atelier' }), APPLICATION_MODES.ATELIER);
  assert.equal(resolveApplicationMode({ search: '?mode=unknown' }), APPLICATION_MODES.PUBLIC);
});

test('mode URLs preserve unrelated query values and provide stable direct entries', () => {
  const location = { href: 'https://example.test/world?debug=1#resident' };

  assert.equal(
    createApplicationModeUrl(location, APPLICATION_MODES.ATELIER),
    '/world?debug=1&mode=atelier#resident'
  );
  assert.equal(
    createApplicationModeUrl(
      { href: 'https://example.test/world?debug=1&mode=atelier#resident' },
      APPLICATION_MODES.PUBLIC
    ),
    '/world?debug=1#resident'
  );
});
