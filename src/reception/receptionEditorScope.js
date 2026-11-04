import { projectReceptionMember } from './editorCellGeometry.js';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { bindWorkbenchTextRecovery, textRecoveries, TEXT_RECOVERY_MESSAGE } from '../text/textEditRecovery.js';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createShapePresentation } from '../shapes/shapes.js';
import { createImagePresentation } from '../imageModule/imageModule.js';
import { applyReceptionLayout } from './receptionLayoutGenerator.js';
import { resizeReceptionBento, swapReceptionBentoCells, addReceptionBentoCell, appendReceptionBentoRow, setReceptionBentoSettings, setReceptionCellRadius } from './receptionBento.js';
import { mergeReceptionCells, splitReceptionCell } from './receptionCellStructure.js';
import { fillDeletedReceptionCells } from './receptionCellDeletion.js';
import { createReceptionEditorDocument, receptionModuleWindow, withReceptionModuleWindow, reconcileReceptionCells, receptionModuleLimits,
  RECEPTION_CELL_LIMIT } from './receptionEditorDocument.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nativeKeys = ['workbench', 'imageModules', 'texts', 'shapes', 'artworkLayers'];
// The shared Editor projects Display defaults even in Reception. Those are
// host-only values, not Reception edits or history when leaving the document.
const receptionWorkbench = (presentation, saved) => {
  const next = { ...presentation, display: saved.display };
  for (const key of ['displays', 'miniApps', 'keeperDocks']) {
    if (Object.hasOwn(saved, key)) next[key] = saved[key]; else delete next[key];
  }
  return next;
};
const recordIds = draft => ['imageModules', 'texts', 'shapes'].flatMap(key => (draft[key] || []).map(item => item.id));
const freeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
};

// A capability over the profile's canonical Reception. The native Editor sees
// ordinary module records; it never gets authority over the active canvas.
export function createReceptionEditorScope(rootStore, options = {}) {
  const underlying = rootStore.acquireReceptionScope();
  try {
    const draft = underlying.getSnapshot();
    if (draft.reception?.version !== 3) {
      const reception = createReceptionEditorDocument(draft.reception, options);
      if (!underlying.commitCompletedOperation({ ...draft, reception }, { expectedGeneration: underlying.getGeneration(), historyLabel: 'Open Reception in Editor' }))
        throw new Error('Reception could not be opened in the Editor. Your saved Reception is unchanged.');
    }
  } catch (error) { underlying.release(); throw error; }
  const profile = underlying.getProfileAddress(), base = createEmptySystemWorkflowDraft(profile);
  base.grids = []; base.displays = [];
  freeze(base);
  let snapshot, source, projectedReception, released = false, editingCell = null;
  const guards = new Set(), listeners = new Set();
  const current = () => !released && underlying.isCurrent();
  const writable = () => current() && underlying.hasWriteAccess();
  const read = () => {
    if (!current()) return snapshot;
    const next = underlying.getSnapshot();
    if (next !== source) {
      const reception = next.reception?.version === 3 ? next.reception : createReceptionEditorDocument(next.reception, options);
      projectedReception = freeze(reception);
      if (editingCell && !reception.cells.some(cell => cell.id === editingCell)) editingCell = null;
      snapshot = freeze({ ...base, identityPresentation: next.identityPresentation,
        ...Object.fromEntries(nativeKeys.map(key => [key, reception[key]])) });
      source = next;
    }
    return snapshot;
  };
  const convert = (candidate, rootDocument = underlying.getSnapshot(), previous = read(), targetCell = editingCell) => {
    if (!candidate || candidate.profileAddress !== profile) throw new Error('This Reception is no longer active.');
    const stable = value => Object.fromEntries(Object.entries(value).filter(([key]) => !nativeKeys.includes(key) && key !== 'identityPresentation'));
    if (!same(stable(candidate), stable(previous))) throw new Error('This command is unavailable inside Reception.');
    const canonical = rootDocument.reception;
    const before = canonical?.version === 3 ? canonical : createReceptionEditorDocument(canonical, options);
    if (targetCell && !before.cells.some(cell => cell.id === targetCell)) throw new Error('This Reception cell is no longer available.');
    let next = { ...before, ...Object.fromEntries(nativeKeys.map(key => [key, candidate[key] || (key === 'workbench' ? before.workbench : [])])) };
    next.workbench = receptionWorkbench(next.workbench, before.workbench);
    const added = recordIds(candidate).filter(id => !recordIds(previous).includes(id));
    for (const id of added) if (!receptionModuleWindow(next, id)) {
      const key = ['imageModules', 'texts', 'shapes'].find(key => next[key].some(item => item.id === id));
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
    assertLockedLayersUnchanged(before, next);
    next = reconcileReceptionCells(before, next);
    const filled = fillDeletedReceptionCells(before, next);
    if (filled !== next) next = reconcileReceptionCells(next, filled);
    return { ...rootDocument, reception: next, identityPresentation: candidate.identityPresentation };
  };
  const safeOptions = opts => {
    // Translate native live geometry to Reception history, never the active canvas.
    const { historyPresentation, ...safe } = opts || {};
    read();
    return { ...safe, ...(historyPresentation ? { historyReception: { ...projectedReception, workbench: receptionWorkbench(historyPresentation, projectedReception.workbench) } } : {}) };
  };
  const commit = (candidate, opts = {}, targetCell = editingCell) => {
    if (!writable()) return false;
    try { return underlying.commitCompletedOperation(convert(candidate, undefined, undefined, targetCell), safeOptions(opts)); } catch { return false; }
  };
  const mutate = (make, label, presentation, reconciliationOptions) => {
    if (!writable()) throw new Error('This Reception is no longer active.');
    const generation = underlying.getGeneration(), accepted = underlying.getSnapshot();
    const original = accepted.reception?.version === 3 ? accepted.reception : createReceptionEditorDocument(accepted.reception, options);
    const before = presentation ? reconcileReceptionCells(original,
      { ...original, workbench: receptionWorkbench(structuredClone(presentation), original.workbench) }) : original;
    const reception = reconcileReceptionCells(before, make(before), reconciliationOptions);
    if (!underlying.commitCompletedOperation({ ...accepted, reception }, { expectedGeneration: generation, historyLabel: label,
      ...(presentation ? { historyReception: before } : {}) }))
      throw new Error('The Reception change could not be saved. Your saved work is unchanged.');
    return true;
  };
  const api = Object.freeze({
    isCurrent: current, hasWriteAccess: writable,
    getProfileAddress: () => profile, getWorkbenchId: () => 'reception', getRecoveryContext: () => 'reception',
    getSnapshot: read, getDraft: () => structuredClone(read()), getGeneration: underlying.getGeneration,
    getHistory: underlying.getHistory, getRecordState: underlying.getRecordState, getLastCommitFailure: underlying.getLastCommitFailure,
    getBackupSnapshot: underlying.getBackupSnapshot,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    commitCompletedOperation: commit,
    // A drop targets its cell explicitly. Creating its native module and
    // membership is one operation; the user's editing focus never changes.
    commitInCell: (cellId, candidate, opts) => Boolean(cellId && api.getCells().some(cell => cell.id === cellId)) && commit(candidate, opts, cellId),
    retryCompletedOperation: (make, opts = {}) => {
      if (!writable()) return false;
      return underlying.retryCompletedOperation(recovered => {
        const reception = recovered.reception?.version === 3 ? recovered.reception : createReceptionEditorDocument(recovered.reception, options);
        const previous = { ...base, identityPresentation: recovered.identityPresentation, ...Object.fromEntries(nativeKeys.map(key => [key, reception[key]])) };
        const next = make(structuredClone(previous)); return next && convert(next, recovered, previous);
      }, safeOptions(opts));
    },
    undo: () => writable() && underlying.undo(), redo: () => writable() && underlying.redo(),
    beginHistoryGroup: () => writable() && underlying.beginHistoryGroup(), endHistoryGroup: () => writable() && underlying.endHistoryGroup(),
    isCollection: () => false, listWorkbenches: () => [],
    guardWorkbenchTransition: check => { guards.add(check); return () => guards.delete(check); },
    getCells: () => { read(); return current() ? projectedReception.cells : []; },
    getReception: () => { read(); return current() ? projectedReception : null; },
    getEditingCell: () => { read(); return current() ? editingCell : null; },
    setEditingCell(id) {
      if (!current() || id !== null && !api.getCells().some(cell => cell.id === id)) return false;
      if (editingCell !== id) { editingCell = id; listeners.forEach(listener => listener()); }
      return true;
    },
    generateCellLayout(settings, seed, expectedGeneration) {
      if (!current()) throw new Error('This Reception is no longer active.');
      if (expectedGeneration !== underlying.getGeneration()) throw new Error('Reception changed. Close and reopen the layout generator to try again.');
      if (textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      return mutate(value => applyReceptionLayout(value, settings, seed), 'Generate Reception cell layout');
    },
    editBento(action, args, expectedGeneration, presentation) {
      if (!current()) throw new Error('This Reception is no longer active.');
      if (expectedGeneration !== underlying.getGeneration()) throw new Error('Reception changed. Try the change again.');
      if (textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      const operations = { resize: resizeReceptionBento, swap: swapReceptionBentoCells, addCell: addReceptionBentoCell, appendRow: appendReceptionBentoRow,
        settings: setReceptionBentoSettings, cellRadius: setReceptionCellRadius, merge: mergeReceptionCells, split: splitReceptionCell };
      const labels = { resize: 'Resize Reception cells', swap: 'Swap Reception cells', addCell: 'Add Reception cell', appendRow: 'Add Reception row',
        settings: 'Change bento settings', cellRadius: 'Change cell radius', merge: 'Merge Reception cells', split: 'Split Reception cell' };
      if (!operations[action]) throw new Error('Choose an available bento action.');
      return mutate(value => operations[action](value, ...args), labels[action], presentation, { resizeContents: action !== 'merge' });
    },
    turnShapeIntoCell(id, presentation) {
      mutate(value => {
        const shape = value.shapes.find(item => item.id === id);
        if (!shape || shape.kind || !receptionModuleWindow(value, id)) throw new Error('Select an available rectangle.');
        if (value.cells.some(cell => cell.id === id)) return value;
        if (value.cells.some(cell => cell.members.includes(id))) throw new Error('Remove this shape from its cell before turning it into a cell.');
        if (value.cells.length >= RECEPTION_CELL_LIMIT) throw new Error(`Reception supports up to ${RECEPTION_CELL_LIMIT} new cells.`);
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
          return { ...cell, mobile: { ...cell.mobile, ...(placements ? { placements } : {}), ...patch } };
        }) };
      }, 'Arrange Reception on mobile');
    },
    setCellMobileOrder(ids) {
      return mutate(value => {
        if (ids.length !== value.cells.length || new Set(ids).size !== ids.length || ids.some(id => !value.cells.some(cell => cell.id === id)))
          throw new Error('Choose each Reception cell once.');
        return { ...value, cells: ids.map(id => value.cells.find(cell => cell.id === id)) };
      }, 'Order Reception on mobile');
    },
    release({ force = false } = {}) {
      if (released) return;
      if (current() && !force && textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      if (current() && !force) for (const guard of guards) { const reason = guard(); if (reason) throw new Error(reason); }
      read(); released = true; editingCell = null; guards.clear(); listeners.clear(); unsubscribeUnderlying(); underlying.release();
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
  for (const cell of before.cells) for (const id of cell.lockedMembers || []) {
    const key = ['imageModules', 'texts', 'shapes'].find(key => before[key].some(item => item.id === id));
    const old = before[key].find(item => item.id === id), current = next[key].find(item => item.id === id);
    const content = record => key === 'imageModules' && record ? Object.fromEntries(Object.entries(record).filter(([key]) => !['width', 'height'].includes(key))) : record;
    if (!same(content(old), content(current))) throw new Error('Unlock this layer before editing or deleting it.');
    const oldFrame = receptionModuleWindow(before, id), newFrame = receptionModuleWindow(next, id);
    if (same(oldFrame, newFrame)) continue;
    const oldCell = receptionModuleWindow(before, cell.id), newCell = receptionModuleWindow(next, cell.id);
    if (!oldCell || !newCell || same(oldCell, newCell)) throw new Error('Unlock this layer before moving it.');
    const expected = projectReceptionMember(oldCell, newCell, oldFrame);
    if (!newFrame || Object.keys(expected).some(key => Math.abs(newFrame[key] - expected[key]) > 1)) throw new Error('Unlock this layer before moving it.');
  }
}
