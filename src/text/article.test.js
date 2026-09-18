import test from 'node:test';
import assert from 'node:assert/strict';
import { createArticle, assertArticle, validTextModules, ARTICLE_ALIGNMENTS } from './domain/article.js';
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
