import { createContext, useContext, useLayoutEffect, useState, useCallback } from 'react';

const SceneNavigation = createContext(null);
const SceneReport = createContext(null);
// Scoped to one owner session or one published snapshot. Only temporary navigation
// reports live here; Display remains the sole navigation authority.
export function SceneNavigationProvider({ children }) {
  const [scenes, setScenes] = useState({});
  const report = useCallback((id, value) => setScenes(current => {
    const previous = current[id];
    if (previous === value || previous && value && previous.gridId === value.gridId
      && previous.targetGridId === value.targetGridId && previous.direction === value.direction
      && previous.settling === value.settling && previous.motion === value.motion
      && JSON.stringify(previous.gridOrder) === JSON.stringify(value.gridOrder)) return current;
    const next = { ...current }; if (value) next[id] = value; else delete next[id]; return next;
  }), []);
  return <SceneReport.Provider value={report}><SceneNavigation.Provider value={scenes}>{children}</SceneNavigation.Provider></SceneReport.Provider>;
}
export const useSceneNavigation = () => useContext(SceneNavigation) || {};
export function useReportScene(id, gridId, targetGridId, swipe, available = true, gridOrder = []) {
  const report = useContext(SceneReport);
  const motion = swipe?.motion, direction = swipe?.direction, settling = Boolean(swipe?.settling);
  useLayoutEffect(() => {
    report?.(id, available && gridId ? { gridId, targetGridId: targetGridId || null,
      motion, direction, settling, gridOrder } : null);
  }, [report, id, gridId, targetGridId, motion, direction, settling, available, JSON.stringify(gridOrder)]);
  useLayoutEffect(() => () => report?.(id, null), [report, id]);
}

// Follow only the connected Display's temporary motion. Text never navigates it
// and no article/layout state changes on animation frames.
export function useSceneProgress(scene, trackRef, open) {
  useLayoutEffect(() => {
    const paint = progress => {
      const track = trackRef.current;
      if (!track) return;
      // Set the transition phase before the transform, in the same frame as
      // Display. A later context render must not turn a settle into a jump.
      track.parentElement.toggleAttribute('data-settling', Boolean(scene?.motion?.settling));
      track.style.transform = `translateX(${progress * 100}%)`;
    };
    paint(scene?.motion?.progress || 0);
    if (open) return scene?.motion?.subscribe(paint);
  }, [scene?.motion, trackRef, open]);
}
