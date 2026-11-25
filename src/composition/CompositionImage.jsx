import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import ImageArtwork from '../imageModule/ImageArtwork.jsx';
import '../imageModule/imageModule.css';
import './composition.css';

function useBounds(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    // Rendering owns layout pixels. Inspection/camera transforms change screen
    // bounds, but must never feed a second scale into the media projection.
    const style = getComputedStyle(node), width = parseFloat(style.width), height = parseFloat(style.height);
    setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
  }, [ref]);
  useLayoutEffect(measure, [measure]);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(measure); observer.observe(node); return () => observer.disconnect();
  }, [ref, measure]);
  return size;
}

export function CompositionImage({ record, alignment, onRecoverFocus, decorative = false }) {
  const node = useRef(null), size = useBounds(node), [recoveryHost, setRecoveryHost] = useState(null);
  const artwork = record?.artwork;
  return <div className="composition-image" ref={node}>
    <div className="composition-artwork" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : record?.name || artwork?.asset?.name || 'Artwork'} aria-description={decorative ? undefined : artwork?.asset?.description || undefined}>
      {artwork && size.width > 0 && <ImageArtwork artwork={artwork} alignment={alignment} crop={artwork.crop}
        rectangle={{ left: 0, top: 0, ...size }} recoveryHost={recoveryHost} onRecoverFocus={onRecoverFocus} htmlSvgViewport />}
    </div>
    <div ref={setRecoveryHost} className="composition-media-status" />
  </div>;
}
