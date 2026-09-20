import { createArticle, MAX_TEXT_MODULES, textAppearance } from './domain/article.js';
import { displayTextArticle } from '../systemWorkflow/domain/displayText.js';
import { displayContent, PRIMARY_DISPLAY_ID } from '../systemWorkflow/domain/displayModules.js';
import { assertValidSystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { createSystemWorkflowPlacementId, assertSystemWorkflowDropGeometry } from '../systemWorkflow/systemWorkflowPlacement.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { textSaveFailure } from './textSession.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function saveDisplayArticleResult(store, profile, { moduleId, gridId, expected, article }, { retry = false, replace = false } = {}) {
  if (store.getProfileAddress() !== profile) return textSaveFailure('profile');
  const generation = store.getGeneration(); let reason;
  const candidate = draft => {
    const placement = displayContent(draft, moduleId).grids.find(grid => grid.id === gridId && grid.visibility === 'PUBLIC')?.placements.find(item => item.id === expected.id);
    if (!placement || placement.kind !== 'text') { reason = 'missing'; return null; }
    if (placement.locked) { reason = 'conflict'; return null; }
    if (!same(placement.text, expected.text) && !same(placement.text, { article }) && !replace) { reason = 'conflict'; return null; }
    placement.text = { article };
    return draft;
  };
  try {
    const options = { expectedGeneration: generation, historyLabel: 'Edit Text layer' };
    const draft = retry ? null : candidate(store.getDraft());
    const saved = retry ? store.retryCompletedOperation(candidate, options) : draft && store.commitCompletedOperation(draft, options);
    return saved ? { saved: true, record: displayContent(store.getDraft(), moduleId).grids.find(grid => grid.id === gridId).placements.find(item => item.id === expected.id) }
      : textSaveFailure(reason || store.getLastCommitFailure?.() || 'write_failed');
  } catch (error) { return { saved: false, reason: 'invalid', message: error.message }; }
}
function context(store, profile, moduleId, gridId) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const generation = store.getGeneration(), draft = store.getDraft();
  const grid = displayContent(draft, moduleId).grids.find(item => item.id === gridId);
  if (!grid || grid.visibility !== 'PUBLIC') throw new Error('Choose an editable Grid.');
  return { generation, draft, grid };
}
function commit(store, draft, generation, historyLabel) {
  assertValidSystemWorkflowDraft(draft);
  if (!store.commitCompletedOperation(draft, { expectedGeneration: generation, historyLabel })) throw new Error('The move could not be saved. The text remains in its original location.');
}
export function attachTextToDisplay(store, profile, { expected, moduleId = PRIMARY_DISPLAY_ID, gridId, destination, cellSize }) {
  const { generation, draft, grid } = context(store, profile, moduleId, gridId);
  const record = draft.texts?.find(item => item.id === expected.id);
  if (!same(record, expected)) throw new Error('Save the current Text before moving it into Display.');
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Display is no longer available.');
  if (record.sceneLink) throw new Error('Scene-linked Text must stay on the Workbench so all passages are preserved.');
  const article = structuredClone(record.article);
  article.appearance = { ...textAppearance(article), scale: textAppearance(article).scale * 30 / cellSize };
  const transform = article.appearance.transform || { quarterTurns: 0, mirrorX: false, mirrorY: false };
  delete article.appearance.transform;
  const id = createSystemWorkflowPlacementId(new Set(grid.placements.map(item => item.id)));
  grid.placements.push({ id, kind: 'text', text: { article }, ...assertSystemWorkflowDropGeometry(destination),
    layer: Math.max(-1, ...grid.placements.map(item => item.layer)) + 1,
    navigationOrder: Math.max(-1, ...grid.placements.map(item => item.navigationOrder)) + 1,
    visibility: 'PUBLIC', locked: false, transform });
  draft.texts = draft.texts.filter(item => item.id !== record.id);
  if (draft.workbench?.texts) draft.workbench.texts = draft.workbench.texts.filter(item => item.id !== record.id);
  commit(store, draft, generation, 'Move Text into Display');
  return id;
}
export function detachTextFromDisplay(store, profile, { moduleId = PRIMARY_DISPLAY_ID, gridId, expected, window, cellSize }) {
  const { generation, draft, grid } = context(store, profile, moduleId, gridId);
  const placement = grid.placements.find(item => item.id === expected.id);
  if (!placement || placement.kind !== 'text' || placement.locked || !same(placement, expected)) throw new Error('This text layer changed or is locked. Select it again.');
  if ((draft.texts?.length || 0) >= MAX_TEXT_MODULES) throw new Error(`At most ${MAX_TEXT_MODULES} independent Text modules are supported. The layer has not moved.`);
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Display is no longer available.');
  const article = structuredClone(displayTextArticle(placement.text));
  article.appearance = { ...textAppearance(article), scale: textAppearance(article).scale * cellSize / 30 };
  if (placement.transform.quarterTurns || placement.transform.mirrorX || placement.transform.mirrorY) article.appearance.transform = { ...placement.transform };
  const id = `text:${crypto.randomUUID()}`;
  draft.texts = [...(draft.texts || []), { id, article, visibility: 'PRIVATE' }];
  grid.placements = grid.placements.filter(item => item.id !== placement.id);
  draft.workbench ||= createDefaultWorkbenchPresentation();
  draft.workbench.texts = [...(draft.workbench.texts || []), { ...createTextPresentation(id), window }];
  commit(store, draft, generation, 'Move Text onto Workbench');
  return id;
}

export function addArticleToDisplay(store, profile, { moduleId = PRIMARY_DISPLAY_ID, gridId }) {
  const { generation, draft, grid } = context(store, profile, moduleId, gridId);
  const id = createSystemWorkflowPlacementId(new Set(grid.placements.map(item => item.id)));
  grid.placements.push({ id, kind: 'text', text: { article: createArticle() }, column: 2, row: 2, columnSpan: 16, rowSpan: 6,
    layer: Math.max(-1, ...grid.placements.map(item => item.layer)) + 1,
    navigationOrder: Math.max(-1, ...grid.placements.map(item => item.navigationOrder)) + 1,
    visibility: 'PUBLIC', locked: false, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } });
  commit(store, draft, generation, 'Add Text to Display');
  return id;
}
