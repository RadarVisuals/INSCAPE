import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { addTextModule, saveTextModule } from '../text/textSession.js';
import { assertArticle } from '../text/domain/article.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
const profile = `0x${'1'.repeat(40)}`;
test('Text edges save, reopen, publish and restore; legacy content needs no rewrite', () => {
  const entries = new Map(), storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v) };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const legacy = store.getDraft();
  const legacyDocument = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: legacy });
  assert.equal(validateProfileDocumentV9(legacyDocument).valid, true);
  const edges = { corners: [12, 0, 0, 12], shadow: false, grain: .22 };
  addTextModule(store, profile);
  const text = store.getDraft().texts[0];
  saveTextModule(store, profile, text, { ...text, visibility: 'PUBLIC', article: { ...text.article, appearance: { ...text.article.appearance, edges } } });
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft();
  assert.deepEqual(reopened.texts[0].article.appearance.edges, edges);
  const doc = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: reopened });
  assert.equal(validateProfileDocumentV9(doc).valid, true);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, reopened);
  assert.deepEqual(restored.texts[0].article, reopened.texts[0].article);
  for (const invalid of [null, {}, { ...edges, corners: [0, 0, -1, 0] }, { ...edges, grain: 2 }, { ...edges, shadow: 'yes' }, { ...edges, extra: 1 }]) {
    const bad = structuredClone(doc); bad.texts[0].article.appearance.edges = invalid;
    assert.equal(validateProfileDocumentV9(bad).valid, false);
    assert.throws(() => assertArticle({ ...text.article, appearance: { ...text.article.appearance, edges: invalid } }));
  }
});
