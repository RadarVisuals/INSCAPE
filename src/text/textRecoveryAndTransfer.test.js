import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { addTextModule, saveTextModuleResult } from './textSession.js';
const profile = `0x${'1'.repeat(40)}`;
function setup() {
  const entries = new Map(); let broken = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { if (broken) throw Error('full'); entries.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addTextModule(store, profile);
  return { store, storage, entries, fail: value => { broken = value; }, record: store.getDraft().texts[0] };
}
const edited = record => ({ ...record, article: { ...record.article, title: 'Arrival', appearance: { ...record.article.appearance, titleGap: 12, lineHeight: 1.8, textStyles: { h2: { fontSize: 32 }, caption: { fontSize: 12, color: '#aabbcc' } } }, content: { type: 'doc', content: [
  { type: 'paragraph', attrs: { textAlign: 'justify-center', spaceBefore: 4, spaceAfter: 20, lineHeight: 2.1 }, content: [{ type: 'text', text: 'The landscape remembers.', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#ffaa11', fontSize: 24, letterSpacing: .12 } }] }] },
] } } });
test('retry rebases unrelated persisted changes, retains their data, and undoes only recovered text', () => {
  const f = setup(), next = edited(f.record);
  const external = f.store.getDraft(); external.identityPresentation.alias = 'External edit';
  f.storage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(external));
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next).reason, 'changed');
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next, { retry: true }).saved, true);
  assert.equal(f.store.getDraft().identityPresentation.alias, 'External edit');
  assert.equal(f.store.getDraft().texts[0].article.title, 'Arrival');
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft().texts[0], f.record);
  assert.equal(f.store.getDraft().identityPresentation.alias, 'External edit');
});
test('retry preserves conflicting text until explicit replacement and recovers transient storage failures', () => {
  const f = setup(), next = edited(f.record), external = f.store.getDraft(); external.texts[0].article.title = 'Elsewhere';
  f.storage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(external));
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next, { retry: true }).reason, 'conflict');
  assert.equal(JSON.parse(f.storage.getItem(systemWorkflowDraftKey(profile))).texts[0].article.title, 'Elsewhere');
  f.fail(true);
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next, { retry: true, replace: true }).reason, 'write_failed');
  assert.deepEqual(f.store.getDraft().texts[0], f.record);
  f.fail(false);
  assert.equal(saveTextModuleResult(f.store, profile, f.record, next, { retry: true, replace: true }).saved, true);
  assert.equal(f.store.getDraft().texts[0].article.title, 'Arrival');
});
test('retry refuses corrupt or removed records without replacing them or updating local state', () => {
  for (const raw of ['broken', JSON.stringify({ ...setup().store.getDraft(), texts: [] })]) {
    const f = setup(); f.storage.setItem(systemWorkflowDraftKey(profile), raw);
    assert.equal(saveTextModuleResult(f.store, profile, f.record, edited(f.record), { retry: true }).saved, false);
    assert.equal(f.storage.getItem(systemWorkflowDraftKey(profile)), raw);
    assert.deepEqual(f.store.getDraft().texts[0], f.record);
  }
});
