import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchema, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state';
import { history, undo, redo } from '@tiptap/pm/history';
import { moveArticleArtwork } from './articleArtworkEditing.js';
const artwork = Node.create({ name: 'artwork', group: 'block', atom: true, addAttributes: () => ({ caption: { default: '' }, asset: { default: null } }) });
const schema = getSchema([StarterKit, artwork]);
const p = text => schema.nodes.paragraph.create(null, schema.text(text));
const art = schema.nodes.artwork.create({ caption: 'Caption', asset: { id: 'unchanged-source' } });

test('artwork reordering retains its source and caption, selects the moved node and undoes independently', () => {
  const first = p('Before'), last = p('After'), doc = schema.nodes.doc.create(null, [first, art, last]);
  let state = EditorState.create({ schema, doc, selection: NodeSelection.create(doc, first.nodeSize), plugins: [history()] });
  const run = direction => moveArticleArtwork(direction)({ state, dispatch: tr => { state = state.apply(tr); } });
  assert.equal(run(-1), true); assert.equal(state.selection.from, 0); assert.deepEqual(state.doc.firstChild.toJSON(), art.toJSON());
  assert.equal(run(-1), false);
  assert.equal(run(1), true); assert.equal(run(1), true); assert.equal(run(1), false);
  assert.deepEqual(state.doc.lastChild.toJSON(), art.toJSON());
  assert.ok(undo(state, tr => { state = state.apply(tr); })); assert.deepEqual(state.doc.toJSON(), doc.toJSON());
  assert.ok(redo(state, tr => { state = state.apply(tr); })); assert.deepEqual(state.doc.lastChild.toJSON(), art.toJSON());
});
test('artwork reordering respects parent structure and ignores ordinary text selections', () => {
  const paragraph = p('List item'), item = schema.nodes.listItem.create(null, [paragraph, art]);
  const doc = schema.nodes.doc.create(null, schema.nodes.bulletList.create(null, item));
  const state = EditorState.create({ schema, doc, selection: NodeSelection.create(doc, 2 + paragraph.nodeSize) });
  assert.equal(moveArticleArtwork(-1)({ state }), false, 'list items must start with a paragraph');
  const textState = EditorState.create({ schema, doc, selection: TextSelection.create(doc, 3) });
  assert.equal(moveArticleArtwork(1)({ state: textState }), false);
});
