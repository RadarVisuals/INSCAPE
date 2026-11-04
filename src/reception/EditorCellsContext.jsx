import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { RECEPTION_CELL_LIMIT } from './receptionEditorDocument.js';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { receptionCellStructureActions } from './receptionCellStructure.js';
import './editorCells.css';

const EditorCellsContext = createContext(null);
const NO_CELLS = Object.freeze([]);
const noSubscription = () => () => {};
const noEditingCell = () => null;
export const useEditorCells = () => useContext(EditorCellsContext);
export function editorCellStructureActions(store, id, view) {
  const previewing = Object.keys(view.transforms).length > 0;
  return receptionCellStructureActions(store.getReception(), id).map(({ action, direction, label, reason }) => ({
    id: `cell-${action}-${direction}`, label, disabled: previewing || Boolean(reason),
    reason: previewing ? 'Finish or cancel the current preview first.' : reason,
    run: () => {
      store.editBento(action, [id, direction], store.getGeneration(), view.getPresentation());
      view.selectArtwork(id);
    },
  }));
}
export function isEditorCellSurface(target, context) {
  const cell = context?.cells.find(item => item.id === context.editingCellId);
  const id = target?.closest?.('[data-workbench-view-id]')?.dataset.workbenchViewId;
  return Boolean(cell && (cell.id === id || cell.members.includes(id)));
}
export function EditorCellsProvider({ store, selection, children }) {
  const [bentoOpen, setBentoOpen] = useState(false);
  const editingCellId = useSyncExternalStore(store?.subscribe || noSubscription, store?.getEditingCell || noEditingCell, noEditingCell);
  const nativeCells = store?.getCells?.() || NO_CELLS, transforms = useWorkbenchView()?.transforms;
  const innerLines = store?.getReception?.()?.innerLines;
  const [linePreview, setLinePreview] = useState(null), generation = store?.getGeneration();
  const previewInnerLines = useCallback(patch => setLinePreview(patch ? { store, generation, patch } : null), [store, generation]);
  const changeInnerLines = useCallback(patch => {
    if (!innerLines) throw new Error('Enable inner lines in Bento settings.');
    store.editBento('settings', [{ innerLines: { ...innerLines, ...patch } }], generation);
  }, [store, generation, innerLines]);
  const paintedInnerLines = useMemo(() => linePreview && linePreview.store === store && linePreview.generation === generation
    ? { ...innerLines, ...linePreview.patch } : innerLines, [store, generation, linePreview, innerLines]);
  const cells = useMemo(() => nativeCells.map(cell => transforms?.[cell.id]?.cellRadius === undefined ? cell
    : { ...cell, radius: transforms[cell.id].cellRadius }), [nativeCells, transforms]);
  const enterCell = useCallback(id => {
    if (store?.setEditingCell?.(id)) selection.setSelection([]);
  }, [store, selection]);
  const leaveCell = useCallback((select = true) => {
    store?.setEditingCell?.(null);
    if (select && editingCellId) selection.selectArtwork(editingCellId);
  }, [store, selection, editingCellId]);
  const openSettings = useCallback(id => {
    if (cells.some(cell => cell.id === id)) selection.selectArtwork(id);
    setBentoOpen(true);
  }, [cells, selection]);
  useEffect(() => () => store?.setEditingCell?.(null), [store]);
  const value = useMemo(() => store?.getCells ? { cells, editingCellId, enterCell, leaveCell, openSettings,
    bentoOpen, setBentoOpen, store, innerLines, paintedInnerLines, previewInnerLines, changeInnerLines } : null,
  [store, cells, editingCellId, enterCell, leaveCell, openSettings, bentoOpen, innerLines, paintedInnerLines, previewInnerLines, changeInnerLines]);
  return <EditorCellsContext.Provider value={value}>{children}</EditorCellsContext.Provider>;
}
export function EditorCellEditingNotice() {
  const context = useEditorCells();
  if (!context?.editingCellId) return null;
  const name = context.store.getReception().shapes.find(item => item.id === context.editingCellId)?.name || 'Cell';
  return <div className="editor-cell-editing" data-workbench-selection-tools role="status">
    <span>Editing contents · {name}</span>
    <button className="workflow-tactile-control" type="button" onClick={() => context.leaveCell()}>Back to cells</button>
  </div>;
}
export function EditorCellTools({ record, view, run }) {
  const context = useEditorCells();
  if (!context || record.kind) return null;
  const { store, cells } = context, cell = cells.find(item => item.id === record.id);
  if (cell) return <button type="button" className="workflow-tactile-control" onClick={() => context.openSettings(cell.id)}>Bento settings</button>;
  return <button type="button" className="workflow-tactile-control"
    disabled={cells.some(item => item.members.includes(record.id)) || cells.length >= RECEPTION_CELL_LIMIT}
    onClick={() => run(() => store.turnShapeIntoCell(record.id, view.getPresentation()), 'shape')}>Turn into cell</button>;
}
