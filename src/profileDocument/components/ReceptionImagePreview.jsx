import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { projectSystemWorkflowTransform } from '../../systemWorkflow/systemWorkflowTransform.js';

const ImageArtwork = lazy(() => import('../../imageModule/ImageArtwork.jsx'));

// Reception owns only the preview crop. The original renderer, orientation and
// retained SVG remain shared with Image and its readiness-gated Lift.
export default function ReceptionImagePreview({ side, crop = side.receptionCrop ?? null, onReady }) {
  const source = useRef(null);
  const [size, setSize] = useState(null);
  const dimensions = projectSystemWorkflowTransform(side.transform, side.asset.media, null).dimensions;
  useLayoutEffect(() => {
    if (!crop) return undefined;
    const node = source.current;
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) setSize(previous => previous?.width === bounds.width && previous?.height === bounds.height
        ? previous : { width: bounds.width, height: bounds.height });
    };
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, [Boolean(crop)]);
  return <div className="profile-overview__image-fit"><div className="profile-overview__image-source" ref={source}
    data-image-source data-reception-crop={Boolean(crop) || undefined} style={{ '--media-ratio': dimensions.width / dimensions.height }}>
    <Suspense fallback={<span role="status">Loading artwork…</span>}><ImageArtwork side={side} crop={crop}
      rectangle={{ left: 0, top: 0, ...(crop && size ? size : dimensions) }} onReady={onReady} /></Suspense>
  </div></div>;
}
