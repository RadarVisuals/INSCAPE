import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projectPublishedIdentityRack } from './publishedIdentityRack.js';

const ADDRESS = '0x1111111111111111111111111111111111111111';
function documentWith(overrides = {}) {
  return {
    profile: { address: ADDRESS, cachedIdentity: { address: ADDRESS, name: 'VESPER', avatarUrl: 'https://example.test/avatar.png', description: 'Public memory.', tags: ['ART'], links: [{ label: 'Archive', url: 'https://example.test/archive' }] } },
    presentation: { racks: [{ id: 'identity', order: 0, visible: true, modules: [
      { id: 'profile', order: 1, visible: true, startOpen: true },
      { id: 'bio', order: 0, visible: true, startOpen: false },
      { id: 'links-tags', order: 2, visible: false, startOpen: false }
    ] }] },
    ...overrides
  };
}

test('published Identity Rack projects only visible controlled modules in authored order', () => {
  const source = documentWith();
  const projection = projectPublishedIdentityRack(source);
  assert.deepEqual(projection.modules.map(({ id, startOpen }) => ({ id, startOpen })), [
    { id: 'bio', startOpen: false }, { id: 'profile', startOpen: true }
  ]);
  assert.equal(projection.displayName, 'VESPER');
  assert.equal(projection.displayAddress, '0x111111…111111');
  assert.equal(projection.officialProfileUrl, `https://universaleverything.io/${ADDRESS}`);
  assert.deepEqual(source.presentation.racks[0].modules.map(({ id }) => id), ['profile', 'bio', 'links-tags'], 'visitor projection cannot mutate authored order');
});

test('hidden, empty, and unknown rack projections fail closed', () => {
  const hidden = documentWith(); hidden.presentation.racks[0].visible = false;
  assert.equal(projectPublishedIdentityRack(hidden), null);
  const empty = documentWith(); empty.presentation.racks[0].modules.forEach((module) => { module.visible = false; });
  assert.equal(projectPublishedIdentityRack(empty), null);
  const unknown = documentWith(); unknown.presentation.racks[0].modules = [{ id: 'owner-private', order: 0, visible: true, startOpen: true }];
  assert.equal(projectPublishedIdentityRack(unknown), null);
});

test('missing public names use a bounded address label without retrieving fallback data', () => {
  const source = documentWith(); delete source.profile.cachedIdentity.name;
  assert.equal(projectPublishedIdentityRack(source).displayName, '0x111111…111111');
});

test('production rack stays detached, ephemeral, accessible, and responsive', () => {
  const component = readFileSync(new URL('../components/PublishedIdentityRack.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../components/publishedIdentityRack.css', import.meta.url), 'utf8');
  assert.match(component, /COLLAPSE ALL/);
  assert.match(component, /aria-keyshortcuts/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /setPointerCapture/);
  assert.match(component, /noopener noreferrer/);
  assert.match(component, /referrerPolicy="no-referrer"/);
  assert.match(component, /navigator\.clipboard\.writeText\(rack\.address\)/);
  assert.match(component, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(component, /<code[^>]*>\{rack\.address\}<\/code>/);
  assert.doesNotMatch(component, /useLibraryStore|useWalletStore|localStorage|sessionStorage|indexedDB|fetch\(|writeContract/);
  assert.match(css, /width:clamp\(480px,31vw,720px\)/);
  assert.match(css, /@media\(max-width:719px\)/);
  assert.match(css, /grid-template-columns:34px minmax\(0,1fr\) 34px 34px/);
  assert.match(css, /published-rack-master-control__icon\{display:block/);
  assert.match(component, /aria-label="Collapse all identity modules"/);
  assert.match(component, /Finish arranging identity modules/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
