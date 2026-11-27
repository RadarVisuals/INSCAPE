import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { FIRST_WORKBENCH_ID } from '../../systemWorkflow/domain/workbenchCollection.js';
import { addTextModule, saveTextModule } from '../../text/textSession.js';
import { createProfileDocumentV9AssetResolver } from '../../profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as sources } from '../../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';

test('one Library reference in two Text modules keeps authored text independent across Workbenches and reload', () => {
  const profile = `0x${'a'.repeat(40)}`, records = new Map();
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const source = createProfileDocumentV9AssetResolver(sources, { compactContentReference: false })(sources[0].id);
  const originalSource = structuredClone(source);
  const addArticle = () => {
    const id = addTextModule(store.getWorkbenchScope(), profile);
    const expected = store.getDraft().texts.find(item => item.id === id);
    const article = { ...expected.article, content: { type: 'doc', content: [
      { type: 'artwork', attrs: { asset: source, alt: 'Source artwork', caption: 'Original caption' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'Original paragraph' }] },
    ] } };
    assert.equal(saveTextModule(store.getWorkbenchScope(), profile, expected, { ...expected, article }), true);
    return store.getDraft().texts.find(item => item.id === id);
  };
  const first = addArticle();
  const secondWorkbench = store.createWorkbench('Second source interpretation');
  const second = addArticle();
  const edited = structuredClone(second.article);
  edited.content.content[0].attrs.caption = 'Second caption';
  edited.content.content[1].content[0].text = 'Second paragraph';
  assert.equal(saveTextModule(store.getWorkbenchScope(), profile, second, { ...second, article: edited }), true);
  edited.content.content[1].content[0].text = 'Caller mutation after save';
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(reopened.getWorkbenchId(), secondWorkbench);
  const savedSecond = reopened.getDraft().texts[0];
  assert.equal(savedSecond.article.content.content[1].content[0].text, 'Second paragraph');
  assert.equal(savedSecond.article.content.content[0].attrs.asset.stableAssetId,
    first.article.content.content[0].attrs.asset.stableAssetId);
  assert.equal(reopened.switchWorkbench(FIRST_WORKBENCH_ID), true);
  assert.deepEqual(reopened.getDraft().texts[0], first);
  assert.deepEqual(source, originalSource);
});
