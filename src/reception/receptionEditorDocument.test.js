import test from 'node:test';
import assert from 'node:assert/strict';
import { createReception, validReception, projectReception, restoreReception } from '../profileDocument/domain/receptionPresentation.js';
import { createReceptionExample } from '../../design-system/lab/receptionExample.js';
import { addReceptionScenePlacement } from './receptionLayers.js';
import { createReceptionEditorDocument, receptionModuleWindow, withReceptionModuleWindow, reconcileReceptionCells,
  receptionResponsiveLayout } from './receptionEditorDocument.js';
import { setReceptionCellMemberAnchor, setReceptionCellClip } from './receptionBento.js';
import { receptionMemberAnchor, editorCellPreviewTransforms } from './editorCellGeometry.js';

function sample() {
  const value = createReceptionExample(); value.radius = 24;
  value.shapes = [{ id: 'shape:overlay', name: 'Overlay', color: '#ffffff', opacity: .5, visibility: 'PUBLIC' }];
  const layered = addReceptionScenePlacement(value, value.regions[0].id, 'shape:overlay', { column: 4, row: 2, columnSpan: 8, rowSpan: 6 });
  layered.regions[0].scene.mobile = [{ id: 'shape:overlay', column: 2, row: 1, columnSpan: 4, rowSpan: 3 }];
  return layered;
}

test('conversion preserves source records, crop, layers, rounded cells and mobile overrides without mutating v2', () => {
  const old = sample(), saved = structuredClone(old), value = createReceptionEditorDocument(old);
  assert.equal(validReception(value), true);
  assert.deepEqual(old, saved);
  assert.equal(value.cells[0].radius, 24);
  assert.deepEqual(value.imageModules[0].artwork, old.imageModules[0].artwork);
  assert.equal(value.cells[0].members.length, 2);
  assert.deepEqual(value.artworkLayers, [value.cells[0].id, ...value.cells[0].members]);
  assert.equal(value.cells[0].mobile.referenceWidth, 390);
  assert.deepEqual(value.shapes.find(item => item.id === 'shape:overlay'), old.shapes[0]);
  assert.equal(value.workbench.display.open, false);
});

test('builtin profile content retains its semantic identity when converted', () => {
  const old = createReception(); old.regions[0].content = 'profile';
  const value = createReceptionEditorDocument(old);
  assert.equal(value.cells[0].content, 'profile');
  assert.equal(validReception(value), true);
  assert.equal(validReception(projectReception(value), true), true);
});

test('public projection excludes private cells and their children and filters mobile references together', () => {
  const value = createReceptionEditorDocument(sample()), owner = value.cells[0].id;
  const privateChild = { ...value, shapes: value.shapes.map(item => item.id === 'shape:overlay' ? { ...item, visibility: 'PRIVATE' } : item) };
  const publicChild = projectReception(privateChild);
  assert.equal(validReception(publicChild, true), true);
  assert.deepEqual(publicChild.cells[0].members, [value.imageModules[0].id]);
  assert.deepEqual(publicChild.cells[0].mobile.placements, []);
  assert.equal(validReception(restoreReception(publicChild)), true);
  const privateCell = { ...value, shapes: value.shapes.map(item => item.id === owner ? { ...item, visibility: 'PRIVATE' } : item) };
  const hidden = projectReception(privateCell);
  assert.deepEqual(hidden.cells, []); assert.deepEqual(hidden.shapes, []); assert.deepEqual(hidden.imageModules, []);
  assert.equal(validReception(hidden, true), true);
});

test('cell validation rejects cycles, double membership, stale references and unknown module frames', () => {
  const value = createReceptionEditorDocument(sample());
  const invalid = make => { const next = structuredClone(value); make(next); assert.equal(validReception(next), false); };
  invalid(v => v.cells[0].members.push(v.cells[0].id));
  invalid(v => v.cells[0].members.push(v.cells[0].members[0]));
  invalid(v => v.cells[0].members.push('shape:missing'));
  invalid(v => v.workbench.shapes.push({ ...v.workbench.shapes[0], id: 'shape:missing' }));
  invalid(v => v.cells[0].mobile.placements.push({ id: 'shape:missing', window: { left: 0, top: 0, width: 32, height: 32 } }));
});

test('explicitly removing membership from an existing private cell retains authored member visibility', () => {
  const before = createReceptionEditorDocument(sample());
  before.shapes.find(item => item.id === before.cells[0].id).visibility = 'PRIVATE';
  const candidate = structuredClone(before); candidate.cells[0].members = []; candidate.cells[0].mobile.placements = [];
  const after = reconcileReceptionCells(before, candidate);
  assert.deepEqual(after.imageModules, before.imageModules); assert.deepEqual(after.shapes, before.shapes);
  assert.equal(projectReception(after).imageModules.length, before.imageModules.length);
});

test('moving and resizing a cell carries untouched native layers once and preserves explicit child transforms', () => {
  const value = createReceptionEditorDocument(sample()), id = value.cells[0].id, original = receptionModuleWindow(value, id);
  const oldChild = receptionModuleWindow(value, 'shape:overlay');
  const enlarged = withReceptionModuleWindow(value, id, { ...original, left: 100, top: 50, width: original.width * 1.5, height: original.height * 1.5 });
  const moved = reconcileReceptionCells(value, enlarged);
  assert.deepEqual(receptionModuleWindow(moved, 'shape:overlay'), { left: 100 + oldChild.left * 1.5, top: 50 + oldChild.top * 1.5,
    width: oldChild.width * 1.5, height: oldChild.height * 1.5 });
  const explicit = { left: 800, top: 250, width: 220, height: 180 };
  const changed = reconcileReceptionCells(value, withReceptionModuleWindow(enlarged, 'shape:overlay', explicit));
  assert.deepEqual(receptionModuleWindow(changed, 'shape:overlay'), explicit);
});

test('mobile overrides scale from their reference cell width and do not mutate desktop geometry', () => {
  const value = createReceptionEditorDocument(sample()), saved = structuredClone(value), id = 'shape:overlay';
  const large = receptionResponsiveLayout(value, 390), narrow = receptionResponsiveLayout(value, 320);
  assert.equal(large.mobile, true); assert.equal(narrow.mobile, true);
  assert.equal(narrow.windows[id].width, large.windows[id].width * 320 / 390);
  assert.equal(narrow.windows[id].left, large.windows[id].left * 320 / 390);
  assert.equal(receptionResponsiveLayout(value, 1440).mobile, false);
  assert.deepEqual(value, saved);
});

test('mobile preview includes visible independent artwork below reflowed cells without expanding for closed artwork', () => {
  let value = createReceptionEditorDocument(sample()); value.cells[0].mobile.height = 80;
  value.shapes.push({ id: 'shape:free', name: 'Free shape', color: '#ffffff', opacity: 1, visibility: 'PUBLIC' });
  value.artworkLayers.push('shape:free');
  value = withReceptionModuleWindow(value, 'shape:free', { left: 100, top: 800, width: 200, height: 100 });
  const layout = receptionResponsiveLayout(value, 390);
  assert.equal(layout.height, layout.windows['shape:free'].top + layout.windows['shape:free'].height);
  assert.ok(layout.height > layout.cells[0].window.height);
  value.workbench.shapes = value.workbench.shapes.map(item => item.id === 'shape:free' ? { ...item, open: false } : item);
  const closed = receptionResponsiveLayout(value, 390);
  assert.equal(closed.windows['shape:free'], undefined); assert.equal(closed.height, 80);
});

test('source-only branding stays available to the header but never paints as a free duplicate', () => {
  const old = createReceptionExample();
  old.imageModules.push({ ...structuredClone(old.imageModules[0]), id: 'image:logo', name: 'Header logo', width: 100, height: 100 });
  old.branding.logo = 'image:logo';
  const value = createReceptionEditorDocument(old), layout = receptionResponsiveLayout(value, 390);
  assert.equal(value.imageModules.length, 2); assert.equal(value.branding.logo, 'image:logo');
  assert.equal(layout.windows['image:logo'], undefined);
  assert.equal(projectReception(value).imageModules.length, 2);
});

test('closed cells and their members do not reserve mobile rows or leak free artwork', () => {
  const value = createReceptionEditorDocument(sample()), owner = value.cells[0].id;
  value.workbench.shapes = value.workbench.shapes.map(item => item.id === owner ? { ...item, open: false } : item);
  const layout = receptionResponsiveLayout(value, 390);
  assert.deepEqual(layout.cells, []); assert.deepEqual(layout.windows, {});
});

function authoredCanvas(width = 800, height = 500) {
  let value = createReceptionEditorDocument();
  value.workbench.area = { left: 100, top: 50, width, height };
  value.shapes = [{ id: 'shape:canvas-cell', name: 'Authored cell', color: '#123456', opacity: 1, visibility: 'PUBLIC' }];
  value.artworkLayers = ['shape:canvas-cell'];
  value = withReceptionModuleWindow(value, 'shape:canvas-cell', { left: 140, top: 90, width: 320, height: 240 });
  value.cells = [{ id: 'shape:canvas-cell', members: [], mobile: { columns: 2, height: 280 } }];
  return value;
}

function anchoredContents() {
  let value = authoredCanvas();
  for (const [id, left, top, width, height] of [['shape:a', 160, 110, 60, 40], ['shape:b', 260, 150, 80, 50]]) {
    value.shapes.push({ id, name: id, color: '#ffffff', opacity: 1, visibility: 'PUBLIC' });
    value.artworkLayers.push(id);
    value = withReceptionModuleWindow(value, id, { left, top, width, height });
  }
  value.cells[0].members = ['shape:a', 'shape:b'];
  return setReceptionCellMemberAnchor(value, value.cells[0].id, value.cells[0].members,
    { alignX: 'center', alignY: 'center', paddingX: 16, paddingY: 12 });
}

test('native group anchors preserve relative placement and size through cell resize and its preview', () => {
  const value = anchoredContents(), cell = value.cells[0], oldCell = receptionModuleWindow(value, cell.id);
  const frame = { ...oldCell, width: 640, height: 480 };
  const next = reconcileReceptionCells(value, withReceptionModuleWindow(value, cell.id, frame));
  const a = receptionModuleWindow(next, 'shape:a'), b = receptionModuleWindow(next, 'shape:b');
  assert.deepEqual(a, { left: 370, top: 285, width: 60, height: 40 });
  assert.deepEqual(b, { left: 470, top: 325, width: 80, height: 50 });
  assert.deepEqual(next.cells[0].memberAnchors, cell.memberAnchors);
  const preview = editorCellPreviewTransforms(value.cells, { [cell.id]: { frame } }, value.workbench, value);
  assert.deepEqual(preview['shape:a'].frame, a); assert.deepEqual(preview['shape:b'].frame, b);
});

test('free dragging releases the affected group; individual anchoring moves only its own member', () => {
  const value = anchoredContents(), cell = value.cells[0], a = receptionModuleWindow(value, 'shape:a'), b = receptionModuleWindow(value, 'shape:b');
  const moved = reconcileReceptionCells(value, withReceptionModuleWindow(value, 'shape:a', { ...a, left: a.left + 10 }));
  assert.equal(receptionMemberAnchor(moved.cells[0], ['shape:a']), null);
  assert.deepEqual(receptionModuleWindow(moved, 'shape:b'), b);
  const individual = setReceptionCellMemberAnchor(value, cell.id, ['shape:b'], { alignX: 'right', alignY: 'bottom', paddingX: 8, paddingY: 10 });
  assert.equal(receptionMemberAnchor(individual.cells[0], ['shape:a']), null);
  assert.deepEqual(receptionModuleWindow(individual, 'shape:a'), a);
  assert.deepEqual(receptionModuleWindow(individual, 'shape:b'), { left: 372, top: 270, width: 80, height: 50 });
  assert.deepEqual(receptionMemberAnchor(value.cells[0], ['shape:a']).members, cell.members);
});

test('resizing anchored contents preserves anchoring, while removal prunes group references', () => {
  const value = anchoredContents(), a = receptionModuleWindow(value, 'shape:a');
  const resized = reconcileReceptionCells(value, withReceptionModuleWindow(value, 'shape:a', { ...a, width: 220 }));
  assert.equal(receptionMemberAnchor(resized.cells[0], ['shape:a']).alignX, 'center');
  const remaining = { ...value, cells: value.cells.map(cell => ({ ...cell, members: ['shape:a'] })) };
  const pruned = reconcileReceptionCells(value, remaining);
  assert.deepEqual(pruned.cells[0].memberAnchors[0].members, ['shape:a']);
  assert.equal(validReception(pruned), true);
});

test('anchors and clipping survive public projection with private members removed', () => {
  const value = setReceptionCellClip(anchoredContents(), 'shape:canvas-cell', false);
  value.shapes.find(item => item.id === 'shape:b').visibility = 'PRIVATE';
  const published = projectReception(value);
  assert.equal(published.cells[0].clipContent, false);
  assert.deepEqual(published.cells[0].memberAnchors[0].members, ['shape:a']);
  assert.equal(validReception(published, true), true);
  assert.deepEqual(restoreReception(published).cells, published.cells);
  const mobile = receptionResponsiveLayout(value, 390), owner = mobile.cells[0].window;
  const a = mobile.windows['shape:a'], b = mobile.windows['shape:b'];
  assert.equal(a.width, 60); assert.equal(b.height, 50);
  assert.equal((a.left + b.left + b.width) / 2, owner.left + owner.width / 2);
});

test('strict cell placement validation rejects overlapping, foreign and invalid anchors or clipping', () => {
  const value = anchoredContents();
  const invalid = change => { const next = structuredClone(value); change(next.cells[0]); assert.equal(validReception(next), false); };
  invalid(cell => { cell.clipContent = 'false'; });
  invalid(cell => { cell.memberAnchors[0].paddingX = -1; });
  invalid(cell => { cell.memberAnchors[0].members = ['shape:missing']; });
  invalid(cell => { cell.memberAnchors.push({ ...cell.memberAnchors[0], members: ['shape:a'] }); });
  invalid(cell => { cell.memberAnchors[0].alignX = 'middle'; });
});

test('wide Desktop previews preserve authored canvas size and module geometry without upscaling', () => {
  const value = authoredCanvas(), saved = structuredClone(value);
  for (const viewportWidth of [1440, 2560]) {
    const layout = receptionResponsiveLayout(value, viewportWidth);
    assert.equal(layout.viewportWidth, viewportWidth);
    assert.equal(layout.width, 800); assert.equal(layout.height, 500); assert.equal(layout.scale, 1);
    assert.equal(layout.mobile, false);
    assert.deepEqual(layout.windows['shape:canvas-cell'], { left: 40, top: 40, width: 320, height: 240 });
  }
  assert.deepEqual(value, saved);
});

test('a narrow tablet shrinks the authored canvas while Phone reflows cells inside its actual width', () => {
  const value = authoredCanvas(), saved = structuredClone(value);
  const tablet = receptionResponsiveLayout(value, 700);
  assert.equal(tablet.mobile, false); assert.equal(tablet.width, 700); assert.equal(tablet.height, 437.5);
  assert.equal(tablet.scale, .875);
  assert.deepEqual(tablet.windows['shape:canvas-cell'], { left: 35, top: 35, width: 280, height: 210 });
  for (const width of [390, 320]) {
    const phone = receptionResponsiveLayout(value, width);
    assert.equal(phone.viewportWidth, width); assert.equal(phone.width, width); assert.equal(phone.mobile, true);
    assert.equal(phone.height, 280);
    assert.deepEqual(phone.cells[0].window, { left: 0, top: 0, width, height: 280 });
  }
  assert.deepEqual(value, saved);
});

test('a small authored canvas remains desktop on a wide viewport rather than selecting Phone by its own width', () => {
  const value = authoredCanvas(500, 400), layout = receptionResponsiveLayout(value, 1440);
  assert.equal(layout.width, 500); assert.equal(layout.viewportWidth, 1440);
  assert.equal(layout.height, 400); assert.equal(layout.mobile, false); assert.equal(layout.scale, 1);
  assert.deepEqual(layout.cells[0].window, { left: 40, top: 40, width: 320, height: 240 });
});

test('two half-row cells retain positive widths inside a valid tiny authored canvas', () => {
  let value = createReceptionEditorDocument();
  value.workbench.area = { left: 0, top: 0, width: 8, height: 8 };
  value.shapes = ['shape:left', 'shape:right'].map(id => ({ id, name: id, color: '#ffffff', opacity: 1, visibility: 'PUBLIC' }));
  value.artworkLayers = value.shapes.map(item => item.id);
  value.cells = value.shapes.map(item => ({ id: item.id, members: [], mobile: { columns: 1, height: 80 } }));
  value = withReceptionModuleWindow(value, 'shape:left', { left: 0, top: 0, width: 8, height: 8 });
  value = withReceptionModuleWindow(value, 'shape:right', { left: 8, top: 0, width: 8, height: 8 });
  assert.equal(validReception(value), true);
  const before = structuredClone(value), layout = receptionResponsiveLayout(value, 390);
  assert.equal(layout.width, 8);
  for (const cell of layout.cells) {
    assert.ok(cell.window.width > 0);
    assert.ok(cell.window.left >= 0);
    assert.ok(cell.window.left + cell.window.width <= layout.width);
  }
  assert.ok(layout.cells[0].window.left + layout.cells[0].window.width <= layout.cells[1].window.left);
  assert.deepEqual(value, before);
});
