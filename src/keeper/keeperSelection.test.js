import test from 'node:test';
import assert from 'node:assert/strict';
import { captureKeeperScene } from './keeperScene.js';
import { keeperReactionContext } from './keeperReactions.js';

function fixture() {
  const nodes = [];
  const host = { isConnected: true, contains: node => nodes.includes(node), querySelectorAll: () => nodes,
    ownerDocument: { defaultView: { innerWidth: 1800, innerHeight: 1000 } } };
  for (let i = 0; i < 12; i++) {
    const node = { module: `image:${i}`, selected: false, hidden: false, parentElement: host,
      dataset: { artworkContextId: `side:${i}`, artworkContextTitle: `Artwork ${i}`, artworkContextSrc: `https://art.test/${i}.png` },
      checkVisibility() { return !this.hidden; }, getBoundingClientRect: () => ({ left: i * 120, right: i * 120 + 100, top: 100, bottom: 200 }),
      closest(selector) { return selector.includes('workbench-view-id') ? { dataset: { workbenchViewId: this.module } } : this.selected ? this : null; } };
    nodes.push(node);
  }
  const capture = options => captureKeeperScene(host, { x: 0, y: 100 }, null, { shareArtwork: true, gestures: true, ...options });
  return { nodes, host, capture };
}

test('selected modules outrank nearby art and retained Display selection without sharing module IDs', () => {
  const { nodes, capture } = fixture(); nodes[0].selected = true;
  const snapshot = capture({ selectedModuleIds: ['image:10'] });
  assert.deepEqual(snapshot.scene.selection, { kind: 'modules', count: 1, complete: true });
  assert.equal(snapshot.scene.artworks.length, 8);
  assert.equal(snapshot.scene.artworks[0].title, 'Artwork 10');
  assert.equal(snapshot.scene.artworks[0].selected, true);
  assert.equal(snapshot.scene.artworks.filter(item => item.selected).length, 1);
  assert.ok(!JSON.stringify(snapshot.scene).includes('image:10'));
  nodes[10].dataset.artworkContextId = 'replaced';
  assert.equal(snapshot.resolve({ gesture: 'approach', target: 'art-1' }), null);
});

test('each message captures current Display selection and counts hidden or excess selection without sharing it', () => {
  const { nodes, capture } = fixture(); nodes[11].selected = true;
  const first = capture();
  assert.deepEqual(first.scene.selection, { kind: 'artworks', count: 1, complete: true });
  assert.equal(first.scene.artworks[0].title, 'Artwork 11');
  nodes[11].selected = false; nodes[9].selected = true;
  assert.equal(capture().scene.artworks[0].title, 'Artwork 9');
  assert.equal(first.scene.artworks[0].title, 'Artwork 11', 'in-flight context stays bound to its Send');
  nodes[9].hidden = true;
  assert.equal(capture().scene.selection.count, 1);
  assert.equal(capture().scene.selection.complete, false);
  assert.ok(capture().scene.artworks.every(item => !item.selected));
  nodes.forEach(node => { node.selected = true; });
  assert.equal(capture().scene.selection.count, 12);
  assert.equal(capture().scene.artworks.length, 8);
});

test('sharing off does not read selection cues, and unsupported modules never select neighbouring artwork', () => {
  const { host, capture } = fixture();
  const unsupported = capture({ selectedModuleIds: ['text:private'] }).scene;
  assert.equal(unsupported.selection.count, 1);
  assert.equal(unsupported.selection.complete, false);
  assert.ok(unsupported.artworks.every(item => !item.selected));
  host.querySelectorAll = () => { throw new Error('must not read'); };
  const off = capture({ shareArtwork: false, selectedModuleIds: ['image:10'] }).scene;
  assert.deepEqual(off.artworks, []); assert.equal(off.selection, undefined);
});

test('server preserves only bounded explicit selection facts', () => {
  const input = { selection: { kind: 'modules', count: 2, complete: true, moduleIds: ['PRIVATE'] },
    artworks: [{ id: 'art-1', selected: true }, { id: 'art-2', selected: 'true' }] };
  const scene = keeperReactionContext(input);
  assert.deepEqual(scene.selection, { kind: 'modules', count: 2, complete: true });
  assert.equal(scene.artworks[0].selected, true); assert.equal(scene.artworks[1].selected, undefined);
  assert.ok(!JSON.stringify(scene).includes('PRIVATE'));
  for (const selection of [{ kind: 'execute', count: 2 }, { kind: 'artworks', count: -1 }, { kind: 'artworks', count: Infinity }]) {
    const invalid = keeperReactionContext({ ...input, selection });
    assert.deepEqual(invalid.selection, { kind: 'none', count: 0 });
    assert.ok(invalid.artworks.every(item => !item.selected));
  }
  assert.equal(keeperReactionContext({ ...input, selection: { kind: 'modules', count: 10000 } }).selection.count, 128);
});
