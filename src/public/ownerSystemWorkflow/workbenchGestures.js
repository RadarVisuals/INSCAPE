// @ts-check
// Owns only a Workbench editing gesture and its temporary preview. Geometry,
// module authoring and storage remain behind the explicit actions passed in.
/** @typedef {import('../../contracts/workbench.js').WorkbenchTransforms} WorkbenchTransforms */
/**
 * @template Selection
 * @typedef {{beforeTransforms?: WorkbenchTransforms, beforeSelection?: Selection,
 * valid(): boolean, preview(pointer: PointerEvent): void, commit(pointer: PointerEvent): boolean}} GestureOperation
 */
/**
 * @template Selection
 * @typedef {GestureOperation<Selection> & {host: HTMLElement, pointerId: number,
 * move(pointer: PointerEvent): void, finish(pointer: PointerEvent): void,
 * pointerCancel(pointer: PointerEvent): void, lost(pointer: PointerEvent): void,
 * cancel(): void, hidden(): void, escape(key: KeyboardEvent): void}} ActiveGesture
 */
/**
 * @template Selection
 * @param {import('../../contracts/workbench.js').WorkbenchGestureInput<Selection>} input
 * @returns {import('../../contracts/workbench.js').WorkbenchGestures<Selection>}
 */
export function createWorkbenchGestures({
  getHost, restoreTransforms, replaceSelection, restoreSelection, previewMarquee, finishSnap, cancelDrop,
  events = globalThis, visibility = globalThis.document,
}) {
  /** @type {ActiveGesture<Selection> | null} */ let active = null;
  /** @param {ActiveGesture<Selection>} current */
  const detach = current => {
    if (active !== current) return false;
    active = null;
    events.removeEventListener('pointermove', current.move, true);
    events.removeEventListener('pointerup', current.finish, true);
    events.removeEventListener('pointercancel', current.pointerCancel, true);
    events.removeEventListener('keydown', current.escape, true);
    events.removeEventListener('blur', current.cancel);
    visibility.removeEventListener('visibilitychange', current.hidden);
    current.host.removeEventListener('lostpointercapture', current.lost);
    if (current.host.hasPointerCapture(current.pointerId)) current.host.releasePointerCapture(current.pointerId);
    return true;
  };
  /** @param {ActiveGesture<Selection>} current */
  const restore = current => {
    if (current.beforeTransforms) restoreTransforms(current.beforeTransforms);
    if (current.beforeSelection) restoreSelection(current.beforeSelection);
  };
  const clean = () => { finishSnap(); cancelDrop(); previewMarquee(null); };
  const cancel = (rollback = true) => {
    const current = active;
    if (!current || !detach(current)) return;
    try { if (rollback) restore(current); } finally { clean(); }
  };
  /**
   * @param {import('../../contracts/workbench.js').GestureStartEvent} event
   * @param {GestureOperation<Selection>} operation
   */
  const start = (event, operation) => {
    if (event.button !== 0 || active) return false;
    const host = getHost();
    if (!host) return false;
    // All callbacks are assigned synchronously below, before active ownership
    // or listener registration exposes this completed gesture object.
    const current = /** @type {ActiveGesture<Selection>} */ ({ ...operation, host, pointerId: event.pointerId });
    /** @param {Pick<PointerEvent, 'pointerId'>} pointer */
    const owns = pointer => active === current && pointer.pointerId === current.pointerId;
    current.move = pointer => {
      if (!owns(pointer)) return;
      if (!(pointer.buttons & 1) || !operation.valid()) { cancel(); return; }
      pointer.preventDefault(); pointer.stopPropagation();
      try { operation.preview(pointer); } catch (error) { cancel(); throw error; }
    };
    current.finish = pointer => {
      if (!owns(pointer)) return;
      if (!operation.valid()) { cancel(); return; }
      // Retire capture and callbacks before authoring. A reentrant or late
      // pointer-up cannot commit the same gesture for a second time.
      detach(current);
      try {
        if (operation.commit(pointer) === false) restore(current);
      } catch (error) { restore(current); throw error; }
      finally { clean(); }
    };
    current.cancel = () => { if (active === current) cancel(); };
    current.pointerCancel = pointer => { if (owns(pointer)) cancel(); };
    current.lost = pointer => { if (owns(pointer)) cancel(); };
    current.hidden = () => { if (visibility.hidden && active === current) cancel(); };
    current.escape = key => {
      if (key.key !== 'Escape' || active !== current) return;
      key.preventDefault(); key.stopPropagation(); cancel();
      host.focus({ preventScroll: true });
    };
    active = current;
    events.addEventListener('pointermove', current.move, true);
    events.addEventListener('pointerup', current.finish, true);
    events.addEventListener('pointercancel', current.pointerCancel, true);
    events.addEventListener('keydown', current.escape, true);
    events.addEventListener('blur', current.cancel);
    visibility.addEventListener('visibilitychange', current.hidden);
    host.addEventListener('lostpointercapture', current.lost);
    try { host.setPointerCapture(current.pointerId); }
    catch { cancel(); return false; }
    return true;
  };
  return {
    isActive: () => Boolean(active),
    ownsPointer: pointerId => active?.pointerId === pointerId,
    cancel,
    releaseAbandoned: () => {
      if (!active || active.host.hasPointerCapture(active.pointerId)) return null;
      const pointerId = active.pointerId; cancel(); return pointerId;
    },
    beginMove(event, { nodes, beforeTransforms, preview, commit, previewDrop, commitDrop, valid = () => true }) {
      const origin = { x: event.clientX, y: event.clientY };
      /** @type {WorkbenchTransforms | null} */ let moved = null;
      return start(event, {
        beforeTransforms, valid: () => nodes.every(node => node.isConnected) && valid(),
        preview: pointer => {
          moved = preview({ x: pointer.clientX - origin.x, y: pointer.clientY - origin.y }, pointer.altKey);
          previewDrop(pointer);
        },
        commit: pointer => {
          if (!moved) return true;
          if (commitDrop(pointer)) { restoreTransforms(beforeTransforms); return true; }
          return commit(moved);
        },
      });
    },
    beginResize(event, { beforeTransforms, valid, preview, commit }) {
      const origin = { x: event.clientX, y: event.clientY };
      return start(event, { beforeTransforms, valid, commit,
        preview: pointer => preview({ x: pointer.clientX - origin.x, y: pointer.clientY - origin.y }, pointer.altKey),
      });
    },
    beginMarquee(event, { beforeSelection, previousSelection, hits }) {
      const origin = { x: event.clientX, y: event.clientY };
      const started = start(event, { beforeSelection, valid: () => true,
        preview: pointer => {
          const rectangle = { left: Math.min(origin.x, pointer.clientX), top: Math.min(origin.y, pointer.clientY),
            width: Math.abs(pointer.clientX - origin.x), height: Math.abs(pointer.clientY - origin.y) };
          previewMarquee(rectangle);
          replaceSelection([...new Set([...previousSelection, ...hits(rectangle)])]);
        }, commit: () => true,
      });
      if (started) replaceSelection(previousSelection);
      return started;
    },
  };
}
