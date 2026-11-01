import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { artworkRecords } from '../systemWorkflow/domain/artworkLayers.js';
import { editorCellWindow } from './editorCellGeometry.js';
import './editorCells.css';

const EditorCellsContext = createContext(null);
const NO_CELLS = Object.freeze([]);
export const useEditorCells = () => useContext(EditorCellsContext);
export function isEditorCellSurface(target, context) {
  const cell = context?.cells.find(item => item.id === context.editingCellId);
  const id = target?.closest?.('[data-workbench-view-id]')?.dataset.workbenchViewId;
  return Boolean(cell && (cell.id === id || cell.members.includes(id)));
}

export function EditorCellsProvider({ store, content, selection, onOpenSharedTool, children }) {
  const [editingId, setEditingId] = useState(null);
  const menus = useRef(new Map());
  const registerMenu = useCallback((id, open) => { menus.current.set(id, open); return () => menus.current.delete(id); }, []);
  const openMenu = useCallback((id, anchor) => menus.current.get(id)?.(anchor), []);
  const cells = store?.getCells?.() || NO_CELLS;
  const groups = store?.getCellGroups?.() || NO_CELLS;
  const editingCellId = cells.some(cell => cell.id === editingId) ? editingId : null;
  const live = useRef(null); live.current = { store, cells, selection, onOpenSharedTool };
  const enterCell = useCallback(id => {
    if (!live.current.cells.some(cell => cell.id === id)) return;
    setEditingId(id);
    live.current.store.setEditingCell?.(id);
    live.current.selection.setSelection([]);
  }, []);
  const leaveCell = useCallback((select = true) => {
    setEditingId(null);
    live.current.store?.setEditingCell?.(null);
    if (select && editingCellId) live.current.selection.selectArtwork(editingCellId);
  }, [editingCellId]);
  const openSettings = useCallback(id => {
    if (!live.current.cells.some(cell => cell.id === id)) return;
    live.current.selection.selectArtwork(id);
    live.current.onOpenSharedTool?.('Shape');
  }, []);
  useEffect(() => { if (editingId && !editingCellId) store?.setEditingCell?.(null); }, [editingId, editingCellId, store]);
  useEffect(() => () => store?.setEditingCell?.(null), [store]);
  const value = useMemo(() => store?.getCells ? { cells, groups, editingCellId, enterCell, leaveCell, openSettings, store, content, registerMenu, openMenu } : null,
    [store, cells, groups, content, editingCellId, enterCell, leaveCell, openSettings, registerMenu, openMenu]);
  return <EditorCellsContext.Provider value={value}>{children}</EditorCellsContext.Provider>;
}

export function EditorCellEditingNotice() {
  const context = useEditorCells();
  if (!context?.editingCellId) return null;
  const name = context.content.shapes?.find(item => item.id === context.editingCellId)?.name || 'Cell';
  return <div className="editor-cell-editing" data-workbench-selection-tools role="status">
    <span>Editing contents · {name}</span>
    <button className="workflow-tactile-control" type="button" onClick={() => context.leaveCell()}>Back to cells</button>
  </div>;
}

export function EditorCellTools({ record, view, run }) {
  const context = useEditorCells();
  const [chosen, setChosen] = useState([]);
  if (!context || record.kind) return null;
  const { store, cells } = context, cell = cells.find(item => item.id === record.id);
  const parent = cells.find(item => item.members.includes(record.id));
  const group = context.groups.find(item => item.members.includes(record.id));
  if (!cell) return <button type="button" className="workflow-tactile-control" disabled={Boolean(parent) || cells.length >= 8}
    onClick={() => run(() => store.turnShapeIntoCell(record.id, view.getPresentation()), 'shape')}>Turn into cell</button>;
  const available = artworkRecords(context.content).filter(item => item.id !== record.id && !cells.some(value => value.id === item.id)
    && !cells.some(value => value.id !== cell.id && value.members.includes(item.id)) && !item.record.kind);
  const selected = [cell.id, ...chosen.filter(id => id !== cell.id && cells.some(item => item.id === id))];
  const name = id => context.content.shapes.find(item => item.id === id)?.name || 'Cell';
  const gap = group && group[group.axis === 'row' ? 'gapX' : 'gapY'];
  const layout = view.getPresentation(), horizontal = group?.axis === 'row';
  const frame = group && editorCellWindow(layout, group.members[0]);
  const span = group?.members.reduce((sum, id) => sum + (editorCellWindow(layout, id)?.[horizontal ? 'width' : 'height'] || 0), 0);
  const maxGap = frame ? Math.max(gap, Math.floor(((layout.area?.[horizontal ? 'left' : 'top'] || 0) + (layout.area?.[horizontal ? 'width' : 'height'] || 1440)
    - frame[horizontal ? 'left' : 'top'] - span) / (group.members.length - 1))) : 0;
  return <fieldset className="editor-cell-tools"><legend>Cell</legend>
    <button type="button" className="workflow-tactile-control" onClick={() => context.enterCell(cell.id)}>Edit contents</button>
    <p>Choose which layers belong to this cell. Double-click the cell to move its contents individually.</p>
    {!available.length && <p>Add an Image, Text or Shape in the Editor, then place it in this cell.</p>}
    {available.map(item => <div key={item.id} className="editor-cell-member">
      <label className="shape-check"><input type="checkbox" aria-label={`Include ${item.name} in cell`} checked={cell.members.includes(item.id)}
        disabled={cell.lockedMembers?.includes(item.id)} onChange={event => run(() => event.target.checked
          ? store.putInCell(cell.id, [item.id], view.getPresentation())
          : store.removeFromCell([item.id], view.getPresentation()), 'shape')} />{item.name}</label>
      {cell.members.includes(item.id) && <label className="shape-check"><input type="checkbox" aria-label={`Lock ${item.name} in cell`}
        checked={Boolean(cell.lockedMembers?.includes(item.id))}
        onChange={event => run(() => store.setCellLayerLocked(cell.id, item.id, event.target.checked), 'shape')} />Lock</label>}
    </div>)}
    {cells.length > 1 && <fieldset className="editor-cell-tools"><legend>Couple cells</legend>
      {cells.filter(item => item.id !== cell.id).map(item => <label key={item.id} className="shape-check">
        <input type="checkbox" aria-label={`Couple with ${name(item.id)}`} checked={chosen.includes(item.id)}
          onChange={event => setChosen(values => event.target.checked ? [...values, item.id] : values.filter(id => id !== item.id))} />{name(item.id)}
      </label>)}
      <button type="button" className="workflow-tactile-control" disabled={selected.length < 2}
        onClick={() => run(() => store.coupleCells(selected, 'row', view.getPresentation()), 'shape')}>Couple as row</button>
      <button type="button" className="workflow-tactile-control" disabled={selected.length < 2}
        onClick={() => run(() => store.coupleCells(selected, 'column', view.getPresentation()), 'shape')}>Couple as column</button>
      {group && <>
        <label>{horizontal ? 'Horizontal spacing' : 'Vertical spacing'}<input key={`${group.id}:${gap}`} type="range"
          aria-label={horizontal ? 'Horizontal cell spacing' : 'Vertical cell spacing'} min="0" max={maxGap} step="1" defaultValue={gap}
          onPointerUp={event => run(() => store.setCellGroupGap(group.id, Number(event.currentTarget.value), view.getPresentation()), 'shape')}
          onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) run(() => store.setCellGroupGap(group.id, Number(event.currentTarget.value), view.getPresentation()), 'shape'); }} /></label>
        <button type="button" className="workflow-tactile-control" onClick={() => run(() => store.unlinkCells(group.id, view.getPresentation()), 'shape')}>Unlink cells</button>
      </>}
    </fieldset>}
  </fieldset>;
}
