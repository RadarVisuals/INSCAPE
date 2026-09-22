import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DisplayLiftArtwork from '../public/ownerSystemWorkflow/DisplayLiftArtwork.jsx';

export default function ImageLift({ source, entry, reducedMotion, onClose }) {
  const [scene, setScene] = useState(null), [closing, setClosing] = useState(false);
  useEffect(() => () => { if (source?.isConnected) source.focus({ preventScroll: true }); }, [source]);
  return createPortal(<div className="image-lift" role="dialog" aria-modal="true" aria-label="Inspect Image"
    onClick={() => setClosing(true)} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setClosing(true); }
      if (event.key === 'Tab') { event.preventDefault(); event.currentTarget.querySelector('button')?.focus(); }
    }}>
    <div ref={setScene} />
    <DisplayLiftArtwork scene={scene} source={source} entry={entry} closing={closing} reducedMotion={reducedMotion} onCloseComplete={onClose} />
    <button type="button" autoFocus onClick={() => setClosing(true)}>Return to Image</button>
  </div>, document.body);
}
