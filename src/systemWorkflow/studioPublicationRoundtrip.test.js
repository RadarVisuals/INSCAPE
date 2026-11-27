import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioDraft } from './domain/studioComposition.js';
import { assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { createArticle } from '../text/domain/article.js';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 as restore } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { slideOf } from '../composition/cellSlides.js';

const profile = '0x' + 'a'.repeat(40);
function fixture() {
  const draft = createStudioDraft(profile, 'bento');
  for (const [id, visibility] of [['text:public', 'PUBLIC'], ['text:private', 'PRIVATE'], ['text:hidden', 'PUBLIC']]) {
    draft.texts.push({ id, visibility, article: createArticle(id) });
    draft.workbench.texts.push(createTextPresentation(id));
    draft.artworkLayers.push(id);
  }
  const [visible, hidden] = draft.cells;
  visible.members = ['text:public', 'text:private'];
  visible.slides = [[], ['text:private']];
  visible.fitText = ['text:private'];
  visible.lockedMembers = ['text:private'];
  visible.memberAnchors = [{ members: ['text:private'], alignX: 'center', alignY: 'center', paddingX: 24, paddingY: 24 }];
  hidden.members = ['text:hidden'];
  hidden.content = 'link:private';
  draft.links = [{ id: 'link:private', kind: 'source', destination: null,
    source: { profileAddress: profile, canvasId: 'workbench:private', moduleId: 'text:source' } }];
  draft.shapes.find(shape => shape.id === hidden.id).visibility = 'PRIVATE';
  draft.workbench.lockedLayerIds = ['text:private'];
  return assertValidSystemWorkflowDraft(draft);
}
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft });

test('publication excludes private cells and their contents; local recovery retains their records, layout and links', () => {
  const draft = fixture(), before = structuredClone(draft), document = publish(draft);
  assert.deepEqual(document.texts.map(item => item.id), ['text:public']);
  assert.doesNotMatch(JSON.stringify(document), /text:private|text:hidden|link:private/);
  const local = restore(document, draft);
  for (const key of ['texts', 'cells', 'links', 'artworkLayers']) assert.deepEqual(local[key], draft[key]);
  for (const key of ['texts', 'shapes', 'imageModules']) assert.deepEqual(
    Object.fromEntries(local.workbench[key].map(item => [item.id, item])),
    Object.fromEntries(draft.workbench[key].map(item => [item.id, item])));
  assert.deepEqual(local.workbench.area, draft.workbench.area);
  assert.deepEqual(local.workbench.lockedLayerIds, draft.workbench.lockedLayerIds);
  assert.deepEqual(draft, before);
  const fresh = restore(document);
  assert.deepEqual(fresh.texts.map(item => item.id), ['text:public']);
  assert.equal(Object.hasOwn(fresh, 'composition'), false);
});

test('restoring a changed public cell preserves private member slides, constraints and saved windows', () => {
  const draft = fixture(), document = publish(draft);
  document.cells[0].radius = 8;
  document.cells[0].slides = [[]];
  document.texts[0].article.title = 'New public title';
  const local = restore(document, draft), cell = local.cells[0];
  assert.equal(cell.radius, 8);
  assert.equal(local.texts[0].article.title, 'New public title');
  assert.equal(slideOf(cell, 'text:private'), 2);
  for (const key of ['fitText', 'memberAnchors', 'lockedMembers']) assert.deepEqual(cell[key], draft.cells[0][key]);
  assert.deepEqual(local.workbench.texts.find(item => item.id === 'text:private'), draft.workbench.texts.find(item => item.id === 'text:private'));
  assert.doesNotThrow(() => assertValidSystemWorkflowDraft(local));
});

test('linked frames and paginated text survive the same public projection and fresh recovery as cells', () => {
  const draft = createStudioDraft(profile, 'bento');
  for (const [id, pagination] of [['text:linked', undefined], ['text:pages', 'pages']]) {
    draft.texts.push({ id, article: createArticle(id), visibility: 'PUBLIC', ...(pagination ? { pagination } : {}) });
    draft.workbench.texts.push(createTextPresentation(id));
    draft.artworkLayers.push(id);
  }
  draft.workbench.texts[0].frames = [{ id: 'text-frame:continued', window: { left: 800, top: 300, width: 400, height: 300 } }];
  const document = publish(draft), recovered = restore(document);
  assert.deepEqual(recovered.workbench.texts, draft.workbench.texts);
  assert.deepEqual(recovered.texts, draft.texts);
  assert.deepEqual(recovered.cells, draft.cells);
  assert.equal(Object.hasOwn(document, 'composition'), false);
});
