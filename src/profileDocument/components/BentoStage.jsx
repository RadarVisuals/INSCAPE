import { useLayoutEffect, useRef, useState } from 'react';
import { stageCardInsets } from './bentoStageGeometry.js';
import './bentoStage.css';

// The resting composition owns responsive layout. Every temporary layer uses
// this same containing block; opening never replaces or resizes the composition.
export default function BentoStage({ children, target, getOrigin, onClose, renderExpanded, reducedMotion, transition = 'panel' }) {
  const stage = useRef(null), composition = useRef(null);
  const [presented, setPresented] = useState(null);
  const latestTarget = useRef(target); latestTarget.current = target;
  useLayoutEffect(() => { if (target) setPresented({ target, transition }); }, [target, transition]);
  const finishClose = () => {
    if (latestTarget.current) return;
    const origin = getOrigin(presented.target);
    setPresented(null);
    // Release inert before returning focus, without changing page position.
    if (composition.current) composition.current.inert = false;
    origin?.focus({ preventScroll: true });
  };
  return <div className="bento-stage" ref={stage} data-bento-stage>
    <div className="bento-stage__composition" ref={composition} inert={presented ? '' : undefined} aria-hidden={presented ? true : undefined}>
      {children}
    </div>
    {presented && <BentoExpansion key={presented.target.moduleId} stage={stage} origin={getOrigin(presented.target)} transition={presented.transition}
      closing={!target} onClosed={finishClose} onClose={onClose} reducedMotion={reducedMotion}>
      {inspection => renderExpanded(presented.target, inspection)}
    </BentoExpansion>}
  </div>;
}

function BentoExpansion({ stage, origin: source, transition, closing, onClosed, onClose, reducedMotion, children }) {
  const layer = useRef(null), motion = useRef(null), opened = useRef(false);
  const [scene, setScene] = useState(null);
  const artwork = transition === 'artwork';
  const callbacks = useRef(null); callbacks.current = { onClosed, onClose };
  useLayoutEffect(() => {
    if (artwork) return;
    const node = layer.current;
    const origin = stageCardInsets(stage.current.getBoundingClientRect(), source?.getBoundingClientRect());
    const from = opened.current ? getComputedStyle(node).inset : origin;
    const to = closing ? origin : '0% 0% 0% 0%';
    motion.current?.cancel();
    node.style.inset = to;
    opened.current = true;
    if (reducedMotion) { if (closing) callbacks.current.onClosed(); return; }
    const animation = node.animate([{ inset: from }, { inset: to }], { duration: 320, easing: 'cubic-bezier(.22, .75, .2, 1)' });
    motion.current = animation;
    animation.onfinish = () => { if (closing) callbacks.current.onClosed(); };
    // A subsequent direction reads the current animated rectangle before cancelling.
  }, [closing, reducedMotion, stage, source, artwork]);
  useLayoutEffect(() => {
    if (!artwork || !source) return undefined;
    source.setAttribute('data-bento-lift-origin', '');
    return () => source.removeAttribute('data-bento-lift-origin');
  }, [source, artwork]);
  useLayoutEffect(() => () => motion.current?.cancel(), []);
  useLayoutEffect(() => { layer.current.focus({ preventScroll: true }); }, []);
  const handleKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); callbacks.current.onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...layer.current.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')]
      .filter(node => node.getClientRects().length && !node.closest('[inert]'));
    const first = controls[0], last = controls.at(-1), focused = document.activeElement;
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (focused === first || focused === layer.current)) { event.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!event.shiftKey && (focused === last || focused === layer.current)) { event.preventDefault(); first.focus({ preventScroll: true }); }
  };
  return <><div ref={setScene} />
    <div className="bento-stage__expansion" ref={layer} tabIndex={-1} role="dialog" aria-label="Expanded work"
      inert={closing ? '' : undefined} data-closing={closing || undefined} data-artwork-lift={artwork || undefined} onKeyDown={handleKey}>
      {children(artwork ? { scene, source, closing, onClosed, reducedMotion, layer: layer.current } : null)}
    </div></>;
}
