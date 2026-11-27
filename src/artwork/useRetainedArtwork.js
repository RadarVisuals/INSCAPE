import { useLayoutEffect, useState } from 'react';
import { artworkRetention } from './artworkRetention.js';

// Never start an offscreen document. Keep one already requested by its placement
// briefly, without transferring ownership or keeping an inactive Workbench alive.
export function useRetainedArtwork(src, requested) {
  const [retained, setRetained] = useState(null);
  useLayoutEffect(() => {
    if (requested) { setRetained(src); return; }
    if (retained !== src) {
      // An old source must not become eligible again if the placement changes
      // back to it while still offscreen.
      if (retained !== null) setRetained(null);
      return;
    }
    return artworkRetention.retain(() => setRetained(current => current === src ? null : current));
  }, [src, requested, retained]);
  return requested || retained === src;
}
