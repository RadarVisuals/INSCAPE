import { useEffect, useState } from 'react';
import { readSvgArtwork } from '../public/ownerSystemWorkflow/LibraryArtworkImage.jsx';
import { KEEPER_RIG_LIMITS, parseKeeperRig } from './keeperRig.js';

export function useKeeperRig(src, enabled, attempt) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!src || !enabled) return undefined;
    const controller = new AbortController(), images = [];
    let disposed = false;
    const timer = setTimeout(() => controller.abort(), 15000);
    setResult(null);
    async function load() {
      const rig = parseKeeperRig(await readSvgArtwork(src, controller.signal));
      let pixels = 0;
      for (const part of rig.parts) {
        if (controller.signal.aborted) throw new Error('Keeper loading cancelled.');
        const image = new Image(); images.push(image); image.src = part.src;
        await image.decode();
        pixels += image.naturalWidth * image.naturalHeight;
        if (Math.max(image.naturalWidth, image.naturalHeight) > KEEPER_RIG_LIMITS.dimension || pixels > KEEPER_RIG_LIMITS.pixels)
          throw new Error('Keeper parts exceed the supported image size. Export smaller cropped parts.');
      }
      if (!disposed && !controller.signal.aborted) setResult({ src, attempt, status: 'ready', rig });
      else if (!disposed) throw new Error('The Keeper took too long to load. Try again.');
    }
    load().catch(error => { if (!disposed) setResult({ src, attempt, status: 'failed', error: error.message }); })
      .finally(() => clearTimeout(timer));
    return () => { disposed = true; controller.abort(); clearTimeout(timer); images.forEach(image => { image.src = ''; }); };
  }, [src, enabled, attempt]);
  return enabled && result?.src === src && result.attempt === attempt ? result : { status: 'loading', rig: null };
}
