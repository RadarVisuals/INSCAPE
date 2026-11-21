import { useContext, useRef } from 'react';
import { GalleryStudioMotion } from './galleryStudioMotion.js';

export default function GalleryStudioStage() {
  const { journey, destination, finish, surface } = useContext(GalleryStudioMotion);
  const waitingHost = useRef(null);
  if (!journey) return null;
  const target = destination?.trip === journey ? destination : null;
  // On return only Gallery can supply the verified publication to paint.
  const presentation = target?.presentation || (journey.direction === 'editor' ? journey : null);
  if (!presentation) return null;
  const CanvasJourney = journey.Renderer;
  return <CanvasJourney journey={presentation} targetReady={Boolean(target)}
    hostRef={target?.hostRef || waitingHost} surface={surface} resolveTarget={target?.resolveTarget}
    revealLayers={target?.revealLayers} onComplete={() => finish(journey)} />;
}
