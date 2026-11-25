import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrialStore, initialDocument, STORAGE_KEY } from './model.js';
import { projectDocument, moveCell, leaves, dropTarget, sampleDocument, setRatio } from './partition.js';
const textHeight = () => 96;
const frame = (doc, id, width = 1440) => projectDocument(doc, width, textHeight).frames.find(r => r.id === id);
function fixture() {
  const records = new Map([['real-composition', 'untouched'], ['inscape:prototype:bento-grid-trial:v1', 'previous trial']]); let fail = false;
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('Full'); records.set(key, value); }, removeItem: key => records.delete(key) };
  return { store: createTrialStore(storage), storage, records, fail: () => { fail = true; } };
}
function partition(projection) {
  const { width, height, frames } = projection;
  assert.ok(Math.abs(frames.reduce((n, r) => n + r.width * r.height, 0) - width * height) < .01, 'partition fills its frame');
  for (const [i, a] of frames.entries()) {
    assert.ok(a.width > 0 && a.height >= 160 && a.left >= -.001 && a.top >= -.001);
    assert.ok(a.left + a.width <= width + .001 && a.top + a.height <= height + .001);
    for (const b of frames.slice(i + 1)) assert.ok(a.left + a.width <= b.left + .001 || b.left + b.width <= a.left + .001
      || a.top + a.height <= b.top + .001 || b.top + b.height <= a.top + .001, 'cells do not overlap');
  }
}
test('right-column swap preserves left artwork and content, reload, and one-step Undo/Redo', () => {
  const { store, storage, records } = fixture(), before = store.read().document;
  store.move('quote', { kind: 'swap', target: 'detail' });
  const after = store.read().document;
  assert.deepEqual(frame(after, 'artwork'), frame(before, 'artwork'));
  assert.equal(frame(after, 'quote').top, frame(before, 'detail').top);
  assert.deepEqual(after.content, before.content);
  assert.deepEqual(createTrialStore(storage).read().document, after);
  store.undo(); assert.deepEqual(store.read().document, before); assert.equal(store.read().canUndo, false);
  store.redo(); assert.deepEqual(store.read().document, after);
  assert.equal(records.get('real-composition'), 'untouched');
  assert.equal(records.get('inscape:prototype:bento-grid-trial:v1'), 'previous trial');
});
test('cross-column centre swaps trade differently-sized slots without losing artwork identity', () => {
  const before = initialDocument(), after = { ...before, tree: moveCell(before.tree, 'quote', { kind: 'swap', target: 'artwork' }) };
  const { id: a, ...newQuote } = frame(after, 'quote'), { id: b, ...oldArt } = frame(before, 'artwork');
  assert.deepEqual(newQuote, oldArt); assert.equal(after.content.artwork.image, before.content.artwork.image);
  partition(projectDocument(after, 1440, textHeight));
});
test('local lower-edge insertion stays in its column; the outer lower edge spans the card', () => {
  const before = initialDocument();
  const local = { ...before, tree: moveCell(before.tree, 'quote', { kind: 'cell', target: 'detail', side: 'bottom' }) };
  assert.equal(frame(local, 'quote').width, 720); assert.equal(frame(local, 'quote').left, 720);
  assert.deepEqual(frame(local, 'artwork'), frame(before, 'artwork'));
  const outer = { ...before, tree: moveCell(before.tree, 'quote', { kind: 'root', side: 'bottom' }) };
  assert.equal(frame(outer, 'quote').width, 1440);
  assert.equal(frame(outer, 'quote').top + frame(outer, 'quote').height, projectDocument(outer, 1440, textHeight).height);
});
test('hit testing distinguishes centre, all local edges, and all outer edges', () => {
  const p = projectDocument(initialDocument(), 1440, textHeight);
  assert.deepEqual(dropTarget(p, 'quote', { x: 1100, y: 680 }), { kind: 'swap', target: 'detail' });
  for (const [side, point] of Object.entries({ left: { x: 730, y: 680 }, right: { x: 1420, y: 680 }, top: { x: 1100, y: 460 }, bottom: { x: 1100, y: 880 } }))
    assert.deepEqual(dropTarget(p, 'quote', point), { kind: 'cell', target: 'detail', side });
  for (const [side, point] of Object.entries({ left: { x: 4, y: 300 }, right: { x: 1437, y: 300 }, top: { x: 600, y: 4 }, bottom: { x: 600, y: 897 } }))
    assert.deepEqual(dropTarget(p, 'quote', point), { kind: 'root', side });
  assert.equal(dropTarget(p, 'quote', { x: -50, y: 80 }), null);
});
test('all insertion sides and targets remain closed across wide, narrow, and phone widths', () => {
  const doc = initialDocument();
  for (const id of leaves(doc.tree)) for (const target of leaves(doc.tree).filter(t => t !== id)) for (const side of ['left', 'right', 'top', 'bottom']) {
    for (const destination of [{ kind: 'cell', target, side }, { kind: 'root', side }]) {
      const next = { ...doc, tree: moveCell(doc.tree, id, destination) };
      assert.deepEqual(leaves(next.tree).sort(), leaves(doc.tree).sort());
      for (const width of [2400, 1440, 900, 390]) partition(projectDocument(next, width, textHeight));
    }
  }
});
test('49 cells really reflow: 7 across on a wide viewport, more rows narrower, one column on a phone', () => {
  const doc = sampleDocument(49), before = JSON.stringify(doc);
  const wide = projectDocument(doc, 2400, textHeight), medium = projectDocument(doc, 1200, textHeight), phone = projectDocument(doc, 366, textHeight);
  assert.equal(wide.frames.filter(r => r.top === 0).length, 7);
  assert.ok(medium.frames.filter(r => r.top === 0).length < 7);
  assert.ok(phone.frames.every(r => r.left === 0 && r.width === 366));
  assert.ok(phone.height > wide.height);
  for (const p of [wide, medium, phone]) { assert.equal(p.frames.length, 49); partition(p); }
  assert.equal(JSON.stringify(doc), before, 'viewport changes never rewrite authored state');
});
test('shared-divider resizing moves neighbouring edges together and is one reversible save', () => {
  const { store } = fixture(), before = store.read().document;
  store.ratio([], .6);
  const next = store.read().document;
  assert.equal(frame(next, 'artwork').width, 864);
  assert.equal(frame(next, 'quote').left, 864);
  assert.deepEqual(next.content, before.content); partition(projectDocument(next, 1440, textHeight));
  store.undo(); assert.deepEqual(store.read().document, before);
});
test('cancelled previews write nothing; stale preview commits, invalid identities and failed saves preserve accepted state', () => {
  const f = fixture(), before = f.store.read();
  const preview = moveCell(before.document.tree, 'quote', { kind: 'root', side: 'top' });
  assert.deepEqual(f.store.read(), before); assert.equal(f.records.has(STORAGE_KEY), false);
  assert.throws(() => f.store.tree('missing'));
  f.store.content('quote', { text: 'Changed after preview' });
  assert.throws(() => f.store.tree(preview, before.revision), /veranderd/);
  const current = f.store.read(), source = f.records.get(STORAGE_KEY); f.fail();
  assert.throws(() => f.store.undo(), /niet worden opgeslagen/);
  assert.throws(() => f.store.ratio([], .7), /niet worden opgeslagen/);
  assert.deepEqual(f.store.read(), current); assert.equal(f.records.get(STORAGE_KEY), source);
});
test('malformed storage is retained and blocks replacement until an explicit trial reset', () => {
  const { storage, records } = fixture(); records.set(STORAGE_KEY, '{broken');
  const store = createTrialStore(storage); assert.ok(store.read().notice);
  assert.throws(() => store.move('quote', { kind: 'swap', target: 'detail' }));
  assert.equal(records.get(STORAGE_KEY), '{broken'); store.reset();
  store.move('quote', { kind: 'swap', target: 'detail' }); assert.equal(store.read().notice, '');
});
test('shared divider constraints preserve bounded ratios', () => {
  assert.equal(setRatio(initialDocument().tree, [], -100).ratio, .15);
  assert.equal(setRatio(initialDocument().tree, [], 100).ratio, .85);
});

test('outer right drop moves Artwork to a full column and keeps the two text cells stacked together on the left', () => {
  const { store, storage } = fixture(), before = store.read().document;
  const p = projectDocument(before, 1440, textHeight);
  const destination = dropTarget(p, 'artwork', { x: p.width - 3, y: p.height / 2 });
  assert.deepEqual(destination, { kind: 'root', side: 'right' });
  store.move('artwork', destination);
  const after = store.read().document;
  const art = frame(after, 'artwork'), quote = frame(after, 'quote'), detail = frame(after, 'detail');
  assert.equal(art.left, 720); assert.equal(art.height, p.height);
  assert.equal(quote.left, 0); assert.equal(detail.left, 0);
  assert.equal(quote.width, 720); assert.equal(detail.width, 720);
  assert.equal(quote.top + quote.height, detail.top);
  assert.deepEqual(after.content, before.content);
  assert.deepEqual(createTrialStore(storage).read().document, after);
  store.undo(); assert.deepEqual(store.read().document, before);
});
