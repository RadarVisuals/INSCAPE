import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultWorkbenchPresentation } from './workbenchPresentation.js';
import { buildProfileDocumentV9 } from './profileDocumentV9Builder.js';
import { canonicalSerializeProfileDocumentV9, profileDocumentV9ContentFingerprint } from './profileDocumentV9Serialization.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from './profileDocumentV9Reconciliation.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createWorkbenchSession } from '../../systemWorkflow/workbenchSession.js';
import { createArticle } from '../../text/domain/article.js';
import { resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';

const profileAddress = '0x1111111111111111111111111111111111111111';
const build = draft => buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress, createdAt: 1 });

test('old v9 bytes still validate and restore; the next save includes the Workbench and new Identity card', () => {
  const old = build(createEmptySystemWorkflowDraft(profileAddress));
  const bytes = canonicalSerializeProfileDocumentV9(old);
  assert.equal(Object.hasOwn(old, 'workbench'), false);
  const draft = reconcileSystemWorkflowDraftFromProfileDocumentV9(JSON.parse(bytes));
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.identity.open = true;
  draft.identityPresentation.card = resolveIdentityCard(draft.identityPresentation);
  draft.identityPresentation.card.fields = [{ id: 'field:place', label: 'Location', type: 'text', value: 'The Underneath' }];
  const next = build(draft);
  assert.equal(next.version, 9);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(next).workbench, draft.workbench);
  assert.deepEqual(next.identityPresentation.card, draft.identityPresentation.card);
  assert.equal(canonicalSerializeProfileDocumentV9(old), bytes, 'reading old content never changes its hashed bytes');
});

test('Workbench layout changes invalidate prepared content; private authoring state is rejected', () => {
  const draft = createEmptySystemWorkflowDraft(profileAddress);
  draft.workbench = createDefaultWorkbenchPresentation();
  const first = build(draft);
  draft.workbench.identity.window.left += 20;
  assert.notEqual(profileDocumentV9ContentFingerprint(build(draft)), profileDocumentV9ContentFingerprint(first));
  for (const extra of ['library', 'layers', 'activity', 'wallet', 'script']) {
    const bad = structuredClone(first); bad.workbench[extra] = {};
    assert.throws(() => assertValidProfileDocumentV9(bad));
  }
  const bad = structuredClone(first); bad.workbench.identity.window.width = Infinity;
  assert.throws(() => assertValidProfileDocumentV9(bad));
});

test('explicit Workbench saving uses draft storage and preserves unrelated private content', () => {
  const records = new Map(); let denied = false;
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => {
    if (denied) throw Error('denied'); records.set(key, value);
  } };
  const store = createSystemWorkflowDraftStore({ profileAddress, storage });
  const draft = store.getDraft();
  draft.texts = [{ id: 'text:private', article: createArticle('Private study'), visibility: 'PRIVATE' }];
  assert.equal(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }), true);
  const session = createWorkbenchSession({ store });
  const workbench = createDefaultWorkbenchPresentation();
  assert.equal(session.saveWorkbench(workbench), true);
  const saved = [...records.values()][0];
  denied = true;
  workbench.identity.open = true;
  assert.throws(() => session.saveWorkbench(workbench));
  assert.equal([...records.values()][0], saved);
  assert.equal(createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft().workbench.identity.open, false);
  assert.equal(createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft().texts[0].article.title, 'Private study');
  assert.equal(build(store.getDraft()).texts, undefined);
});
