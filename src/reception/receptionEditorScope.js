import { drawReceptionBentoCell } from './receptionCellDrawing.js';
import { moveReceptionBentoCell, placeReceptionBentoCells } from './receptionBentoInsertion.js';
import { projectReceptionCellMembers } from './editorCellGeometry.js';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { bindWorkbenchTextRecovery, textRecoveries, TEXT_RECOVERY_MESSAGE } from '../text/textEditRecovery.js';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createShapePresentation } from '../shapes/shapes.js';
import { createImagePresentation } from '../imageModule/imageModule.js';
import { applyReceptionLayout } from './receptionLayoutGenerator.js';
import { resizeReceptionBentoFrame, setReceptionBentoSettings,
  setReceptionCellRadius, setReceptionCellClip, setReceptionCellGrain, setReceptionCellMemberAnchor, setReceptionCellSingleLine } from './receptionBento.js';
import { setReceptionCellSize, resizeReceptionCell } from './receptionCellSizing.js';
import { moveReceptionMembers } from './receptionCellMembership.js';
import { mergeReceptionCells } from './receptionCellStructure.js';
import { fitReceptionText, setReceptionTextFit } from './receptionTextFit.js';
import { createReceptionEditorDocument, receptionModuleWindow, withReceptionModuleWindow, reconcileReceptionCells, receptionModuleLimits,
  RECEPTION_CELL_LIMIT } from './receptionEditorDocument.js';

const lockedLayerError = () => Object.assign(new Error('Unlock this layer before changing it.'), { code: 'locked' });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const moduleKeys = ['imageModules', 'texts', 'shapes'];
const nativeKeys = ['workbench', 'imageModules', 'texts', 'shapes', 'artworkLayers'];
const nativeContent = value => Object.fromEntries(nativeKeys.map(key => [key, value[key]]));
// The shared Editor projects Display defaults even in Reception. Those are
// host-only values, not Reception edits or history when leaving the document.
const receptionWorkbench = (presentation, saved) => {
  const next = { ...presentation, display: saved.display };
  for (const key of ['displays', 'miniApps', 'keeperDocks']) {
    if (Object.hasOwn(saved, key)) next[key] = saved[key]; else delete next[key];
  }
  return next;
};
const recordIds = draft => moduleKeys.flatMap(key => (draft[key] || []).map(item => item.id));
const freeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
};

// One native document capability. Named compositions and the profile Bento
// each expose only their own layers, cells and history to the Studio tools.
export function createReceptionEditorScope(rootStore, options = {}) {
  const field = options.documentId ? 'composition' : 'reception';
  const documentId = options.documentId || 'reception';
  if (field === 'composition' && documentId !== rootStore.getWorkbenchId()) throw new Error('Reopen the composition to edit it.');
  const underlying = rootStore.acquireReceptionScope(field);
  try {
    const draft = underlying.getSnapshot();
    if (draft[field]?.version !== 3) {
      const reception = createReceptionEditorDocument(draft[field], options);
      if (!underlying.commitCompletedOperation({ ...draft, [field]: reception }, { expectedGeneration: underlying.getGeneration(), historyLabel: 'Open profile Bento in Studio' }))
        throw new Error('Studio could not open the profile Bento. Your saved work is unchanged.');
    }
  } catch (error) { underlying.release(); throw error; }
  const profile = underlying.getProfileAddress(), base = createEmptySystemWorkflowDraft(profile);
  base.grids = []; base.displays = [];
  freeze(base);
  let snapshot, source, projectedReception, released = false, editingCell = null, commitFailure = null;
  const guards = new Set(), listeners = new Set();
  const current = () => !released && underlying.isCurrent();
  const writable = () => current() && underlying.hasWriteAccess()
    && (field === 'reception' || Boolean(underlying.getSnapshot().composition));
  const read = () => {
    if (!current()) return snapshot;
    const next = underlying.getSnapshot();
    if (next !== source) {
      commitFailure = null;
      const reception = next[field]?.version === 3 ? next[field] : createReceptionEditorDocument(next[field], options);
      projectedReception = freeze(reception);
      if (editingCell && !reception.cells.some(cell => cell.id === editingCell)) editingCell = null;
      snapshot = freeze({ ...base, identityPresentation: next.identityPresentation,
        ...nativeContent(reception) });
      source = next;
    }
    return snapshot;
  };
  const convert = (candidate, rootDocument = underlying.getSnapshot(), previous = read(), targetCell = editingCell, newText) => {
    if (!candidate || candidate.profileAddress !== profile) throw new Error('This composition is no longer active.');
    const stable = value => Object.fromEntries(Object.entries(value).filter(([key]) => !nativeKeys.includes(key) && key !== 'identityPresentation'));
    if (!same(stable(candidate), stable(previous))) throw Object.assign(new Error('This command is unavailable for this composition.'), { code: 'reception_command' });
    const canonical = rootDocument[field];
    const before = canonical?.version === 3 ? canonical : createReceptionEditorDocument(canonical, options);
    if (targetCell && !before.cells.some(cell => cell.id === targetCell)) throw new Error('This Bento cell is no longer available.');
    let next = { ...before, ...Object.fromEntries(nativeKeys.map(key => [key, candidate[key] || (key === 'workbench' ? before.workbench : [])])) };
    next.workbench = receptionWorkbench(next.workbench, before.workbench);
    const added = recordIds(candidate).filter(id => !recordIds(previous).includes(id));
    for (const id of added) if (!receptionModuleWindow(next, id)) {
      const key = moduleKeys.find(key => next[key].some(item => item.id === id));
      const make = { imageModules: createImagePresentation, texts: createTextPresentation, shapes: createShapePresentation }[key];
      next = { ...next, workbench: { ...next.workbench, [key]: [...(next.workbench[key] || []), make(id, next[key].length - 1)] } };
    }
    if (targetCell && added.length) next = {
      ...next, cells: next.cells.map(cell => cell.id === targetCell ? { ...cell, members: [...cell.members, ...added] } : cell),
    };
    if (targetCell) {
      const cell = receptionModuleWindow(next, targetCell);
      for (const id of added) {
        const window = receptionModuleWindow(next, id);
        if (!window || window.left < cell.left + cell.width && window.left + window.width > cell.left
          && window.top < cell.top + cell.height && window.top + window.height > cell.top) continue;
        const limits = receptionModuleLimits(id), minimum = { width: limits.minimumWidth, height: limits.minimumHeight };
        const scale = Math.min(1, cell.width / window.width, cell.height / window.height);
        const width = Math.max(minimum.width, Math.min(cell.width, window.width * scale)), height = Math.max(minimum.height, Math.min(cell.height, window.height * scale));
        next = withReceptionModuleWindow(next, id, { left: cell.left + (cell.width - width) / 2, top: cell.top + (cell.height - height) / 2, width, height });
      }
    }
    if (targetCell && newText && added.includes(newText)) {
      const frame = receptionModuleWindow(next, targetCell);
      const inset = Math.min(24, frame.width / 8, frame.height / 8);
      const width = Math.min(560, frame.width - inset * 2), height = Math.min(160, frame.height - inset * 2);
      next = withReceptionModuleWindow(next, newText, { width, height,
        left: frame.left + (frame.width - width) / 2, top: frame.top + (frame.height - height) / 2 });
    }
    for (const cell of before.cells) for (const id of cell.fitText || []) {
      const current = next.texts.find(text => text.id === id);
      if (!current) continue;
      const old = before.texts.find(text => text.id === id);
      if (!same(old.article, current.article)) {
        next = fitReceptionText(next, cell.id, id, options.measureText);
      } else {
        const prior = receptionModuleWindow(before, id), frame = receptionModuleWindow(next, id);
        if (frame && (prior.width !== frame.width || prior.height !== frame.height)
          && same(receptionModuleWindow(before, cell.id), receptionModuleWindow(next, cell.id)))
          next = setReceptionTextFit(next, cell.id, id, false);
      }
    }
    assertLockedLayersUnchanged(before, next);
    next = reconcileReceptionCells(before, next);
    return { ...rootDocument, [field]: next, identityPresentation: candidate.identityPresentation };
  };
  const safeOptions = opts => {
    // Translate native live geometry to Reception history, never the active canvas.
    const { historyPresentation, newText, ...safe } = opts || {};
    read();
    return { ...safe, ...(historyPresentation ? { historyReception: { ...projectedReception, workbench: receptionWorkbench(historyPresentation, projectedReception.workbench) } } : {}) };
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
    const original = accepted[field]?.version === 3 ? accepted[field] : createReceptionEditorDocument(accepted[field], options);
    const before = presentation ? reconcileReceptionCells(original,
      { ...original, workbench: receptionWorkbench(structuredClone(presentation), original.workbench) }) : original;
    const reception = reconcileReceptionCells(before, make(before), reconciliationOptions);
    if (same(reception, original)) return true;
    if (!underlying.commitCompletedOperation({ ...accepted, [field]: reception }, { expectedGeneration: generation, historyLabel: label,
      ...(presentation ? { historyReception: before } : {}) }))
      throw new Error('The change could not be saved. Your saved work is unchanged.');
    return true;
  };
  const checkTransition = () => {
    for (const guard of guards) { const reason = guard(); if (reason) throw new Error(reason); }
  };
  const api = Object.freeze({
    checkTransition,
    isCurrent: current, hasWriteAccess: writable,
    getProfileAddress: () => profile, getWorkbenchId: () => documentId, getRecoveryContext: () => documentId,
    getSnapshot: read, getDraft: () => structuredClone(read()), getGeneration: underlying.getGeneration,
    getHistory: underlying.getHistory, getRecordState: underlying.getRecordState, getLastCommitFailure: () => commitFailure || underlying.getLastCommitFailure(),
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
        const reception = recovered[field]?.version === 3 ? recovered[field] : createReceptionEditorDocument(recovered[field], options);
        const previous = { ...base, identityPresentation: recovered.identityPresentation, ...nativeContent(reception) };
        try { const next = make(structuredClone(previous)); return next && convert(next, recovered, previous); }
        catch (error) { return reject(error.code || 'invalid'); }
      }, safeOptions(opts));
    },
    undo: () => writable() && underlying.undo(), redo: () => writable() && underlying.redo(),
    beginHistoryGroup: () => writable() && underlying.beginHistoryGroup(), endHistoryGroup: () => writable() && underlying.endHistoryGroup(),
    isCollection: () => false, listWorkbenches: () => [],
    guardWorkbenchTransition: check => { guards.add(check); return () => guards.delete(check); },
    getCells: () => { read(); return current() ? projectedReception.cells : []; },
    getReception: () => { read(); return current() ? projectedReception : null; },
    replaceReception(value, expectedGeneration) {
      if (!writable()) throw new Error('This composition is no longer active.');
      checkTransition();
      if (textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      if (expectedGeneration !== underlying.getGeneration()) throw new Error('The composition changed. Open its restore preview again.');
      const reception = createReceptionEditorDocument(value, options);
      if (!underlying.commitCompletedOperation({ ...underlying.getSnapshot(), [field]: reception }, {
        expectedGeneration, historyLabel: 'Restore Bento',
      })) throw new Error('The composition could not be saved. Local work is unchanged.');
      editingCell = null;
    },
    previewFittedTextFrame(cellId, id, article) {
      const before = api.getReception();
      if (!before?.cells.some(cell => cell.id === cellId && cell.fitText?.includes(id))) return null;
      const candidate = { ...before, texts: before.texts.map(text => text.id === id ? { ...text, article } : text) };
      const fitted = fitReceptionText(candidate, cellId, id, options.measureText);
      return receptionModuleWindow(reconcileReceptionCells(before, fitted), id);
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
      return mutate(value => applyReceptionLayout(value, settings, seed), 'Generate Bento cell layout', undefined, { moveContents: true });
    },
    editBento(action, args, expectedGeneration, presentation) {
      if (!current()) throw new Error('This composition is no longer active.');
      if (expectedGeneration !== underlying.getGeneration()) throw new Error('The composition changed. Try the change again.');
      if (textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      const operations = { drawCell: drawReceptionBentoCell, placeCells: placeReceptionBentoCells, resizeFrame: resizeReceptionBentoFrame, resizeCell: resizeReceptionCell, moveCell: moveReceptionBentoCell,
        fitText: (value, cellId, id, enabled) => {
          const next = setReceptionTextFit(value, cellId, id, enabled);
          return enabled ? fitReceptionText(next, cellId, id, options.measureText) : next;
        },
        settings: setReceptionBentoSettings, cellRadius: setReceptionCellRadius, cellClip: setReceptionCellClip, cellGrain: setReceptionCellGrain, cellSingleLine: setReceptionCellSingleLine,
        anchorMembers: setReceptionCellMemberAnchor, moveMembers: moveReceptionMembers, cellSize: setReceptionCellSize, merge: mergeReceptionCells };
      const labels = { drawCell: 'Draw Bento cell', placeCells: 'Move Bento cell', resizeFrame: 'Resize Bento frame', resizeCell: 'Resize Bento cell', moveCell: 'Move Bento cell',
        settings: 'Change Bento settings', cellRadius: 'Change cell radius', cellClip: 'Change cell clipping', cellGrain: 'Change cell grain coverage', anchorMembers: 'Position cell contents',
        cellSize: 'Resize Bento cell', fitText: 'Fit box to text', moveMembers: 'Move Bento layers', merge: 'Merge Bento cells', cellSingleLine: 'Change single-line text' };
      if (!operations[action]) throw new Error('Choose an available bento action.');
      return mutate(value => operations[action](value, ...args), labels[action], presentation,
        { resizeContents: action !== 'merge', preserveMemberAnchors: action === 'anchorMembers', moveContents: action !== 'merge' });
    },
    turnShapeIntoCell(id, presentation) {
      mutate(value => {
        const shape = value.shapes.find(item => item.id === id);
        if (!shape || shape.kind || !receptionModuleWindow(value, id)) throw new Error('Select an available rectangle.');
        if (value.cells.some(cell => cell.id === id)) return value;
        if (value.cells.some(cell => cell.members.includes(id))) throw new Error('Remove this shape from its cell before turning it into a cell.');
        if (value.cells.length >= RECEPTION_CELL_LIMIT) throw new Error(`A composition supports up to ${RECEPTION_CELL_LIMIT} new cells.`);
        return { ...value, cells: [...value.cells, { id, members: [], mobile: { columns: 2, height: Math.round(Math.max(80, Math.min(1200, receptionModuleWindow(value, id).height))) } }] };
      }, 'Turn rectangle into cell', presentation);
      return id;
    },
    setCellMobile(id, patch) {
      return mutate(value => {
        if (!value.cells.some(cell => cell.id === id)) throw new Error('This cell is no longer available.');
        return { ...value, cells: value.cells.map(cell => {
          if (cell.id !== id) return cell;
          const previousWidth = cell.mobile.referenceWidth || (cell.mobile.columns === 2 ? 390 : 189);
          const scale = patch.referenceWidth ? patch.referenceWidth / previousWidth : 1;
          const placements = cell.mobile.placements?.map(item => ({ id: item.id, window: Object.fromEntries(Object.entries(item.window).map(([key, value]) => [key, value * scale])) }));
          return { ...cell, mobile: { ...cell.mobile, ...(placements ? { placements } : {}),
            ...(Object.hasOwn(patch, 'height') ? { autoHeight: false } : {}), ...patch } };
        }) };
      }, 'Arrange Bento on mobile');
    },
    setCellMobileOrder(ids) {
      return mutate(value => {
        if (ids.length !== value.cells.length || new Set(ids).size !== ids.length || ids.some(id => !value.cells.some(cell => cell.id === id)))
          throw new Error('Choose each Bento cell once.');
        return { ...value, stackOrder: 'manual', cells: ids.map(id => value.cells.find(cell => cell.id === id)) };
      }, 'Order Bento on mobile');
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
    const oldFrame = receptionModuleWindow(before, id), newFrame = receptionModuleWindow(next, id);
    if (same(oldFrame, newFrame)) continue;
    const oldCell = receptionModuleWindow(before, cell.id), newCell = receptionModuleWindow(next, cell.id);
    if (!oldCell || !newCell || same(oldCell, newCell)) throw lockedLayerError();
    const frames = Object.fromEntries(cell.members.map(id => [id, receptionModuleWindow(before, id)]));
    const expected = projectReceptionCellMembers(oldCell, newCell, frames, cell)[id];
    if (!newFrame || Object.keys(expected).some(key => Math.abs(newFrame[key] - expected[key]) > 1)) throw lockedLayerError();
  }
}
