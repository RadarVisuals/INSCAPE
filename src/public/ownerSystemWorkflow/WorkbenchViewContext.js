import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { identityWorkbenchTransform } from './workbenchViewScale.js';

// Shared window contract. Importing a window or its geometry must not load
// the host's selection controls, group tools or placement implementation.
export const WorkbenchView = createContext({ scale: 1, transforms: {}, entries: new Map() });
export const WorkbenchActions = createContext({});
export const useWorkbenchView = () => useContext(WorkbenchView);
export const useWorkbenchActions = () => useContext(WorkbenchActions);

export function workbenchModuleTransform(view, id) {
  const local = view.presentationTransforms?.[id] || view.transforms[id] || identityWorkbenchTransform;
  return { scale: view.scale * local.scale, x: view.scale * local.x, y: view.scale * local.y, frame: local.frame, presented: Boolean(view.presentationTransforms?.[id]) };
}

export function useWorkbenchViewRegistration(id, node, enabled, frame, resizeTarget = null, onPosition = null) {
  const { register, changed, frames, resizeTargets, transforms } = useWorkbenchView();
  const previewFrame = transforms?.[id]?.frame;
  // A live reference to module-owned geometry, not a copy of painted DOM bounds.
  const currentFrame = useRef(frame); currentFrame.current = frame;
  // The window owns its base position. Completed owner movement reports back
  // through that same boundary as an individual drag, including local saving.
  currentFrame.move = onPosition;
  const currentResize = useRef(resizeTarget); currentResize.current = resizeTarget;
  const savedLayout = resizeTarget?.store?.getSnapshot().workbench;
  const savedEntry = resizeTarget?.parentTextId ? savedLayout?.texts?.find(item => item.id === resizeTarget.parentTextId)?.frames?.find(item => item.id === id)
    : resizeTarget?.layoutKey === 'display' ? savedLayout?.display
    : savedLayout?.[resizeTarget?.layoutKey]?.find(item => item.id === id);
  const savedFrame = savedEntry?.window || savedEntry?.position;
  const savedKey = JSON.stringify(savedFrame ?? null);
  // Remember the local frame for an older draft without a saved entry. Undoing
  // the first authored resize can then restore it without migrating that draft.
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
      while (savedFrames.current.size > 51) savedFrames.current.delete(savedFrames.current.keys().next().value);
    }
  }, [savedKey, frame?.left, frame?.top, frame?.width, frame?.height, resizeTarget, previewFrame]);
  useLayoutEffect(() => {
    if (!id || !enabled || !node.current || !register) return;
    register(id, node.current);
    frames.set(id, currentFrame);
    resizeTargets.set(id, currentResize);
    return () => { frames.delete(id); resizeTargets.delete(id); register(id, null); };
  }, [id, node, enabled, register, changed, frames, resizeTargets]);
  useLayoutEffect(() => { if (id && enabled) changed?.(); }, [id, enabled, frame?.left, frame?.top, frame?.width, frame?.height, changed]);
}
