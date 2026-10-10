import { useEffect, useRef } from 'react';
import { prepareRasterArtwork } from '../artwork/prepareRasterArtwork.js';

// Keeper parts keep their own DOM and motion. Only their transient raster
// source follows the current screen size and display density.
export function usePreparedRasterArtwork(source) {
  const node = useRef(null);
  useEffect(() => {
    const prepared = prepareRasterArtwork(node.current, source, { scale: devicePixelRatio || 1 });
    const resize = () => prepared.setScale(devicePixelRatio || 1);
    addEventListener('resize', resize);
    return () => { removeEventListener('resize', resize); prepared.dispose(); };
  }, [source]);
  return node;
}
