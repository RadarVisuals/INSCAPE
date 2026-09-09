import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultWorkbenchPresentation } from './workbenchPresentation.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from './profileDocumentV9Builder.js';
import { createProfileDocumentV9AssetResolver } from './profileDocumentV9Asset.js';
import { canonicalSerializeProfileDocumentV9, profileDocumentV9ContentFingerprint } from './profileDocumentV9Serialization.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from './profileDocumentV9Reconciliation.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createSystemWorkflowAuthoringSession } from '../../systemWorkflow/systemWorkflowAuthoringSession.js';
import { resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';

const profileAddress = '0x1111111111111111111111111111111111111111';
const build = draft => buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress, createdAt: 1 });

test('old v9 bytes still validate and restore; the next save includes the Workbench and new Identity card', () => {
  const old = build(createEmptySystemWorkflowDraft(profileAddress));
  const bytes = canonicalSerializeProfileDocumentV9(old);
  assert.equal(Object.hasOwn(old, 'workbench'), false);
  const draft = reconcileSystemWorkflowDraftFromProfileDocumentV9(JSON.parse(bytes));
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.display.name = 'Lunar Desert';
  draft.workbench.display.open = false;
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
  const bad = structuredClone(first); bad.workbench.display.window.width = Infinity;
  assert.throws(() => assertValidProfileDocumentV9(bad));
});

test('explicit Workbench saving uses draft storage and preserves unrelated private content', () => {
  const records = new Map(); let denied = false;
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => {
    if (denied) throw Error('denied'); records.set(key, value);
  } };
  const store = createSystemWorkflowDraftStore({ profileAddress, storage });
  const draft = store.getDraft();
  draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:private', title: 'Private study', visibility: 'PRIVATE' });
  assert.equal(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }), true);
  const session = createSystemWorkflowAuthoringSession({ store });
  const workbench = createDefaultWorkbenchPresentation();
  assert.equal(session.saveWorkbench(workbench), true);
  const saved = [...records.values()][0];
  denied = true;
  workbench.display.name = 'Unsaved';
  assert.throws(() => session.saveWorkbench(workbench));
  assert.equal([...records.values()][0], saved);
  assert.equal(createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft().workbench.display.name, 'DISPLAY MODULE');
  assert.equal(createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft().grids.find(grid => grid.id === 'grid:private').title, 'Private study');
  assert.equal(build(store.getDraft()).grids.some(grid => grid.id === 'grid:private'), false);
});

test('a saved shortcut retains its selected artwork and provenance without a Library lookup', () => {
  const contractAddress = '0x2222222222222222222222222222222222222222';
  const id = `42:${contractAddress}:0x01`;
  const record = { id, chainId: 42, contractAddress, tokenId: '0x01', standard: 'LSP8',
    name: 'Shortcut artwork', description: '', collectionName: '', imageUrl: 'https://assets.example/original.png',
    imageWidth: 1600, imageHeight: 900, creators: [], attributes: [] };
  const draft = createEmptySystemWorkflowDraft(profileAddress);
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.display.shortcut.icon = createProfileDocumentV9AssetResolver([record], { compactContentReference: false })(id,
    { url: 'https://assets.example/selected.png', width: 800, height: 800 });
  const document = build(draft);
  assert.equal(countProfileDocumentV9Assets(document), 1);
  assert.equal(document.workbench.display.shortcut.icon.media.url, 'https://assets.example/selected.png');
  assert.deepEqual(build(reconcileSystemWorkflowDraftFromProfileDocumentV9(document)).workbench, document.workbench);
});
