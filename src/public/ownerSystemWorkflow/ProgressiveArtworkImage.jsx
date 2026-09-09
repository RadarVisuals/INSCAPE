import { useEffect, useMemo, useState } from 'react';
import { progressiveArtworkSources } from './progressiveArtworkSources.js';

export default function ProgressiveArtworkImage({ alt = '', asset, draggable = false, onSourceLoad, style }) {
  const sources = useMemo(() => progressiveArtworkSources(asset), [asset]);
  const [highReady, setHighReady] = useState(sources.low === sources.high);
  const [highFailed, setHighFailed] = useState(false);
  useEffect(() => { setHighReady(sources.low === sources.high); setHighFailed(false); }, [sources.high, sources.low]);
  if (!sources.low) return null;
  const report = (event, source) => {
    const { naturalHeight: height, naturalWidth: width } = event.currentTarget;
    if (width && height) onSourceLoad?.({ source, width, height });
  };
  // Moving Stage media must paint atomically. Async decoding can expose the
  // guides for a frame when an offscreen, already-loaded Grid slides into view.
  if (sources.low === sources.high) return <img alt={alt} className="system-workflow__artwork-media" decoding="sync" draggable={draggable} loading="eager"
    onLoad={(event) => report(event, sources.high)} src={sources.high} style={style} />;
  return <span className="system-workflow__artwork-media system-workflow__progressive-media" data-high-ready={highReady || undefined}>
    <img alt={alt} decoding="sync" draggable={draggable} loading="eager" src={sources.low} style={style} />
    {!highFailed && <img alt="" aria-hidden="true" decoding="sync" draggable={draggable} loading="eager"
      onError={() => setHighFailed(true)} onLoad={(event) => { setHighReady(true); report(event, sources.high); }}
      src={sources.high} style={style} />}
  </span>;
}
