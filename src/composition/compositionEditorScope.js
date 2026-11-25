import { saveKeeperDock } from '../keeper/keeperSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { duplicateCompositionLayers, duplicateCompositionSlide } from './duplicateCompositionLayers.js';
import { editCellSlides, slideIndex, slideKey, assignSlide } from './cellSlides.js';
import { drawCompositionBentoCell } from './compositionCellDrawing.js';
import { moveCompositionBentoCell, placeCompositionBentoCells } from './compositionBentoInsertion.js';
import { projectCompositionCellMembers } from './editorCellGeometry.js';
import { createBlankWorkbenchDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { bindWorkbenchTextRecovery, textRecoveries, TEXT_RECOVERY_MESSAGE } from '../text/textEditRecovery.js';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createShapePresentation } from '../shapes/shapes.js';
import { createImagePresentation } from '../imageModule/imageModule.js';
import { applyCompositionLayout } from './compositionLayoutGenerator.js';
import { resizeCompositionBentoFrame, setCompositionBentoSettings,
  setCompositionCellRadius, setCompositionCellClip, setCompositionCellGrain, setCompositionCellMemberAnchor, setCompositionCellSingleLine } from './compositionBento.js';
import { setCompositionCellSize, resizeCompositionCell } from './compositionCellSizing.js';
import { moveCompositionMembers } from './compositionCellMembership.js';
import { mergeCompositionCells } from './compositionCellStructure.js';
import { fitCompositionText, setCompositionTextFit } from './compositionTextFit.js';
import { compositionModuleWindow, withCompositionModuleWindow, reconcileCompositionCells, compositionModuleLimits,
  COMPOSITION_CELL_LIMIT } from './compositionEditorDocument.js';

import { changesLockedArtwork, withArtworkLocks } from '../systemWorkflow/domain/artworkLayers.js';

const lockedLayerError = () => Object.assign(new Error('Unlock this layer before changing it.'), { code: 'locked' });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const moduleKeys = ['imageModules', 'texts', 'shapes'];
const nativeKeys = ['workbench', 'imageModules', 'texts', 'shapes', 'artworkLayers'];
const nativeContent = value => Object.fromEntries(nativeKeys.map(key => [key, value[key]]));
// Preserve host-only values when capturing a Composition edit.
const compositionWorkbench = (presentation, saved) => {
  const next = { ...presentation };
  for (const key of ['keeperDocks', 'lockedLayerIds']) {
    if (Object.hasOwn(saved, key)) next[key] = saved[key]; else delete next[key];
  }
  return next;
};
const recordIds = draft => moduleKeys.flatMap(key => (draft[key] || []).map(item => item.id));
const freeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
};

export function createCompositionEditorScope(rootStore, options = {}) {
  const documentId = options.documentId ?? rootStore.getWorkbenchId();
  if (documentId !== rootStore.getWorkbenchId()) throw new Error('Reopen the composition to edit it.');
  const underlying = rootStore.acquireCompositionScope();
  const profile = underlying.getProfileAddress();
  const base = freeze(createBlankWorkbenchDraft(profile));
  let snapshot, source, projectedComposition, released = false, editingCell = null, commitFailure = null;
  let slidePositions = {};
  const guards = new Set(), listeners = new Set();
  const current = () => !released && underlying.isCurrent();
  const writable = () => current() && underlying.hasWriteAccess()
    && Boolean(underlying.getSnapshot().composition);
  const read = () => {
    if (!current()) return snapshot;
    const next = underlying.getSnapshot();
    if (next !== source && next.composition) {
      commitFailure = null;
      const composition = next.composition;
      projectedComposition = freeze(composition);
      if (editingCell && !composition.cells.some(cell => cell.id === editingCell)) editingCell = null;
      snapshot = freeze({ ...base, identityPresentation: next.identityPresentation,
        ...nativeContent(composition) });
      source = next;
    }
    return snapshot;
  };
  const convert = (candidate, rootDocument = underlying.getSnapshot(), previous = read(), targetCell = editingCell, newText) => {
    if (!candidate || candidate.profileAddress !== profile) throw new Error('This composition is no longer active.');
    const stable = value => Object.fromEntries(Object.entries(value).filter(([key]) => !nativeKeys.includes(key) && key !== 'identityPresentation'));
    if (!same(stable(candidate), stable(previous))) throw Object.assign(new Error('This command is unavailable for this composition.'), { code: 'composition_command' });
    const before = rootDocument.composition;
    if (targetCell && !before.cells.some(cell => cell.id === targetCell)) throw new Error('This Bento cell is no longer available.');
    let next = { ...before, ...Object.fromEntries(nativeKeys.map(key => [key, candidate[key] || (key === 'workbench' ? before.workbench : [])])) };
    next.workbench = compositionWorkbench(next.workbench, before.workbench);
    const added = recordIds(candidate).filter(id => !recordIds(previous).includes(id));
    for (const id of added) if (!compositionModuleWindow(next, id)) {
      const key = moduleKeys.find(key => next[key].some(item => item.id === id));
      const make = { imageModules: createImagePresentation, texts: createTextPresentation, shapes: createShapePresentation }[key];
      next = { ...next, workbench: { ...next.workbench, [key]: [...(next.workbench[key] || []), make(id, next[key].length - 1)] } };
    }
    if (targetCell && added.length) next = {
      ...next, cells: next.cells.map(cell => cell.id === targetCell ? assignSlide({ ...cell, members: [...cell.members, ...added] }, added, slideIndex(cell, slidePositions)) : cell),
    };
    if (targetCell) {
      const cell = compositionModuleWindow(next, targetCell);
      for (const id of added) {
        const window = compositionModuleWindow(next, id);
        if (!window || window.left < cell.left + cell.width && window.left + window.width > cell.left
          && window.top < cell.top + cell.height && window.top + window.height > cell.top) continue;
        const limits = compositionModuleLimits(id), minimum = { width: limits.minimumWidth, height: limits.minimumHeight };
        const scale = Math.min(1, cell.width / window.width, cell.height / window.height);
        const width = Math.max(minimum.width, Math.min(cell.width, window.width * scale)), height = Math.max(minimum.height, Math.min(cell.height, window.height * scale));
        next = withCompositionModuleWindow(next, id, { left: cell.left + (cell.width - width) / 2, top: cell.top + (cell.height - height) / 2, width, height });
      }
    }
    if (targetCell && newText && added.includes(newText)) {
      const frame = compositionModuleWindow(next, targetCell);
      const inset = Math.min(24, frame.width / 8, frame.height / 8);
      const width = Math.min(560, frame.width - inset * 2), height = Math.min(160, frame.height - inset * 2);
      next = withCompositionModuleWindow(next, newText, { width, height,
        left: frame.left + (frame.width - width) / 2, top: frame.top + (frame.height - height) / 2 });
    }
    for (const cell of before.cells) for (const id of cell.fitText || []) {
      const current = next.texts.find(text => text.id === id);
      if (!current) continue;
      const old = before.texts.find(text => text.id === id);
      if (!same(old.article, current.article)) {
        next = fitCompositionText(next, cell.id, id, options.measureText);
      } else {
        const prior = compositionModuleWindow(before, id), frame = compositionModuleWindow(next, id);
        if (frame && (prior.width !== frame.width || prior.height !== frame.height)
          && same(compositionModuleWindow(before, cell.id), compositionModuleWindow(next, cell.id)))
          next = setCompositionTextFit(next, cell.id, id, false);
      }
    }
    if (changesLockedArtwork(before, next)) throw lockedLayerError();
    assertLockedLayersUnchanged(before, next);
    next = reconcileCompositionCells(before, next);
    return { ...rootDocument, composition: next, identityPresentation: candidate.identityPresentation };
  };
  const safeOptions = opts => {
    // Translate native live geometry to Composition history, never the active canvas.
    const { historyPresentation, newText, ...safe } = opts || {};
    read();
    return { ...safe, ...(historyPresentation ? { historyComposition: { ...projectedComposition, workbench: compositionWorkbench(historyPresentation, projectedComposition.workbench) } } : {}) };
  };
  const reject = reason => { commitFailure = reason; listeners.forEach(listener => listener()); return false; };
  const commit = (candidate, opts = {}, targetCell = editingCell) => {
    commitFailure = null;
    if (!writable()) return reject('editor_unavailable');
    try { return underlying.commitCompletedOperation(convert(candidate, undefined, undefined, targetCell, opts.newText), safeOptions(opts)); } catch (error) { return reject(error.code || 'invalid'); }
  };
  const mutate = (make, label, presentation, reconciliationOptions) => {
    if (!writable()) throw new Error('This composition is no longer active.');
    const generation = underlying.getGeneration(), accepted = underlying.getSnapshot();
    const original = accepted.composition;
    const before = presentation ? reconcileCompositionCells(original,
      { ...original, workbench: compositionWorkbench(structuredClone(presentation), original.workbench) }) : original;
    const composition = reconcileCompositionCells(before, make(before), reconciliationOptions);
    if (changesLockedArtwork(original, composition)) throw lockedLayerError();
    if (same(composition, original)) return true;
    if (!underlying.commitCompletedOperation({ ...accepted, composition: composition }, { expectedGeneration: generation, historyLabel: label,
      ...(presentation ? { historyComposition: before } : {}) }))
      throw new Error('The change could not be saved. Your saved work is unchanged.');
    return true;
  };
  const checkTransition = () => {
    for (const guard of guards) { const reason = guard(); if (reason) throw new Error(reason); }
  };
  const api = Object.freeze({
    checkTransition,
    // The dock belongs to the profile. Its writes expire with this editor lease.
    keeper: Object.freeze({
      records: () => current() ? underlying.getSnapshot().keeperDocks : undefined,
      save: (expected, changes) => writable() && saveKeeperDock(rootStore, profile, expected, changes),
      remove: expected => writable() && removeWorkbenchModule(rootStore, profile, 'keeper', expected),
    }),
    isCurrent: current, hasWriteAccess: writable,
    getProfileAddress: () => profile, getWorkbenchId: () => documentId, getRecoveryContext: () => documentId,
    getSnapshot: read, getDraft: () => structuredClone(read()), getGeneration: underlying.getGeneration,
    getHistory: underlying.getHistory, getRecordState: underlying.getRecordState, getLastCommitFailure: () => commitFailure || underlying.getLastCommitFailure(),
    whenCommitted: underlying.whenCommitted,
    getBackupSnapshot(candidate) {
      if (!current()) throw new Error('This composition is no longer active.');
      return underlying.getBackupSnapshot(candidate ? convert(candidate) : undefined);
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    commitCompletedOperation: commit,
    // A drop targets its cell explicitly. Creating its native module and
    // membership is one operation; the user's editing focus never changes.
    commitInCell: (cellId, candidate, opts) => Boolean(cellId && api.getCells().some(cell => cell.id === cellId)) && commit(candidate, opts, cellId),
    retryCompletedOperation: (make, opts = {}) => {
      commitFailure = null;
      if (!writable()) return reject('editor_unavailable');
      return underlying.retryCompletedOperation(recovered => {
        const composition = recovered.composition;
        const previous = { ...base, identityPresentation: recovered.identityPresentation, ...nativeContent(composition) };
        try { const next = make(structuredClone(previous)); return next && convert(next, recovered, previous); }
        catch (error) { return reject(error.code || 'invalid'); }
      }, safeOptions(opts));
    },
    undo: () => writable() && underlying.undo(), redo: () => writable() && underlying.redo(),
    beginHistoryGroup: () => writable() && underlying.beginHistoryGroup(), endHistoryGroup: () => writable() && underlying.endHistoryGroup(),
    isCollection: () => false, listWorkbenches: () => [],
    guardWorkbenchTransition: check => { guards.add(check); return () => guards.delete(check); },
    getCells: () => { read(); return current() ? projectedComposition.cells : []; },
    getComposition: () => { read(); return current() ? projectedComposition : null; },
    previewFittedTextFrame(cellId, id, article) {
      const before = api.getComposition();
      if (!before?.cells.some(cell => cell.id === cellId && cell.fitText?.includes(id))) return null;
      const candidate = { ...before, texts: before.texts.map(text => text.id === id ? { ...text, article } : text) };
      const fitted = fitCompositionText(candidate, cellId, id, options.measureText);
      return compositionModuleWindow(reconcileCompositionCells(before, fitted), id);
    },
    setArtworkLocks(ids, lock) {
      return mutate(value => withArtworkLocks(value, ids, lock), lock ? 'Lock artwork' : 'Unlock artwork');
    },
    getSlidePositions: () => slidePositions,
    showSlide(id, index) {
      const cell = api.getCells().find(item => item.id === id);
      if (!cell || !Number.isInteger(index) || index < 0 || index > (cell.slides?.length || 0)) return;
      slidePositions = { ...slidePositions, [slideKey(cell)]: index };
      listeners.forEach(listener => listener());
    },
    getEditingCell: () => { read(); return current() ? editingCell : null; },
    setEditingCell(id) {
      if (!current() || id !== null && !api.getCells().some(cell => cell.id === id)) return false;
      if (editingCell !== id) { editingCell = id; listeners.forEach(listener => listener()); }
      return true;
    },
    generateCellLayout(settings, seed, expectedGeneration) {
      if (!current()) throw new Error('This composition is no longer active.');
      if (expectedGeneration !== underlying.getGeneration()) throw new Error('The composition changed. Close and reopen the layout generator to try again.');
      if (textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      return mutate(value => applyCompositionLayout(value, settings, seed), 'Generate Bento cell layout', undefined, { moveContents: true });
    },
    duplicateLayers(ids, delta, destination, expectedGeneration, presentation) {
      if (underlying.getGeneration() !== expectedGeneration) throw Error('The composition changed. Try the drag again.');
      if (textRecoveries(api, profile).length) throw Error(TEXT_RECOVERY_MESSAGE);
      let copies;
      mutate(value => {
        const result = duplicateCompositionLayers(value, ids, delta, destination, slidePositions);
        copies = result.selection;
        return result.value;
      }, 'Duplicate selection', presentation);
      return copies;
    },
    editBento(action, args, expectedGeneration, presentation) {
      if (!current()) throw new Error('This composition is no longer active.');
      if (expectedGeneration !== underlying.getGeneration()) throw new Error('The composition changed. Try the change again.');
      if (textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      const operations = { duplicateSlide: duplicateCompositionSlide, slides: editCellSlides, drawCell: drawCompositionBentoCell, placeCells: placeCompositionBentoCells, resizeFrame: resizeCompositionBentoFrame, resizeCell: resizeCompositionCell, moveCell: moveCompositionBentoCell,
        fitText: (value, cellId, id, enabled) => {
          const next = setCompositionTextFit(value, cellId, id, enabled);
          return enabled ? fitCompositionText(next, cellId, id, options.measureText) : next;
        },
        settings: setCompositionBentoSettings, cellRadius: setCompositionCellRadius, cellClip: setCompositionCellClip, cellGrain: setCompositionCellGrain, cellSingleLine: setCompositionCellSingleLine,
        anchorMembers: setCompositionCellMemberAnchor, moveMembers: (value, ids, target, ...rest) => {
          const next = moveCompositionMembers(value, ids, target, ...rest);
          const added = ids.filter(id => !value.cells.find(cell => cell.id === target)?.members.includes(id));
          return !added.length || !target ? next : { ...next, cells: next.cells.map(cell => cell.id === target
            ? assignSlide(cell, added, slideIndex(cell, slidePositions)) : cell) };
        }, cellSize: setCompositionCellSize, merge: mergeCompositionCells };
      const labels = { duplicateSlide: 'Duplicate slide', slides: 'Edit cell slides', drawCell: 'Draw Bento cell', placeCells: 'Move Bento cell', resizeFrame: 'Resize Bento frame', resizeCell: 'Resize Bento cell', moveCell: 'Move Bento cell',
        settings: 'Change Bento settings', cellRadius: 'Change cell radius', cellClip: 'Change cell clipping', cellGrain: 'Change cell grain coverage', anchorMembers: 'Position cell contents',
        cellSize: 'Resize Bento cell', fitText: 'Fit box to text', moveMembers: 'Move Bento layers', merge: 'Merge Bento cells', cellSingleLine: 'Change single-line text' };
      if (!operations[action]) throw new Error('Choose an available bento action.');
      return mutate(value => operations[action](value, ...args), labels[action], presentation,
        { resizeContents: action !== 'merge', preserveMemberAnchors: action === 'anchorMembers' || action === 'duplicateSlide', moveContents: action !== 'merge' });
    },
    turnShapeIntoCell(id, presentation) {
      mutate(value => {
        const shape = value.shapes.find(item => item.id === id);
        if (!shape || shape.kind || !compositionModuleWindow(value, id)) throw new Error('Select an available rectangle.');
        if (value.cells.some(cell => cell.id === id)) return value;
        if (value.cells.some(cell => cell.members.includes(id))) throw new Error('Remove this shape from its cell before turning it into a cell.');
        if (value.cells.length >= COMPOSITION_CELL_LIMIT) throw new Error(`A composition supports up to ${COMPOSITION_CELL_LIMIT} new cells.`);
        return { ...value, cells: [...value.cells, { id, members: [], mobile: { columns: 2, height: Math.round(Math.max(80, Math.min(1200, compositionModuleWindow(value, id).height))) } }] };
      }, 'Turn rectangle into cell', presentation);
      return id;
    },
    release({ force = false } = {}) {
      if (released) return;
      if (current() && !force && textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      if (current() && !force) checkTransition();
      read(); released = true; editingCell = null; guards.clear(); listeners.clear(); unsubscribeUnderlying(); underlying.release();
      options.disposeTextMeasure?.();
    },
  });
  read();
  // Invalidate ephemeral editing focus on every canonical transition, even when
  // no React consumer reads between deleting a cell and undoing that deletion.
  const unsubscribeUnderlying = underlying.subscribe(() => {
    if (!current()) { editingCell = null; return; }
    read(); listeners.forEach(listener => listener());
  });
  bindWorkbenchTextRecovery(api);
  return api;
}

function assertLockedLayersUnchanged(before, next) {
  // A child lock protects direct edits; deleting its owning cell removes the whole contents.
  for (const cell of before.cells.filter(cell => next.shapes.some(shape => shape.id === cell.id))) for (const id of cell.lockedMembers || []) {
    const key = moduleKeys.find(key => before[key].some(item => item.id === id));
    const old = before[key].find(item => item.id === id), current = next[key].find(item => item.id === id);
    const content = record => key === 'imageModules' && record ? Object.fromEntries(Object.entries(record).filter(([key]) => !['width', 'height'].includes(key))) : record;
    if (!same(content(old), content(current))) throw lockedLayerError();
    const oldFrame = compositionModuleWindow(before, id), newFrame = compositionModuleWindow(next, id);
    if (same(oldFrame, newFrame)) continue;
    const oldCell = compositionModuleWindow(before, cell.id), newCell = compositionModuleWindow(next, cell.id);
    if (!oldCell || !newCell || same(oldCell, newCell)) throw lockedLayerError();
    const frames = Object.fromEntries(cell.members.map(id => [id, compositionModuleWindow(before, id)]));
    const expected = projectCompositionCellMembers(oldCell, newCell, frames, cell)[id];
    if (!newFrame || Object.keys(expected).some(key => Math.abs(newFrame[key] - expected[key]) > 1)) throw lockedLayerError();
  }
}
