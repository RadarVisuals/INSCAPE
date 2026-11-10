import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { beforeProfileEditorRelease } from '../../systemWorkflow/profileEditorLease.js';
import { SceneNavigationProvider } from '../../text/SceneNavigation.jsx';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createEditorPreferencesStore } from './editorPreferencesStore.js';
import { createWorkbenchPreferencesStore } from './workbenchPreferences.js';
import { createReceptionEditorScope } from '../../reception/receptionEditorScope.js';
import { createReceptionTextMeasure } from '../../reception/measureReceptionText.jsx';
import WorkbenchBackupControls from '../../systemWorkflow/WorkbenchBackupControls.jsx';
import { workbenchSaveError } from './namedWorkbenchActions.js';

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
  const [editorAction, setEditorAction] = useState(null);
  const overviewMemory = useRef({ cameras: new Map(), scroll: null });
  const [reception, setReception] = useState(null);
  const [openingError, setOpeningError] = useState(null);
  const appliedRequest = useRef(null);
  const request = props.receptionEditorRequested ? 'reception' : props.canvasOverviewRequested ? 'overview' : 'canvas';
  const [readyRequest, setReadyRequest] = useState(null);
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
  const generation = useSyncExternalStore(store.subscribe, store.getGeneration);
  const collection = useMemo(() => ({ kind: 'local', profileAddress: props.profileAddress, revision: 'editor', generation,
    entries: store.listWorkbenches().map(item => store.readWorkbench(item.id)) }), [store, props.profileAddress, generation]);
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
    if (!overview && !reception) {
      if (lastCanvas.getSnapshot() !== activeCanvasId) lastCanvas.update(activeCanvasId);
    } else if (lastCanvas.getSnapshot() === undefined) lastCanvas.update(previousCanvas);
  }, [activeCanvasId, lastCanvas, openingError, overview, previousCanvas, readyRequest, reception, request, store]);
  const openReception = useCallback(() => {
    if (!reception?.isCurrent()) setReception(createReceptionEditorScope(store, createReceptionTextMeasure()));
    setOpeningError(null); setOverview(false);
  }, [reception, store]);
  const openOverview = useCallback(source => {
    setOpeningError(null); setOverview(true);
    setJourney(source ? { source, direction: 'overview' } : null);
  }, []);
  const selectDocument = (id, source, action) => {
    if (id === 'reception') openReception();
    else {
      if (!store.listWorkbenches().some(item => item.id === id)) throw new Error('This canvas is no longer available.');
      const previous = reception?.isCurrent() ? reception : null;
      previous?.release();
      try {
        if (!store.switchWorkbench(id)) throw workbenchSaveError(store);
      } catch (error) {
        if (previous) setReception(createReceptionEditorScope(store, createReceptionTextMeasure()));
        throw error;
      }
      setReception(null); setOverview(false); setOpeningError(null);
    }
    setJourney(source ? { source, direction: 'editor' } : null);
    setEditorAction(action || null);
    props.onEditorDocumentChange?.(id === 'reception' ? 'reception' : 'canvas');
  };
  // Routes request a document in this same session. Local selection and editing
  // remain here; opening Reception never creates another editor/preferences host.
  useEffect(() => {
    if (appliedRequest.current === request) return;
    appliedRequest.current = request;
    try {
      if (request === 'reception') openReception();
      else if (request === 'overview') openOverview();
      else {
        reception?.release();
        setReception(null); setOpeningError(null); setOverview(false);
      }
    } catch (error) { setOpeningError(error.message); }
    setReadyRequest(request);
  }, [request, reception, openReception, openOverview]);
  useEffect(() => () => reception?.release({ force: true }), [reception]);
  if (readyRequest !== request) return <p role="status">Opening Editor…</p>;
  if (openingError) return <main className="public-shell"><p role="alert">{openingError}</p>
    <WorkbenchBackupControls store={store} storage={props.reviewStorage ?? globalThis.localStorage} onRestored={props.onDraftRestored} />
    <button type="button" onClick={() => openOverview()}>My Inscape</button></main>;
  const scope = reception?.isCurrent() ? reception : store.getWorkbenchScope();
  return (
    <EditorDocument key={activation} component={Session} scope={scope} revision={activation}
        {...props}
        overview={{ active: overview, store, view: overviewView, onViewChange: setOverviewView, memory: overviewMemory.current,
          onEdit: selectDocument, onResume: () => { setJourney(null); setEditorAction(null); setOverview(false); }, journey, onJourneyComplete: () => setJourney(null),
          editorAction, onActionComplete: () => setEditorAction(null) }}
        onOpenWorkbenchOverview={openOverview}
        onEditReception={() => selectDocument('reception')}
        documentNavigation={{ items: store.listWorkbenches(), activeId: scope.getWorkbenchId(), lastCanvas: lastCanvas.getSnapshot, select: selectDocument }}
        reception={scope === reception ? { collection, backupControls: <WorkbenchBackupControls store={store}
          storage={props.reviewStorage ?? globalThis.localStorage} onRestored={props.onDraftRestored} /> } : undefined}
        editorPreferences={editorPreferences}
        workbenchPreferenceStore={workbenchPreferenceStore}
        keeperDockPositions={keeperDockPositions}
        navigatorPosition={navigatorPosition}
        focusWorkbench={activation > 0}
      />
  );
}

function EditorDocument({ component: Session, scope, revision, ...props }) {
  const content = useSyncExternalStore(scope.subscribe, scope.getSnapshot);
  return <SceneNavigationProvider scope={{ profileAddress: scope.getProfileAddress(), canvasId: scope.getWorkbenchId(), revision }} content={content}>
    <Session {...props} sharedStore={scope} />
  </SceneNavigationProvider>;
}
