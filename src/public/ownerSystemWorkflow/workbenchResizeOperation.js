// @ts-check
import {
  identityWorkbenchTransform, proportionalCornerResize, scaleWorkbenchTransform, stepWorkbenchViewScale,
} from './workbenchViewScale.js';
/** @typedef {import('../../contracts/workbench.js').Frame} Frame */
/** @typedef {import('../../contracts/workbench.js').Vector} Vector */
/** @typedef {import('../../contracts/workbench.js').AuthoredResizeTarget} AuthoredResizeTarget */
/** @typedef {AuthoredResizeTarget & {resizeCorner: NonNullable<AuthoredResizeTarget['resizeCorner']>}} CornerResizeTarget */
/** @typedef {{commit(): boolean} & (
 * {applyDelta(delta: Vector, bypass: boolean): void, step: number, apply?: never} |
 * {apply(requested: number, bypass: boolean): void, applyDelta?: never, step?: never}
 * )} ResizeAction */

// The host projects a selection; each target supplies its limits, preparation
// and existing atomic commit. This operation never interprets module content.
/**
 * @param {import('../../contracts/workbench.js').ResizeOperationInput} input
 * @returns {import('../../contracts/workbench.js').WorkbenchResizeOperation | null}
 */
export function createWorkbenchResizeOperation({
  origin, ids, registry, geometry, transforms, corner, setTransforms,
}) {
  // The immediately following guard checks each mapped node. Array-wide checks
  // do not retain element refinements through the captured callbacks below.
  const nodes = /** @type {HTMLElement[]} */ (ids.map(id => registry.entries.get(id)));
  if (!nodes.length || nodes.some(node => !node?.isConnected)) return null;
  const rectangle = geometry.rectangle(nodes);
  if (!rectangle?.width || !rectangle?.height) return null;
  const anchor = {
    x: corner.includes('w') ? rectangle.left + rectangle.width : rectangle.left,
    y: corner.includes('n') ? rectangle.top + rectangle.height : rectangle.top,
  };
  const vector = { x: (corner.includes('w') ? -1 : 1) * rectangle.width,
    y: (corner.includes('n') ? -1 : 1) * rectangle.height };
  const scales = ids.map(geometry.moduleScale);
  const registrations = ids.map(id => registry.resizeTargets.get(id));
  const editors = registrations.map(registration => registration?.current);
  const owner = origin.kind === 'owner';
  const authored = owner && editors.every(editor => editor?.enabled
    && editor.commit === editors[0]?.commit && editor.store === origin.store
    && editor.profileAddress === origin.profileAddress);
  // Owner authoring cannot fall back to an unsaved visitor transformation.
  if (owner && !authored) return null;
  const valid = () => origin.isCurrent()
    && (!owner || origin.store.hasWriteAccess() && origin.store.getProfileAddress() === origin.profileAddress)
    && ids.every((id, index) => registry.entries.get(id) === nodes[index] && nodes[index].isConnected
      && registry.resizeTargets.get(id) === registrations[index]
      && (!authored || registrations[index]?.current === editors[index]));
  const originals = /** @type {Frame[]} */ (nodes.map(node => geometry.rectangle([node])));
  if (originals.some(frame => !frame)) return null;
  const maximumScale = Math.max(...scales);
  const offset = geometry.cameraOffset;
  /**
   * @param {import('../../contracts/workbench.js').SelectionResizeChange[]} changes
   * @param {() => void} applyFrames
   */
  const commitFrames = (changes, applyFrames) => {
    if (!/** @type {AuthoredResizeTarget} */ (editors[0]).commit(changes)) return false;
    applyFrames();
    setTransforms(values => { const next = { ...values }; ids.forEach(id => { delete next[id]; }); return next; });
    return true;
  };
  /** @type {ResizeAction} */ let resize;
  // authored proves every captured target's presence, enabled state and writer
  // identity. The refinements below apply only behind that existing guard.
  if (authored && ids.length === 1 && /** @type {AuthoredResizeTarget} */ (editors[0]).resizeCorner) {
    const editor = /** @type {CornerResizeTarget} */ (editors[0]), id = ids[0];
    const original = { left: (rectangle.left - offset.x) / geometry.scale,
      top: (rectangle.top - offset.y) / geometry.scale,
      width: rectangle.width / geometry.scale, height: rectangle.height / geometry.scale };
    /** @type {Frame | null} */ let next = null;
    resize = {
      step: editor.resizeStep ?? 1,
      applyDelta(delta, bypass) {
        next = editor.resizeCorner(original, corner,
          { x: delta.x / geometry.scale, y: delta.y / geometry.scale }, bypass);
        setTransforms({ ...transforms, [id]: { ...identityWorkbenchTransform, frame: next } });
      },
      commit() {
        if (!next) return true;
        return commitFrames([{ ...editor, id, getPresentation: origin.getPresentation, ...next }],
          () => editor.applyFrame(/** @type {Frame} */ (next)));
      },
    };
  } else {
    const limits = geometry.bounds();
    const availableX = corner.includes('w') ? anchor.x - limits.left : limits.right - anchor.x;
    const availableY = corner.includes('n') ? anchor.y - limits.top : limits.bottom - anchor.y;
    // A camera change must not make an already larger/smaller selection jump.
    const upper = authored ? Math.min(.../** @type {AuthoredResizeTarget[]} */ (editors).flatMap((editor, i) => [
      (editor.maximumWidth * geometry.scale) / originals[i].width,
      (editor.maximumHeight * geometry.scale) / originals[i].height,
      (editor.maximumScale ?? Infinity) / (transforms[ids[i]]?.scale || 1),
    ])) : Math.max(1, 1 / Math.max(...scales));
    const lower = authored ? Math.max(.../** @type {AuthoredResizeTarget[]} */ (editors).flatMap((editor, i) => [
      // The target contract requires either both dimension minima or minimumSize.
      (/** @type {number} */ (editor.minimumWidth ?? editor.minimumSize) * geometry.scale) / originals[i].width,
      (/** @type {number} */ (editor.minimumHeight ?? editor.minimumSize) * geometry.scale) / originals[i].height,
      (editor.minimumScale ?? 0) / (transforms[ids[i]]?.scale || 1),
    ])) : Math.min(1, 0.25 / Math.min(...scales));
    const groupLimits = ids.length > 1 ? editors.flatMap(editor => editor?.groupScaleLimits ? [editor.groupScaleLimits] : []) : [];
    const maximum = Math.max(0, Math.min(upper, availableX / rectangle.width, availableY / rectangle.height,
      ...groupLimits.map(limit => limit.maximum)));
    const minimum = Math.min(maximum, Math.max(lower, ...groupLimits.map(limit => limit.minimum)));
    const worldAnchor = { x: (anchor.x - offset.x) / geometry.scale, y: (anchor.y - offset.y) / geometry.scale };
    // Preview and commit share exact endpoints. Only whole-pixel modules round;
    // Text reflow and Display retain their continuous common edge.
    /** @param {Frame} frame @param {number} factor @param {boolean} continuous */
    const resizedFrame = (frame, factor, continuous = false) => {
      /** @param {number} value */
      const round = value => continuous ? value : Math.round(Math.round(value * 1e7) / 1e7);
      /** @param {number} value @param {'x' | 'y'} axis */
      const edge = (value, axis) => worldAnchor[axis]
        + round(((value - offset[axis]) / geometry.scale - worldAnchor[axis]) * factor);
      const left = edge(frame.left, 'x'), top = edge(frame.top, 'y');
      return { left, top,
        width: continuous ? (frame.width / geometry.scale) * factor : round(edge(frame.left + frame.width, 'x') - left),
        height: continuous ? (frame.height / geometry.scale) * factor : round(edge(frame.top + frame.height, 'y') - top),
      };
    };
    /** @param {Frame} frame @param {number} factor @param {number} i */
    const frameFor = (frame, factor, i) => {
      const next = resizedFrame(frame, factor, editors[i]?.continuousGeometry);
      return ids.length === 1 && editors[i]?.constrainFrame
        ? editors[i].constrainFrame(next, { edge: corner, bounds: geometry.areaBounds() }) : next;
    };
    /** @type {number | null} */ let appliedFactor = null;
    resize = {
      apply(requested, bypass) {
        const bounded = Math.max(minimum, Math.min(maximum, requested));
        const factor = geometry.snapResize(rectangle, anchor, corner, bounded, nodes, geometry.scale, minimum, maximum, bypass);
        appliedFactor = factor;
        setTransforms({ ...transforms, ...Object.fromEntries(ids.map((id, i) => editors[i]?.reflow
          ? [id, { ...identityWorkbenchTransform, gridScale: ids.length > 1 ? factor : 1, frame: frameFor(originals[i], factor, i) }]
          : [id, scaleWorkbenchTransform(transforms[id] || identityWorkbenchTransform, factor, worldAnchor)])) });
      },
      commit() {
        if (!authored || appliedFactor === null) return true;
        // The guard above also narrows the captured factor for this map callback.
        const changes = originals.map((frame, i) => ({ .../** @type {AuthoredResizeTarget} */ (editors[i]), id: ids[i],
          gridScale: ids.length > 1 ? /** @type {number} */ (appliedFactor) : undefined, getPresentation: origin.getPresentation,
          ...frameFor(frame, /** @type {number} */ (appliedFactor), i) }));
        return commitFrames(changes, () => changes.forEach(change => change.applyFrame({
          left: change.left, top: change.top, width: change.width, height: change.height,
        })));
      },
    };
  }
  return {
    ids, nodes, mode: authored ? 'authored' : 'visitor', beforeTransforms: transforms, valid,
    preview(delta, bypass = false) {
      if (!valid()) return false;
      if (resize.applyDelta) resize.applyDelta(delta, bypass);
      else resize.apply(proportionalCornerResize(vector, delta).factor, bypass);
      return true;
    },
    previewByKey(key, shift = false, bypass = false) {
      if (!valid()) return false;
      if (resize.applyDelta) {
        const step = resize.step * (shift ? 10 : 1) * geometry.scale;
        resize.applyDelta({ x: key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0,
          y: key === 'ArrowDown' ? step : key === 'ArrowUp' ? -step : 0 }, bypass);
      } else {
        const direction = ['ArrowUp', 'ArrowRight'].includes(key) ? 1 : -1;
        const nextScale = authored ? maximumScale * (1 + direction * (shift ? 0.25 : 0.1))
          : stepWorkbenchViewScale(maximumScale, direction);
        if ((direction > 0 && nextScale <= maximumScale) || (direction < 0 && nextScale >= maximumScale)) return false;
        resize.apply(nextScale / maximumScale, bypass);
      }
      return true;
    },
    commit() { return valid() && resize.commit(); },
  };
}
