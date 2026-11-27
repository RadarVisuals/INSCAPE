import test from 'node:test';
import assert from 'node:assert/strict';
import { validCompositionEditorDocument as validComposition, projectCompositionEditorDocument as projectComposition, restoreCompositionEditorDocument as restoreComposition } from './compositionEditorDocument.js';
import { createCompositionExample } from '../../design-system/lab/compositionExample.js';
import { createCompositionEditorDocument, compositionModuleWindow, withCompositionModuleWindow, reconcileCompositionCells,
  compositionResponsiveLayout } from './compositionEditorDocument.js';
import { setCompositionCellMemberAnchor, setCompositionCellClip } from './compositionBento.js';
import { compositionMemberAnchor, editorCellPreviewTransforms } from './editorCellGeometry.js';
import { fitNativeMediaRectangle } from '../lattice/rendering/latticeGeometry.js';
import { progressiveCompositionFrames } from './compositionResponsiveImages.js';

test('six columns wrap progressively while a vertical pair stays together and saved geometry remains unchanged', () => {
  const cells = Array.from({ length: 7 }, (_, index) => ({ id: `shape:flow-${index}` }));
  const frames = cells.map((cell, index) => ({ id: cell.id, open: true, window: index < 2
    ? { left: 0, top: index * 150, width: 300, height: 150 }
    : { left: (index - 1) * 300, top: 0, width: 300, height: 300 } }));
  const value = { cells, bento: { gap: 0 }, workbench: { area: { width: 1800, height: 300 }, shapes: frames } };
  const saved = structuredClone(value);
  assert.equal(progressiveCompositionFrames(value, cells, 1, 0, () => 200), null);
  for (const [width, count] of [[1200, 5], [1000, 4], [800, 3], [600, 2], [400, 1]]) {
    const output = progressiveCompositionFrames(value, cells, width / 1800, 0, () => 200);
    const columns = new Set(Object.values(output).filter(r => Math.abs(r.top) < .001).map(r => r.left));
    assert.equal(columns.size, count);
    const a = output[cells[0].id], b = output[cells[1].id];
    assert.equal(a.left, b.left); assert.equal(a.width, b.width);
    assert.ok(Math.abs(a.top + a.height - b.top) < .001);
    for (const r of Object.values(output)) {
      assert.ok(r.width > 0 && r.height > 0);
      assert.ok(r.left >= 0 && r.left + r.width <= width + .001);
    }
  }
  assert.deepEqual(value, saved);
});

function responsiveImages() {
  let value = createCompositionEditorDocument();
  value.bento = { gap: 0, padding: 0 };
  const frames = { header: [0, 0, 1440, 120], character: [0, 120, 480, 660],
    content: [480, 120, 480, 660], extra: [960, 120, 480, 660], footer: [0, 780, 1440, 120] };
  // Deliberately different insertion order from desktop reading order.
  for (const name of ['character', 'footer', 'extra', 'header', 'content']) {
    const id = `shape:${name}`, [left, top, width, height] = frames[name];
    value.shapes.push({ id, name, color: '#000000', opacity: 1, visibility: 'PUBLIC' });
    value.cells.push({ id, members: [], mobile: { columns: 2, height: 600 } });
    value.artworkLayers.push(id);
    value = withCompositionModuleWindow(value, id, { left, top, width, height });
  }
  const asset = createCompositionExample().imageModules[0].artwork;
  for (const [name, left, top, width, height] of [['header', 570, 35, 300, 50],
    ['character', 20, 200, 160, 400], ['footer', 1200, 810, 220, 50]]) {
    const id = `image:${name}`;
    const artwork = structuredClone(asset);
    artwork.crop = null; artwork.transform = { quarterTurns: 0, mirrorX: false, mirrorY: false };
    artwork.asset.media.width = width; artwork.asset.media.height = height;
    value.imageModules.push({ id, name, width, height, visibility: 'PUBLIC', artwork });
    value.cells.find(cell => cell.id === `shape:${name}`).members.push(id);
    value.artworkLayers.push(id);
    value = withCompositionModuleWindow(value, id, { left, top, width, height });
  }
  return value;
}

test('stacked layouts keep desktop reading order, compact logos and a centred proportional character without writes', () => {
  const value = responsiveImages(), saved = structuredClone(value);
  assert.equal(validComposition(value), true);
  const desktop = compositionResponsiveLayout(value, 1440);
  assert.deepEqual(desktop.windows['image:character'], compositionModuleWindow(value, 'image:character'));
  for (const width of [650, 640, 390, 320, 650]) {
    const layout = compositionResponsiveLayout(value, width);
    assert.ok(layout.mobile || layout.stacked);
    assert.deepEqual(layout.cells.map(cell => cell.id), ['shape:header', 'shape:character', 'shape:content', 'shape:extra', 'shape:footer']);
    assert.ok(layout.windows['shape:header'].height <= 82);
    assert.ok(layout.windows['shape:footer'].height <= 82);
    for (const name of ['header', 'character', 'footer']) {
      const image = layout.windows[`image:${name}`], parent = layout.windows[`shape:${name}`];
      const media = value.imageModules.find(item => item.id === `image:${name}`).artwork.asset.media;
      assert.ok(Math.abs(image.width / image.height - media.width / media.height) < .001);
      assert.ok(image.left >= parent.left && image.top >= parent.top);
      assert.ok(image.left + image.width <= parent.left + parent.width + .001);
      assert.ok(image.top + image.height <= parent.top + parent.height + .001);
    }
    const image = layout.windows['image:character'], parent = layout.windows['shape:character'];
    assert.ok(Math.abs(image.left + image.width / 2 - parent.left - parent.width / 2) < .001);
    assert.ok(image.height >= 280);
  }
  assert.deepEqual(value, saved);
});

test('explicit stacked order, manual heights and phone image placements survive public projection', () => {
  const value = responsiveImages();
  value.stackOrder = 'manual';
  const character = value.cells[0];
  character.mobile.autoHeight = false; character.mobile.height = 500;
  const published = projectComposition(value), restored = restoreComposition(published);
  assert.equal(validComposition(published, true), true);
  assert.deepEqual(restored.cells, value.cells);
  for (const width of [650, 390]) {
    const layout = compositionResponsiveLayout(restored, width);
    assert.deepEqual(layout.cells.map(cell => cell.id), value.cells.map(cell => cell.id));
    assert.equal(layout.windows[character.id].height, 500);
  }
  character.mobile.referenceWidth = 390;
  character.mobile.placements = [{ id: 'image:character', window: { left: 20, top: 30, width: 120, height: 300 } }];
  const layout = compositionResponsiveLayout(value, 390);
  assert.deepEqual(layout.windows['image:character'], { left: 20, top: 30, width: 120, height: 300 });
  const bad = structuredClone(value); bad.cells[0].mobile.autoHeight = 'yes';
  assert.equal(validComposition(bad), false);
});

test('responsive images respect rotation, authored crops and explicit anchors', () => {
  const value = responsiveImages(), image = value.imageModules.find(item => item.id === 'image:header');
  image.artwork.transform.quarterTurns = 1;
  const rotated = compositionResponsiveLayout(value, 390).windows[image.id];
  assert.ok(Math.abs(rotated.width / rotated.height - 1 / 6) < .001);
  const cell = value.cells.find(item => item.id === 'shape:header');
  cell.memberAnchors = [{ members: [image.id], alignX: 'right', alignY: 'bottom', paddingX: 8, paddingY: 10 }];
  const saved = structuredClone(value), anchored = compositionResponsiveLayout(value, 390);
  const child = anchored.windows[image.id], parent = anchored.windows[cell.id];
  assert.equal(child.width, image.width); assert.equal(child.height, image.height);
  assert.equal(parent.left + parent.width - child.left - child.width, 8);
  assert.equal(parent.top + parent.height - child.top - child.height, 10);
  assert.deepEqual(value, saved);
  delete cell.memberAnchors;
  image.artwork.crop = { x: .5, y: .5, zoom: 2 };
  const crop = structuredClone(image.artwork.crop), fitted = compositionResponsiveLayout(value, 390).windows[image.id];
  assert.ok(Math.abs(fitted.width / fitted.height - image.width / image.height) < .001);
  assert.deepEqual(image.artwork.crop, crop);
});

function sample() {
  let value = createCompositionEditorDocument();
  const id = 'shape:cell', overlay = 'shape:overlay', image = createCompositionExample().imageModules[0];
  value.shapes = [id, overlay].map(id => ({ id, name: id, color: '#ffffff', opacity: .5, visibility: 'PUBLIC' }));
  value.imageModules = [image];
  value.cells = [{ id, members: [image.id, overlay], radius: 24, mobile: { columns: 2, height: 600,
    referenceWidth: 390, placements: [{ id: overlay, window: { left: 32, top: 24, width: 120, height: 100 } }] } }];
  value.artworkLayers = [id, image.id, overlay];
  for (const [key, frame] of [[id, [0, 0, 1440, 900]], [image.id, [0, 0, 1440, 900]], [overlay, [180, 100, 360, 300]]]) {
    const [left, top, width, height] = frame;
    value = withCompositionModuleWindow(value, key, { left, top, width, height });
  }
  return value;
}

test('public projection excludes private cells and their children and filters mobile references together', () => {
  const value = sample(), owner = value.cells[0].id;
  const privateChild = { ...value, shapes: value.shapes.map(item => item.id === 'shape:overlay' ? { ...item, visibility: 'PRIVATE' } : item) };
  const publicChild = projectComposition(privateChild);
  assert.equal(validComposition(publicChild, true), true);
  assert.deepEqual(publicChild.cells[0].members, [value.imageModules[0].id]);
  assert.deepEqual(publicChild.cells[0].mobile.placements, []);
  assert.equal(validComposition(restoreComposition(publicChild)), true);
  const privateCell = { ...value, shapes: value.shapes.map(item => item.id === owner ? { ...item, visibility: 'PRIVATE' } : item) };
  const hidden = projectComposition(privateCell);
  assert.deepEqual(hidden.cells, []); assert.deepEqual(hidden.shapes, []); assert.deepEqual(hidden.imageModules, []);
  assert.equal(validComposition(hidden, true), true);
});

test('cell validation rejects cycles, double membership, stale references and unknown module frames', () => {
  const value = sample();
  const invalid = make => { const next = structuredClone(value); make(next); assert.equal(validComposition(next), false); };
  invalid(v => { v.texts = {}; });
  invalid(v => { v.workbench.texts = {}; });
  invalid(v => v.cells[0].members.push(v.cells[0].id));
  invalid(v => v.cells[0].members.push(v.cells[0].members[0]));
  invalid(v => v.cells[0].members.push('shape:missing'));
  invalid(v => v.workbench.shapes.push({ ...v.workbench.shapes[0], id: 'shape:missing' }));
  invalid(v => v.cells[0].mobile.placements.push({ id: 'shape:missing', window: { left: 0, top: 0, width: 32, height: 32 } }));
});

test('explicitly removing membership from an existing private cell retains authored member visibility', () => {
  const before = sample();
  before.shapes.find(item => item.id === before.cells[0].id).visibility = 'PRIVATE';
  const candidate = structuredClone(before); candidate.cells[0].members = []; candidate.cells[0].mobile.placements = [];
  const after = reconcileCompositionCells(before, candidate);
  assert.deepEqual(after.imageModules, before.imageModules); assert.deepEqual(after.shapes, before.shapes);
  assert.equal(projectComposition(after).imageModules.length, before.imageModules.length);
});

test('moving and resizing a cell carries untouched native layers once and preserves explicit child transforms', () => {
  const value = sample(), id = value.cells[0].id, original = compositionModuleWindow(value, id);
  const oldChild = compositionModuleWindow(value, 'shape:overlay');
  const enlarged = withCompositionModuleWindow(value, id, { ...original, left: 100, top: 50, width: original.width * 1.5, height: original.height * 1.5 });
  const moved = reconcileCompositionCells(value, enlarged);
  assert.deepEqual(compositionModuleWindow(moved, 'shape:overlay'), { left: 100 + oldChild.left * 1.5, top: 50 + oldChild.top * 1.5,
    width: oldChild.width * 1.5, height: oldChild.height * 1.5 });
  const explicit = { left: 800, top: 250, width: 220, height: 180 };
  const changed = reconcileCompositionCells(value, withCompositionModuleWindow(enlarged, 'shape:overlay', explicit));
  assert.deepEqual(compositionModuleWindow(changed, 'shape:overlay'), explicit);
});

test('mobile overrides scale from their reference cell width and do not mutate desktop geometry', () => {
  const value = sample(), saved = structuredClone(value), id = 'shape:overlay';
  const large = compositionResponsiveLayout(value, 390), narrow = compositionResponsiveLayout(value, 320);
  assert.equal(large.mobile, true); assert.equal(narrow.mobile, true);
  assert.equal(narrow.windows[id].width, large.windows[id].width * (320 / 390));
  assert.equal(narrow.windows[id].left, large.windows[id].left * (320 / 390));
  assert.equal(compositionResponsiveLayout(value, 1440).mobile, false);
  assert.deepEqual(value, saved);
});

test('mobile preview includes visible independent artwork below reflowed cells without expanding for closed artwork', () => {
  let value = sample(); value.cells[0].mobile.height = 80;
  value.shapes.push({ id: 'shape:free', name: 'Free shape', color: '#ffffff', opacity: 1, visibility: 'PUBLIC' });
  value.artworkLayers.push('shape:free');
  value = withCompositionModuleWindow(value, 'shape:free', { left: 100, top: 800, width: 200, height: 100 });
  const layout = compositionResponsiveLayout(value, 390);
  assert.equal(layout.height, layout.windows['shape:free'].top + layout.windows['shape:free'].height);
  assert.ok(layout.height > layout.cells[0].window.height);
  value.workbench.shapes = value.workbench.shapes.map(item => item.id === 'shape:free' ? { ...item, open: false } : item);
  const closed = compositionResponsiveLayout(value, 390);
  assert.equal(closed.windows['shape:free'], undefined); assert.equal(closed.height, 80);
});

test('closed cells and their members do not reserve mobile rows or leak free artwork', () => {
  const value = sample(), owner = value.cells[0].id;
  value.workbench.shapes = value.workbench.shapes.map(item => item.id === owner ? { ...item, open: false } : item);
  const layout = compositionResponsiveLayout(value, 390);
  assert.deepEqual(layout.cells, []); assert.deepEqual(layout.windows, {});
});

function authoredCanvas(width = 800, height = 500) {
  let value = createCompositionEditorDocument();
  value.workbench.area = { left: 100, top: 50, width, height };
  value.shapes = [{ id: 'shape:canvas-cell', name: 'Authored cell', color: '#123456', opacity: 1, visibility: 'PUBLIC' }];
  value.artworkLayers = ['shape:canvas-cell'];
  value = withCompositionModuleWindow(value, 'shape:canvas-cell', { left: 140, top: 90, width: 320, height: 240 });
  value.cells = [{ id: 'shape:canvas-cell', members: [], mobile: { columns: 2, height: 280 } }];
  return value;
}

function anchoredContents() {
  let value = authoredCanvas();
  for (const [id, left, top, width, height] of [['shape:a', 160, 110, 60, 40], ['shape:b', 260, 150, 80, 50]]) {
    value.shapes.push({ id, name: id, color: '#ffffff', opacity: 1, visibility: 'PUBLIC' });
    value.artworkLayers.push(id);
    value = withCompositionModuleWindow(value, id, { left, top, width, height });
  }
  value.cells[0].members = ['shape:a', 'shape:b'];
  return setCompositionCellMemberAnchor(value, value.cells[0].id, value.cells[0].members,
    { alignX: 'center', alignY: 'center', paddingX: 16, paddingY: 12 });
}

test('native group anchors preserve relative placement and size through cell resize and its preview', () => {
  const value = anchoredContents(), cell = value.cells[0], oldCell = compositionModuleWindow(value, cell.id);
  const frame = { ...oldCell, width: 640, height: 480 };
  const next = reconcileCompositionCells(value, withCompositionModuleWindow(value, cell.id, frame));
  const a = compositionModuleWindow(next, 'shape:a'), b = compositionModuleWindow(next, 'shape:b');
  assert.deepEqual(a, { left: 370, top: 285, width: 60, height: 40 });
  assert.deepEqual(b, { left: 470, top: 325, width: 80, height: 50 });
  assert.deepEqual(next.cells[0].memberAnchors, cell.memberAnchors);
  const preview = editorCellPreviewTransforms(value.cells, { [cell.id]: { frame } }, value.workbench, value);
  assert.deepEqual(preview['shape:a'].frame, a); assert.deepEqual(preview['shape:b'].frame, b);
});

test('aligned groups shrink with their cells and keep preview, saved geometry and responsive output consistent', () => {
  const value = anchoredContents(), cell = value.cells[0], original = compositionModuleWindow(value, cell.id);
  const frame = { ...original, width: original.width * .8, height: original.height * .8 };
  const beforeA = compositionModuleWindow(value, 'shape:a'), beforeB = compositionModuleWindow(value, 'shape:b');
  const next = reconcileCompositionCells(value, withCompositionModuleWindow(value, cell.id, frame));
  const a = compositionModuleWindow(next, 'shape:a'), b = compositionModuleWindow(next, 'shape:b');
  assert.equal(a.width, beforeA.width * .8); assert.equal(b.height, beforeB.height * .8);
  assert.ok(Math.abs((b.left - a.left) - (beforeB.left - beforeA.left) * .8) < .001);
  const preview = editorCellPreviewTransforms(value.cells, { [cell.id]: { frame } }, value.workbench, value);
  assert.deepEqual(preview['shape:a'].frame, a); assert.deepEqual(preview['shape:b'].frame, b);
  assert.deepEqual(next.cells[0].memberAnchors, cell.memberAnchors);
  const smaller = compositionResponsiveLayout(value, 700);
  assert.ok(Math.abs(smaller.windows['shape:a'].width - beforeA.width * .875) < .001);
});

test('a whole-image frame can remain aligned left across a wide-to-phone reflow without making the character tiny', () => {
  let value = responsiveImages();
  const keep = new Set(['shape:header', 'shape:character', 'shape:footer']);
  value.cells = value.cells.filter(cell => keep.has(cell.id));
  value.shapes = value.shapes.filter(shape => keep.has(shape.id));
  value.workbench.shapes = value.workbench.shapes.filter(shape => keep.has(shape.id));
  value.artworkLayers = value.artworkLayers.filter(id => id.startsWith('image:') || keep.has(id));
  const cell = value.cells.find(item => item.id === 'shape:character'), image = value.imageModules.find(item => item.id === 'image:character');
  const owner = { ...compositionModuleWindow(value, cell.id), width: 1440 };
  value = withCompositionModuleWindow(value, cell.id, owner);
  value = withCompositionModuleWindow(value, image.id, owner);
  cell.memberAnchors = [{ members: [image.id], alignX: 'left', alignY: 'center', paddingX: 0, paddingY: 0 }];
  const saved = structuredClone(value);
  const layout = compositionResponsiveLayout(projectComposition(value), 390), frame = layout.windows[image.id];
  const paint = fitNativeMediaRectangle(frame, image.artwork.asset.media, cell.memberAnchors[0]);
  assert.equal(paint.left, layout.windows[cell.id].left);
  assert.ok(paint.height >= 390, 'the image uses the tall phone cell instead of shrinking by desktop frame width');
  assert.ok(paint.left + paint.width <= layout.windows[cell.id].left + layout.windows[cell.id].width);
  assert.deepEqual(value, saved);
});

test('free dragging releases the affected group; individual anchoring moves only its own member', () => {
  const value = anchoredContents(), cell = value.cells[0], a = compositionModuleWindow(value, 'shape:a'), b = compositionModuleWindow(value, 'shape:b');
  const moved = reconcileCompositionCells(value, withCompositionModuleWindow(value, 'shape:a', { ...a, left: a.left + 10 }));
  assert.equal(compositionMemberAnchor(moved.cells[0], ['shape:a']), null);
  assert.deepEqual(compositionModuleWindow(moved, 'shape:b'), b);
  const individual = setCompositionCellMemberAnchor(value, cell.id, ['shape:b'], { alignX: 'right', alignY: 'bottom', paddingX: 8, paddingY: 10 });
  assert.equal(compositionMemberAnchor(individual.cells[0], ['shape:a']), null);
  assert.deepEqual(compositionModuleWindow(individual, 'shape:a'), a);
  assert.deepEqual(compositionModuleWindow(individual, 'shape:b'), { left: 372, top: 270, width: 80, height: 50 });
  assert.deepEqual(compositionMemberAnchor(value.cells[0], ['shape:a']).members, cell.members);
});

test('resizing anchored contents preserves anchoring, while removal prunes group references', () => {
  const value = anchoredContents(), a = compositionModuleWindow(value, 'shape:a');
  const resized = reconcileCompositionCells(value, withCompositionModuleWindow(value, 'shape:a', { ...a, width: 220 }));
  assert.equal(compositionMemberAnchor(resized.cells[0], ['shape:a']).alignX, 'center');
  const remaining = { ...value, cells: value.cells.map(cell => ({ ...cell, members: ['shape:a'] })) };
  const pruned = reconcileCompositionCells(value, remaining);
  assert.deepEqual(pruned.cells[0].memberAnchors[0].members, ['shape:a']);
  assert.equal(validComposition(pruned), true);
});

test('anchors and clipping survive public projection with private members removed', () => {
  const value = setCompositionCellClip(anchoredContents(), 'shape:canvas-cell', false);
  value.shapes.find(item => item.id === 'shape:b').visibility = 'PRIVATE';
  const published = projectComposition(value);
  assert.equal(published.cells[0].clipContent, false);
  assert.deepEqual(published.cells[0].memberAnchors[0].members, ['shape:a']);
  assert.equal(validComposition(published, true), true);
  assert.deepEqual(restoreComposition(published).cells, published.cells);
  const mobile = compositionResponsiveLayout(value, 390), owner = mobile.cells[0].window;
  const a = mobile.windows['shape:a'], b = mobile.windows['shape:b'];
  assert.equal(a.width, 60); assert.equal(b.height, 50);
  assert.equal((a.left + b.left + b.width) / 2, owner.left + owner.width / 2);
});

test('strict cell placement validation rejects overlapping, foreign and invalid anchors or clipping', () => {
  const value = anchoredContents();
  const invalid = change => { const next = structuredClone(value); change(next.cells[0]); assert.equal(validComposition(next), false); };
  invalid(cell => { cell.clipContent = 'false'; });
  invalid(cell => { cell.memberAnchors[0].paddingX = -1; });
  invalid(cell => { cell.memberAnchors[0].members = ['shape:missing']; });
  invalid(cell => { cell.memberAnchors.push({ ...cell.memberAnchors[0], members: ['shape:a'] }); });
  invalid(cell => { cell.memberAnchors[0].alignX = 'middle'; });
});

test('wide Desktop previews preserve authored canvas size and module geometry without upscaling', () => {
  const value = authoredCanvas(), saved = structuredClone(value);
  for (const viewportWidth of [1440, 2560]) {
    const layout = compositionResponsiveLayout(value, viewportWidth);
    assert.equal(layout.viewportWidth, viewportWidth);
    assert.equal(layout.width, 800); assert.equal(layout.height, 500); assert.equal(layout.scale, 1);
    assert.equal(layout.mobile, false);
    assert.deepEqual(layout.windows['shape:canvas-cell'], { left: 40, top: 40, width: 320, height: 240 });
  }
  assert.deepEqual(value, saved);
});

test('a narrow tablet shrinks the authored canvas while Phone reflows cells inside its actual width', () => {
  const value = authoredCanvas(), saved = structuredClone(value);
  const tablet = compositionResponsiveLayout(value, 700);
  assert.equal(tablet.mobile, false); assert.equal(tablet.width, 700); assert.equal(tablet.height, 437.5);
  assert.equal(tablet.scale, .875);
  assert.deepEqual(tablet.windows['shape:canvas-cell'], { left: 35, top: 35, width: 280, height: 210 });
  for (const width of [390, 320]) {
    const phone = compositionResponsiveLayout(value, width);
    assert.equal(phone.viewportWidth, width); assert.equal(phone.width, width); assert.equal(phone.mobile, true);
    assert.equal(phone.height, 280);
    assert.deepEqual(phone.cells[0].window, { left: 0, top: 0, width, height: 280 });
  }
  assert.deepEqual(value, saved);
});

test('a small authored canvas remains desktop on a wide viewport rather than selecting Phone by its own width', () => {
  const value = authoredCanvas(500, 400), layout = compositionResponsiveLayout(value, 1440);
  assert.equal(layout.width, 500); assert.equal(layout.viewportWidth, 1440);
  assert.equal(layout.height, 400); assert.equal(layout.mobile, false); assert.equal(layout.scale, 1);
  assert.deepEqual(layout.cells[0].window, { left: 40, top: 40, width: 320, height: 240 });
});

test('two half-row cells retain positive widths inside a valid tiny authored canvas', () => {
  let value = createCompositionEditorDocument();
  value.workbench.area = { left: 0, top: 0, width: 8, height: 8 };
  value.shapes = ['shape:left', 'shape:right'].map(id => ({ id, name: id, color: '#ffffff', opacity: 1, visibility: 'PUBLIC' }));
  value.artworkLayers = value.shapes.map(item => item.id);
  value.cells = value.shapes.map(item => ({ id: item.id, members: [], mobile: { columns: 1, height: 80 } }));
  value = withCompositionModuleWindow(value, 'shape:left', { left: 0, top: 0, width: 8, height: 8 });
  value = withCompositionModuleWindow(value, 'shape:right', { left: 8, top: 0, width: 8, height: 8 });
  assert.equal(validComposition(value), true);
  const before = structuredClone(value), layout = compositionResponsiveLayout(value, 390);
  assert.equal(layout.width, 8);
  for (const cell of layout.cells) {
    assert.ok(cell.window.width > 0);
    assert.ok(cell.window.left >= 0);
    assert.ok(cell.window.left + cell.window.width <= layout.width);
  }
  assert.ok(layout.cells[0].window.left + layout.cells[0].window.width <= layout.cells[1].window.left);
  assert.deepEqual(value, before);
});

test('single-line height does not apply the saved narrow reading order to a wide composition', () => {
  const value = responsiveImages();
  value.stackOrder = 'manual'; value.cells.find(c => c.id === 'shape:header').singleLine = true;
  const layout = compositionResponsiveLayout(value, 1100), header = layout.windows['shape:header'];
  assert.equal(layout.stacked, false); assert.equal(header.top, 0); assert.equal(header.height, 120);
  for (const id of ['shape:character', 'shape:content', 'shape:extra']) assert.ok(layout.windows[id].top >= header.top + header.height);
});

test('bottom-positioned text reflows inside a compact phone cell without multiplying its height', () => {
  let value = authoredCanvas();
  const id = 'text:bottom';
  value.texts = [{ id }]; value.artworkLayers.push(id); value.cells[0].members = [id];
  value = withCompositionModuleWindow(value, id, { left: 160, top: 310, width: 280, height: 20 });
  const saved = structuredClone(value);
  for (const width of [320,390,640,700,390]) {
    const layout = compositionResponsiveLayout(value,width);
    const frame = layout.windows[id], cell = layout.cells[0].window;
    assert.ok(cell.height < 300);
    assert.ok(frame.top >= cell.top);
    assert.ok(frame.top + frame.height <= cell.top + cell.height + .001);
  }
  const phone = compositionResponsiveLayout(value,390);
  assert.equal(phone.cells[0].window.height, value.cells[0].mobile.height, 'the saved phone height owns its preview cell');
  assert.deepEqual(value,saved);
});

test('an explicitly fixed-height strip retains its height and shifts following rows at every width without classifying content', () => {
  const value = responsiveImages(), header = value.cells.find(c => c.id === 'shape:header');
  header.singleLine = true;
  const before = structuredClone(value);
  for (const width of [1440, 1100, 900, 700, 440, 390, 320]) {
    const layout = compositionResponsiveLayout(value, width), h = layout.windows[header.id];
    assert.equal(h.height, 120, `header at ${width}`);
    for (const cell of layout.cells.filter(c => c.id !== header.id)) assert.ok(cell.window.top >= h.top + h.height - .001, 'following rows clear the fixed strip');
    for (const a of layout.cells) for (const b of layout.cells) if (a.id !== b.id) {
      const x = Math.min(a.window.left + a.window.width, b.window.left + b.window.width) - Math.max(a.window.left, b.window.left);
      const y = Math.min(a.window.top + a.window.height, b.window.top + b.window.height) - Math.max(a.window.top, b.window.top);
      assert.ok(x < .001 || y < .001, 'responsive cells never overlap');
    }
  }
  assert.deepEqual(value, before);
});

test('shrinking a desktop card scales text frame height instead of lifting bottom text by its old height', () => {
  let value = authoredCanvas(1440,900);
  const cell=value.cells[0], id='text:quote';
  value=withCompositionModuleWindow(value,cell.id,{left:100,top:50,width:1440,height:900});
  value.cells[0].members=[id];value.texts=[{id}];value.artworkLayers.push(id);
  const source={left:880,top:710,width:600,height:200};
  value=withCompositionModuleWindow(value,id,source);
  const saved=structuredClone(value);
  for(const fitted of [false,true]) {
    if(fitted)value.cells[0].fitText=[id];
    for(const width of [1440,1080,720,672]) {
      const scale=width/1440, layout=compositionResponsiveLayout(value,width);
      const target=layout.windows[id];
      assert.ok(Math.abs(target.height-source.height*scale)<.001);
      assert.ok(Math.abs(target.top-(source.top-50)*scale)<.001,'text retains its vertical composition when the card scales');
      const gap=layout.cells[0].window.top+layout.cells[0].window.height-target.top-target.height;
      assert.ok(Math.abs(gap-40*scale)<.001,'bottom distance scales with the card');
    }
  }
  delete value.cells[0].fitText;assert.deepEqual(value,saved);
  const overflow=compositionResponsiveLayout(value,672);
  const box=overflow.windows[id], parent=overflow.cells[0].window;
  assert.equal(box.height,source.height*672/1440);
  assert.ok(box.top>=parent.top && box.top+box.height<=parent.top+parent.height+.001);
});

test('narrow text preserves its authored vertical placement without an extra inset or moving explicit placements', () => {
  let value=authoredCanvas(1440,900);const cell=value.cells[0],id='text:edge';
  cell.members=[id];cell.mobile.height=80;value.texts=[{id}];value.artworkLayers.push(id);
  const owner=compositionModuleWindow(value,cell.id);
  value=withCompositionModuleWindow(value,id,{left:owner.left+20,top:owner.top+owner.height-25,width:280,height:24});
  const saved=structuredClone(value);
  for(const width of [320,390,640]) {
    const layout=compositionResponsiveLayout(value,width),frame=layout.windows[id],parent=layout.cells[0].window;
    assert.ok(Math.abs(frame.top-parent.top-(owner.height-25)*parent.height/owner.height)<.001);
    assert.ok(Math.abs(frame.height-24*parent.height/owner.height)<.001);
    assert.equal(parent.height,80,'long text uses the reader instead of growing the cell');
    assert.ok(frame.height>0);
  }
  assert.deepEqual(value,saved);
  value.cells[0].mobile={...cell.mobile,referenceWidth:390,placements:[{id,window:{left:20,top:0,width:280,height:80}}]};
  const explicit=compositionResponsiveLayout(value,390);
  assert.equal(explicit.windows[id].top,explicit.cells[0].window.top,'explicit phone geometry retains its authority');
  const anchored=setCompositionCellMemberAnchor(saved,cell.id,[id],{alignX:'left',alignY:'bottom',paddingX:0,paddingY:4});
  const anchoredLayout=compositionResponsiveLayout(anchored,390);
  const a=anchoredLayout.windows[id],p=anchoredLayout.cells[0].window;
  assert.equal(p.top+p.height-a.top-a.height,4,'authored anchors keep their own padding');
});

test('phone rows respect authored gaps including zero, and layered artwork fills its own content bounds', () => {
  let value = responsiveImages();
  const cell = value.cells.find(item => item.id === 'shape:extra');
  for (const [id, left, top, width, height] of [['image:figure', 970, 140, 100, 400], ['image:companion', 1080, 160, 50, 80]]) {
    const copy = structuredClone(value.imageModules[1]);
    copy.id = id; copy.width = width; copy.height = height;
    copy.artwork.asset.media.width = width; copy.artwork.asset.media.height = height;
    value.imageModules.push(copy); cell.members.push(id); value.artworkLayers.push(id);
    value = withCompositionModuleWindow(value, id, { left, top, width, height });
  }
  value.shapes.push({ id: 'shape:overlay', name: 'Visual overlay', color: '#ffffff', opacity: 1, visibility: 'PUBLIC' });
  value.cells.find(item => item.id === cell.id).members.push('shape:overlay'); value.artworkLayers.push('shape:overlay');
  value = withCompositionModuleWindow(value, 'shape:overlay', { left: 985, top: 180, width: 40, height: 40 });
  const saved = structuredClone(value);
  for (const gap of [0, 20]) {
    value.bento.gap = gap;
    const layout = compositionResponsiveLayout(value, 390), rows = layout.cells;
    for (let i = 1; i < rows.length; i++) assert.ok(Math.abs(rows[i].window.top - rows[i - 1].window.top - rows[i - 1].window.height - layout.gap) < .001);
    assert.equal(layout.gap, gap * layout.scale);
    const figure = layout.windows['image:figure'], companion = layout.windows['image:companion'];
    assert.ok(figure.height >= 300, 'a wide source cell does not miniaturize the character');
    assert.equal(figure.width / figure.height, .25);
    assert.equal(companion.width / companion.height, 50/80);
    assert.ok(companion.left >= figure.left + figure.width);
    const overlay = layout.windows['shape:overlay'], factor = figure.height / 400;
    assert.ok(Math.abs(overlay.left - figure.left - 15 * factor) < .001);
    assert.ok(Math.abs(overlay.top - figure.top - 40 * factor) < .001, 'shapes travel with the visual assembly');
  }
  value.bento.gap = 0; assert.deepEqual(value, saved);
});


test('a cell-filling crop stays edge-to-edge through progressive and phone reflow without draft writes', () => {
  let value = responsiveImages();
  const cell = value.cells.find(item => item.id === 'shape:character');
  const image = value.imageModules.find(item => item.id === 'image:character');
  image.artwork.crop = { x: .7, y: .4, zoom: 1.5 };
  cell.mobile.autoHeight = false; cell.mobile.height = 500;
  value = withCompositionModuleWindow(value, image.id, compositionModuleWindow(value, cell.id));
  const saved = structuredClone(value);
  for (const width of [1440, 1000, 650, 390, 320, 1440]) {
    const layout = compositionResponsiveLayout(value, width);
    assert.deepEqual(layout.windows[image.id], layout.windows[cell.id], 'crop fills its current cell at ' + width);
  }
  assert.deepEqual(value, saved);
});


test('cell-filling crops retain coverage with anchors while explicit phone placements win', () => {
  let value = responsiveImages();
  const cell = value.cells.find(item => item.id === 'shape:character');
  const image = value.imageModules.find(item => item.id === 'image:character');
  image.artwork.crop = { x: .7, y: .4, zoom: 1.5 };
  cell.mobile.autoHeight = false; cell.mobile.height = 500;
  cell.memberAnchors = [{ members: [image.id], alignX: 'right', alignY: 'bottom', paddingX: 0, paddingY: 0 }];
  value = withCompositionModuleWindow(value, image.id, compositionModuleWindow(value, cell.id));
  const saved = structuredClone(value);
  for (const width of [1440, 1000, 650, 390, 320, 1440]) {
    const layout = compositionResponsiveLayout(value, width);
    assert.deepEqual(layout.windows[image.id], layout.windows[cell.id], 'anchored crop covers cell at ' + width);
  }
  assert.deepEqual(value, saved);
  const current = value.cells.find(item => item.id === cell.id);
  current.mobile.referenceWidth = 390;
  current.mobile.placements = [{ id: image.id, window: { left: 20, top: 30, width: 200, height: 300 } }];
  const layout = compositionResponsiveLayout(value, 390), parent = layout.windows[cell.id];
  assert.deepEqual(layout.windows[image.id], { left: parent.left + 20, top: parent.top + 30, width: 200, height: 300 });
});


test('a cell crop over an oversized Fit image survives reflow without revealing source or margins', () => {
  let value = responsiveImages();
  const cell = value.cells.find(item => item.id === 'shape:character');
  const image = value.imageModules.find(item => item.id === 'image:character');
  image.artwork.crop = null; image.artwork.asset.media.width = 880; image.artwork.asset.media.height = 880;
  const parent = compositionModuleWindow(value, cell.id);
  const source = { left: parent.left - 300, top: parent.top - 130, width: 1236, height: 1000 };
  value = withCompositionModuleWindow(value, image.id, source);
  const saved = structuredClone(value);
  for (const width of [1000, 650, 390, 320, 1440]) {
    const layout = compositionResponsiveLayout(value, width), frame = layout.windows[image.id], owner = layout.windows[cell.id];
    const media = fitNativeMediaRectangle(frame, image.artwork.asset.media);
    assert.ok(media.left <= owner.left + 1 && media.top <= owner.top + 1);
    assert.ok(media.left + media.width >= owner.left + owner.width - 1);
    assert.ok(media.top + media.height >= owner.top + owner.height - 1);
    assert.ok(frame.width > owner.width, 'the larger image frame retains the cell crop');
    if (layout.mobile) assert.ok(Math.abs(owner.width / owner.height - parent.width / parent.height) < .001);
  }
  assert.deepEqual(value, saved);
});
