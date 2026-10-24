// @ts-check
import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { identityWorkbenchTransform } from './workbenchViewScale.js';

/** @typedef {import('../../contracts/workbench.js').MountedWorkbenchViewValue['toolSources']} LiveTools */
/** @typedef {() => void} Notify */

// Shared window contract. Importing a window or its geometry must not load
// the host's selection controls, group tools or placement implementation.
/** @type {import('react').Context<import('../../contracts/workbench.js').WorkbenchViewValue>} */
export const WorkbenchView = createContext({ scale: 1, transforms: {}, entries: new Map() });
/** @type {import('react').Context<import('../../contracts/workbench.js').WorkbenchActionsValue>} */
export const WorkbenchActions = createContext({});
export const useWorkbenchView = () => useContext(WorkbenchView);
export const useWorkbenchActions = () => useContext(WorkbenchActions);

/** @param {import('../../contracts/workbench.js').ModuleId} id @param {() => void} open */
export function useArtworkOpener(id, open) {
  const { registerArtworkOpener } = useWorkbenchActions();
  const current = useRef(open); current.current = open;
  useLayoutEffect(() => registerArtworkOpener?.(id, current), [id, registerArtworkOpener]);
}

// Module-owned controls, routed by the existing Workbench selection. The registry
// holds live references only; content and persistence never move into this host.
/** @param {import('../../contracts/workbench.js').ModuleId} id @param {import('../../contracts/workbench.js').ToolSource} source */
export function useWorkbenchToolSource(id, source) {
  const { toolSources, toolsChanged: changed, store } = useWorkbenchView();
  const current = useRef(source); current.current = source;
  const shared = Boolean(store && toolSources);
  useLayoutEffect(() => {
    if (!shared) return;
    // Boolean's result does not narrow the destructured union for TypeScript.
    // shared proves the registry exists; the mounted-provider contract pairs
    // that registry with toolsChanged (WorkbenchView.jsx is its sole producer).
    /** @type {LiveTools} */ (toolSources).set(id, current); /** @type {Notify} */ (changed)();
    return () => { if (/** @type {LiveTools} */ (toolSources).get(id) === current) { /** @type {LiveTools} */ (toolSources).delete(id); /** @type {Notify} */ (changed)(); } };
  }, [shared, id, toolSources, changed]);
  useLayoutEffect(() => { if (shared) /** @type {Notify} */ (changed)(); }, [shared, source, changed]);
  return shared;
}

// Closed artwork has no mounted window registration to consume geometry from
// a block move or Undo. Its module-owned presentation must follow those saves.
/**
 * @template {{open: boolean}} Presentation
 * @param {Presentation} presentation
 * @param {import('react').Dispatch<import('react').SetStateAction<Presentation>>} setPresentation
 * @param {Partial<Presentation> | null | undefined} saved
 */
export function useClosedArtworkLayout(presentation, setPresentation, saved) {
  const key = JSON.stringify(saved), previous = useRef(key);
  useLayoutEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    if (saved && !presentation.open) setPresentation(current => ({ ...current, ...saved, open: current.open }));
  }, [key, presentation.open, setPresentation]);
}

// Modules retain inspection state and media readiness. The Workbench only routes
// the shortcut to a mounted module; callback refs follow its current content.
/** @param {import('../../contracts/workbench.js').ModuleId} id @param {(source?: HTMLElement) => boolean | void} inspect */
export function useWorkbenchInspectionAction(id, inspect) {
  const { registerInspection } = useWorkbenchActions();
  const current = useRef(inspect); current.current = inspect;
  useLayoutEffect(() => registerInspection?.(id, current), [id, registerInspection]);
}

/** @param {import('../../contracts/workbench.js').WorkbenchViewValue} view @param {import('../../contracts/workbench.js').WindowId} id */
export function workbenchModuleTransform(view, id) {
  /** @type {import('../../contracts/workbench.js').ViewTransform} */
  const local = view.presentationTransforms?.[id] || view.transforms[id] || identityWorkbenchTransform;
  return { scale: view.scale * local.scale, x: view.scale * local.x, y: view.scale * local.y, frame: local.frame, presented: Boolean(view.presentationTransforms?.[id]) };
}

/**
 * @param {import('../../contracts/workbench.js').WindowId | undefined} id
 * @param {import('react').RefObject<HTMLElement>} node
 * @param {boolean} enabled
 * @param {import('../../contracts/workbench.js').Frame | null} frame
 * @param {import('../../contracts/workbench.js').ResizeTarget | null} resizeTarget
 * @param {((position: import('../../contracts/workbench.js').Position) => void) | null} onPosition
 */
export function useWorkbenchViewRegistration(id, node, enabled, frame, resizeTarget = null, onPosition = null) {
  const { register, changed, frames, resizeTargets, transforms } = useWorkbenchView();
  // Missing IDs are permitted for unregistered windows; these are read-only
  // lookups and JavaScript's missing-key result is undefined.
  const previewFrame = transforms?.[/** @type {import('../../contracts/workbench.js').WindowId} */ (id)]?.frame;
  // A live reference to module-owned geometry, not a copy of painted DOM bounds.
  /** @type {import('react').MutableRefObject<import('../../contracts/workbench.js').Frame | null> & {move?: ((position: import('../../contracts/workbench.js').Position) => void) | null}} */
  const currentFrame = useRef(frame); currentFrame.current = frame;
  // The window owns its base position. Completed owner movement reports back
  // through that same boundary as an individual drag, including local saving.
  currentFrame.move = onPosition;
  const currentResize = useRef(resizeTarget); currentResize.current = resizeTarget;
  const savedLayout = resizeTarget?.store?.getSnapshot().workbench;
  /** @type {{window?: import('../../contracts/workbench.js').Frame | import('../../contracts/workbench.js').Position, position?: import('../../contracts/workbench.js').Position} | undefined} */
  const savedEntry = resizeTarget?.parentTextId ? savedLayout?.texts?.find(item => item.id === resizeTarget.parentTextId)?.frames?.find(item => item.id === id)
    : resizeTarget?.layoutKey === 'display' ? savedLayout?.display
    : savedLayout?.[/** @type {Exclude<import('../../contracts/workbench.js').ResizeTarget['layoutKey'], 'display' | undefined>} */ (resizeTarget?.layoutKey)]?.find(item => item.id === id);
  const savedFrame = savedEntry?.window || savedEntry?.position;
  const savedKey = JSON.stringify(savedFrame ?? null);
  // Remember the local frame for an older draft without a saved entry. Undoing
  // the first authored resize can then restore it without migrating that draft.
  /** @type {import('react').MutableRefObject<Map<string, import('../../contracts/workbench.js').Position | import('../../contracts/workbench.js').Frame>>} */
  const savedFrames = useRef(new Map()), previousSavedKey = useRef(savedKey);
  useLayoutEffect(() => {
    if (!frame || !resizeTarget || previewFrame) return;
    if (previousSavedKey.current !== savedKey) {
      const restored = savedFrames.current.get(savedKey) || savedFrame;
      if (restored) resizeTarget.applyFrame(restored);
      previousSavedKey.current = savedKey;
    } else {
      savedFrames.current.set(savedKey, frame);
      // Match the draft history's bounded lifetime; this is only undo recovery
      // for local frames, never an alternative persisted layout.
      while (savedFrames.current.size > 51) savedFrames.current.delete(/** @type {string} */ (savedFrames.current.keys().next().value));
    }
  }, [savedKey, frame?.left, frame?.top, frame?.width, frame?.height, resizeTarget, previewFrame]);
  useLayoutEffect(() => {
    if (!id || !enabled || !node.current || !register) return;
    register(id, node.current);
    // register is supplied together with these maps by the live provider.
    frames.set(id, currentFrame);
    resizeTargets.set(id, currentResize);
    return () => { frames.delete(id); resizeTargets.delete(id); register(id, null); };
  }, [id, node, enabled, register, changed, frames, resizeTargets]);
  useLayoutEffect(() => { if (id && enabled) changed?.(); }, [id, enabled, frame?.left, frame?.top, frame?.width, frame?.height, changed]);
}
