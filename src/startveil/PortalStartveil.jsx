import { useEffect, useRef, useState } from 'react';
import { STARTVEIL_STATES } from './startveilMachine.js';
import { useStartveil } from './useStartveil.js';
import PublicEntryPortal from './PublicEntryPortal.jsx';
import '../lattice/rendering/latticeMenuSurface.css';
import './publicEntryPortal.css';

const REVEAL_MS = 920;

export default function PortalStartveil({ connectedProfile, portal = false, onConnect, onDisconnect, onEnterMyWorld, onVisitProfile, ...props }) {
  const [sequenceReady, setSequenceReady] = useState(false);
  const portalSeenRef = useRef(portal);
  const reducedMotionPreferred = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const { state, enter, reducedMotion, shortened, canEnter } = useStartveil({
    ...props,
    entryReady: sequenceReady,
    keyboardEntryEnabled: !portal,
  });

  const dormant = state === STARTVEIL_STATES.DORMANT;
  const ready = dormant && canEnter && sequenceReady;
  const exiting = state === STARTVEIL_STATES.ENTERING;
  const handoff = ![
    STARTVEIL_STATES.LOADING,
    STARTVEIL_STATES.DORMANT,
    STARTVEIL_STATES.ENTERING,
  ].includes(state);

  useEffect(() => {
    if (reducedMotionPreferred) { setSequenceReady(true); return undefined; }
    const timer = window.setTimeout(() => setSequenceReady(true), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotionPreferred]);

  useEffect(() => {
    const arrivedFromPortal = portalSeenRef.current && !portal;
    portalSeenRef.current ||= portal;
    if (arrivedFromPortal && ready) enter({ notifyUserGesture: false });
  }, [enter, portal, ready]);

  if (state === STARTVEIL_STATES.COMPLETE) return null;

  const visitProfile = (address) => {
    if (!ready || !address) return;
    onVisitProfile?.(address);
    enter({ notifyUserGesture: false });
  };

  return <section aria-busy={!ready && !handoff} aria-label="INSCAPE entry" className="startveil"
    data-handoff={handoff || undefined} data-portal={portal || undefined} data-ready={ready || undefined}
    data-reduced-motion={reducedMotion || undefined} data-sequence={shortened ? 'short' : 'full'}
    data-state={state} data-exiting={exiting || undefined} data-lattice-menu-surface data-menu-surface="mist">
    <div aria-hidden="true" className="startveil__grid" />
    {portal && ready ? <PublicEntryPortal connectedProfile={connectedProfile} onConnect={onConnect}
      onDisconnect={onDisconnect} onEnterMyWorld={onEnterMyWorld} onVisitProfile={visitProfile} />
      : <div className="startveil__intro">
        <span aria-hidden="true" className="startveil__intro-wordmark" />
        <small>{props.ready ? 'PUBLIC NETWORK · LUKSO MAINNET' : 'PREPARING INSCAPE'}</small>
        {!portal && <button className="startveil__entry" disabled={!ready} onClick={() => enter()} type="button">ENTER INSCAPE</button>}
      </div>}
    <span aria-live="polite" className="startveil__status">
      {handoff ? 'Opening INSCAPE.' : portal && ready ? 'Choose Explore Worlds or Connect Profile.'
        : ready ? 'INSCAPE ready.' : props.ready ? 'Resolving INSCAPE.' : 'Preparing INSCAPE.'}
    </span>
  </section>;
}
