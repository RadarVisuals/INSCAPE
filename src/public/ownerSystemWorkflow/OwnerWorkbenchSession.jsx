import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { beforeProfileEditorRelease } from '../../systemWorkflow/profileEditorLease.js';
import { assertWorkbenchName } from '../../systemWorkflow/domain/workbenchCollection.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createEditorPreferencesStore } from './editorPreferencesStore.js';
import { createWorkbenchPreferencesStore } from './workbenchPreferences.js';
import { createCompositionEditorScope } from '../../composition/compositionEditorScope.js';
import { createCompositionTextMeasure } from '../../composition/measureCompositionText.jsx';
import { StartupDestinationContext, StartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
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
  const overviewSource = useRef(null);
  const returning = useRef(false);
  const overviewMemory = useRef({ cameras: new Map(), scroll: null });
  const [composition, setComposition] = useState(null);
  const [openingError, setOpeningError] = useState(null);
  const appliedRequest = useRef(null);
  const { requestedWorkId, onEditorDocumentChange } = props;
  const request = requestedWorkId || (props.canvasOverviewRequested ? 'overview' : 'canvas');
  const [readyRequest, setReadyRequest] = useState(null);
  const onDestinationReady = useContext(StartupDestinationContext);
  const [overviewView, setOverviewView] = useState(() => ({ layout: props.canvasOverviewRequested && innerWidth < 900 ? 'grid' : 'list', wrap: true }));
  const [store] = useState(() =>
    rootStore || createSystemWorkflowDraftStore({
      profileAddress: props.profileAddress,
      storage: props.reviewStorage ?? globalThis.localStorage,
      requireEditor: true,
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
  const openEditor = useCallback(id => createCompositionEditorScope(store, {
    ...createCompositionTextMeasure(), documentId: id,
  }), [store]);
  const showOverview = useCallback(source => {
    composition?.release();
    setComposition(null); setOpeningError(null); setOverview(true);
    setJourney(source ? { source, direction: 'overview' } : null);
  }, [composition]);
  const openOverview = source => {
    returning.current = true;
    localNavigation.current = 'overview';
    if (props.onManageCompositions) {
      // The router captures the live editor before committing its overview.
      overviewSource.current = source;
      props.onManageCompositions();
    } else {
      showOverview(source);
      props.onReturnToWorks?.();
    }
  };
  const updateEditorRoute = id => {
    localNavigation.current = id;
    onEditorDocumentChange?.(id);
  };
  const activateCanvas = useCallback(id => {
    if (composition?.isCurrent() && composition.getWorkbenchId() === id) {
      setOpeningError(null); setOverview(false); return;
    }
    if (composition?.isCurrent()) composition.checkTransition();
    // Switch first: failed persistence must leave the originating scope usable.
    if (!openStudioWorkbench(store, id, props.publishedResolution)) throw workbenchSaveError(store);
    composition?.release();
    setComposition(openEditor(id));
    setOverview(false); setOpeningError(null);
  }, [openEditor, props.publishedResolution, composition, store]);
  const selectDocument = (id, source) => {
    activateCanvas(id);
    setJourney(source ? { source, direction: 'editor' } : null);
    updateEditorRoute(id);
  };
  const prepareDocumentChange = () => {
    if (activation !== store.getActivation() || composition && !composition.isCurrent())
      throw new Error('The active composition changed. Open its menu again.');
    if (saveBeforeRoute.current && !saveBeforeRoute.current())
      throw new Error('Save the current changes before switching documents.');
    composition?.checkTransition();
  };
  const createDocument = (name, layout) => {
    const title = name.trim();
    assertWorkbenchName(title);
    prepareDocumentChange();
    const id = store.createWorkbench(title, { layout });
    if (!id) throw workbenchSaveError(store);
    selectDocument(id);
  };
  const renameDocument = name => {
    const title = name.trim();
    assertWorkbenchName(title);
    prepareDocumentChange();
    if (!store.renameWorkbench(title)) throw workbenchSaveError(store);
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
    const source = overviewSource.current;
    localNavigation.current = null;
    overviewSource.current = null;
    if (handled && request === 'overview') showOverview(source);
    if (!handled) {
      if (previous && !overview && !openingError && saveBeforeRoute.current && !saveBeforeRoute.current()) {
        const id = composition?.getWorkbenchId() || store.getWorkbenchId();
        localNavigation.current = id;
        onEditorDocumentChange?.(id, { replace: true });
        return;
      }
      try {
        setJourney(null);
        if (request === 'overview') { returning.current = Boolean(previous); showOverview(null); }
        else activateCanvas(requestedWorkId || store.getWorkbenchId());
      } catch (error) { setOpeningError(error.message); }
    }
    setReadyRequest(request);
  }, [request, overview, openingError, composition, store, requestedWorkId, onEditorDocumentChange, activateCanvas, showOverview]);
  useEffect(() => () => composition?.release({ force: true }), [composition]);
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
  const scope = composition?.isCurrent() ? composition : store.getWorkbenchScope();
  return (
    <StartupDestinationContext.Provider value={readyRequest === request ? onDestinationReady : null}>
      <Session key={activation} sharedStore={scope}
        {...props}
        overview={{ active: overview, store, view: overviewView, onViewChange: setOverviewView, memory: overviewMemory.current,
          onEdit: selectDocument, journey, saveBeforeRoute, returning: returning.current,
          onJourneyComplete: () => setJourney(null) }}
        onOpenWorkbenchOverview={openOverview}
        documentNavigation={{ items: store.listWorkbenches(), activeId: scope.getWorkbenchId(), select: selectDocument, create: createDocument, rename: renameDocument, remove: removeDocument,
          onCanvasChange: updateEditorRoute }}
        editorPreferences={editorPreferences}
        workbenchPreferenceStore={workbenchPreferenceStore}
        keeperDockPositions={keeperDockPositions}
        navigatorPosition={navigatorPosition}
        focusWorkbench={activation > 0 || Boolean(props.requestedWorkId)}
      />
    </StartupDestinationContext.Provider>
  );
}
