import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import useOwnerLatticeBrowser, { canOpenCreatorCollection } from './useOwnerLatticeBrowser.js';

const PROFILE = '0x84841412e9f66e360c6da5f9dba11b8e88d87ea8';

test('root Library exposes collection opening before any collection is active or holdings load', () => {
  let browser;
  function Probe() {
    browser = useOwnerLatticeBrowser(PROFILE, false);
    return null;
  }
  renderToString(createElement(Probe));
  assert.equal(browser.data.collectionContext, undefined);
  assert.equal(typeof browser.data.onOpenCollection, 'function');
  assert.equal(browser.data.onOpenCollection({ isCollection: false }), false);
});

test('creator collection opening is not coupled to transient owned-inventory readiness', () => {
  assert.equal(canOpenCreatorCollection(PROFILE, { isCollection: true }), true);
  assert.equal(canOpenCreatorCollection(PROFILE, { isCollection: false }), false);
  assert.equal(canOpenCreatorCollection('invalid', { isCollection: true }), false);
});
