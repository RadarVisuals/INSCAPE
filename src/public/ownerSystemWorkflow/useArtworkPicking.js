import { useCallback, useEffect, useRef } from 'react';
import { createArtworkPicker } from './artworkPicking.js';

export default function useArtworkPicking(rootRef, scope) {
  const picker = useRef(null);
  useEffect(() => {
    const current = createArtworkPicker(); picker.current = current;
    rootRef.current?.querySelectorAll('img').forEach(image => current.prepare(image));
    return () => { current.dispose(); if (picker.current === current) picker.current = null; };
  }, [rootRef, scope]);
  return {
    onLoadCapture: useCallback(event => picker.current?.prepare(event.target), []),
    pick: useCallback((event, plane) => picker.current?.pick(event, plane) || null, []),
  };
}
