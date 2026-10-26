import { lazy, Suspense, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { beforeProfileEditorRelease } from '../../systemWorkflow/profileEditorLease.js';
import { SceneNavigationProvider } from '../../text/SceneNavigation.jsx';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createEditorPreferencesStore } from './editorPreferencesStore.js';
import { createWorkbenchPreferencesStore } from './workbenchPreferences.js';
const OwnerWorkbenchOverview = lazy(() => import('../workbenchOverview/OwnerWorkbenchOverview.jsx'));
const ReceptionStoreEditor = lazy(() => import('../../reception/ReceptionStoreEditor.jsx'));

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

function LocalWorkbenchSession({ component: Session, ...props }) {
  const [overview, setOverview] = useState(false);
  const [reception, setReception] = useState(false);
  const [overviewView, setOverviewView] = useState({ layout: 'list', wrap: true });
  const [store] = useState(() =>
    createSystemWorkflowDraftStore({
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
      fallbackSurfaceId: store.getDraft().appearance.surfaceId,
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
  if (reception) return <Suspense fallback={<p role="status">Opening Reception…</p>}>
    <ReceptionStoreEditor rootStore={store} onClose={() => setReception(false)} onCanvases={() => { setReception(false); setOverview(true); }}
      reviewAssets={props.reviewAssets} reviewCategories={props.reviewCategories} reviewProfile={props.reviewProfile}
      publishedDocument={props.publishedResolution?.document} storage={props.reviewStorage} />
  </Suspense>;
  if (overview) return <Suspense fallback={<p role="status">Opening Workbenches…</p>}>
    <OwnerWorkbenchOverview store={store} reviewAssets={props.reviewAssets} reviewProfile={props.reviewProfile}
      preferences={workbenchPreferenceStore}
      view={overviewView} onViewChange={setOverviewView}
      onOpen={() => setOverview(false)} onOpenReception={props.onOpenReception} />
  </Suspense>;
  return (
    <SceneNavigationProvider key={activation}>
      <Session
        {...props}
        onOpenWorkbenchOverview={() => setOverview(true)}
        onEditReception={() => setReception(true)}
        editorPreferences={editorPreferences}
        workbenchPreferenceStore={workbenchPreferenceStore}
        sharedStore={store.getWorkbenchScope()}
        keeperDockPositions={keeperDockPositions}
        navigatorPosition={navigatorPosition}
        sidebarSession={sidebarSession}
        focusWorkbench={activation > 0}
      />
    </SceneNavigationProvider>
  );
}
