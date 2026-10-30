import { createContext, useContext, useLayoutEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { createSceneSession, sceneScopeKey } from '../presentation/sceneSession.js';

const SceneNavigation = createContext(null);
const SceneReport = createContext(null);
const SceneSession = createContext(null);
const SceneScopes = createContext(new Map());
export function SceneNavigationProvider({ children, scope, content }) {
  return <SceneSessionProvider key={sceneScopeKey(scope)} scope={scope} content={content}>{children}</SceneSessionProvider>;
}
function SceneSessionProvider({ children, scope, content }) {
  const inherited = useContext(SceneScopes);
  const [session] = useState(() => createSceneSession(scope, content));
  // Allocate new controllers before children render; publish additions and
  // reconcile/removal only after commit. Existing controllers are untouched.
  session.prepare(content);
  const selected = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useLayoutEffect(() => { session.configure(content); }, [session, content]);
  const [motions, setMotions] = useState({});
  const motionOwners = useRef(new Map());
  // The lease belongs to a mounted motion adapter. Its cleanup cannot erase a
  // newer adapter's report, and never erases the logical selected scene.
  const attach = useCallback(id => {
    const lease = {}; let live = true;
    motionOwners.current.set(id, lease);
    return {
      report: value => { if (live && motionOwners.current.get(id) === lease) setMotions(current => ({ ...current, [id]: { lease, value } })); },
      release: () => { live = false;
        if (motionOwners.current.get(id) === lease) motionOwners.current.delete(id);
        setMotions(current => {
        if (current[id]?.lease !== lease) return current;
        const next = { ...current }; delete next[id]; return next;
      }); },
    };
  }, []);
  const scenes = useMemo(() => Object.fromEntries(Object.entries(selected)
    .filter(([, scene]) => scene.gridOrder.includes(scene.gridId))
    .map(([id, scene]) => [id, { ...scene, ...motions[id]?.value }])), [selected, motions]);
  const value = useMemo(() => ({ session, attach, scenes }), [session, attach, scenes]);
  const scopes = useMemo(() => new Map([...inherited, [scope.canvasId, value]]), [inherited, scope.canvasId, value]);
  return <SceneScopes.Provider value={scopes}><SceneContext value={value}>{children}</SceneContext></SceneScopes.Provider>;
}
function SceneContext({ value, children }) {
  return <SceneSession.Provider value={value.session}><SceneReport.Provider value={value.attach}><SceneNavigation.Provider value={value.scenes}>{children}</SceneNavigation.Provider></SceneReport.Provider></SceneSession.Provider>;
}
// Several cells can enter the same canvas scope, including its live swipe
// adapter. Canvas IDs never share Display selection merely because IDs match.
export function SceneNavigationScope({ canvasId, children }) {
  const value = useContext(SceneScopes).get(canvasId);
  return value ? <SceneContext value={value}>{children}</SceneContext> : null;
}
export const useSceneNavigation = () => useContext(SceneNavigation) || {};
export const useSceneController = id => useContext(SceneSession)?.controller(id) || null;
export function useSceneMotion(id, gridId, targetGridId, swipe, available = true) {
  const attach = useContext(SceneReport);
  const [adapter, setAdapter] = useState(null);
  useLayoutEffect(() => {
    const next = attach?.(id); setAdapter(next);
    return () => next?.release();
  }, [attach, id]);
  const motion = swipe?.motion, direction = swipe?.direction, settling = Boolean(swipe?.settling);
  useLayoutEffect(() => {
    adapter?.report(available && gridId ? { gridId, targetGridId: targetGridId || null,
      motion, direction, settling } : null);
  }, [adapter, gridId, targetGridId, motion, direction, settling, available]);
}

// Follow only the connected Display's temporary motion. Text never navigates it
// and no article/layout state changes on animation frames.
export function useSceneProgress(scene, trackRef, open) {
  useLayoutEffect(() => {
    let following = null, release = null, sourceSlot = null, widthRatio = null;
    const paint = progress => {
      const track = trackRef.current;
      if (!track) return;
      // Set the transition phase before the transform, in the same frame as
      // Display. A later context render must not turn a settle into a jump.
      track.parentElement.toggleAttribute('data-settling', Boolean(scene?.motion?.settling));
      const transport = open ? scene?.motion?.transport : null;
      const slot = scene?.motion?.sourceSlot || 0, ratio = scene?.motion?.widthRatio ?? 1;
      if (transport !== following || slot !== sourceSlot || ratio !== widthRatio) {
        release?.(); following = transport; sourceSlot = slot; widthRatio = ratio;
        release = transport?.follow(track, position => `translateX(${(position + slot) * ratio * 100}%)`);
      }
      if (!release) track.style.transform = `translateX(${progress * 100}%)`;
    };
    paint(scene?.motion?.progress || 0);
    const unsubscribe = open ? scene?.motion?.subscribe(paint) : null;
    return () => { unsubscribe?.(); release?.(); };
  }, [scene?.motion, trackRef, open]);
}
