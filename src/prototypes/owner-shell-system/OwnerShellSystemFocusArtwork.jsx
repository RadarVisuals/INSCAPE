import { useLayoutEffect, useRef } from 'react';
import { projectCroppedMediaRectangle } from '../../lattice/rendering/latticeCrop.js';
import {
  interpolateOwnerShellSystemFocusCrop,
  OWNER_SHELL_SYSTEM_FOCUS_TRANSITION_MS,
  ownerShellSystemFocusTransitionProgress,
} from './ownerShellSystemFocusArtworkMotion.js';

export default function OwnerShellSystemFocusArtwork({ entry, phase }) {
  const rootRef = useRef(null);
  const imageRef = useRef(null);

  useLayoutEffect(() => {
    const image = imageRef.current;
    const parent = rootRef.current?.parentElement;
    if (!image || !parent) return undefined;
    const authoredCrop = entry.placement.crop || { x: 0.5, y: 0.5, zoom: 1 };
    const nativeCrop = { x: 0.5, y: 0.5, zoom: 1 };
    const startedAt = performance.now();
    let frame = null;

    const renderFrame = (time = startedAt) => {
      const parentRectangle = parent.getBoundingClientRect();
      const scaleX = parentRectangle.width / parent.offsetWidth;
      const scaleY = parentRectangle.height / parent.offsetHeight;
      if (!(scaleX > 0 && scaleY > 0)) return;
      const elapsed = Math.min(1, Math.max(0,
        (time - startedAt) / OWNER_SHELL_SYSTEM_FOCUS_TRANSITION_MS));
      const cropProgress = phase === 'opening' || phase === 'closing'
        ? ownerShellSystemFocusTransitionProgress(elapsed)
        : phase === 'open' || phase === 'outgoing' ? 1 : 0;
      const crop = phase === 'closing'
        ? interpolateOwnerShellSystemFocusCrop(nativeCrop, authoredCrop, cropProgress)
        : interpolateOwnerShellSystemFocusCrop(authoredCrop, nativeCrop, cropProgress);
      const rectangle = projectCroppedMediaRectangle(
        { left: 0, top: 0, width: parentRectangle.width, height: parentRectangle.height },
        entry.focusDimensions,
        crop,
      );
      Object.assign(image.style, {
        height: `${rectangle.height / scaleY}px`,
        left: `${rectangle.left / scaleX}px`,
        top: `${rectangle.top / scaleY}px`,
        width: `${rectangle.width / scaleX}px`,
      });
      if ((phase === 'opening' || phase === 'closing') && elapsed < 1) {
        frame = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => cancelAnimationFrame(frame);
  }, [entry.focusDimensions, entry.placement.crop, phase]);

  return <div className="owner-shell-system__focus-artwork" ref={rootRef}>
    <img alt={entry.media.accessibleLabel} draggable="false" ref={imageRef} src={entry.media.src} />
  </div>;
}
