import { useCallback, useRef, useState } from 'react';

export const LATTICE_CHROME_REGIONS = Object.freeze({ RAIL: 'rail', TOOLBAR: 'toolbar' });

export function createLatticeChromeWindowState() {
  return { railId: null, toolbarId: null, deepestRegion: null };
}

export function activateLatticeChromeWindow(state, region, id) {
  const key = `${region}Id`;
  if (!(key in state)) throw new TypeError(`Unsupported lattice chrome region: ${region}`);
  if (state[key] === id) return closeLatticeChromeWindow(state, region);
  return { ...state, [key]: id, deepestRegion: region };
}

export function closeLatticeChromeWindow(state, region) {
  const key = `${region}Id`;
  if (!(key in state)) throw new TypeError(`Unsupported lattice chrome region: ${region}`);
  const otherRegion = region === LATTICE_CHROME_REGIONS.RAIL ? LATTICE_CHROME_REGIONS.TOOLBAR : LATTICE_CHROME_REGIONS.RAIL;
  return { ...state, [key]: null, deepestRegion: state[`${otherRegion}Id`] ? otherRegion : null };
}

export function deepestLatticeChromeRegion(state) {
  if (state.deepestRegion && state[`${state.deepestRegion}Id`]) return state.deepestRegion;
  if (state.toolbarId) return LATTICE_CHROME_REGIONS.TOOLBAR;
  if (state.railId) return LATTICE_CHROME_REGIONS.RAIL;
  return null;
}

export default function useLatticeChromeWindows() {
  const [state, setState] = useState(createLatticeChromeWindowState);
  const stateRef = useRef(state);
  const returnFocusRefs = useRef({ rail: null, toolbar: null });
  stateRef.current = state;

  const closeRegion = useCallback((region, restoreFocus = true) => {
    const trigger = returnFocusRefs.current[region];
    setState((current) => closeLatticeChromeWindow(current, region));
    if (restoreFocus) requestAnimationFrame(() => trigger?.focus?.({ preventScroll: true }));
  }, []);

  const activate = useCallback((region, id, trigger, returnFocus = trigger) => {
    if (stateRef.current[`${region}Id`] === id) return closeRegion(region);
    returnFocusRefs.current[region] = returnFocus || null;
    setState((current) => activateLatticeChromeWindow(current, region, id));
  }, [closeRegion]);

  const closeDeepest = useCallback((restoreFocus = true) => {
    const region = deepestLatticeChromeRegion(stateRef.current);
    if (region) closeRegion(region, restoreFocus);
  }, [closeRegion]);

  const closeAll = useCallback((restoreFocus = false) => {
    const deepest = deepestLatticeChromeRegion(stateRef.current);
    setState(createLatticeChromeWindowState());
    if (restoreFocus && deepest) {
      const trigger = returnFocusRefs.current[deepest];
      requestAnimationFrame(() => trigger?.focus?.({ preventScroll: true }));
    }
  }, []);

  return { ...state, activate, closeAll, closeDeepest, closeRegion };
}
