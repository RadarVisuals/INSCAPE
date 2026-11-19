import test from 'node:test';
import assert from 'node:assert/strict';
import { Editor } from '@tiptap/core';
import { history, closeHistory } from '@tiptap/pm/history';
import { articleExtensions } from './articleExtensions.js';
import { createArticle, assertArticle } from './domain/article.js';

function fixture(t, marks = []) {
  const editor = new Editor({ element: null, extensions: articleExtensions, content: {
    type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nomad walks', marks }] }],
  } });
  // Tiptap installs view plugins on mount. Exercise the real commands headlessly
  // with the same ProseMirror history used by the mounted editor.
  editor.registerPlugin(history());
  t.after(() => editor.destroy());
  return editor;
}
const firstLink = editor => editor.getJSON().content[0].content[0].marks?.find(mark => mark.type === 'link');
const isolateHistory = editor => editor.view.dispatch(closeHistory(editor.state.tr));

test('explicit links preserve article JSON, other marks and native history', t => {
  const editor = fixture(t, [{ type: 'bold' }, { type: 'italic' }]);
  const original = editor.getJSON();
  editor.commands.setTextSelection({ from: 1, to: 6 });
  assert.equal(editor.commands.setLink({ href: 'https://inscape.id/nomad' }), true);
  assert.deepEqual({ ...firstLink(editor).attrs }, {
    href: 'https://inscape.id/nomad', target: '_blank', rel: 'noopener noreferrer nofollow', class: null, title: null,
  });
  const linked = editor.getJSON();
  assert.deepEqual(linked.content[0].content[0].marks.filter(mark => mark.type !== 'link'), original.content[0].content[0].marks);
  assertArticle({ ...createArticle(), content: linked });
  assert.equal(editor.commands.undo(), true);
  assert.deepEqual(editor.getJSON(), original);
  assert.equal(editor.commands.redo(), true);
  assert.deepEqual(editor.getJSON(), linked);
});

test('editing a link at its cursor extends the range and removing it preserves text and formatting', t => {
  const editor = fixture(t, [{ type: 'underline' }]);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.setLink({ href: 'https://inscape.id' });
  editor.commands.setTextSelection(3);
  isolateHistory(editor);
  assert.equal(editor.chain().extendMarkRange('link').setLink({ href: 'mailto:nomad@example.com' }).run(), true);
  assert.equal(firstLink(editor).attrs.href, 'mailto:nomad@example.com');
  const linked = editor.getJSON();
  editor.commands.setTextSelection(3);
  isolateHistory(editor);
  assert.equal(editor.commands.unsetLink(), true);
  assert.equal(firstLink(editor), undefined);
  assert.equal(editor.state.doc.textContent, 'Nomad walks');
  assert.ok(editor.getJSON().content[0].content.every(node => node.marks.some(mark => mark.type === 'underline')));
  assert.equal(editor.commands.undo(), true);
  assert.deepEqual(editor.getJSON(), linked);
  assert.equal(editor.commands.redo(), true);
  assert.equal(firstLink(editor), undefined);
});

test('partial links split marks without changing surrounding writing', t => {
  const editor = fixture(t);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.setLink({ href: 'https://inscape.id' });
  editor.commands.setTextSelection({ from: 3, to: 5 });
  editor.commands.setLink({ href: 'https://inscape.id/other' });
  const nodes = editor.getJSON().content[0].content;
  assert.deepEqual(nodes.map(node => node.text), ['No', 'ma', 'd', ' walks']);
  assert.deepEqual(nodes.map(node => node.marks?.[0]?.attrs.href), [
    'https://inscape.id', 'https://inscape.id/other', 'https://inscape.id', undefined,
  ]);
});

test('typing inside links continues them, while either boundary stays unlinked', t => {
  const editor = fixture(t);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.setLink({ href: 'https://inscape.id' });
  editor.commands.setTextSelection(1);
  editor.view.dispatch(editor.state.tr.insertText('['));
  editor.commands.setTextSelection(7);
  editor.view.dispatch(editor.state.tr.insertText(']'));
  assert.deepEqual(editor.getJSON().content[0].content.map(node => [node.text, Boolean(node.marks?.some(mark => mark.type === 'link'))]), [
    ['[', false], ['Nomad', true], ['] walks', false],
  ]);
  editor.commands.setTextSelection(4);
  editor.view.dispatch(editor.state.tr.insertText('X'));
  assert.equal(editor.getJSON().content[0].content[1].text, 'NoXmad');
  assert.equal(editor.getJSON().content[0].content[1].marks[0].type, 'link');
});

test('splitting a paragraph ends its link and keeps the new paragraph editable', t => {
  const editor = fixture(t);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.setLink({ href: 'https://inscape.id' });
  editor.commands.setTextSelection(6);
  assert.equal(editor.commands.splitBlock(), true);
  editor.view.dispatch(editor.state.tr.insertText('Next'));
  assert.equal(editor.getJSON().content[1].content[0].text, 'Next walks');
  assert.equal(editor.getJSON().content[1].content[0].marks, undefined);
});

test('toggle supports explicit creation and whole-link removal at the cursor', t => {
  const editor = fixture(t);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  assert.equal(editor.commands.toggleLink({ href: 'https://inscape.id' }), true);
  editor.commands.setTextSelection(10);
  assert.equal(editor.chain().setTextSelection(3).toggleLink().run(), true);
  assert.equal(firstLink(editor), undefined);
  assert.equal(editor.commands.toggleLink(), false);
});

test('unsafe or unsupported links cannot change the document through commands, parsing or rendering', t => {
  const editor = fixture(t);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  const original = editor.getJSON();
  const type = editor.schema.marks.link;
  for (const href of ['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,hello',
    'http://example.com', '//example.com', '/relative', 'https://user:pass@example.com', 'https://example.com/a b', '', null]) {
    assert.equal(editor.commands.setLink({ href }), false, String(href));
    assert.equal(editor.commands.toggleLink({ href }), false, String(href));
    assert.deepEqual(editor.getJSON(), original);
    assert.equal(type.spec.parseDOM[0].getAttrs({ getAttribute: () => href }), false);
    assert.equal(type.spec.toDOM(type.create({ href }))[1].href, '');
  }
  for (const href of ['https://inscape.id/path?q=one#two', 'mailto:nomad@example.com']) {
    assert.equal(type.spec.parseDOM[0].getAttrs({ getAttribute: name => name === 'href' ? href : null }).href, href);
    const attributes = type.spec.toDOM(type.create({ href }))[1];
    assert.equal(attributes.href, href);
    assert.equal(attributes.target, '_blank');
    assert.equal(attributes.rel, 'noopener noreferrer nofollow');
  }
});

test('existing link attributes round-trip without changing article validation', t => {
  const editor = fixture(t, [{ type: 'link', attrs: { href: 'mailto:nomad@example.com', target: '_self', rel: 'noopener noreferrer' } }]);
  const article = { ...createArticle(), content: editor.getJSON() };
  assertArticle(article);
  assert.equal(firstLink(editor).attrs.target, '_self');
  assert.equal(firstLink(editor).attrs.rel, 'noopener noreferrer');
});
