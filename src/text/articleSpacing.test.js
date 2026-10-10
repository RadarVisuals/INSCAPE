import assert from 'node:assert/strict';
import test from 'node:test';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { history, undo, redo } from '@tiptap/pm/history';
import { ArticleSpacing, articleLineToSeparate, separateArticleLine } from './articleSpacing.js';
import { ArticleAlignment } from './articleAlignment.js';
import { ArticleTextStyle, ArticleTypography } from './articleTypography.js';
import { assertArticle, createArticle } from './domain/article.js';

const schema = getSchema([StarterKit, ArticleTextStyle, ArticleTypography, ArticleAlignment, ArticleSpacing]);
const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
function stateFor(content, from, to = from) {
  const doc = schema.nodeFromJSON({ type: 'doc', content });
  return EditorState.create({ schema, doc, selection: TextSelection.create(doc, from, to), plugins: [history()] });
}

test('separating an authored line preserves marks and outer spacing, keeps its cursor, and undoes atomically', () => {
  for (const separator of [{ type: 'hardBreak' }, text('\n'), text('\r\n')]) {
    let state = stateFor([{ type: 'paragraph', attrs: { textAlign: 'center', spaceBefore: 8, spaceAfter: 36 }, content: [
      text('HUMAN UNDERNEATH', [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: 10, letterSpacing: .1 } }]),
      separator, text('Nomad is an inversion.'),
    ] }, { type: 'paragraph', content: [text('Unrelated paragraph')] }], 6);
    const original = state.doc.toJSON(), selectedText = state.doc.firstChild.firstChild.toJSON();
    const tr = state.tr; assert.equal(separateArticleLine(tr), true); state = state.apply(tr);
    assert.equal(state.doc.childCount, 3);
    assert.equal(state.doc.child(0).textContent, 'HUMAN UNDERNEATH');
    assert.equal(state.doc.child(1).textContent, 'Nomad is an inversion.');
    assert.deepEqual(state.doc.child(0).firstChild.toJSON(), selectedText);
    assert.deepEqual(state.doc.child(2).toJSON(), original.content[1]);
    assert.equal(state.doc.child(0).attrs.spaceBefore, 8); assert.equal(state.doc.child(0).attrs.spaceAfter, 0);
    assert.equal(state.doc.child(1).attrs.spaceBefore, 0); assert.equal(state.doc.child(1).attrs.spaceAfter, 36);
    assert.equal(state.doc.child(1).attrs.textAlign, 'center');
    assert.equal(state.selection.from, 6); assert.equal(articleLineToSeparate(state.selection), null);
    assertArticle({ ...createArticle(), content: state.doc.toJSON() });
    const separated = state.doc.toJSON();
    assert.ok(undo(state, tr => { state = state.apply(tr); })); assert.deepEqual(state.doc.toJSON(), original);
    assert.ok(redo(state, tr => { state = state.apply(tr); })); assert.deepEqual(state.doc.toJSON(), separated);
  }
});

test('a selected middle line is isolated without changing other breaks, list nesting or heading style', () => {
  for (const wrapper of ['doc', 'blockquote', 'listItem']) {
    const paragraph = { type: 'paragraph', attrs: { spaceBefore: 4, spaceAfter: 12 }, content: [text('Before\n\nMiddle\nAfter\nLast')] };
    const content = wrapper === 'doc' ? [paragraph] : wrapper === 'blockquote' ? [{ type: wrapper, content: [paragraph] }]
      : [{ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph] }] }];
    const position = wrapper === 'doc' ? 1 : wrapper === 'blockquote' ? 2 : 3;
    let state = stateFor(content, position + 8, position + 14);
    const tr = state.tr; assert.ok(separateArticleLine(tr)); state = state.apply(tr);
    const parent = wrapper === 'doc' ? state.doc : wrapper === 'blockquote' ? state.doc.firstChild : state.doc.firstChild.firstChild;
    assert.equal(parent.childCount, 3);
    assert.equal(parent.child(0).textContent, 'Before\n'); assert.equal(parent.child(1).textContent, 'Middle');
    assert.equal(parent.child(2).textContent, 'After\nLast');
    assert.equal(state.doc.textBetween(state.selection.from, state.selection.to), 'Middle');
    assertArticle({ ...createArticle(), content: state.doc.toJSON() });
  }
  const state = stateFor([{ type: 'heading', attrs: { level: 2, textAlign: 'right' }, content: [text('One\nTwo')] }], 6);
  const tr = state.tr; assert.ok(separateArticleLine(tr));
  assert.ok(tr.doc.content.content.every(node => node.type.name === 'heading' && node.attrs.level === 2 && node.attrs.textAlign === 'right'));
});

test('wrapped text and selections across lines cannot silently split a paragraph', () => {
  for (const [content, from, to] of [[text('A long wrapped paragraph'), 5, 5], [text('First\nSecond'), 3, 10]]) {
    const state = stateFor([{ type: 'paragraph', content: [content] }], from, to), tr = state.tr;
    assert.equal(articleLineToSeparate(state.selection), null); assert.equal(separateArticleLine(tr), false);
    assert.equal(tr.docChanged, false);
  }
});
