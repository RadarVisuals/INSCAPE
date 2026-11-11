import { layerIds } from '../systemWorkflow/domain/artworkLayers.js';
import { receptionModuleWindow, withReceptionModuleWindow, pruneCellMembers, withReceptionMemberAnchors } from './receptionEditorDocument.js';
import { backgroundsBehindContents } from './receptionLayerOrder.js';
import { positionReceptionMembers } from './editorCellGeometry.js';

// Explicit ownership changes keep native identities, sizes and relative offsets.
// Moving to a cell centres the selection; releasing it keeps its world position.
export function moveReceptionMembers(value, ids, targetId) {
  const selected = new Set(ids), order = layerIds(value.artworkLayers);
  const target = targetId === null ? null : value.cells.find(cell => cell.id === targetId);
  if (!selected.size || selected.size !== ids.length || ids.some(id => !order.includes(id) || value.cells.some(cell => cell.id === id)))
    throw new Error('Select Image, Text or Shape layers, without cell backgrounds.');
  if (targetId !== null && !target) throw new Error('The destination cell is no longer available.');
  const owners = ids.map(id => value.cells.find(cell => cell.members.includes(id)));
  if (owners.every(owner => owner?.id === target?.id)) return value;
  const affected = new Set([...ids, ...value.cells.flatMap(cell => (cell.memberAnchors || [])
    .filter(anchor => anchor.members.some(id => selected.has(id))).flatMap(anchor => anchor.members))]);
  if (value.cells.some(cell => cell.lockedMembers?.some(id => affected.has(id))))
    throw new Error('Unlock these layers before moving them to another cell.');
  const moving = order.filter(id => selected.has(id)), remaining = new Set(order.filter(id => !selected.has(id)));
  const fitted = value.cells.flatMap(cell => cell.fitText || []).filter(id => selected.has(id));
  const cells = value.cells.map(cell => {
    // Release intersecting group anchors so the members left behind do not jump.
    const next = pruneCellMembers(withReceptionMemberAnchors(cell,
      (cell.memberAnchors || []).filter(anchor => !anchor.members.some(id => selected.has(id)))), remaining);
    return cell.id !== targetId ? next : { ...next, members: [...next.members, ...moving],
      ...(fitted.length ? { fitText: [...(next.fitText || []), ...fitted] } : {}) };
  });
  let next = { ...value, cells, artworkLayers: backgroundsBehindContents(value.artworkLayers, cells) };
  if (target) {
    const frames = Object.fromEntries(moving.map(id => [id, receptionModuleWindow(value, id)]));
    const placed = positionReceptionMembers(receptionModuleWindow(value, targetId), frames,
      { members: moving, alignX: 'center', alignY: 'center', paddingX: 0, paddingY: 0 });
    for (const [id, frame] of Object.entries(placed)) next = withReceptionModuleWindow(next, id, frame);
  }
  return next;
}
