import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ProfileLibraryPicker from '../library/ProfileLibraryPicker.jsx';
import { prepareReceptionImage } from './receptionSession.js';

// Explicit cell receivers; the shared Library owns the whole pointer lifecycle.
// A receiver captures this draft generation before decoding, never a later selection.
export default function ReceptionLibrary({ library, menuSurface, onClose, store, value, expected, regionId,
  boundsRef, toolBoundsRef = boundsRef, initialTop, preferences, framePreferences, active, onActivate, onPlaced, onPlacingChange }) {
  const live = useRef(true), requests = useRef(new Set());
  const generation = store.getGeneration();
  const scope = useMemo(() => ({ profile: store.getProfileAddress(), generation }), [store, generation]);
  useEffect(() => {
    live.current = true;
    const pending = requests.current;
    return () => { live.current = false; for (const request of pending) request.cancel(); pending.clear(); };
  }, []);
  useLayoutEffect(() => {
    toolBoundsRef.current?.querySelector('.reception-library input')?.focus({ preventScroll: true });
  }, [toolBoundsRef]);
  const targets = useRef(null);
  const capture = id => {
    const cell = value.regions.find(r => r.id === id);
    if (!cell) return null;
    const request = prepareReceptionImage(store, expected, id, value);
    const isCurrent = () => live.current && store.isCurrent() && store.getGeneration() === generation;
    const placeAsset = async (asset, dimensions, _destination, current = isCurrent) => {
      if (!isCurrent() || !current()) return false;
      requests.current.add(request);
      try {
        const placed = await request.choose(asset, dimensions, current);
        if (placed && live.current) onPlaced(id);
        return placed;
      } finally { requests.current.delete(request); }
    };
    return { isCurrent, placeAsset, previewAt: () => {
      const node = [...(boundsRef.current?.querySelectorAll('[data-region-id]') || [])].find(n => n.dataset.regionId === id);
      const rect = node?.getBoundingClientRect();
      return rect ? { kind: 'reception', label: `Release to place in Cell ${value.regions.indexOf(cell) + 1}`,
        rectangle: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, destination: id } : null;
    } };
  };
  targets.current = { captureTarget: () => capture(regionId), targetAt: point => {
    const node = document.elementFromPoint(point.x, point.y)?.closest('[data-region-id]');
    return boundsRef.current?.contains(node) ? capture(node.dataset.regionId) : null;
  } };
  return <ProfileLibraryPicker library={library} menuSurface={menuSurface} onClose={onClose} placementScope={scope}
    placementTargetRef={targets} preferences={preferences} framePreferences={framePreferences} boundsRef={toolBoundsRef} initialTop={initialTop} active={active} onActivate={onActivate}
    selectionEnabled={value.regions.some(cell => cell.id === regionId)} onPlacingChange={onPlacingChange} />;
}
