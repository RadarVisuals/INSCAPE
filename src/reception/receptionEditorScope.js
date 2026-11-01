import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { artworkLayers, layerIds } from '../systemWorkflow/domain/artworkLayers.js';
import { bindWorkbenchTextRecovery, textRecoveries, TEXT_RECOVERY_MESSAGE } from '../text/textEditRecovery.js';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { createShapePresentation } from '../shapes/shapes.js';
import { createImagePresentation } from '../imageModule/imageModule.js';
import { createReceptionEditorDocument, receptionModuleWindow, withReceptionModuleWindow, reconcileReceptionCells, followReceptionCellGroups,
  RECEPTION_CELL_LIMIT } from './receptionEditorDocument.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nativeKeys = ['workbench', 'imageModules', 'texts', 'shapes', 'artworkLayers'];
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
  const guards = new Set();
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
        const minimum = id.startsWith('text:') ? { width: 180, height: 100 } : { width: id.startsWith('image:') ? 32 : 8, height: id.startsWith('image:') ? 32 : 8 };
        const scale = Math.min(1, cell.width / window.width, cell.height / window.height);
        const width = Math.max(minimum.width, Math.min(cell.width, window.width * scale)), height = Math.max(minimum.height, Math.min(cell.height, window.height * scale));
        next = withReceptionModuleWindow(next, id, { left: cell.left + (cell.width - width) / 2, top: cell.top + (cell.height - height) / 2, width, height });
      }
    }
    assertLockedLayersUnchanged(before, next);
    next = reconcileReceptionCells(before, followReceptionCellGroups(before, next));
    return { ...rootDocument, reception: next, identityPresentation: candidate.identityPresentation };
  };
  const safeOptions = opts => {
    // Translate native live geometry to Reception history, never the active canvas.
    const { historyPresentation, ...safe } = opts || {};
    read();
    return { ...safe, ...(historyPresentation ? { historyReception: { ...projectedReception, workbench: historyPresentation } } : {}) };
  };
  const commit = (candidate, opts = {}, targetCell = editingCell) => {
    if (!writable()) return false;
    try { return underlying.commitCompletedOperation(convert(candidate, undefined, undefined, targetCell), safeOptions(opts)); } catch { return false; }
  };
  const mutate = (make, label, presentation) => {
    if (!writable()) throw new Error('This Reception is no longer active.');
    const generation = underlying.getGeneration(), accepted = underlying.getSnapshot();
    const original = accepted.reception?.version === 3 ? accepted.reception : createReceptionEditorDocument(accepted.reception, options);
    const before = presentation ? { ...original, workbench: structuredClone(presentation) } : original;
    const reception = reconcileReceptionCells(original, make(before));
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
    subscribe: listener => underlying.subscribe(() => { if (current()) listener(); }),
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
    getCellGroups: () => { read(); return current() ? projectedReception.arrangement?.groups || [] : []; },
    getEditingCell: () => editingCell,
    setEditingCell(id) {
      if (!current() || id !== null && !api.getCells().some(cell => cell.id === id)) return false;
      editingCell = id; return true;
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
    putInCell(cellId, ids, presentation) {
      return mutate(value => {
        const target = value.cells.find(cell => cell.id === cellId), selected = new Set(ids), available = new Set(recordIds(value));
        if (!target || !selected.size || [...selected].some(id => !available.has(id) || value.cells.some(cell => cell.id === id)))
          throw new Error('Choose artwork layers and an available cell. Cells cannot be nested.');
        const layers = artworkLayers(value), order = layerIds(layers), members = [...new Set([...target.members, ...selected])];
        const children = order.filter(id => members.includes(id));
        const rest = layers.flatMap(layer => {
          if (typeof layer === 'string') return members.includes(layer) ? [] : [layer];
          const remaining = layer.children.filter(id => !members.includes(id));
          if (remaining.includes(cellId)) return remaining;
          return remaining.length ? [{ ...layer, children: remaining }] : [];
        }), index = rest.indexOf(cellId);
        // Explicit membership changes extract their layers; unrelated artwork
        // blocks and their order remain intact.
        return { ...value, artworkLayers: [...rest.slice(0, index + 1), ...children, ...rest.slice(index + 1)], cells: value.cells.map(cell => ({ ...cell,
          members: cell.id === cellId ? members : cell.members.filter(id => !selected.has(id)),
          ...(cell.lockedMembers ? { lockedMembers: cell.lockedMembers.filter(id => !selected.has(id)) } : {}),
          mobile: { ...cell.mobile, ...(cell.mobile.placements ? { placements: cell.mobile.placements.filter(item => !selected.has(item.id)) } : {}) } })) };
      }, 'Put artwork in cell', presentation);
    },
    removeFromCell(ids, presentation) {
      const selected = new Set(ids);
      return mutate(value => ({ ...value, cells: value.cells.map(cell => ({ ...cell, members: cell.members.filter(id => !selected.has(id)),
        ...(cell.lockedMembers ? { lockedMembers: cell.lockedMembers.filter(id => !selected.has(id)) } : {}),
        mobile: { ...cell.mobile, ...(cell.mobile.placements ? { placements: cell.mobile.placements.filter(item => !selected.has(item.id)) } : {}) } })) }), 'Remove artwork from cell', presentation);
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
    setCellLayerLocked(cellId, id, locked) {
      return mutate(value => {
        const cell = value.cells.find(item => item.id === cellId);
        if (!cell?.members.includes(id)) throw new Error('This layer is no longer in the cell.');
        return { ...value, cells: value.cells.map(item => item.id === cellId ? { ...item,
          lockedMembers: locked ? [...new Set([...(item.lockedMembers || []), id])] : (item.lockedMembers || []).filter(member => member !== id) } : item) };
      }, locked ? 'Lock cell layer' : 'Unlock cell layer');
    },
    coupleCells(ids, axis = 'row', presentation) {
      const members = [...new Set(ids)];
      return mutate(value => {
        if (!['row', 'column'].includes(axis) || members.length < 2 || members.some(id => !value.cells.some(cell => cell.id === id)))
          throw new Error('Choose at least two Reception cells.');
        const group = { id: `group:${crypto.randomUUID()}`, members, axis, gapX: 16, gapY: 16 };
        const groups = (value.arrangement?.groups || []).map(item => ({ ...item, members: item.members.filter(id => !members.includes(id)) })).filter(item => item.members.length > 1);
        return arrangeGroup({ ...value, arrangement: { groups: [...groups, group] } }, group);
      }, 'Couple Reception cells', presentation);
    },
    unlinkCells(id, presentation) {
      return mutate(value => ({ ...value, arrangement: { groups: (value.arrangement?.groups || []).filter(group => group.id !== id && !group.members.includes(id)) } }), 'Unlink Reception cells', presentation);
    },
    setCellGroupGap(id, gap, presentation) {
      return mutate(value => {
        const group = value.arrangement?.groups.find(item => item.id === id || item.members.includes(id));
        if (!group || !Number.isFinite(gap) || gap < 0 || gap > 10000) throw new Error('Choose an available cell group and valid spacing.');
        const next = { ...group, [group.axis === 'row' ? 'gapX' : 'gapY']: Math.round(gap) };
        return arrangeGroup({ ...value, arrangement: { groups: value.arrangement.groups.map(item => item.id === group.id ? next : item) } }, next);
      }, 'Space Reception cells', presentation);
    },
    setCellMobileOrder(ids) {
      return mutate(value => {
        if (ids.length !== value.cells.length || new Set(ids).size !== ids.length || ids.some(id => !value.cells.some(cell => cell.id === id)))
          throw new Error('Choose each Reception cell once.');
        return { ...value, cells: ids.map(id => value.cells.find(cell => cell.id === id)) };
      }, 'Order Reception on mobile');
    },
    release({ force = false } = {}) {
      if (!current()) return;
      if (!force && textRecoveries(api, profile).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      if (!force) for (const guard of guards) { const reason = guard(); if (reason) throw new Error(reason); }
      read(); released = true; editingCell = null; guards.clear(); underlying.release();
    },
  });
  read(); bindWorkbenchTextRecovery(api);
  return api;
}

function arrangeGroup(value, group) {
  let next = value;
  const first = receptionModuleWindow(value, group.members[0]), horizontal = group.axis === 'row';
  let position = horizontal ? first.left : first.top;
  for (const id of group.members) {
    const window = receptionModuleWindow(value, id);
    next = withReceptionModuleWindow(next, id, { ...window, left: horizontal ? position : first.left, top: horizontal ? first.top : position });
    position += (horizontal ? window.width + group.gapX : window.height + group.gapY);
  }
  return next;
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
    const expected = { left: newCell.left + (oldFrame.left - oldCell.left) * newCell.width / oldCell.width,
      top: newCell.top + (oldFrame.top - oldCell.top) * newCell.height / oldCell.height,
      width: oldFrame.width * newCell.width / oldCell.width, height: oldFrame.height * newCell.height / oldCell.height };
    if (!newFrame || Object.keys(expected).some(key => Math.abs(newFrame[key] - expected[key]) > 1)) throw new Error('Unlock this layer before moving it.');
  }
}
