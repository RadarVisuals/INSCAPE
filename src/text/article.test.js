import test from 'node:test';
import assert from 'node:assert/strict';
import { createArticle, assertArticle, validTextModules, ARTICLE_ALIGNMENTS, textAppearance } from './domain/article.js';
import { displayTextArticle } from '../systemWorkflow/domain/displayText.js';
import { addTextModule, saveTextModule } from './textSession.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { validateSystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { captureWorkbenchPresentation } from '../public/ownerSystemWorkflow/workbenchPresentationCapture.js';
const profile = `0x${'1'.repeat(40)}`;
function fixture() {
  const entries = new Map(); let fail = false;
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => { if (fail) throw Error('full'); entries.set(k, v); } };
  return { store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }), storage, entries, fail: () => { fail = true; } };
}
const build = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });

test('editor link defaults save, publish and restore while legacy links remain unchanged', () => {
  for (const extra of [{}, { title: null, target: '_blank', rel: 'noopener noreferrer nofollow', class: null }]) {
    const f = fixture(); addTextModule(f.store, profile);
    const record = f.store.getDraft().texts[0], article = createArticle('Linked article');
    article.content.content[0].content = [{ type: 'text', text: 'Read more', marks: [{ type: 'link', attrs: { href: 'https://example.com/article', ...extra } }] }];
    assert.ok(saveTextModule(f.store, profile, record, { ...record, article, visibility: 'PUBLIC' }));
    const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
    assert.deepEqual(draft.texts[0].article, article);
    const published = build(draft); assert.equal(validateProfileDocumentV9(published).valid, true);
    assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(published, draft).texts[0].article, article);
    for (const title of ['Unsupported title', 42, {}]) {
      const invalid = structuredClone(article); invalid.content.content[0].content[0].marks[0].attrs.title = title;
      assert.throws(() => assertArticle(invalid));
    }
  }
});

test('article role styles preserve old defaults and survive save, undo, publication and restore', () => {
  const old = createArticle('Existing'); const originalBytes = JSON.stringify(old);
  assertArticle(old); assert.equal(JSON.stringify(old), originalBytes);
  const f = fixture(); addTextModule(f.store, profile);
  const original = f.store.getDraft().texts[0], article = createArticle('Styled essay');
  article.appearance.textStyles = { h1: { fontSize: 42, fontFamily: 'Inscape Article Literata', color: '#aabbcc', lineHeight: 1.15, letterSpacing: -.02 },
    h2: { fontSize: 28 }, h3: { color: '#334455' }, caption: { fontSize: 12, lineHeight: 1.4 } };
  article.content.content = [{ type: 'heading', attrs: { level: 1, lineHeight: 2 }, content: [{ type: 'text', text: 'Override survives', marks: [{ type: 'textStyle', attrs: { fontSize: 20 } }] }] }];
  assert.ok(saveTextModule(f.store, profile, original, { ...original, article, visibility: 'PUBLIC' }));
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().texts[0], original); assert.ok(f.store.redo());
  const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
  assert.deepEqual(draft.texts[0].article, article);
  const doc = build(draft); assert.equal(validateProfileDocumentV9(doc).valid, true);
  assert.deepEqual(doc.texts[0].article, article);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).texts[0].article, article);
  for (const invalid of [null, [], { invented: {} }, { h1: null }, { h1: { fontSize: 0 } }, { h2: { lineHeight: 4 } },
    { caption: { color: 'red' } }, { h3: { fontFamily: 'Unbundled' } }, { h1: { letterSpacing: 2 } }, { h1: { position: 'fixed' } }]) {
    const broken = structuredClone(article); broken.appearance.textStyles = invalid;
    assert.throws(() => assertArticle(broken));
  }
});

test('line spacing preserves legacy defaults and survives save, undo, publication and restore', () => {
  const old = articleWithText('An existing article', 'Existing title');
  const bytes = JSON.stringify(old); assertArticle(old); assert.equal(JSON.stringify(old), bytes);
  const f = fixture(); addTextModule(f.store, profile);
  const original = f.store.getDraft().texts[0], article = createArticle('An illustrated essay');
  article.appearance.lineHeight = 1.8;
  article.content.content = [
    { type: 'heading', attrs: { level: 2, lineHeight: 1.15 }, content: [{ type: 'text', text: 'A compact heading' }] },
    { type: 'paragraph', attrs: { lineHeight: 2.2, spaceAfter: 12 }, content: [{ type: 'text', text: 'An airy paragraph' }] },
    { type: 'paragraph', attrs: { lineHeight: null }, content: [{ type: 'text', text: 'Inherited body spacing' }] },
  ];
  assert.ok(saveTextModule(f.store, profile, original, { ...original, article, visibility: 'PUBLIC' }));
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().texts[0], original); assert.ok(f.store.redo());
  const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
  assert.deepEqual(draft.texts[0].article, article);
  const doc = build(draft); assert.equal(validateProfileDocumentV9(doc).valid, true);
  assert.deepEqual(doc.texts[0].article, article);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).texts[0].article, article);
  for (const value of [0, .99, 3.01, '1.5', '24px', {}, NaN, Infinity]) {
    const broken = structuredClone(article); broken.appearance.lineHeight = value;
    assert.throws(() => assertArticle(broken));
    for (const index of [0, 1]) {
      const invalid = structuredClone(article); invalid.content.content[index].attrs.lineHeight = value;
      assert.throws(() => assertArticle(invalid));
      const badDoc = structuredClone(doc); badDoc.texts[0].article = invalid;
      assert.equal(validateProfileDocumentV9(badDoc).valid, false);
    }
  }
  assert.throws(() => assertArticle({ ...article, appearance: { ...article.appearance, lineHeight: null } }));
});

test('title and paragraph spacing preserve old data and survive save, undo, publication and restore', () => {
  const old = articleWithText('Original spacing', 'Title');
  old.content.content.push({ type: 'paragraph', attrs: null });
  const bytes = JSON.stringify(old); assertArticle(old); assert.equal(JSON.stringify(old), bytes);
  const f = fixture(); addTextModule(f.store, profile);
  const original = f.store.getDraft().texts[0], article = createArticle('NOMAD');
  article.appearance.titleGap = 8;
  article.content.content = [
    { type: 'paragraph', attrs: { spaceBefore: 0, spaceAfter: 32 }, content: [{ type: 'text', text: 'HUMAN UNDERNEATH' }] },
    { type: 'heading', attrs: { level: 2, textAlign: 'center', spaceBefore: 4, spaceAfter: 0 }, content: [{ type: 'text', text: 'Nomad is an inversion.' }] },
    { type: 'paragraph', attrs: { spaceBefore: null, spaceAfter: null }, content: [{ type: 'text', text: 'Ordinary paragraph' }] },
  ];
  assert.ok(saveTextModule(f.store, profile, original, { ...original, article, visibility: 'PUBLIC' }));
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().texts[0], original); assert.ok(f.store.redo());
  const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
  assert.deepEqual(draft.texts[0].article, article);
  const doc = build(draft); assert.equal(validateProfileDocumentV9(doc).valid, true);
  assert.deepEqual(doc.texts[0].article, article);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).texts[0].article, article);
  for (const value of [-1, 513, '12px', '12', {}, NaN, Infinity]) {
    for (const name of ['spaceBefore', 'spaceAfter']) {
      const broken = structuredClone(article); broken.content.content[0].attrs[name] = value;
      assert.throws(() => assertArticle(broken));
      const badDoc = structuredClone(doc); badDoc.texts[0].article = broken;
      assert.equal(validateProfileDocumentV9(badDoc).valid, false);
    }
    assert.throws(() => assertArticle({ ...article, appearance: { ...article.appearance, titleGap: value } }));
  }
  assert.throws(() => assertArticle({ ...article, appearance: { ...article.appearance, titleGap: null } }));
});

test('selection size and tracking preserve old articles and survive save, undo, publication and restore', () => {
  const old = articleWithText('Original font mark');
  old.content.content[0].content[0].marks = [{ type: 'textStyle', attrs: { fontFamily: 'Inscape Sora', color: null } }];
  const bytes = JSON.stringify(old); assertArticle(old); assert.equal(JSON.stringify(old), bytes);
  const f = fixture(); addTextModule(f.store, profile);
  const original = f.store.getDraft().texts[0], article = createArticle('THE UNDERNEATH');
  article.appearance.titleLetterSpacing = .12;
  article.content.content = [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Archive', marks: [{ type: 'textStyle', attrs: { fontSize: 48, letterSpacing: -.04 } }] }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'ARCHIVE // 01', marks: [{ type: 'textStyle', attrs: { fontSize: 10, letterSpacing: .2, color: '#aabbcc' } }] },
      { type: 'text', text: ' unchanged' },
      { type: 'text', text: ' zero', marks: [{ type: 'textStyle', attrs: { letterSpacing: 0 } }] },
    ] },
  ];
  assert.ok(saveTextModule(f.store, profile, original, { ...original, article, visibility: 'PUBLIC' }));
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().texts[0], original); assert.ok(f.store.redo());
  const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
  assert.deepEqual(draft.texts[0].article, article);
  const doc = build(draft); assert.equal(validateProfileDocumentV9(doc).valid, true);
  assert.deepEqual(doc.texts[0].article, article);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).texts[0].article, article);
  for (const [name, invalid] of [['fontSize', [0, 7, 301, '24px', '24', {}, NaN, Infinity]],
    ['letterSpacing', [-.11, 1.01, '.2em', '0', {}, NaN, Infinity]]]) {
    for (const value of invalid) {
      const broken = structuredClone(article);
      broken.content.content[1].content[0].marks = [{ type: 'textStyle', attrs: { [name]: value } }];
      assert.throws(() => assertArticle(broken));
      const badDoc = structuredClone(doc); badDoc.texts[0].article = broken;
      assert.equal(validateProfileDocumentV9(badDoc).valid, false);
    }
  }
  for (const titleLetterSpacing of [null, -.11, 1.01, '.2em', NaN, Infinity])
    assert.throws(() => assertArticle({ ...article, appearance: { ...article.appearance, titleLetterSpacing } }));
});

test('Text creation saves its requested Workbench position atomically and retains old default placement', () => {
  const f = fixture(), first = addTextModule(f.store, profile);
  const before = f.store.getDraft();
  assert.equal(before.workbench?.texts?.length || 0, 0, 'older callers retain the existing default');
  const workbench = createDefaultWorkbenchPresentation();
  workbench.texts = [{ ...createTextPresentation(first), window: { left: 350, top: 400, width: 500, height: 300 } }];
  const id = addTextModule(f.store, profile, { position: { left: 1300.5, top: 930.25 }, workbench });
  const draft = f.store.getDraft();
  assert.deepEqual(draft.workbench.texts[0], workbench.texts[0], 'existing live layout survives creation');
  assert.deepEqual(draft.workbench.texts[1], { id, open: true, window: { left: 1300.5, top: 930.25, width: 720, height: 680 } });
  assert.equal(draft.texts[1].visibility, 'PRIVATE');
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft().workbench, draft.workbench);
  const edge = addTextModule(f.store, profile, { position: { left: 7990, top: -100 } });
  assert.deepEqual(f.store.getDraft().workbench.texts.find(text => text.id === edge).window,
    { left: 7272, top: 8, width: 720, height: 680 });
  const saved = f.store.getDraft(); f.fail();
  assert.throws(() => addTextModule(f.store, profile, { position: { left: 1000, top: 1000 } }), /could not be saved/);
  assert.deepEqual(f.store.getDraft(), saved, 'failed creation adds neither content nor a window');
});

test('new Text has a visible background while saved transparent and legacy articles retain their appearance', () => {
  assert.equal(createArticle().appearance.background, '#101111');
  const f = fixture(); addTextModule(f.store, profile);
  const record = f.store.getDraft().texts[0], article = createArticle('Existing transparent text');
  article.appearance.background = null;
  assert.ok(saveTextModule(f.store, profile, record, { ...record, visibility: 'PUBLIC', article }));
  const restored = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
  assert.deepEqual(restored.texts[0].article, article);
  const published = build(restored);
  assert.deepEqual(published.texts[0].article, article);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(published, restored).texts[0].article, article);
  const legacy = createArticle(); delete legacy.appearance;
  assertArticle(legacy); assert.equal(textAppearance(legacy).frame, true);
  assert.equal(textAppearance(legacy).background, '#101111');
  const display = displayTextArticle({ content: 'Existing Display label', font: 'sora', size: 20, color: '#ffffff', alignment: 'left', bold: false, italic: false });
  assert.equal(display.appearance.background, null);
  assert.equal(display.appearance.compact, true);
});

test('title size is optional and survives draft, publication and restore independently of body size', () => {
  const old = createArticle(), bytes = JSON.stringify(old);
  assertArticle(old); assert.equal(JSON.stringify(old), bytes);
  const f = fixture(); addTextModule(f.store, profile);
  const original = f.store.getDraft().texts[0];
  const article = createArticle(); article.title = '// ARRIVAL'; article.appearance.titleFontSize = 64;
  assert.ok(saveTextModule(f.store, profile, original, { ...original, visibility: 'PUBLIC', article }));
  const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
  assert.deepEqual(draft.texts[0].article, article);
  const doc = build(draft); assert.equal(validateProfileDocumentV9(doc).valid, true);
  assert.deepEqual(doc.texts[0].article, article);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).texts[0].article, article);
  for (const titleFontSize of [null, '64', 7, 301, NaN]) {
    assert.throws(() => assertArticle({ ...article, appearance: { ...article.appearance, titleFontSize } }));
  }
});

test('custom inner spacing survives saving, publication and restore while old articles remain unchanged', () => {
  const old = createArticle(); const bytes = JSON.stringify(old);
  assertArticle(old); assert.equal(JSON.stringify(old), bytes);
  const f = fixture(); addTextModule(f.store, profile);
  const original = f.store.getDraft().texts[0];
  const article = createArticle(); article.appearance.padding = { top: 0, right: 12, bottom: 6, left: 32 };
  assert.ok(saveTextModule(f.store, profile, original, { ...original, visibility: 'PUBLIC', article }));
  const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
  assert.deepEqual(draft.texts[0].article, article);
  const doc = build(draft); assert.equal(validateProfileDocumentV9(doc).valid, true);
  assert.deepEqual(doc.texts[0].article, article);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).texts[0].article, article);
  for (const padding of [null, {}, { top: -1, right: 0, bottom: 0, left: 0 }, { top: 0, right: 0, bottom: 0, left: 513 }]) {
    assert.throws(() => assertArticle({ ...article, appearance: { ...article.appearance, padding } }));
  }
});

test('title alignment, title colour and inline colours survive save, publication and restore without changing old articles', () => {
  const old = createArticle('Old title');
  old.content.content[0].content = [{ type: 'text', text: 'Older font mark', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Inscape Sora' } }] }];
  const bytes = JSON.stringify(old); assertArticle(old); assert.equal(JSON.stringify(old), bytes);
  for (const titleAlignment of ['left', 'center', 'right']) {
    const f = fixture(); addTextModule(f.store, profile);
    const original = f.store.getDraft().texts[0], article = structuredClone(old);
    Object.assign(article.appearance, { titleAlignment, titleColor: '#ff8800', columns: 3, columnGap: 32 });
    article.content.content[0].content = [
      { type: 'text', text: 'Coloured', marks: [{ type: 'textStyle', attrs: { fontFamily: null, color: '#9876ff' } }] },
      { type: 'text', text: 'Coloured font', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Inscape Article Literata', color: '#ab12ef' } }] },
      { type: 'text', text: 'Font only', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Inscape Sora', color: null } }] },
    ];
    assert.ok(saveTextModule(f.store, profile, original, { ...original, visibility: 'PUBLIC', article }));
    const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
    assert.deepEqual(draft.texts[0].article, article);
    const doc = build(draft); assert.equal(validateProfileDocumentV9(doc).valid, true);
    assert.deepEqual(doc.texts[0].article, article);
    assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).texts[0].article, article);
  }
  for (const titleAlignment of [null, 'justify', 1, {}]) assert.throws(() => assertArticle({ ...old, appearance: { ...old.appearance, titleAlignment } }));
  for (const columns of [null, 0, 4, 1.5, '2']) assert.throws(() => assertArticle({ ...old, appearance: { ...old.appearance, columns } }));
  for (const columnGap of [null, -1, 129, '24']) assert.throws(() => assertArticle({ ...old, appearance: { ...old.appearance, columnGap } }));
  for (const color of [null, 'red', '#fff', 'url(https://example.com)', 123]) {
    assert.throws(() => assertArticle({ ...old, appearance: { ...old.appearance, titleColor: color } }));
    const invalid = structuredClone(old);
    invalid.content.content[0].content[0].marks = [{ type: 'textStyle', attrs: { color } }];
    assert.throws(() => assertArticle(invalid));
  }
});
test('alignment is optional for old articles and survives draft, publication and restore for paragraphs and headings', () => {
  const old = createArticle(); const bytes = JSON.stringify(old);
  assertArticle(old); assert.equal(JSON.stringify(old), bytes);
  for (const textAlign of ARTICLE_ALIGNMENTS) {
    const f = fixture(); addTextModule(f.store, profile);
    const original = f.store.getDraft().texts[0];
    const article = createArticle();
    article.content.content = [{ type: 'paragraph', attrs: { textAlign } }, { type: 'heading', attrs: { level: 2, textAlign } }];
    assert.ok(saveTextModule(f.store, profile, original, { ...original, visibility: 'PUBLIC', article }));
    const draft = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }).getDraft();
    assert.deepEqual(draft.texts[0].article, article);
    const doc = build(draft); assert.deepEqual(doc.texts[0].article, article);
    assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).texts[0].article, article);
  }
  for (const textAlign of ['justify', 'invalid', {}, 4]) {
    const article = createArticle(); article.content.content[0].attrs = { textAlign };
    assert.throws(() => assertArticle(article));
  }
});
function articleWithText(text, title = '') {
  const article = createArticle(title);
  article.content.content[0].content = [{ type: 'text', text }];
  return article;
}
test('unsupported blocks, unsafe links, unknown fonts and malformed structures fail without dropping content', () => {
  const article = articleWithText('Hello');
  for (const node of [{ type: 'iframe' }, { type: 'heading', attrs: { level: 9 } },
    { type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'bad', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Unknown' } }] }] }]) {
    assert.throws(() => assertArticle({ ...article, content: { type: 'doc', content: [node] } }));
  }
  assert.equal(validTextModules([null]), false);
});
test('old draft stays unchanged; text edits save, reopen, undo and reject stale or failed writes', () => {
  const f = fixture(), old = f.store.getDraft(); assert.equal(f.entries.size, 0); assert.equal(Object.hasOwn(build(old), 'texts'), false);
  addTextModule(f.store, profile); const original = f.store.getDraft().texts[0];
  const next = { ...original, article: articleWithText('First edition', 'Essay') };
  assert.ok(saveTextModule(f.store, profile, original, next));
  assert.equal(saveTextModule(f.store, profile, original, original), false);
  const reloaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage });
  assert.deepEqual(reloaded.getDraft().texts[0], next);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().texts[0], original); assert.ok(f.store.redo());
  f.fail(); assert.equal(saveTextModule(f.store, profile, next, original), false); assert.deepEqual(f.store.getDraft().texts[0], next);
  assert.equal(f.entries.size, 1); assert.ok(f.entries.has(systemWorkflowDraftKey(profile)));
});
test('publication omits excluded text and token update authority; restore retains missing local modules', () => {
  const f = fixture(); addTextModule(f.store, profile); addTextModule(f.store, profile);
  const draft = f.store.getDraft(); draft.texts[0].visibility = 'PUBLIC';
  draft.texts[0].target = { address: profile, tokenId: `0x${'2'.repeat(64)}`, metadataValue: '0x1234', assetIndex: 0 };
  draft.workbench = { ...createDefaultWorkbenchPresentation(), texts: draft.texts.map((t, i) => createTextPresentation(t.id, i)) };
  const doc = build(draft); assert.equal(doc.texts.length, 1); assert.equal(doc.workbench.texts.length, 1); assert.equal(Object.hasOwn(doc.texts[0], 'target'), false);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft);
  assert.equal(restored.texts.length, 2); assert.equal(Object.hasOwn(restored.texts[0], 'target'), false);
  const old = build(fixture().store.getDraft());
  const fromOld = reconcileSystemWorkflowDraftFromProfileDocumentV9(old, draft);
  assert.equal(fromOld.texts.length, 2); assert.ok(fromOld.texts.every(t => t.visibility === 'PRIVATE'));
  assert.deepEqual(fromOld.workbench.texts, draft.workbench.texts);
});
test('host capture and deletion follow live membership; malformed optional fields return validation failures', () => {
  const f = fixture(); addTextModule(f.store, profile); const item = f.store.getDraft().texts[0];
  const layout = { ...createDefaultWorkbenchPresentation(), texts: [createTextPresentation(item.id)] };
  const capture = captureWorkbenchPresentation({ layout, texts: [], displayOpen: true, identityOpen: false, assetRecords: [] });
  assert.deepEqual(capture.value.texts, []);
  assert.ok(removeWorkbenchModule(f.store, profile, 'text', item)); assert.equal(f.store.getDraft().texts.length, 0); assert.ok(f.store.undo());
  const draft = f.store.getDraft(), doc = build(draft);
  for (const texts of [null, {}, [null], 'bad']) {
    assert.equal(validateSystemWorkflowDraft({ ...draft, texts, workbench: { ...layout, texts } }).valid, false);
    assert.equal(validateProfileDocumentV9({ ...doc, texts, workbench: { ...layout, texts } }).valid, false);
  }
});

test('legacy bound drafts reopen and remain editable without creating new bindings', () => {
  const f = fixture(); addTextModule(f.store, profile);
  assert.equal(Object.hasOwn(f.store.getDraft().texts[0], 'target'), false);
  const draft = f.store.getDraft();
  draft.texts[0].target = { address: profile, tokenId: '0x' + '2'.repeat(64), metadataValue: '0x1234', assetIndex: 0 };
  f.storage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(draft));
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage });
  const old = reopened.getDraft().texts[0];
  assert.deepEqual(old, draft.texts[0]);
  const next = { ...old, article: articleWithText('Still editable', 'Saved article') };
  assert.ok(saveTextModule(reopened, profile, old, next));
  assert.deepEqual(reopened.getDraft().texts[0].article, next.article);
});
