// @ts-check
import { moveWorkbenchGroup } from '../../systemWorkflow/moveWorkbenchGroup.js';
import { workbenchMemberIds } from '../../systemWorkflow/domain/workbenchGroups.js';
import { artworkWindowIds } from '../../systemWorkflow/domain/artworkLayers.js';
import { clampWorkbenchMove, identityWorkbenchTransform } from './workbenchViewScale.js';

/** @typedef {import('../../contracts/workbench.js').WindowId} WindowId */
/** @typedef {import('../../contracts/workbench.js').WorkbenchTransforms} WorkbenchTransforms */
/** @typedef {import('../../contracts/workbench.js').Position} Position */

// One prepared selection move is shared by pointer and keyboard input. The
// gesture owns cancellation; modules still own presentation and the draft store
// still owns authored group movement. A plain window move never enters Undo.
/**
 * @param {import('../../contracts/workbench.js').MoveOperationInput} input
 * @returns {import('../../contracts/workbench.js').WorkbenchMoveOperation | null}
 */
export function createWorkbenchMoveOperation({
  origin, selection, registry, geometry, transforms, setTransforms, reportError,
}) {
  const { content, layers, selectedIds } = selection;
  const blocks = layers.flatMap(layer => typeof layer === 'string' ? []
    : [/** @type {WindowId[]} */ (artworkWindowIds(content, layer.children))]);
  const ids = [...new Set([
    ...selection.ids,
    ...blocks.flatMap(windows => windows.every(id => selectedIds.includes(id))
      && windows.some(id => selection.ids.includes(id)) ? windows : []),
  ])];
  const registrations = ids.map(id => registry.frames.get(id));
  const targets = ids.map(id => registry.entries.get(id));
  // This filter excludes missing and hidden registrations; keep that array refinement.
  const nodes = /** @type {HTMLElement[]} */ (targets.filter(node => node && !node.hasAttribute('data-editor-hidden')));
  const rectangle = geometry.rectangle(nodes);
  if (!rectangle || !nodes.length) return null;
  const owner = origin.kind === 'owner';
  const generation = owner ? origin.store.getGeneration() : null;
  const draft = owner ? origin.store.getSnapshot() : null;
  const members = draft ? workbenchMemberIds(draft, ids) : [];
  const authored = owner && (blocks.some(windows => windows.every(id => ids.includes(id)))
    || draft?.workbenchGroups?.some(group => group.memberIds.some(id => members.includes(id))));
  const mode = !owner ? 'visitor' : authored ? 'authored' : 'presentation';
  const valid = () => origin.isCurrent()
    && (!owner || origin.store.hasWriteAccess() && origin.store.getProfileAddress() === origin.profileAddress)
    && ids.every((id, index) => registry.entries.get(id) === targets[index]
      && registry.frames.get(id) === registrations[index])
    && nodes.every(node => node.isConnected);
  /** @type {WorkbenchTransforms | null} */ let moved = null;
  return {
    ids, nodes, mode, beforeTransforms: transforms, valid,
    preview(delta, bypass = false) {
      if (!valid()) return null;
      const candidate = { ...rectangle, left: rectangle.left + delta.x, top: rectangle.top + delta.y };
      const snapped = geometry.snap(candidate, nodes, geometry.scale, bypass);
      const movement = clampWorkbenchMove(rectangle, {
        x: (snapped.left ?? candidate.left) - rectangle.left,
        y: (snapped.top ?? candidate.top) - rectangle.top,
      }, geometry.bounds());
      moved = {
        ...transforms,
        ...Object.fromEntries(ids.map(id => {
          const transform = transforms[id] || identityWorkbenchTransform;
          return [id, { ...transform, x: transform.x + movement.x / geometry.scale,
            y: transform.y + movement.y / geometry.scale }];
        })),
      };
      setTransforms(moved);
      return moved;
    },
    commit() {
      if (!valid()) return false;
      if (!moved || !owner) return true;
      if (authored) {
        const presentation = origin.getPresentation();
        const changes = ids.flatMap((id, index) => {
          // commit checked the captured preview before entering these callbacks.
          const transform = /** @type {WorkbenchTransforms} */ (moved)[id];
          /** @type {{id: WindowId, position?: Position, window?: Position} | undefined} */
          const saved = /** @type {const} */ (['texts', 'imageModules', 'shapes']).flatMap(
            /** @returns {{id: WindowId, position?: Position, window?: Position}[]} */ key => presentation?.[key] || [])
            .find(item => item.id === id)
            || presentation?.texts?.flatMap(text => text.frames || []).find(frame => frame.id === id);
          const frame = registrations[index]?.current || saved?.position || saved?.window;
          if (!frame || !transform || (!transform.x && !transform.y)) return [];
          return [{ id, left: frame.left + transform.x / transform.scale,
            top: frame.top + transform.y / transform.scale }];
        });
        if (changes.length) {
          try {
            // Authored movement can only come from the owner branch that captured a generation.
            moveWorkbenchGroup(origin.store, origin.profileAddress, changes, presentation, /** @type {number} */ (generation));
            reportError('');
          } catch (error) {
            reportError(/** @type {Error} */ (error).message);
            return false;
          }
        }
      }
      const next = { ...moved };
      ids.forEach((id, index) => {
        const registration = registrations[index], transform = /** @type {WorkbenchTransforms} */ (moved)[id];
        if (!transform || (!transform.x && !transform.y)) return;
        if (!registration?.move) { delete next[id]; return; }
        // Actual mounted window callers supply a frame alongside move. The
        // registration type itself stays nullable during mounting and cleanup.
        const frame = /** @type {Position} */ (registration.current);
        // Absorb translation only; a move cannot choose a size, crop or zoom.
        registration.move({ left: frame.left + transform.x / transform.scale,
          top: frame.top + transform.y / transform.scale });
        if (transform.scale === 1) delete next[id];
        else next[id] = { ...transform, x: 0, y: 0 };
      });
      setTransforms(next);
      return true;
    },
  };
}
