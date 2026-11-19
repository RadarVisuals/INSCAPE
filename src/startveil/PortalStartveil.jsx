import { lazy, Suspense, useEffect, useState } from 'react';
import { STARTVEIL_STATES, STARTVEIL_REVEAL_MS, STARTVEIL_RETURN_REVEAL_MS } from './startveilMachine.js';
import { useStartveil } from './useStartveil.js';
import '../lattice/rendering/latticeMenuSurface.css';
import './startveil.css';

const PublicEntryPortal = lazy(() => import('./PublicEntryPortal.jsx'));
const INTRO_MS = 720;

export default function PortalStartveil({ connectedProfile, ownerDestinations, portal = false, onConnect, onDisconnect, onEnterMyWorld, onVisitProfile, onExplore, ...props }) {
  const [sequenceReady, setSequenceReady] = useState(false);
  const { state, enter, reducedMotion, shortened, canEnter } = useStartveil({
    ...props,
    entryReady: sequenceReady && props.ready,
  });

  const dormant = state === STARTVEIL_STATES.DORMANT;
  const ready = dormant && canEnter && sequenceReady;
  const exiting = state === STARTVEIL_STATES.REVEALING_INTERFACE;

  useEffect(() => {
    if (shortened) { setSequenceReady(true); return undefined; }
    const timer = window.setTimeout(() => setSequenceReady(true), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [shortened]);

  useEffect(() => {
    if (!portal && ready) enter();
  }, [enter, portal, ready]);

  if (state === STARTVEIL_STATES.COMPLETE) return null;

  const visitProfile = (address) => {
    if (!ready || !address) return;
    onVisitProfile?.(address);
  };

  const intro = <div className="startveil__intro">
    <span aria-hidden="true" className="startveil__intro-wordmark" />
    <small>{props.ready ? 'PUBLIC NETWORK · LUKSO MAINNET' : 'PREPARING INSCAPE'}</small>
  </div>;

  return <section aria-busy={!ready && !exiting} aria-label="INSCAPE entry" className="startveil"
    style={{ '--startveil-reveal-duration': `${reducedMotion ? 0 : shortened ? STARTVEIL_RETURN_REVEAL_MS : STARTVEIL_REVEAL_MS}ms` }}
    data-portal={portal || undefined} data-ready={ready || undefined}
    data-reduced-motion={reducedMotion || undefined} data-sequence={shortened ? 'short' : 'full'}
    data-state={state} data-exiting={exiting || undefined} data-lattice-menu-surface >
    {portal && ready ? <Suspense fallback={intro}><PublicEntryPortal ownerDestinations={ownerDestinations} connectedProfile={connectedProfile} onConnect={onConnect} onExplore={onExplore}
      onDisconnect={onDisconnect} onEnterMyWorld={onEnterMyWorld} onVisitProfile={visitProfile} /></Suspense>
      : intro}
    <span aria-live="polite" className="startveil__status">
      {exiting ? 'Opening INSCAPE.' : portal && ready ? 'Choose Discover or Connect Profile.'
        : ready ? 'INSCAPE ready.' : props.ready ? 'Resolving INSCAPE.' : 'Preparing INSCAPE.'}
    </span>
  </section>;
}
