import assert from 'node:assert/strict';
import test from 'node:test';
import { addMiniApp, saveMiniApp } from './miniAppSession.js';
import { miniAppUrl, validMiniApps } from './domain/miniApps.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { createDefaultWorkbenchPresentation, createMiniAppPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { validateSystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
const profile = `0x${'1'.repeat(40)}`;
function fixture() {
  const entries = new Map(); let fail = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('unavailable'); entries.set(key, value); } };
  return { store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }), storage, entries, fail: () => { fail = true; } };
}
test('old drafts and publications remain unchanged; add/edit/remove use the existing store and undo', () => {
  const { store, entries } = fixture(); const before = store.getDraft();
  const old = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: before, assetRecords: [] });
  assert.equal(Object.hasOwn(old, 'miniApps'), false); assert.deepEqual(assertValidProfileDocumentV9(old), old);
  assert.equal(entries.size, 0);
  addMiniApp(store, profile); const app = store.getDraft().miniApps[0];
  assert.equal(app.visibility, 'PRIVATE');
  assert.ok(saveMiniApp(store, profile, app, { ...app, name: 'RADAR', url: 'https://radar725.netlify.app/' }));
  assert.ok(store.undo()); assert.equal(store.getDraft().miniApps[0].url, '');
  assert.ok(store.redo()); assert.equal(store.getDraft().miniApps[0].name, 'RADAR');
  assert.equal(saveMiniApp(store, profile, app, { ...app, name: 'stale' }), false);
  const configured = store.getDraft().miniApps[0];
  assert.ok(saveMiniApp(store, profile, configured, null)); assert.deepEqual(store.getDraft().miniApps, []);
  assert.equal(entries.size, 1); assert.ok(entries.has(systemWorkflowDraftKey(profile)));
});
test('failed persistence and obsolete profile edits leave the entire draft intact', () => {
  const f = fixture(); addMiniApp(f.store, profile); const before = f.store.getDraft(), app = before.miniApps[0];
  assert.equal(saveMiniApp(f.store, `0x${'2'.repeat(40)}`, app, null), false);
  f.fail(); assert.equal(saveMiniApp(f.store, profile, app, { ...app, name: 'changed' }), false);
  assert.throws(() => addMiniApp(f.store, profile)); assert.deepEqual(f.store.getDraft(), before);
});
test('publication omits private apps and windows; restoration preserves local apps as private', () => {
  const { store } = fixture(); addMiniApp(store, profile); addMiniApp(store, profile);
  const draft = store.getDraft();
  draft.miniApps[0] = { ...draft.miniApps[0], url: 'https://radar725.netlify.app/', visibility: 'PUBLIC' };
  draft.miniApps[1].url = 'http://localhost:5174/';
  draft.workbench = { ...createDefaultWorkbenchPresentation(), miniApps: draft.miniApps.map((app, index) => createMiniAppPresentation(app.id, index)) };
  const doc = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });
  assert.equal(doc.miniApps.length, 1); assert.equal(doc.workbench.miniApps.length, 1);
  assert.equal(JSON.stringify(doc).includes('localhost'), false);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft);
  assert.equal(restored.miniApps.length, 2); assert.equal(restored.miniApps[1].visibility, 'PRIVATE');
  assert.deepEqual(restored.workbench.miniApps, draft.workbench.miniApps);
  const old = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: fixture().store.getDraft(), assetRecords: [] });
  const recovered = reconcileSystemWorkflowDraftFromProfileDocumentV9(old, draft);
  assert.equal(recovered.miniApps.length, 2); assert.ok(recovered.miniApps.every(app => app.visibility === 'PRIVATE'));
  assert.deepEqual(recovered.workbench.miniApps, draft.workbench.miniApps);
  const broken = structuredClone(doc); broken.workbench.miniApps[0].id = 'miniapp:missing';
  assert.throws(() => assertValidProfileDocumentV9(broken));
});

test('malformed app records and window arrays return validation errors without throwing', () => {
  const draft = fixture().store.getDraft();
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });
  for (const miniApps of [null, {}, { some: true }, [null], 'invalid']) {
    assert.equal(validateSystemWorkflowDraft({ ...draft, miniApps, workbench: { ...createDefaultWorkbenchPresentation(), miniApps } }).valid, false);
    assert.equal(validateProfileDocumentV9({ ...document, miniApps, workbench: { ...createDefaultWorkbenchPresentation(), miniApps } }).valid, false);
  }
});
test('closed schemas reject script URLs, credentials, extra properties, duplicate IDs, and localhost publications', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'https://user:secret@host.test/', 'http://example.org/', 'https://a.test/\n']) assert.equal(miniAppUrl(url), null);
  assert.equal(miniAppUrl('https://inscape.test/', { hostOrigin: 'https://inscape.test' }), null);
  const app = { id: 'miniapp:one', name: 'RADAR', url: 'https://radar725.netlify.app/', visibility: 'PRIVATE' };
  assert.ok(validMiniApps([app])); assert.equal(validMiniApps([app, app]), false);
  assert.equal(validMiniApps([{ ...app, permission: true }]), false);
  assert.equal(validMiniApps([{ id: app.id, name: app.name, url: 'http://localhost:5180/' }], true), false);
});
test('new HTTPS apps save and publish without domain configuration; loopback stays local to development', () => {
  const { store } = fixture();
  const id = addMiniApp(store, profile);
  const original = store.getDraft().miniApps.find(item => item.id === id);
  const url = 'https://new-mini-app.test/player?scene=1';
  assert.ok(miniAppUrl(url, { hostOrigin: 'https://inscape.test', allowLocal: false }));
  assert.ok(saveMiniApp(store, profile, original, { ...original, name: 'New app', url, visibility: 'PUBLIC' }));
  const document = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: store.getDraft(), assetRecords: [] });
  assert.equal(assertValidProfileDocumentV9(document).miniApps[0].url, url);
  for (const local of ['http://localhost:5180/', 'https://localhost/', 'http://127.0.0.1:5180/', 'http://[::1]:5180/']) {
    assert.ok(miniAppUrl(local)); // Existing private draft data remains readable.
    assert.ok(miniAppUrl(local, { allowLocal: true }));
    assert.equal(miniAppUrl(local, { allowLocal: false }), null);
    assert.equal(miniAppUrl(local, { published: true }), null);
  }
});
