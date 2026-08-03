import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('People adapter owns listbox focus and delegates normalized selection to the existing owner authority', async () => {
  const [source, styles] = await Promise.all([read('./Modul8rPeopleAdapter.jsx'), read('./modul8rPeople.css')]);
  assert.match(source, /useProfileDiscoveryController\(\{ active, repository \}\)/);
  assert.match(source, /onVisitProfile\?\.\(selected\.address\)/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /Search/);
  assert.doesNotMatch(source, /createViewedProfileUrl|resolveProfileTarget|aria-modal|SIZE|ProfileDiscovery\.jsx|inscapeDirectory\.css/);
  assert.match(styles, /var\(--lattice-menu-panel\)/);
  assert.doesNotMatch(styles, /\.profile-discovery|position:\s*fixed|lattice-rack-/);
});

test('production owner workspace keeps all adapters mounted and supplies stable active lifecycle functions', async () => {
  const integration = await read('./Modul8rOwnerWorkspace.jsx');
  assert.match(integration, /library: <Modul8rLibraryAdapter/);
  assert.match(integration, /activity: \(\{ active \}\) => <Modul8rActivityAdapter active=\{active\}/);
  assert.match(integration, /people: \(\{ active \}\) => <Modul8rPeopleAdapter active=\{active\}/);
  assert.match(integration, /onVisitProfile=\{onVisitProfile\}/);
});
