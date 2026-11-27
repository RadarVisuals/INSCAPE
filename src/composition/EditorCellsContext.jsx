import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { COMPOSITION_CELL_LIMIT, visibleCompositionInnerLines } from './compositionEditorDocument.js';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { compositionCellStructureActions } from './compositionCellStructure.js';
import './editorCells.css';

const EditorCellsContext = createContext(null);
const EditorCellLayoutContext = createContext(null);
const NO_CELLS = Object.freeze([]);
const noSubscription = () => () => {};
const noEditingCell = () => null;
const noSlides = () => EMPTY_POSITIONS;
const EMPTY_POSITIONS = Object.freeze({});
export const useEditorCells = () => useContext(EditorCellsContext);
export const useEditorCellLayout = () => useContext(EditorCellLayoutContext);
export function editorCellStructureActions(store, id, view) {
  const previewing = Object.keys(view.transforms).length > 0;
  const actions = compositionCellStructureActions(store.getComposition(), id);
  return [{
    id: 'cell-merge', label: 'Merge cell',
    children: actions.map(({ direction, reason }) => ({
      id: `cell-merge-${direction}`, label: direction[0].toUpperCase() + direction.slice(1),
      disabled: previewing || Boolean(reason),
      reason: previewing ? 'Finish or cancel the current preview first.' : reason,
      run: () => {
        store.editBento('merge', [id, direction], store.getGeneration(), view.getPresentation());
        view.selectArtwork(id);
      },
    })),
  }];
}
export function isEditorCellSurface(target, context) {
  const cell = context?.cells.find(item => item.id === context.editingCellId);
  const id = target?.closest?.('[data-workbench-view-id]')?.dataset.workbenchViewId;
  return Boolean(cell && (cell.id === id || cell.members.includes(id)));
}
export function EditorCellsProvider({ store, selection, children }) {
  const [bentoOpen, setBentoOpen] = useState(false);
  const contentActions = useRef(null);
  const registerContentActions = useCallback(actions => {
    contentActions.current = actions;
    return () => { if (contentActions.current === actions) contentActions.current = null; };
  }, []);
  const addText = useCallback(id => contentActions.current?.addText(id), []);
  const addImage = useCallback(id => contentActions.current?.addImage(id), []);
  const editingCellId = useSyncExternalStore(store?.subscribe || noSubscription, store?.getEditingCell || noEditingCell, noEditingCell);
  const slidePositions = useSyncExternalStore(store?.subscribe || noSubscription, store?.getSlidePositions || noSlides, noSlides);
  const nativeCells = store?.getCells?.() || NO_CELLS, transforms = useWorkbenchView()?.transforms;
  const innerLines = visibleCompositionInnerLines(store?.getComposition?.()?.innerLines);
  const [linePreview, setLinePreview] = useState(null), generation = store?.getGeneration();
  const [cellGrainPreview, setCellGrainPreview] = useState(null);
  const previewCellGrain = useCallback((id, grain) => setCellGrainPreview(current => grain == null
    ? current?.id === id && current.store === store ? null : current
    : { store, generation, id, grain }), [store, generation]);
  const paintedCellGrain = cellGrainPreview?.store === store && cellGrainPreview?.generation === generation ? cellGrainPreview : null;
  const [appearancePreview, setAppearancePreview] = useState(null);
  const previewAppearance = useCallback(patch => setAppearancePreview(patch ? { store, generation, patch } : null), [store, generation]);
  const paintedAppearance = appearancePreview && appearancePreview.store === store && appearancePreview.generation === generation ? appearancePreview.patch : null;
  const previewInnerLines = useCallback(patch => setLinePreview(patch ? { store, generation, patch } : null), [store, generation]);
  const changeInnerLines = useCallback(patch => {
    if (!innerLines) throw new Error('Enable inner lines in Bento settings.');
    store.editBento('settings', [{ innerLines: { ...innerLines, ...patch } }], generation);
  }, [store, generation, innerLines]);
  const paintedInnerLines = useMemo(() => innerLines && linePreview && linePreview.store === store && linePreview.generation === generation
    ? { ...innerLines, ...linePreview.patch } : innerLines, [store, generation, linePreview, innerLines]);
  const cells = useMemo(() => nativeCells.map(cell => transforms?.[cell.id]?.cellRadius === undefined ? cell
    : { ...cell, radius: transforms[cell.id].cellRadius }), [nativeCells, transforms]);
  const { setSelection, selectArtwork, selectLayers } = selection;
  const moveLayers = useCallback((ids, target, generation, presentation, { placement, offsets } = {}) => {
    store.editBento('moveMembers', [ids, target, placement, offsets], generation, presentation);
    store.setEditingCell(target);
    selectLayers(ids);
  }, [store, selectLayers]);
  const enterCell = useCallback(id => {
    if (store?.setEditingCell?.(id)) setSelection([]);
  }, [store, setSelection]);
  const leaveCell = useCallback((select = true) => {
    store?.setEditingCell?.(null);
    if (select && editingCellId) selectArtwork(editingCellId);
  }, [store, selectArtwork, editingCellId]);
  const openSettings = useCallback(id => {
    if (cells.some(cell => cell.id === id)) selection.selectArtwork(id);
    setBentoOpen(true);
  }, [cells, selection]);
  useEffect(() => () => store?.setEditingCell?.(null), [store]);
  const value = useMemo(() => store?.getCells ? { cells, slidePositions, editingCellId, enterCell, leaveCell, moveLayers, openSettings,
    bentoOpen, setBentoOpen, store, innerLines, paintedInnerLines, previewInnerLines, changeInnerLines, paintedAppearance, previewAppearance, paintedCellGrain, previewCellGrain, registerContentActions, addText, addImage } : null,
  [store, cells, slidePositions, editingCellId, enterCell, leaveCell, moveLayers, openSettings, bentoOpen, innerLines, paintedInnerLines, previewInnerLines, changeInnerLines, paintedAppearance, previewAppearance, paintedCellGrain, previewCellGrain, registerContentActions, addText, addImage]);
  const layout = useMemo(() => store?.getCells ? { cells, editingCellId, enterCell, leaveCell } : null,
    [store, cells, editingCellId, enterCell, leaveCell]);
  return <EditorCellsContext.Provider value={value}><EditorCellLayoutContext.Provider value={layout}>
    {children}
  </EditorCellLayoutContext.Provider></EditorCellsContext.Provider>;
}
export function EditorCellEditingNotice() {
  const context = useEditorCells();
  if (!context?.editingCellId) return null;
  const name = context.store.getComposition().shapes.find(item => item.id === context.editingCellId)?.name || 'Cell';
  return <div className="editor-cell-editing" data-workbench-selection-tools role="status">
    <span>Editing contents · {name}</span>
    <button className="workflow-tactile-control" type="button" onClick={() => context.leaveCell()}>Back to cells</button>
  </div>;
}
export function EditorCellTools({ record, view, run }) {
  const context = useEditorCells();
  if (!context || record.kind) return null;
  const { store, cells } = context;
  return <button type="button" className="workflow-tactile-control"
    disabled={cells.some(item => item.members.includes(record.id)) || cells.length >= COMPOSITION_CELL_LIMIT}
    onClick={() => run(() => store.turnShapeIntoCell(record.id, view.getPresentation()), 'shape')}>Turn into cell</button>;
}
