import { workbenchArea, workbenchAreaBounds } from '../systemWorkflow/domain/workbenchArea.js';
import { createArticle, MAX_TEXT_MODULES } from './domain/article.js';
import { createDefaultWorkbenchPresentation, createTextPresentation, TEXT_WINDOW_LIMITS, CELL_TEXT_WINDOW_LIMITS, MIN_RECEPTION_CELL_SIZE } from '../profileDocument/domain/workbenchPresentation.js';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';

export function prepareTextResize(draft, { expected }) {
  if (JSON.stringify(draft.texts?.find(item => item.id === expected.id)) !== JSON.stringify(expected))
    throw new Error('Text changed during resizing. Save your text and try again.');
  return draft;
}

export function changeTextFrames(store, profile, expected, presentation, frames, workbench) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  prepareTextResize(draft, { expected });
  if (expected.sceneLink || expected.pagination) throw new Error('Unlink Follow Display and turn off Read as pages before adding linked frames.');
  const next = { ...presentation };
  if (frames.length) next.frames = frames; else delete next.frames;
  const layout = workbench || draft.workbench || createDefaultWorkbenchPresentation();
  const texts = [...(layout.texts || []).filter(item => item.id !== expected.id), next];
  if (!store.commitCompletedOperation({ ...draft, workbench: { ...layout, texts } }, {
    expectedGeneration: generation, historyLabel: frames.length > (presentation.frames?.length || 0) ? 'Add linked Text frame' : 'Remove linked Text frame',
  })) throw new Error('The linked frames could not be saved. Your text and saved layout are unchanged.');
  return next;
}

// Unlink is explicit and atomic. Legacy passages become private standalone
// Texts so their distinct typography and content are never flattened or lost.
export function unlinkTextModuleResult(store, profile, expected) {
  if (store.getProfileAddress() !== profile) return textSaveFailure('profile');
  const draft = store.getDraft(), generation = store.getGeneration();
  const current = draft.texts?.find(item => item.id === expected.id);
  if (!current) return textSaveFailure('missing');
  if (JSON.stringify(current) !== JSON.stringify(expected)) return textSaveFailure('conflict');
  if (!current.sceneLink) return { saved: true, record: current };
  const { sceneLink, ...record } = current;
  const passages = sceneLink.mode === 'sections' ? [] : sceneLink.passages;
  if (draft.texts.length + passages.length > MAX_TEXT_MODULES) return { saved: false, reason: 'capacity',
    message: `Unlinking needs ${passages.length} additional Text windows to preserve all passages. The Workbench limit is ${MAX_TEXT_MODULES}. Nothing was changed.` };
  try {
    const extras = passages.map(({ article }) => ({ ...record, id: `text:${crypto.randomUUID()}`, article: structuredClone(article), visibility: 'PRIVATE' }));
    const texts = [...draft.texts.map(item => item.id === record.id ? record : item), ...extras];
    const workbench = draft.workbench || createDefaultWorkbenchPresentation();
    const next = { ...draft, texts, ...(extras.length ? { workbench: { ...workbench,
      texts: [...(workbench.texts || []), ...extras.map((item, index) => createTextPresentation(item.id, draft.texts.length + index))] } } : {}) };
    const saved = store.commitCompletedOperation(next, { expectedGeneration: generation, historyLabel: 'Unlink Text from Display' });
    return saved ? { saved: true, record: store.getDraft().texts.find(item => item.id === record.id) }
      : textSaveFailure(store.getLastCommitFailure?.() || 'write_failed');
  } catch (error) { return { saved: false, reason: 'invalid', message: error.message }; }
}
export function addTextModule(store, profile, placed = null, { visibility = 'PRIVATE', appearance } = {}) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  if ((draft.texts?.length || 0) >= MAX_TEXT_MODULES) throw new Error(`At most ${MAX_TEXT_MODULES} Text modules are supported.`);
  const item = { id: `text:${crypto.randomUUID()}`, article: createArticle(), visibility };
  if (appearance) item.article.appearance = { ...item.article.appearance, ...appearance };
  const next = { ...draft, texts: [...(draft.texts || []), item] };
  if (placed) {
    const presentation = createTextPresentation(item.id, draft.texts?.length || 0);
    if (placed.window) {
      const { width, height } = placed.window;
      const cellId = placed.cellId ?? store.getEditingCell?.();
      const inCell = cellId && store.getCells?.().some(cell => cell.id === cellId);
      const limits = inCell ? CELL_TEXT_WINDOW_LIMITS : TEXT_WINDOW_LIMITS;
      const minimumWidth = inCell ? MIN_RECEPTION_CELL_SIZE.width : limits.minimumWidth;
      const minimumHeight = inCell ? MIN_RECEPTION_CELL_SIZE.height : limits.minimumHeight;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < minimumWidth || height < minimumHeight
        || width > limits.maximumWidth || height > limits.maximumHeight)
        throw new Error(`Text needs at least ${minimumWidth} × ${minimumHeight} px. Enlarge the cell before adding Text.`);
      presentation.window = { ...placed.window };
    } else presentation.window = { ...presentation.window, ...clampWorkbenchPosition(placed.position, presentation.window, workbenchAreaBounds(workbenchArea(draft.workbench))) };
    const workbench = placed.workbench || draft.workbench || createDefaultWorkbenchPresentation();
    next.workbench = { ...workbench, texts: [...(workbench.texts || []), presentation] };
  }
  const cellId = placed?.cellId ?? store.getEditingCell?.();
  if (!store.commitCompletedOperation(next, { expectedGeneration: generation, historyLabel: 'Add Text',
    ...(cellId ? { fitNewText: item.id } : {}) })) throw new Error('Text module could not be saved.');
  return item.id;
}
export function saveTextModule(store, profile, expected, next) {
  return saveTextModuleResult(store, profile, expected, next).saved;
}

export function duplicateTextModule(store, profile, expected, workbench) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft(), generation = store.getGeneration();
  prepareTextResize(draft, { expected });
  if (draft.texts.length >= MAX_TEXT_MODULES) throw new Error(`At most ${MAX_TEXT_MODULES} Text modules are supported.`);
  const record = { ...structuredClone(expected), id: `text:${crypto.randomUUID()}` };
  const layout = workbench || draft.workbench || createDefaultWorkbenchPresentation();
  const original = layout.texts?.find(item => item.id === expected.id) || createTextPresentation(expected.id);
  const windows = [original.window, ...(original.frames || []).map(frame => frame.window)];
  const left = Math.min(...windows.map(window => window.left)), top = Math.min(...windows.map(window => window.top));
  const size = { width: Math.max(...windows.map(window => window.left + window.width)) - left,
    height: Math.max(...windows.map(window => window.top + window.height)) - top };
  const offset = clampWorkbenchPosition({ left: left + 24, top: top + 24 }, size, workbenchAreaBounds(workbenchArea(layout)));
  const shift = window => ({ ...window, left: window.left + offset.left - left, top: window.top + offset.top - top });
  const presentation = { ...structuredClone(original), id: record.id, open: true, window: shift(original.window),
    ...(original.frames ? { frames: original.frames.map(frame => ({ id: `text-frame:${crypto.randomUUID()}`, window: shift(frame.window) })) } : {}) };
  if (!store.commitCompletedOperation({ ...draft, texts: [...draft.texts, record], workbench: { ...layout, texts: [...(layout.texts || []), presentation] } },
    { expectedGeneration: generation, historyLabel: 'Duplicate Text', historyPresentation: layout }))
    throw new Error('The Text copy could not be saved. Your saved work is unchanged.');
  return record.id;
}

const messages = {
  editor_unavailable: 'This tab no longer has editing access. Your unsaved text is still here.',
  profile: 'This profile is no longer active. Your unsaved text is still here.',
  conflict: 'This Text was changed elsewhere. Your edits are still here. Retry checks the latest saved version.',
  missing: 'This Text was removed from the saved draft. Your unsaved text is still here.',
  changed: 'The saved draft changed elsewhere. Retry will preserve unrelated changes.',
  stale: 'The draft changed while saving. Retry checks the latest version.',
  invalid: 'The draft could not be validated. Your unsaved text is still here.',
  corrupt: 'The saved draft could not be read safely. It has not been overwritten.',
  read_failed: 'Browser storage could not be read. Your unsaved text is still here.',
  write_failed: 'Browser storage could not save your changes. It may be full or blocked. Your unsaved text is still here.',
};
export const textSaveFailure = code => ({ saved: false, reason: code, message: messages[code] || messages.write_failed });
const workbenchTexts = { read: draft => draft.texts, replace: (draft, texts) => ({ ...draft, texts }) };
export function saveTextModuleResult(store, profile, expected, next, options) {
  return saveTextRecordResult(store, profile, expected, next, options, workbenchTexts);
}
// The host supplies the canonical collection; conflict detection, recovery and
// accepted saves remain the same for every article editor.
export function saveTextRecordResult(store, profile, expected, next, { retry = false, replace = false } = {}, collection) {
  let reason;
  const failed = textSaveFailure;
  if (store.getProfileAddress() !== profile) return failed('profile');
  const generation = store.getGeneration();
  const candidate = draft => {
    const current = collection.read(draft)?.find(item => item.id === expected.id);
    if (!current) { reason = 'missing'; return null; }
    const value = { ...current };
    for (const key of ['article', 'visibility', 'sceneLink', 'pagination']) {
      if (JSON.stringify(expected[key]) === JSON.stringify(next[key])) continue;
      if (JSON.stringify(current[key]) !== JSON.stringify(expected[key]) && JSON.stringify(current[key]) !== JSON.stringify(next[key]) && !replace) {
        reason = 'conflict'; return null;
      }
      value[key] = next[key];
    }
    if (!retry && JSON.stringify(current) !== JSON.stringify(expected)) { reason = 'conflict'; return null; }
    const texts = collection.read(draft).map(item => item.id === current.id ? value : item);
    // The draft store validates this collection with the complete candidate.
    // Revalidating every sibling article here duplicated that work per keypress.
    return collection.replace(draft, texts);
  };
  try {
    const options = { expectedGeneration: generation, historyLabel: 'Edit Text' };
    // This transformation reads the accepted immutable snapshot and copies only
    // the edited record. The store still validates and detaches before accepting.
    const nextDraft = retry ? null : candidate(store.getSnapshot());
    const saved = retry ? store.retryCompletedOperation(candidate, options) : nextDraft && store.commitCompletedOperation(nextDraft, options);
    return saved ? { saved: true, record: structuredClone(collection.read(store.getSnapshot()).find(item => item.id === expected.id)) }
      : failed(reason || store.getLastCommitFailure?.() || 'write_failed');
  } catch (error) { return { saved: false, reason: 'invalid', message: error.message }; }
}
