import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { beforeProfileEditorRelease } from '../../systemWorkflow/profileEditorLease.js';
import { SceneNavigationProvider } from '../../text/SceneNavigation.jsx';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createEditorPreferencesStore } from './editorPreferencesStore.js';
import { createWorkbenchPreferencesStore } from './workbenchPreferences.js';
import { createReceptionEditorScope } from '../../reception/receptionEditorScope.js';
import WorkbenchBackupControls from '../../systemWorkflow/WorkbenchBackupControls.jsx';
import { workbenchSaveError } from './namedWorkbenchActions.js';
const OwnerWorkbenchOverview = lazy(() => import('../workbenchOverview/OwnerWorkbenchOverview.jsx'));

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
  const [sidebarSession] = useState(() => editorPreferences.ref('sidebar'));
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
  const openReception = useCallback(() => {
    if (!reception?.isCurrent()) setReception(createReceptionEditorScope(store));
    setOpeningError(null); setOverview(false);
  }, [reception, store]);
  const openOverview = useCallback(() => {
    reception?.release(); setReception(null); setOpeningError(null); setOverview(true);
  }, [reception]);
  const selectDocument = id => {
    if (id === 'reception') openReception();
    else {
      if (!store.listWorkbenches().some(item => item.id === id)) throw new Error('This canvas is no longer available.');
      const previous = reception?.isCurrent() ? reception : null;
      previous?.release();
      try {
        if (!store.switchWorkbench(id)) throw workbenchSaveError(store);
      } catch (error) {
        if (previous) setReception(createReceptionEditorScope(store));
        throw error;
      }
      setReception(null); setOverview(false); setOpeningError(null);
    }
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
    <button type="button" onClick={openOverview}>My Inscape</button></main>;
  if (overview) return <Suspense fallback={<p role="status">Opening My Inscape…</p>}>
    <OwnerWorkbenchOverview store={store} reviewAssets={props.reviewAssets} reviewProfile={props.reviewProfile}
      preferences={workbenchPreferenceStore}
      view={overviewView} onViewChange={setOverviewView}
      onOpen={() => { setOverview(false); props.onEditorDocumentChange?.('canvas'); }} onOpenReception={props.onOpenReception}
      onEditReception={() => selectDocument('reception')} />
  </Suspense>;
  const scope = reception?.isCurrent() ? reception : store.getWorkbenchScope();
  return (
    <EditorDocument key={activation} component={Session} scope={scope} revision={activation}
        {...props}
        onOpenWorkbenchOverview={openOverview}
        onEditReception={() => selectDocument('reception')}
        documentNavigation={{ items: store.listWorkbenches(), activeId: scope.getWorkbenchId(), select: selectDocument }}
        reception={scope === reception ? { collection, backupControls: <WorkbenchBackupControls store={store}
          storage={props.reviewStorage ?? globalThis.localStorage} onRestored={props.onDraftRestored} /> } : undefined}
        editorPreferences={editorPreferences}
        workbenchPreferenceStore={workbenchPreferenceStore}
        keeperDockPositions={keeperDockPositions}
        navigatorPosition={navigatorPosition}
        sidebarSession={sidebarSession}
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
