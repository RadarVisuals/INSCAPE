import { useEffect, useState } from 'react';
import { STARTVEIL_STATES, STARTVEIL_REVEAL_MS, STARTVEIL_RETURN_REVEAL_MS } from './startveilMachine.js';
import { useStartveil } from './useStartveil.js';
import '../lattice/rendering/latticeMenuSurface.css';
import ProfileSignIn from './ProfileSignIn.jsx';
import './startveil.css';

const INTRO_MS = 720;

export default function PortalStartveil({ portal = false, onConnect, ready: destinationReady, onRevealInterface, onComplete }) {
  const [sequenceReady, setSequenceReady] = useState(false);
  const { state, enter, reducedMotion, shortened, canEnter } = useStartveil({
    ready: destinationReady, onRevealInterface, onComplete,
    entryReady: sequenceReady && destinationReady,
  });

  const dormant = state === STARTVEIL_STATES.DORMANT;
  const ready = dormant && canEnter && sequenceReady;
  const exiting = state === STARTVEIL_STATES.REVEALING_INTERFACE;

  useEffect(() => {
    if (portal || shortened) { setSequenceReady(true); return undefined; }
    const timer = window.setTimeout(() => setSequenceReady(true), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [portal, shortened]);

  useEffect(() => {
    if (!portal && ready) enter();
  }, [enter, portal, ready]);

  if (state === STARTVEIL_STATES.COMPLETE) return null;

  const intro = <div className="startveil__intro">
    {destinationReady && !portal && <span aria-hidden="true" className="startveil__intro-wordmark" />}
    <small>Preparing Inscape</small>
  </div>;

  return <section aria-busy={!ready && !exiting} aria-label="INSCAPE entry" className="startveil"
    style={{ '--startveil-reveal-duration': `${reducedMotion ? 0 : shortened ? STARTVEIL_RETURN_REVEAL_MS : STARTVEIL_REVEAL_MS}ms` }}
    data-portal={portal || undefined} data-ready={ready || undefined}
    data-reduced-motion={reducedMotion || undefined} data-sequence={shortened ? 'short' : 'full'}
    data-state={state} data-exiting={exiting || undefined} data-lattice-menu-surface >
    {portal && ready ? <ProfileSignIn onConnect={onConnect} /> : intro}
    <span aria-live="polite" className="startveil__status">
      {exiting ? 'Opening INSCAPE.' : portal && ready ? 'Connect your profile to continue.'
        : ready ? 'INSCAPE ready.' : destinationReady ? 'Resolving INSCAPE.' : 'Preparing INSCAPE.'}
    </span>
  </section>;
}
