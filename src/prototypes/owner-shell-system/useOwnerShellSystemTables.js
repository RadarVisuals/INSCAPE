import { useState } from 'react';
import {
  createOwnerShellSystemTable,
  moveOwnerShellSystemTable,
  placeOwnerShellSystemTable,
  removeOwnerShellSystemTable,
  updateOwnerShellSystemTable,
} from './ownerShellSystemTables.js';

export default function useOwnerShellSystemTables({ actionRefs, initialTables, onVisit, setPlacements }) {
  const [tables, setTables] = useState(() => initialTables.map((table) => ({ ...table })));
  const [activeTableId, setActiveTableId] = useState(initialTables[0]?.id || null);
  const [actionId, setActionId] = useState(null);
  const [rename, setRename] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const activeTable = tables.find(({ id }) => id === activeTableId) || tables[0] || null;

  const visitTable = (tableId) => {
    if (!tables.some(({ id }) => id === tableId)) return;
    setActiveTableId(tableId);
    onVisit(tableId);
  };
  const addTable = () => {
    const table = createOwnerShellSystemTable(tables, Date.now());
    setTables((current) => [...current, table]);
    setActiveTableId(table.id);
    onVisit(table.id);
  };
  const updateActiveTable = (patch) => {
    setTables((current) => updateOwnerShellSystemTable(current, activeTableId, patch));
  };
  const beginRename = (table, keyboardFocus = false) => {
    setActionId(null);
    setDeleteId(null);
    setRename({ id: table.id, keyboardFocus, name: table.name });
  };
  const finishRename = (save = true) => {
    if (!rename) return;
    const name = rename.name.trim().toUpperCase();
    if (save && name) setTables((current) => updateOwnerShellSystemTable(current, rename.id, { name }));
    const id = rename.id;
    setRename(null);
    requestAnimationFrame(() => actionRefs.current.get(id)?.focus());
  };
  const removeTable = (tableId) => {
    const result = removeOwnerShellSystemTable(tables, activeTableId, tableId);
    if (!result.removed) return;
    setTables(result.tables);
    setPlacements((current) => current.filter(({ tableId: placementTableId }) => placementTableId !== tableId));
    setDeleteId(null);
    setActionId(null);
    if (result.activeTableId !== activeTableId) {
      setActiveTableId(result.activeTableId);
      onVisit(result.activeTableId);
    }
    requestAnimationFrame(() => actionRefs.current.get(result.focusTableId)?.focus());
  };
  const cancelTransientAction = () => {
    if (rename) { finishRename(false); return true; }
    if (deleteId) { setDeleteId(null); return true; }
    if (actionId) { setActionId(null); return true; }
    return false;
  };
  const changeActionId = (id) => { setDeleteId(null); setActionId(id); };
  const cancelDelete = (id) => {
    setDeleteId(null);
    actionRefs.current.get(id)?.focus();
  };
  const requestDelete = (id) => { setActionId(null); setDeleteId(id); };
  const reorderTable = (tableId, targetId, edge) => {
    setTables((current) => placeOwnerShellSystemTable(current, tableId, targetId, edge));
  };
  const reorderTableByOffset = (tableId, offset) => {
    setTables((current) => {
      const sourceIndex = current.findIndex(({ id }) => id === tableId);
      return moveOwnerShellSystemTable(current, tableId, sourceIndex + offset);
    });
  };

  return {
    actionId, activeTable, activeTableId, addTable, beginRename, cancelDelete, cancelTransientAction,
    changeActionId, deleteId, finishRename, removeTable, rename, reorderTable, reorderTableByOffset, requestDelete,
    setRenameName: (name) => setRename((current) => ({ ...current, name })),
    tables, updateActiveTable, visitTable,
  };
}
