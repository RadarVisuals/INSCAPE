import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useStartupDestinationReady } from '../startveil/StartupDestinationContext.jsx';
import ReceptionCanvas from './ReceptionCanvas.jsx';
import PublicWorkspaceHeader from '../profileDocument/components/PublicWorkspaceHeader.jsx';
import ReceptionHeader from './ReceptionHeader.jsx';
import { workbenchOverviewModel } from '../public/workbenchOverview/workbenchOverviewModel.js';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
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
const ReceptionDocumentCanvas = lazy(() => import('./ReceptionDocumentCanvas.jsx'));

// Presentation only: the caller supplies either public data or an owner's draft.
export default function ReceptionOverview({ snapshot, ...props }) {
  return <ReceptionPresentation snapshot={snapshot}><ReceptionPage {...props} /></ReceptionPresentation>;
}
function ReceptionPage({ reception, model, address, ownerEditingAllowed = false, embedded = false,
  ownerDestinations, account, onEditReception, onOpenOverview, onCloseBento, unavailableTarget = false,
  onOpenCanvas, onOpenWriting, onConnect, onDisconnect, notice, onRetry }) {
  useStartupDestinationReady();
  const [exploring, setExploring] = useState(false);
  const explore = useRef(null), roomTitle = useRef(null), flightArea = useRef(null), previous = useRef(false);
  const scrollRoot = useRef(null), pageRoot = useRef(null), trigger = useRef(null);
  const presentation = useReceptionPresentation();
  const [opened, setOpened] = useState(null), [sourceError, setSourceError] = useState('');
  const { restoreFocus } = useDeferredFocusReturn();
  const open = (reference, button) => {
    const destination = resolvePresentationDestination(presentation?.snapshot, reference);
    if (destination.status !== 'ready') { setSourceError('That canvas or camera point is unavailable.'); return; }
    trigger.current = button; setSourceError('');
    setOpened({ id: destination.entry.id, destinationId: reference.destinationId, origin: button?.closest('.workbench-overview-card, .reception-region, .reception-document-cell') });
  };
  const selectedCanvas = presentation?.snapshot.entries.find(entry => entry.id === opened?.id);
  const selectedModel = useMemo(() => selectedCanvas && workbenchOverviewModel(selectedCanvas.draft),
    [selectedCanvas]);
  const close = () => { setOpened(null); restoreFocus(() => trigger.current?.isConnected ? trigger.current : pageRoot.current); };
  useLayoutEffect(() => {
    if (exploring) roomTitle.current?.focus({ preventScroll: true });
    else if (previous.current) explore.current?.focus({ preventScroll: true });
    previous.current = exploring;
  }, [exploring]);
  const name = model?.profile?.displayName || 'Unnamed profile';
  const frameless = reception.version === 3 || Boolean(reception.arrangement);
  const actions = !exploring && <button className="workflow-tactile-control" type="button" ref={explore}
    onClick={() => setExploring(true)}>Explore</button>;
  const home = onCloseBento || onOpenOverview || (() => { setExploring(false); scrollRoot.current?.scrollTo({ top: 0 }); });
  return <>
    {!embedded && <PublicWorkspaceHeader model={model} account={account} current="Profile" ownerDestinations={ownerDestinations}
      onProfile={home} onWorks={onOpenCanvas} onWriting={onOpenWriting}
      onConnect={onConnect} onDisconnect={onDisconnect} />}
    <main data-public-header={!embedded || undefined} ref={pageRoot} className="reception-page system-workflow__token-scope"
    data-lattice-menu-surface data-workflow-material="tactile" data-workflow-finish="flat" data-frameless={frameless || undefined}
    data-profile-page={reception.version === 3 || undefined} data-published-focus-fallback tabIndex={-1} aria-label={`${name} profile`} style={{ '--reception-page-background': reception.backgroundColor || undefined,
      '--reception-bento-width': `${workbenchArea(reception.workbench).width}px` }}
    onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented && exploring) { event.preventDefault(); setExploring(false); } }}>
    <div className="reception-window" inert={opened ? '' : undefined}>
      <ReceptionHeader reception={reception} model={model}>
        {!frameless && actions}
      </ReceptionHeader>
      {notice && <div className="reception-notice" role="alert">{notice}{onRetry && <button type="button" onClick={onRetry}>Retry</button>}</div>}
      <div className="reception-window-workspace"><div className="reception-window-main"
        data-document={reception.version === 3 && !exploring || undefined} ref={scrollRoot}>
      {exploring ? <section className="exploration-room" aria-label="Exploration room">
        <header><button type="button" onClick={() => setExploring(false)}><ArrowLeft aria-hidden="true" />Back to Profile</button><span>01 / EXPLORATION</span></header>
        <div className="exploration-room__canvas" ref={flightArea}><div className="exploration-room__origin">
          <span className="reception-kicker">{name}</span><h1 ref={roomTitle} tabIndex={-1}>A space to explore.</h1><p>The world starts here.</p>
          <span className="exploration-room__marker" aria-hidden="true" />
        </div>
          {ownerEditingAllowed && <Suspense fallback={<p role="status">Opening Keeper dock…</p>}>
            <ExplorationKeeper profileAddress={address} flightAreaRef={flightArea} onEdit={onEditReception} onReturn={() => setExploring(false)} />
          </Suspense>}
        </div>
        <footer>{ownerEditingAllowed ? '2800 × 1800 · Camera follows Keeper · Metal beams only · Direct recall.' : 'Exploration wireframe · The profile owner can configure a Keeper here.'}</footer>
      </section> : <>
        {unavailableTarget && <p className="reception-notice" role="status">That destination is no longer in this publication.</p>}
        {reception.version === 3
          ? <Suspense fallback={<p role="status">Opening Profile…</p>}><ReceptionDocumentCanvas reception={reception} model={model} address={address} onOpenSource={open} /></Suspense>
          : <ReceptionCanvas reception={reception} model={model} address={address} onOpenSource={open} />}
        {sourceError && <p role="status">{sourceError}</p>}
      </>}
      </div></div>
      {frameless && <footer className="reception-page-actions">{actions}</footer>}
    </div>
    {selectedCanvas && <Suspense fallback={<p role="status">Opening canvas…</p>}><CanvasPresentation key={selectedCanvas.id}
      selected={selectedCanvas} model={selectedModel} origin={opened.origin} initialDestinationId={opened.destinationId} onClose={close} /></Suspense>}
  </main></>;
}
