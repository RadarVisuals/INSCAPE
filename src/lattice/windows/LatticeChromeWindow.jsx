import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import '../rendering/latticeChromePrimitives.css';
import './latticeChromeWindow.css';

export default function LatticeChromeWindow({ animateContent = false, children, contentKey, footer, label, onMotionComplete, onRequestClose, phase = 'open', position = 'rail', railCollapsed = false, title }) {
  const closeRef = useRef(null);
  useEffect(() => { requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true })); }, [title]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onRequestClose?.('escape');
  };

  return <section aria-hidden={phase === 'exiting' || undefined} aria-label={label || title} className="lattice-chrome-window" data-content-motion={animateContent || undefined} data-lattice-chrome data-phase={phase} data-position={position} data-rail-collapsed={position === 'rail' && railCollapsed || undefined} inert={phase === 'exiting' ? '' : undefined} onAnimationEnd={onMotionComplete} onKeyDown={handleKeyDown} onPointerDown={(event) => event.stopPropagation()}>
    <header className="lattice-chrome-window__header">
      <strong>{title}</strong><span>INSCAPE / FIXTURE</span>
      <button aria-label={`Close ${title}`} className="lattice-chrome-close-control" onClick={() => onRequestClose?.('close-control')} ref={closeRef} type="button"><X aria-hidden="true" size={15} strokeWidth={2} /></button>
    </header>
    <div className="lattice-chrome-window__body lattice-chrome-scroll-region"><div className="lattice-chrome-window__content-clip" key={contentKey}><div className="lattice-chrome-window__content">{children}</div></div></div>
    <footer className="lattice-chrome-window__footer"><span>ISOLATED SESSION</span><span>{footer || 'UNRESOLVED ADAPTER'}</span></footer>
  </section>;
}
