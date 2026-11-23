import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { beforeProfileEditorRelease } from '../../systemWorkflow/profileEditorLease.js';
import { SceneNavigationProvider } from '../../text/SceneNavigation.jsx';
import { canvasModuleDraft, studioCellsUnavailableReason } from '../../systemWorkflow/domain/studioComposition.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createEditorPreferencesStore } from './editorPreferencesStore.js';
import { createWorkbenchPreferencesStore } from './workbenchPreferences.js';
import { createReceptionEditorScope } from '../../reception/receptionEditorScope.js';
import { createReceptionTextMeasure } from '../../reception/measureReceptionText.jsx';
import { StartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import WorkbenchBackupControls from '../../systemWorkflow/WorkbenchBackupControls.jsx';
import { workbenchSaveError } from './namedWorkbenchActions.js';
import { openStudioWorkbench } from '../../profileDocument/storage/ownerDraftReconciliation.js';

// Replacing a profile, restored backup or active composition remounts its editor.
export default function OwnerWorkbenchSession({ component: Session, ...props }) {
  const [restored, setRestored] = useState({ revision: 0, warning: null });
  return (
    <LocalWorkbenchSession
      component={Session}
      key={`${props.profileAddress?.toLowerCase()}:${restored.revision}`}
      {...props}
      restored={restored.revision > 0}
      restoreWarning={restored.warning}
      onDraftRestored={warning => setRestored(value => ({ revision: value.revision + 1, warning }))}
    />
  );
}

function LocalWorkbenchSession({ component: Session, rootStore, ...props }) {
  const [overview, setOverview] = useState(props.canvasOverviewRequested === true);
  const [journey, setJourney] = useState(null);
  const saveBeforeRoute = useRef(null);
  const localNavigation = useRef(null);
  const returning = useRef(false);
  const overviewMemory = useRef({ cameras: new Map(), scroll: null });
  const [reception, setReception] = useState(null);
  const [openingError, setOpeningError] = useState(null);
  const appliedRequest = useRef(null);
  const { requestedWorkId, onEditorDocumentChange } = props;
  const request = requestedWorkId || (props.receptionEditorRequested ? 'reception' : props.canvasOverviewRequested ? 'overview' : 'canvas');
  const [readyRequest, setReadyRequest] = useState(null);
  const [overviewView, setOverviewView] = useState(() => ({ layout: props.canvasOverviewRequested && innerWidth < 900 ? 'grid' : 'list', wrap: true }));
  const [store] = useState(() =>
    rootStore || createSystemWorkflowDraftStore({
      profileAddress: props.profileAddress,
      storage: props.reviewStorage ?? globalThis.localStorage,
      requireEditor: true,
      initialStudio: true,
    })
  );
  const [editorPreferences] = useState(() =>
    createEditorPreferencesStore({
      profile: props.profileAddress,
      storage: props.reviewStorage ?? globalThis.localStorage,
      canSave: store.hasWriteAccess,
      width: innerWidth,
    })
  );
  const [keeperDockPositions] = useState(() => editorPreferences.ref('keeper'));
  const [workbenchPreferenceStore] = useState(() =>
    createWorkbenchPreferencesStore({
      profile: props.profileAddress,
      storage: props.reviewStorage ?? globalThis.localStorage,
      canSave: store.hasWriteAccess,
      fresh: store.getRecordState().status === 'absent',
    })
  );
  const [navigatorPosition] = useState(() => editorPreferences.ref('navigator'));
  // Flush before the parent releases its editor lease, including page-cache exits.
  useLayoutEffect(() => {
    editorPreferences.resume();
    workbenchPreferenceStore.resume();
    workbenchPreferenceStore.flush();
    const flush = () => {
      editorPreferences.flush();
      workbenchPreferenceStore.flush();
    };
    const stop = beforeProfileEditorRelease(props.profileAddress, flush);
    addEventListener('beforeunload', flush);
    return () => {
      stop();
      removeEventListener('beforeunload', flush);
      editorPreferences.dispose();
      workbenchPreferenceStore.dispose();
    };
  }, [editorPreferences, workbenchPreferenceStore, props.profileAddress]);
  const activation = useSyncExternalStore(store.subscribe, store.getActivation);
  const generation = useSyncExternalStore(store.subscribe, store.getGeneration);
  const collection = useMemo(() => reception && ({ kind: 'local', profileAddress: props.profileAddress, revision: 'editor', generation,
    entries: store.listWorkbenches().map(item => store.readWorkbench(item.id)) }), [store, props.profileAddress, generation, reception]);
  const activeCanvasId = store.getWorkbenchId();
  const lastCanvas = editorPreferences.section('lastCanvasId');
  // A legacy single-canvas draft can predate the picker. Its saved layout or
  // artwork identifies the canvas; Reception alone does not establish a visit.
  const [previousCanvas] = useState(() => {
    if (lastCanvas.getSnapshot() !== undefined || store.getRecordState().status !== 'valid') return null;
    const draft = store.getSnapshot();
    const hasCanvas = store.isCollection() || draft.workbench || draft.shapes?.length || draft.imageModules?.length
      || draft.texts?.length || draft.miniApps?.length || draft.displays?.length || draft.grids.some(grid => grid.placements.length);
    return hasCanvas ? store.getWorkbenchId() : null;
  });
  useEffect(() => {
    if (readyRequest !== request || openingError || !store.hasWriteAccess()) return;
    if (!overview && reception?.getWorkbenchId() !== 'reception') {
      if (lastCanvas.getSnapshot() !== activeCanvasId) lastCanvas.update(activeCanvasId);
    } else if (lastCanvas.getSnapshot() === undefined) lastCanvas.update(previousCanvas);
  }, [activeCanvasId, lastCanvas, openingError, overview, previousCanvas, readyRequest, reception, request, store]);
  const openNative = useCallback(id => createReceptionEditorScope(store, {
    ...createReceptionTextMeasure(), documentId: id === 'reception' ? undefined : id,
  }), [store]);
  const openReception = useCallback(() => {
    if (reception?.getWorkbenchId() !== 'reception' || !reception.isCurrent()) {
      reception?.release();
      setReception(openNative('reception'));
    }
    setOpeningError(null); setOverview(false);
  }, [openNative, reception]);
  const showOverview = useCallback(source => {
    reception?.release();
    setReception(null); setOpeningError(null); setOverview(true);
    setJourney(source ? { source, direction: 'overview' } : null);
  }, [reception]);
  const openOverview = source => {
    returning.current = true;
    showOverview(source);
    localNavigation.current = 'overview';
    (props.onManageCompositions || props.onReturnToWorks)?.();
  };
  const updateEditorRoute = id => {
    localNavigation.current = id;
    onEditorDocumentChange?.(id === 'reception' ? 'reception' : 'canvas', id);
  };
  const activateCanvas = useCallback(id => {
    if (reception?.isCurrent() && reception.getWorkbenchId() === id) {
      setOpeningError(null); setOverview(false); return;
    }
    if (reception?.isCurrent()) reception.checkTransition();
    // Switch first: failed persistence must leave the originating scope usable.
    if (!openStudioWorkbench(store, id, props.publishedResolution)) throw workbenchSaveError(store);
    reception?.release();
    setReception(store.getSnapshot().composition ? openNative(id) : null);
    setOverview(false); setOpeningError(null);
  }, [openNative, props.publishedResolution, reception, store]);
  const selectDocument = (id, source) => {
    if (id === 'reception') openReception();
    else activateCanvas(id);
    setJourney(source ? { source, direction: 'editor' } : null);
    updateEditorRoute(id);
  };
  const prepareDocumentChange = () => {
    if (activation !== store.getActivation() || reception && !reception.isCurrent())
      throw new Error('The active composition changed. Open its menu again.');
    if (saveBeforeRoute.current && !saveBeforeRoute.current())
      throw new Error('Save the current changes before switching documents.');
    reception?.checkTransition();
  };
  const createDocument = (name, layout) => {
    prepareDocumentChange();
    const id = store.createWorkbench(name.trim(), { layout });
    if (!id) throw workbenchSaveError(store);
    selectDocument(id);
  };
  const enableCanvasModules = () => {
    prepareDocumentChange();
    if (!store.enableCurrentCanvasModules()) throw workbenchSaveError(store);
  };
  const renameDocument = name => {
    prepareDocumentChange();
    if (!store.renameWorkbench(name.trim())) throw workbenchSaveError(store);
  };
  const removeDocument = () => {
    prepareDocumentChange();
    const id = store.deleteWorkbench(store.getWorkbenchId());
    if (!id) throw workbenchSaveError(store);
    selectDocument(id);
  };
  // UI commands already saved and activated their document. Only an external
  // route (reload or browser history) needs to perform that transition here.
  useLayoutEffect(() => {
    if (appliedRequest.current === request) return;
    const previous = appliedRequest.current;
    appliedRequest.current = request;
    const handled = localNavigation.current === request;
    localNavigation.current = null;
    if (!handled) {
      if (previous && !overview && !openingError && saveBeforeRoute.current && !saveBeforeRoute.current()) {
        const id = reception?.getWorkbenchId() || store.getWorkbenchId();
        localNavigation.current = id;
        onEditorDocumentChange?.(id === 'reception' ? 'reception' : 'canvas', id, { replace: true });
        return;
      }
      try {
        setJourney(null);
        if (request === 'overview') { returning.current = Boolean(previous); showOverview(null); }
        else if (request === 'reception') openReception();
        else activateCanvas(requestedWorkId || store.getWorkbenchId());
      } catch (error) { setOpeningError(error.message); }
    }
    setReadyRequest(request);
  }, [request, overview, openingError, reception, store, requestedWorkId, onEditorDocumentChange, openReception, activateCanvas, showOverview]);
  // The in-place adoption is an ordinary Undo entry, so undo/redo may change
  // which projection is appropriate without changing the work's ID or URL.
  useLayoutEffect(() => {
    if (readyRequest !== request || overview || openingError || reception?.getWorkbenchId() === 'reception') return;
    if (store.getSnapshot().composition && !reception?.isCurrent()) setReception(openNative(store.getWorkbenchId()));
    else if (!store.getSnapshot().composition && reception?.isCurrent()) {
      reception.release({ force: true });
      setReception(null);
    }
  }, [generation, openNative, openingError, overview, readyRequest, reception, request, store]);
  useEffect(() => () => reception?.release({ force: true }), [reception]);
  if (!readyRequest) return <p role="status">Opening Studio…</p>;
  if (openingError) return <main className="published-profile-status" data-published-focus-fallback tabIndex={-1}>
    <StartupDestinationReady />
    <section className="published-profile-status__card">
      <header><span>INSCAPE</span><h1>Composition unavailable</h1></header>
      <div className="published-profile-status__body">
        <p role="alert">{openingError}</p>
        <button type="button" className="published-profile-retry" onClick={props.onReturnToWorks || (() => openOverview())}>Back to Gallery</button>
        <WorkbenchBackupControls store={store} storage={props.reviewStorage ?? globalThis.localStorage} onRestored={props.onDraftRestored} />
      </div>
    </section>
  </main>;
  const scope = reception?.isCurrent() ? reception : store.getWorkbenchScope();
  const canUseCanvasModules = readyRequest === request && scope === reception && scope.getWorkbenchId() !== 'reception'
    && Boolean(canvasModuleDraft(store.getSnapshot()));
  const cellsUnavailableReason = scope === reception ? '' : studioCellsUnavailableReason(store.getSnapshot());
  return (
    <EditorDocument key={activation} component={Session} scope={scope} revision={activation}
        {...props}
        overview={{ active: overview, store, view: overviewView, onViewChange: setOverviewView, memory: overviewMemory.current,
          onEdit: selectDocument, journey, saveBeforeRoute, returning: returning.current,
          onJourneyComplete: () => setJourney(null) }}
        onOpenWorkbenchOverview={openOverview}
        onEditReception={() => selectDocument('reception')}
        documentNavigation={{ items: store.listWorkbenches(), activeId: scope.getWorkbenchId(), lastCanvas: lastCanvas.getSnapshot, select: selectDocument, create: createDocument, rename: renameDocument, remove: removeDocument,
          enableCanvasModules: canUseCanvasModules ? enableCanvasModules : undefined,
          beginFirstCell: scope !== reception && !cellsUnavailableReason ? store.beginFirstCell : undefined, cellsUnavailableReason,
          onCanvasChange: updateEditorRoute }}
        reception={scope === reception ? { collection, backupControls: <WorkbenchBackupControls store={store}
          storage={props.reviewStorage ?? globalThis.localStorage} receptionRecovery={scope.getWorkbenchId() === 'reception' ? { scope: reception, collection, publishedResolution: props.publishedResolution } : undefined}
          onRestored={props.onDraftRestored} /> } : undefined}
        editorPreferences={editorPreferences}
        workbenchPreferenceStore={workbenchPreferenceStore}
        keeperDockPositions={keeperDockPositions}
        navigatorPosition={navigatorPosition}
        focusWorkbench={activation > 0 || Boolean(props.requestedWorkId)}
      />
  );
}

function EditorDocument({ component: Session, scope, revision, ...props }) {
  const content = useSyncExternalStore(scope.subscribe, scope.getSnapshot);
  return <SceneNavigationProvider scope={{ profileAddress: scope.getProfileAddress(), canvasId: scope.getWorkbenchId(), revision }} content={content}>
    <Session {...props} sharedStore={scope} />
  </SceneNavigationProvider>;
}
