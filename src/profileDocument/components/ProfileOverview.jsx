import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import ReceptionCanvas from '../../reception/ReceptionCanvas.jsx';
import ReceptionNavigation from '../../reception/ReceptionNavigation.jsx';
import { createReception } from '../domain/receptionPresentation.js';
const OwnerReception = lazy(() => import('../../reception/OwnerReception.jsx'));
import '../../public/ownerSystemWorkflow/workflowTactile.css';
import '../../public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../../public/ownerSystemWorkflow/workflowFlat.css';
import '../../lattice/rendering/latticeMenuSurface.css';
import './profileOverview.css';
const ExplorationKeeper = lazy(() => import('../../keeper/ExplorationKeeper.jsx'));

// Only verified public identity is read here. Temporary room navigation owns no draft.
export default function ProfileOverview({ document: publication, ownerEditingAllowed = false, onReturnToWorkbench, unavailableTarget = false, onOpenDirectory, onReturn, onOpenCanvas }) {
  useStartupDestinationReady();
  const identity = useProfileIdentity(publication.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document: publication, identity }), [publication, identity]);
  const [exploring, setExploring] = useState(false), [editing, setEditing] = useState(false);
  const [blank] = useState(createReception), reception = publication.reception || blank;
  const [theme, setTheme] = useState(reception.branding.theme);
  const explore = useRef(null), roomTitle = useRef(null), flightArea = useRef(null), previous = useRef(false);
  useLayoutEffect(() => {
    if (exploring) roomTitle.current?.focus({ preventScroll: true });
    else if (previous.current) explore.current?.focus({ preventScroll: true });
    previous.current = exploring;
  }, [exploring]);
  const profile = model?.profile || { displayName: publication.profile.cachedIdentity.name || 'Unnamed profile', avatarUrl: publication.profile.cachedIdentity.avatarUrl, description: '', tags: [] };
  const name = profile.displayName;
  if (editing && ownerEditingAllowed) return <Suspense fallback={<p role="status">Opening Reception editor…</p>}><OwnerReception document={publication} onClose={() => setEditing(false)}
    onCanvases={onOpenCanvas} onDiscover={onOpenDirectory} onReturn={onReturnToWorkbench || onReturn} /></Suspense>;
  return <main className="reception-page system-workflow__token-scope" data-menu-surface={theme}
    data-lattice-menu-surface data-workflow-material="tactile" data-workflow-finish="flat"
    data-published-focus-fallback tabIndex={-1} aria-label={`${name} reception`}
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented && exploring) { event.preventDefault(); setExploring(false); } }}>
    <div>
      {exploring ? <section className="exploration-room" aria-label="Exploration room">
        <header><button type="button" onClick={() => setExploring(false)}><ArrowLeft aria-hidden="true" />Back to Reception</button><span>01 / EXPLORATION</span>
          {onReturnToWorkbench && <button type="button" onClick={onReturnToWorkbench}>Back to my Workbench</button>}</header>
        <div className="exploration-room__canvas" ref={flightArea}><div className="exploration-room__origin">
          <span className="reception-kicker">{name}</span><h1 ref={roomTitle} tabIndex={-1}>A space to explore.</h1><p>The world starts here.</p>
          <span className="exploration-room__marker" aria-hidden="true" />
        </div>
          {ownerEditingAllowed && <Suspense fallback={<p role="status">Opening Keeper dock…</p>}>
            <ExplorationKeeper profileAddress={publication.profile.address} flightAreaRef={flightArea} menuSurface={publication.appearance.menuSurfaceId} onReturn={() => setExploring(false)} />
          </Suspense>}
        </div>
        <footer>{ownerEditingAllowed ? '2800 × 1800 · Camera follows Keeper · Metal beams only · Direct recall.' : 'Exploration wireframe · The profile owner can configure a Keeper here.'}</footer>
      </section> : <>
        {unavailableTarget && <p className="reception-notice" role="status">That destination is no longer in this publication.</p>}
        <ReceptionCanvas reception={reception} model={model} address={publication.profile.address}
          navigation={<ReceptionNavigation reception={reception} model={model} theme={theme} onTheme={setTheme} onCanvases={onOpenCanvas}
            onDiscover={onOpenDirectory} onReturn={onReturnToWorkbench || onReturn} returnLabel={onReturnToWorkbench ? 'Back to my Workbench' : undefined} onEdit={ownerEditingAllowed ? () => setEditing(true) : undefined} />} />
        <footer className="reception-footer"><button className="workflow-tactile-control" type="button" ref={explore} onClick={() => setExploring(true)}>Explore</button>
          <button className="workflow-tactile-control" type="button" onClick={onOpenCanvas} disabled={!onOpenCanvas}>Enter Inscape</button></footer>
      </>}
    </div>
  </main>;
}
