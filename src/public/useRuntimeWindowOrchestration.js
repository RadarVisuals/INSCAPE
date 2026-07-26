import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { decodeWindowGridGeometry } from './windowGeometry.js';
import {
  LEGACY_MODULE_LAYOUT_STORAGE_KEY,
  MODULE_LAYOUT_STORAGE_KEY,
  decodeModuleLayout,
  encodeModuleLayout,
  getDefaultModulePositions,
  normalizeModulePositions
} from './moduleLayout.js';
import { readOwnerProfileValue, writeOwnerProfileValue } from './ownerProfileStorage.js';
import {
  createRuntimeWindowState,
  loadRuntimeWindowState,
  normalizeRuntimeWindowGeometry,
  runtimeWindowKey,
  saveRuntimeWindowState,
  updateRuntimeWindowState,
  windowZIndex
} from './windows/runtimeWindowState.js';

const LEGACY_WINDOW_GEOMETRY_KEY = 'os-underneath.window-geometry.v1';
const RUNTIME_WINDOW_IDS = Object.freeze(['identity', 'collection', 'creations', 'signals']);
const RUNTIME_WINDOW_ID_SET = new Set(RUNTIME_WINDOW_IDS);
const EMPTY_RUNTIME_WINDOWS = createRuntimeWindowState();

function readStoredPositions(storage, geometry, profileAddress) {
  try {
    const current = readOwnerProfileValue(
      storage,
      MODULE_LAYOUT_STORAGE_KEY,
      profileAddress,
      [MODULE_LAYOUT_STORAGE_KEY, LEGACY_MODULE_LAYOUT_STORAGE_KEY]
    );
    if (!current) return getDefaultModulePositions(geometry);
    const record = JSON.parse(current);
    const positions = record?.version === 3
      ? normalizeModulePositions(record.positions, geometry)
      : decodeModuleLayout(record, geometry);
    if (record?.version === 3) {
      writeOwnerProfileValue(storage, MODULE_LAYOUT_STORAGE_KEY, profileAddress, encodeModuleLayout(positions));
    }
    return positions;
  } catch {
    return getDefaultModulePositions(geometry);
  }
}

function readLegacyWindowGeometry(storage, geometry, profileAddress) {
  return decodeWindowGridGeometry(
    readOwnerProfileValue(storage, LEGACY_WINDOW_GEOMETRY_KEY, profileAddress),
    geometry,
    readStoredPositions(storage, geometry, profileAddress)
  );
}

export function createAuthoredRuntimeWindowDefaults(systemPresentation) {
  const openIds = RUNTIME_WINDOW_IDS.filter((id) => systemPresentation[id]?.startOpen);
  const rects = {};
  RUNTIME_WINDOW_IDS.forEach((id) => {
    if (systemPresentation[id]?.windowGeometry) rects[id] = systemPresentation[id].windowGeometry;
  });
  return createRuntimeWindowState({ openIds, zOrder: openIds, rects });
}

export function loadRuntimeWindowProfileState({
  storage,
  profileAddress,
  placementGeometry,
  authoredDefaults
}) {
  const profile = normalizeProfileAddress(profileAddress);
  let keyExists = false;
  try {
    keyExists = storage?.getItem?.(runtimeWindowKey(profile)) !== null;
  } catch {
    // Storage is optional.
  }
  const loaded = loadRuntimeWindowState(storage, profile, {
    rects: readLegacyWindowGeometry(storage, placementGeometry, profile)
  });
  const restored = normalizeRuntimeWindowGeometry(
    keyExists || Object.keys(loaded.rects).length ? loaded : authoredDefaults,
    placementGeometry
  );
  return {
    profileAddress: profile,
    windows: createRuntimeWindowState({
      openIds: restored.openIds.filter((id) => RUNTIME_WINDOW_ID_SET.has(id)),
      zOrder: restored.zOrder.filter((id) => RUNTIME_WINDOW_ID_SET.has(id)),
      rects: Object.fromEntries(Object.entries(restored.rects).filter(([id]) => RUNTIME_WINDOW_ID_SET.has(id)))
    })
  };
}

export function runtimeWindowProfileMatches(record, profileAddress) {
  return record.profileAddress === normalizeProfileAddress(profileAddress);
}

export function useRuntimeWindowOrchestration({
  loadSystemPresentation,
  placementGeometry,
  profileAddress,
  saveSystemPresentation,
  setSystemPresentation,
  storage = window.localStorage,
  systemPresentation
}) {
  const authoredDefaults = useMemo(
    () => createAuthoredRuntimeWindowDefaults(systemPresentation),
    [systemPresentation]
  );
  const placementGeometryRef = useRef(placementGeometry);
  placementGeometryRef.current = placementGeometry;

  const [profileState, setProfileState] = useState(() => loadRuntimeWindowProfileState({
    storage,
    profileAddress,
    placementGeometry,
    authoredDefaults
  }));
  const [identityPhase, setIdentityPhase] = useState('closed');
  const runtimeWindows = runtimeWindowProfileMatches(profileState, profileAddress)
    ? profileState.windows
    : EMPTY_RUNTIME_WINDOWS;
  const runtimeWindowsRef = useRef(runtimeWindows);
  runtimeWindowsRef.current = runtimeWindows;

  useLayoutEffect(() => {
    setProfileState(loadRuntimeWindowProfileState({
      storage,
      profileAddress,
      placementGeometry: placementGeometryRef.current,
      authoredDefaults: createAuthoredRuntimeWindowDefaults(loadSystemPresentation(profileAddress))
    }));
  }, [loadSystemPresentation, profileAddress, storage]);

  useEffect(() => {
    setProfileState((current) => runtimeWindowProfileMatches(current, profileAddress)
      ? { ...current, windows: normalizeRuntimeWindowGeometry(current.windows, placementGeometry) }
      : current);
  }, [placementGeometry, profileAddress]);

  useEffect(() => {
    if (runtimeWindowProfileMatches(profileState, profileAddress)) {
      saveRuntimeWindowState(storage, profileState.profileAddress, profileState.windows);
    }
  }, [profileAddress, profileState, storage]);

  const updateWindows = useCallback((action) => {
    setProfileState((current) => runtimeWindowProfileMatches(current, profileAddress)
      ? { ...current, windows: updateRuntimeWindowState(current.windows, action) }
      : current);
  }, [profileAddress]);

  const setWindowOpen = useCallback((id, expanded) => {
    if (id === 'identity') setIdentityPhase(expanded ? 'open' : 'closed');
    updateWindows({ type: expanded ? 'open' : 'close', id });
  }, [updateWindows]);

  const toggleWindow = useCallback((id) => {
    const expanded = !runtimeWindowsRef.current.openIds.includes(id);
    if (!expanded && id === 'identity') {
      setIdentityPhase('closed');
      updateWindows({ type: 'close', id });
      return;
    }
    updateWindows({ type: expanded ? 'open' : 'close', id });
    if (id === 'identity') setIdentityPhase('open');
  }, [updateWindows]);

  const closeAllWindows = useCallback(() => {
    updateWindows({ type: 'close-all' });
    setIdentityPhase('closed');
  }, [updateWindows]);

  const resetWindows = useCallback(() => {
    updateWindows({ type: 'reset', initial: authoredDefaults });
  }, [authoredDefaults, updateWindows]);

  const resetWindow = useCallback((id) => {
    updateWindows({ type: 'reset-window', id, rect: authoredDefaults.rects[id] || null });
  }, [authoredDefaults.rects, updateWindows]);

  const setWindowGeometry = useCallback((id, rect) => {
    updateWindows({ type: 'geometry', id, rect });
  }, [updateWindows]);

  const focusWindow = useCallback((id) => {
    updateWindows({ type: 'focus', id });
  }, [updateWindows]);

  const getWindowZIndex = useCallback((id, base) => (
    windowZIndex(runtimeWindowsRef.current, id, base)
  ), []);

  const toggleStartOpen = useCallback((id, fallbackRect) => {
    const rect = runtimeWindowsRef.current.rects[id] || fallbackRect;
    setSystemPresentation((current) => {
      const next = {
        ...current,
        [id]: {
          ...current[id],
          startOpen: !current[id]?.startOpen,
          windowGeometry: rect
        }
      };
      saveSystemPresentation(profileAddress, next);
      return next;
    });
  }, [profileAddress, saveSystemPresentation, setSystemPresentation]);

  const open = useMemo(() => ({
    identity: runtimeWindows.openIds.includes('identity'),
    collection: runtimeWindows.openIds.includes('collection'),
    creations: runtimeWindows.openIds.includes('creations'),
    signals: runtimeWindows.openIds.includes('signals')
  }), [runtimeWindows.openIds]);

  const actions = useMemo(() => ({
    closeAllWindows,
    focusWindow,
    getWindowZIndex,
    resetWindow,
    resetWindows,
    setWindowGeometry,
    setWindowOpen,
    toggleStartOpen,
    toggleWindow
  }), [closeAllWindows, focusWindow, getWindowZIndex, resetWindow, resetWindows, setWindowGeometry, setWindowOpen, toggleStartOpen, toggleWindow]);

  return {
    actions,
    authoredDefaults,
    identityPhase,
    open,
    runtimeWindows
  };
}
