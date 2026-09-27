import assert from 'node:assert/strict';
import test from 'node:test';
import { assertValidSystemWorkflowDraft, createEmptySystemWorkflowDraft } from './systemWorkflowDraft.js';
import { createArticle } from '../../text/domain/article.js';
import {
  createSystemWorkflowGridCandidate,
  createSystemWorkflowGridDeleteCandidate,
  createSystemWorkflowGridDuplicateCandidate,
  createSystemWorkflowGridRenameCandidate,
  createSystemWorkflowGridReorderCandidate,
  createSystemWorkflowGridVisibilityCandidate,
  inspectSystemWorkflowGridDeletion,
  systemWorkflowGridFingerprint,
  systemWorkflowGridOrder,
} from './systemWorkflowGrid.js';
import {
  adjacentSystemWorkflowGridId,
  adjacentSystemWorkflowGridIdInOrder,
  firstSystemWorkflowGridId,
  reconcileSystemWorkflowGridSelection,
} from './systemWorkflowNavigation.js';

const PROFILE = '0x1111111111111111111111111111111111111111';

test('render navigation uses scene order, wraps in both directions and excludes the cover', () => {
  const order = Object.freeze(['grid:home', 'grid:second', 'grid:third']);
  for (let index = 0; index < order.length; index += 1) {
    assert.equal(adjacentSystemWorkflowGridIdInOrder(order, order[index], 'next'), order[(index + 1) % order.length]);
    assert.equal(adjacentSystemWorkflowGridIdInOrder(order, order[index], 'previous'), order[(index + order.length - 1) % order.length]);
  }
  assert.equal(adjacentSystemWorkflowGridIdInOrder(['grid:home'], 'grid:home', 'next'), null);
  assert.equal(adjacentSystemWorkflowGridIdInOrder(order, 'grid:world-cover', 'previous'), null);
  assert.throws(() => adjacentSystemWorkflowGridIdInOrder(order, 'grid:missing', 'next'), { code: 'SYSTEM_WORKFLOW_GRID_UNKNOWN' });
  assert.throws(() => adjacentSystemWorkflowGridIdInOrder(order, 'grid:home', 'up'), { code: 'SYSTEM_WORKFLOW_NAVIGATION_DIRECTION_INVALID' });
  assert.throws(() => adjacentSystemWorkflowGridId({ grids: order.map((id) => ({ id })) }, 'grid:home', 'next'));
});
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const initial = () => createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
const placement = () => ({
  id: 'placement-a', stableAssetId: ASSET, column: 1, row: 1, columnSpan: 4, rowSpan: 3,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

test('dynamic Grid CRUD appends private Grids, preserves IDs, and deletes only with exact impact', () => {
  const home = initial();
  const created = createSystemWorkflowGridCandidate(home, { generateId: () => 'second' });
  assert.deepEqual(created.grids.map(({ id, title, visibility }) => ({ id, title, visibility })), [
    { id: 'grid:home', title: 'HOME', visibility: 'PUBLIC' },
    { id: 'grid:second', title: 'GRID 02', visibility: 'PRIVATE' },
    { id: 'grid:world-cover', title: 'WORLD COVER', visibility: 'PUBLIC' },
  ]);
  const renamed = createSystemWorkflowGridRenameCandidate(created, {
    expectedGridFingerprint: systemWorkflowGridFingerprint(created.grids[1]),
    gridId: 'grid:second', name: '  Archive   Room  ',
  });
  const visible = createSystemWorkflowGridVisibilityCandidate(renamed, {
    expectedGridFingerprint: systemWorkflowGridFingerprint(renamed.grids[1]),
    gridId: 'grid:second', visibility: 'PUBLIC',
  });
  assert.equal(visible.grids[1].title, 'Archive Room');
  assert.equal(visible.grids[1].visibility, 'PUBLIC');
  assert.equal(home.grids.length, 2);

  const impact = inspectSystemWorkflowGridDeletion(visible, { gridId: 'grid:second' });
  assert.throws(
    () => createSystemWorkflowGridDeleteCandidate(visible, {
      gridId: 'grid:second', confirmation: { ...impact, title: 'stale' },
    }),
    { code: 'SYSTEM_WORKFLOW_GRID_DELETE_CONFIRMATION_STALE' },
  );
  const deleted = createSystemWorkflowGridDeleteCandidate(visible, {
    gridId: 'grid:second', confirmation: impact,
  });
  assert.deepEqual(deleted.grids.map(({ id }) => id), ['grid:home', 'grid:world-cover']);
  assert.throws(
    () => createSystemWorkflowGridDeleteCandidate(deleted, {
      gridId: 'grid:home', confirmation: inspectSystemWorkflowGridDeletion(deleted, { gridId: 'grid:home' }),
    }),
    { code: 'SYSTEM_WORKFLOW_GRID_LAST' },
  );
});

test('rename and visibility are no-ops only for a fresh exact Grid fingerprint', () => {
  const draft = initial();
  const fingerprint = systemWorkflowGridFingerprint(draft.grids[0]);
  assert.equal(createSystemWorkflowGridRenameCandidate(draft, {
    expectedGridFingerprint: fingerprint, gridId: 'grid:home', name: 'HOME',
  }), null);
  assert.equal(createSystemWorkflowGridVisibilityCandidate(draft, {
    expectedGridFingerprint: fingerprint, gridId: 'grid:home', visibility: 'PUBLIC',
  }), null);
  const changed = structuredClone(draft);
  changed.grids[0].subtitle = 'changed elsewhere';
  assert.throws(() => createSystemWorkflowGridRenameCandidate(changed, {
    expectedGridFingerprint: fingerprint, gridId: 'grid:home', name: 'ARCHIVE',
  }), { code: 'SYSTEM_WORKFLOW_GRID_STALE' });
  assert.throws(() => createSystemWorkflowGridVisibilityCandidate(changed, {
    expectedGridFingerprint: fingerprint, gridId: 'grid:home', visibility: 'PRIVATE',
  }), { code: 'SYSTEM_WORKFLOW_GRID_STALE' });
});

test('reorder is atomic, stale-safe, and ordered navigation has no coordinates', () => {
  let draft = createSystemWorkflowGridCandidate(initial(), { generateId: () => 'second' });
  draft = createSystemWorkflowGridCandidate(draft, { generateId: () => 'third' });
  const order = systemWorkflowGridOrder(draft);
  const reordered = createSystemWorkflowGridReorderCandidate(draft, {
    expectedOrder: order,
    gridId: 'grid:third',
    toIndex: 0,
  });
  assert.deepEqual(systemWorkflowGridOrder(reordered), ['grid:third', 'grid:home', 'grid:second']);
  assert.equal(firstSystemWorkflowGridId(reordered), 'grid:third');
  assert.equal(adjacentSystemWorkflowGridId(reordered, 'grid:third', 'next'), 'grid:home');
  assert.equal(adjacentSystemWorkflowGridId(reordered, 'grid:third', 'previous'), 'grid:second');
  assert.equal(adjacentSystemWorkflowGridId(reordered, 'grid:second', 'next'), 'grid:third');
  assert.equal(adjacentSystemWorkflowGridId(initial(), 'grid:home', 'next'), null);
  assert.equal(adjacentSystemWorkflowGridId(initial(), 'grid:home', 'previous'), null);
  assert.equal(adjacentSystemWorkflowGridId(reordered, 'grid:world-cover', 'next'), null);
  assert.equal(reconcileSystemWorkflowGridSelection(reordered, 'grid:missing'), 'grid:third');
  assert.throws(
    () => createSystemWorkflowGridReorderCandidate(reordered, {
      expectedOrder: order,
      gridId: 'grid:home',
      toIndex: 2,
    }),
    { code: 'SYSTEM_WORKFLOW_GRID_ORDER_STALE' },
  );
  assert.ok(reordered.grids.every((grid) => !Object.hasOwn(grid, 'coordinate')));
});

test('the Grid lifecycle reaches 24 and rejects the twenty-fifth', () => {
  let draft = initial();
  while (draft.grids.filter(({ id }) => id !== 'grid:world-cover').length < 24) {
    const id = `generated-${draft.grids.length}`;
    draft = createSystemWorkflowGridCandidate(draft, { generateId: () => id });
  }
  assert.equal(draft.grids.length, 25);
  assert.throws(
    () => createSystemWorkflowGridCandidate(draft, { generateId: () => 'overflow' }),
    { code: 'SYSTEM_WORKFLOW_GRID_LIMIT_REACHED' },
  );
});

test('delete confirmation fingerprints the complete canonical serialized Grid', () => {
  const draft = createSystemWorkflowGridCandidate(initial(), { generateId: () => 'second' });
  draft.grids[1].placements = [placement()];
  const confirmation = inspectSystemWorkflowGridDeletion(draft, { gridId: 'grid:second' });
  for (const mutate of [
    (grid) => { grid.placements[0].column = 2; },
    (grid) => { grid.placements[0].crop = { x: 0.5, y: 0.5, zoom: 1 }; },
    (grid) => { grid.placements[0].locked = true; },
    (grid) => { grid.placements[0].inspectionMode = 'IN_PLACE'; },
  ]) {
    const changed = structuredClone(draft);
    mutate(changed.grids[1]);
    assert.notEqual(
      systemWorkflowGridFingerprint(changed.grids[1]),
      confirmation.fingerprint,
    );
    assert.throws(() => createSystemWorkflowGridDeleteCandidate(changed, {
      gridId: 'grid:second', confirmation,
    }), { code: 'SYSTEM_WORKFLOW_GRID_DELETE_CONFIRMATION_STALE' });
  }
});

test('Grid duplicate preserves exact artwork, rich Text and groups with independent IDs', () => {
  let draft = createSystemWorkflowGridCandidate(initial(), { generateId: () => 'second' });
  const article = createArticle();
  article.title = 'Scene notes';
  article.content.content = [{ type: 'paragraph', content: [{ type: 'text', text: 'Original words', marks: [{ type: 'bold' }] }] }];
  draft.grids[0].subtitle = 'A layered scene';
  draft.grids[0].labelOffset = { column: 2, row: -1 };
  draft.grids[0].placements = [
    { ...placement(), selectedMedia: { url: 'https://example.com/selected.png', width: 1400, height: 900 },
      crop: { x: .4, y: .6, zoom: 2 }, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false },
      mediaFrameRatio: 1.5, inspectionMode: 'IN_PLACE', locked: true },
    { ...placement(), id: 'placement-b', layer: 2, navigationOrder: 2, column: 6, locked: true },
    { id: 'placement-text', kind: 'text', text: { article }, column: 2, row: 5, columnSpan: 8, rowSpan: 4,
      layer: 1, navigationOrder: 1, visibility: 'PUBLIC', locked: false, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } },
    { ...placement(), id: 'placement-private', layer: 3, navigationOrder: 3, visibility: 'PRIVATE' },
  ];
  draft.grids[0].groups = [{ id: 'group:original', placementIds: ['placement-a', 'placement-b'] }];
  draft = assertValidSystemWorkflowDraft(draft);
  const before = structuredClone(draft), source = draft.grids[0];
  let number = 0;
  const result = createSystemWorkflowGridDuplicateCandidate(draft, { gridId: source.id,
    expectedGridFingerprint: systemWorkflowGridFingerprint(source), generateId: () => 'copy',
    generatePlacementId: () => `copied-${++number}` });
  assert.deepEqual(draft, before, 'source input is never mutated');
  assert.deepEqual(result.grids.map(grid => grid.id), ['grid:home', 'grid:second', 'grid:copy', 'grid:world-cover']);
  const copy = result.grids[2];
  assert.equal(copy.title, 'HOME copy');
  assert.equal(copy.visibility, 'PRIVATE');
  assert.equal(copy.subtitle, source.subtitle);
  assert.deepEqual(copy.labelOffset, source.labelOffset);
  const withoutId = ({ id, ...value }) => value;
  assert.deepEqual(copy.placements.map(withoutId), source.placements.map(withoutId));
  assert.ok(copy.placements.every(item => !source.placements.some(original => original.id === item.id)));
  assert.notEqual(copy.groups[0].id, source.groups[0].id);
  assert.deepEqual(copy.groups[0].placementIds, [copy.placements[0].id, copy.placements[1].id]);
  copy.placements[2].text.article.content.content[0].content[0].text = 'Changed copy';
  assert.equal(result.grids[0].placements[2].text.article.content.content[0].content[0].text, 'Original words');
});

test('Grid duplicate names are unique and bounded, including copies of private and legacy empty scenes', () => {
  const draft = initial(); draft.grids[0].title = 'x'.repeat(80);
  const source = draft.grids[0], request = { gridId: source.id, expectedGridFingerprint: systemWorkflowGridFingerprint(source) };
  const first = createSystemWorkflowGridDuplicateCandidate(draft, { ...request, generateId: () => 'first' });
  const second = createSystemWorkflowGridDuplicateCandidate(first, { ...request, generateId: () => 'second' });
  assert.equal(first.grids[1].title.length, 80);
  assert.equal(second.grids[2].title.length, 80);
  assert.match(second.grids[2].title, / copy 2$/);
  assert.notEqual(first.grids[1].title, second.grids[2].title);
  const privateCopy = createSystemWorkflowGridDuplicateCandidate(first, { gridId: first.grids[1].id,
    expectedGridFingerprint: systemWorkflowGridFingerprint(first.grids[1]), generateId: () => 'private-copy' });
  assert.equal(privateCopy.grids[2].visibility, 'PRIVATE');
  assert.deepEqual(privateCopy.grids[2].placements, []);
  assert.equal(Object.hasOwn(privateCopy.grids[2], 'groups'), false);
});

test('Grid duplicate rejects stale sources, World Cover, exhausted IDs and the Grid limit', () => {
  const draft = initial(), source = draft.grids[0];
  const request = { gridId: source.id, expectedGridFingerprint: systemWorkflowGridFingerprint(source) };
  assert.throws(() => createSystemWorkflowGridDuplicateCandidate(draft, { ...request, expectedGridFingerprint: 'stale' }), { code: 'SYSTEM_WORKFLOW_GRID_STALE' });
  assert.throws(() => createSystemWorkflowGridDuplicateCandidate(draft, { ...request, gridId: 'missing' }), { code: 'SYSTEM_WORKFLOW_GRID_UNKNOWN' });
  assert.throws(() => createSystemWorkflowGridDuplicateCandidate(draft, { gridId: 'grid:world-cover',
    expectedGridFingerprint: systemWorkflowGridFingerprint(draft.grids[1]) }), { code: 'SYSTEM_WORKFLOW_WORLD_COVER_PROTECTED' });
  assert.throws(() => createSystemWorkflowGridDuplicateCandidate(draft, { ...request, generateId: () => 'home' }), { code: 'SYSTEM_WORKFLOW_ID_EXHAUSTED' });
  let full = draft;
  for (let index = 1; index < 24; index++) full = createSystemWorkflowGridDuplicateCandidate(full, { ...request, generateId: () => `copy-${index}` });
  assert.throws(() => createSystemWorkflowGridDuplicateCandidate(full, request), { code: 'SYSTEM_WORKFLOW_GRID_LIMIT_REACHED' });
  assert.equal(draft.grids.length, 2);
});
