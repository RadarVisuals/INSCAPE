import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useStartupDestinationReady } from '../startveil/StartupDestinationContext.jsx';
import ReceptionCanvas from './ReceptionCanvas.jsx';
import ReceptionNavigation from './ReceptionNavigation.jsx';
import ReceptionHeader from './ReceptionHeader.jsx';
import ReceptionPresentation, { useReceptionPresentation } from './ReceptionPresentation.jsx';
import { resolvePresentationDestination } from '../presentation/presentationSources.js';
import useDeferredFocusReturn from '../public/useDeferredFocusReturn.js';
import '../profileDocument/components/profileOverview.css';
import '../public/ownerSystemWorkflow/workflowTokens.css';
import '../public/ownerSystemWorkflow/workflowTactile.css';
import '../public/ownerSystemWorkflow/workflowFlat.css';
import '../lattice/rendering/latticeMenuSurface.css';
const ExplorationKeeper = lazy(() => import('../keeper/ExplorationKeeper.jsx'));
const CanvasPresentation = lazy(() => import('../public/workbenchOverview/CanvasPresentation.jsx'));

// Presentation only: the caller supplies either public data or an owner's draft.
export default function ReceptionOverview({ snapshot, assets, assetStatus, ...props }) {
  return <ReceptionPresentation snapshot={snapshot} assets={assets} assetStatus={assetStatus}><ReceptionPage {...props} /></ReceptionPresentation>;
}
function ReceptionPage({ reception, model, address, menuSurface, ownerEditingAllowed = false,
  onEdit, onReturnToWorkbench, unavailableTarget = false, onOpenDirectory, onReturn, onOpenCanvas, notice, onRetry }) {
  useStartupDestinationReady();
  const [exploring, setExploring] = useState(false), [theme, setTheme] = useState(reception.branding.theme);
  const explore = useRef(null), roomTitle = useRef(null), flightArea = useRef(null), previous = useRef(false);
  const scrollRoot = useRef(null), pageRoot = useRef(null), trigger = useRef(null);
  const presentation = useReceptionPresentation();
  const [opened, setOpened] = useState(null), [sourceError, setSourceError] = useState('');
  const { restoreFocus } = useDeferredFocusReturn();
  const open = (reference, button) => {
    const destination = resolvePresentationDestination(presentation?.snapshot, reference);
    if (destination.status !== 'ready') { setSourceError('That canvas or camera point is unavailable.'); return; }
    trigger.current = button; setSourceError('');
    setOpened({ id: destination.entry.id, destinationId: reference.destinationId, origin: button?.closest('.workbench-overview-card, .reception-region') });
  };
  const selectedCanvas = presentation?.previews.find(entry => entry.id === opened?.id);
  const close = () => { setOpened(null); restoreFocus(() => trigger.current?.isConnected ? trigger.current : pageRoot.current); };
  useLayoutEffect(() => {
    if (exploring) roomTitle.current?.focus({ preventScroll: true });
    else if (previous.current) explore.current?.focus({ preventScroll: true });
    previous.current = exploring;
  }, [exploring]);
  const name = model?.profile?.displayName || 'Unnamed profile';
  return <main ref={pageRoot} className="reception-page system-workflow__token-scope" data-menu-surface={theme}
    data-lattice-menu-surface data-workflow-material="tactile" data-workflow-finish="flat"
    data-published-focus-fallback tabIndex={-1} aria-label={`${name} reception`}
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented && exploring) { event.preventDefault(); setExploring(false); } }}>
    <div className="reception-window" inert={opened ? '' : undefined}>
      <ReceptionHeader navigation={<ReceptionNavigation reception={reception} model={model} theme={theme} onTheme={setTheme}
        onAbout={() => { setExploring(false); scrollRoot.current?.scrollTo({ top: 0 }); }} onCanvases={onOpenCanvas} onDiscover={onOpenDirectory} onEdit={onEdit} />}>
        {(onReturnToWorkbench || onReturn) && <button className="workflow-tactile-control" type="button"
          aria-label={onReturnToWorkbench ? 'Back to my Workbench' : 'Back to my Inscape'}
          onClick={onReturnToWorkbench || onReturn}>{onReturnToWorkbench ? 'Workbench' : 'Back to my Inscape'}</button>}
        {!exploring && <>
          <button className="workflow-tactile-control" type="button" ref={explore} onClick={() => setExploring(true)}>Explore</button>
          <button className="workflow-tactile-control" type="button" onClick={onOpenCanvas} disabled={!onOpenCanvas}>Enter Inscape</button>
        </>}
      </ReceptionHeader>
      {notice && <div className="reception-notice" role="alert">{notice}{onRetry && <button type="button" onClick={onRetry}>Retry</button>}</div>}
      <div className="reception-window-workspace"><div className="reception-window-main" ref={scrollRoot}>
      {exploring ? <section className="exploration-room" aria-label="Exploration room">
        <header><button type="button" onClick={() => setExploring(false)}><ArrowLeft aria-hidden="true" />Back to Reception</button><span>01 / EXPLORATION</span></header>
        <div className="exploration-room__canvas" ref={flightArea}><div className="exploration-room__origin">
          <span className="reception-kicker">{name}</span><h1 ref={roomTitle} tabIndex={-1}>A space to explore.</h1><p>The world starts here.</p>
          <span className="exploration-room__marker" aria-hidden="true" />
        </div>
          {ownerEditingAllowed && <Suspense fallback={<p role="status">Opening Keeper dock…</p>}>
            <ExplorationKeeper profileAddress={address} flightAreaRef={flightArea} menuSurface={menuSurface} onReturn={() => setExploring(false)} />
          </Suspense>}
        </div>
        <footer>{ownerEditingAllowed ? '2800 × 1800 · Camera follows Keeper · Metal beams only · Direct recall.' : 'Exploration wireframe · The profile owner can configure a Keeper here.'}</footer>
      </section> : <>
        {unavailableTarget && <p className="reception-notice" role="status">That destination is no longer in this publication.</p>}
        <ReceptionCanvas reception={reception} model={model} address={address} onOpenSource={open} />
        {sourceError && <p role="status">{sourceError}</p>}
      </>}
      </div></div>
    </div>
    {selectedCanvas && <Suspense fallback={<p role="status">Opening canvas…</p>}><CanvasPresentation key={selectedCanvas.id}
      selected={selectedCanvas} model={selectedCanvas.model} origin={opened.origin} initialDestinationId={opened.destinationId} onClose={close} /></Suspense>}
  </main>;
}
