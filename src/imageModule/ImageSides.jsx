import { useCallback, useEffect, useRef, useState } from 'react';
import ImageArtwork from './ImageArtwork.jsx';

// Side content keeps its DOM identity while entering, turning and becoming the
// resting image. Only the current and requested sides exist; preparation is
// local to this transition, never a persistent media or content cache.
export default function ImageSides({ side, nextSide, rectangle, crop, onComplete, onCancel }) {
  const [ready, setReady] = useState(null), [notice, setNotice] = useState(null);
  const pending = useRef(null), callbacks = useRef(null);
  callbacks.current = { onComplete, onCancel };
  useEffect(() => { setNotice(null); }, [side]);
  useEffect(() => {
    if (!nextSide) { setReady(null); return undefined; }
    setNotice(null);
    let active = true, frame = null;
    const loading = setTimeout(() => { if (active) setNotice('loading'); }, 180);
    const failed = () => {
      if (!active) return;
      clearTimeout(loading); clearTimeout(timeout); cancelAnimationFrame(frame);
      active = false; setNotice('failed'); callbacks.current.onCancel();
    };
    const timeout = setTimeout(failed, 15000);
    pending.current = {
      side: nextSide,
      failed,
      loaded: () => {
        if (!active) return;
        clearTimeout(loading); clearTimeout(timeout); cancelAnimationFrame(frame);
        // Give the decoded image / SVG document a paint before promoting the
        // two faces. No React updates occur during the rotation itself.
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
          if (active) { setNotice(null); setReady(nextSide); }
        }); });
      },
    };
    return () => {
      active = false; pending.current = null;
      clearTimeout(loading); clearTimeout(timeout); cancelAnimationFrame(frame);
    };
  }, [nextSide]);
  const onReady = useCallback(() => { if (pending.current?.side === nextSide) pending.current.loaded(); }, [nextSide]);
  const onError = useCallback(() => { if (pending.current?.side === nextSide) pending.current.failed(); }, [nextSide]);
  const turning = Boolean(nextSide && ready === nextSide);
  return <>
    <span className={`image-module__sides${turning ? ' image-module__turn' : ''}`} data-flipping={turning || undefined}
      onAnimationEnd={event => {
        if (event.target === event.currentTarget && event.animationName === 'image-side-turn' && turning)
          callbacks.current.onComplete(nextSide.id);
      }}>
      {[side, nextSide].filter(Boolean).map(item => <span key={item.id}
        className={`image-module__side${turning ? ' image-module__face' : ''}${turning && item === nextSide ? ' image-module__face--back' : ''}`}
        data-preparing={item === nextSide && !turning || undefined}>
        <ImageArtwork side={item} rectangle={rectangle} crop={item === side ? crop : item.crop}
          onReady={item === nextSide ? onReady : undefined} onError={item === nextSide ? onError : undefined} />
      </span>)}
    </span>
    {notice && <span className="image-module__flip-status" role={notice === 'failed' ? 'alert' : 'status'}>
      {notice === 'failed' ? 'Next side unavailable. Try the arrow again.' : 'Loading next side…'}
    </span>}
  </>;
}
