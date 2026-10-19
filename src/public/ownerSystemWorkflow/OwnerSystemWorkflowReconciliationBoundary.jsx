import { lazy, Suspense, useEffect, useState } from 'react';
import { StartupDestinationFailure } from '../../startveil/StartupDestinationContext.jsx';
import ProfileEditingBoundary from '../../systemWorkflow/ProfileEditingBoundary.jsx';
import WorkbenchBackupControls from '../../systemWorkflow/WorkbenchBackupControls.jsx';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { bindWorkbenchTextRecovery } from '../../text/textEditRecovery.js';

const OwnerSystemWorkflowRuntime = lazy(() => import('./OwnerSystemWorkflowRuntime.jsx'));

export default function OwnerSystemWorkflowReconciliationBoundary(props) {
  return <ProfileEditingBoundary profileAddress={props.profileAddress} onView={props.onOpenReception}>
    <ReconciliationSession key={props.profileAddress} {...props} />
  </ProfileEditingBoundary>;
}

function ReconciliationSession(props) {
  const { profileAddress, publishedResolution, reviewStorage } = props;
  const publishedDocument = ['RESOLVED', 'STALE'].includes(publishedResolution?.status)
    ? publishedResolution.document
    : null;
  const [state, setState] = useState('LOADING');
  const [failure, setFailure] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState('LOADING');
    setFailure(null);
    let phase = 'LOAD_RECONCILIATION';
    let store;
    import('../../profileDocument/storage/ownerDraftReconciliation.js')
      .then(({ reconcileOwnerDraftWithPublishedProfile }) => {
        if (!active) return null;
        store = createSystemWorkflowDraftStore({ profileAddress, storage: reviewStorage ?? globalThis.localStorage, requireEditor: true });
        bindWorkbenchTextRecovery(store);
        const record = store.getRecordState();
        if (!['absent', 'valid'].includes(record.status)) return { ...record, status: 'LOCAL_DRAFT_UNAVAILABLE' };
        phase = 'RECONCILE_DRAFT';
        return reconcileOwnerDraftWithPublishedProfile({
          document: publishedDocument,
          profileAddress,
          storage: reviewStorage ?? globalThis.localStorage,
          store,
        });
      })
      .then(result => {
        if (!active) return;
        if (['HYDRATION_FAILED', 'LOCAL_DRAFT_UNAVAILABLE', 'HYDRATED_WITHOUT_BASELINE'].includes(result?.status)) {
          setFailure({ code: result.status, reason: result.reason, issues: result.issues, fingerprint: result.fingerprint, store });
          setState('ERROR');
        } else setState('READY');
      })
      .catch(error => {
        if (!active) return;
        setFailure({ code: phase, reason: String(error?.message || 'Unexpected failure').slice(0, 500),
          issues: error?.errors?.slice(0, 5).map(({ path, code, message }) => ({ path, code, message })) });
        setState('ERROR');
      });
    return () => { active = false; };
  }, [profileAddress, publishedDocument, reviewStorage, attempt]);
  // Disposal cancels a reset before it can affect a different profile or request.
  useEffect(() => {
    if (!resetting || !failure?.fingerprint) return undefined;
    let active = true;
    import('../../systemWorkflow/systemWorkflowDraftStore.js').then(({ createSystemWorkflowDraftStore }) => {
      if (!active) return;
      const store = createSystemWorkflowDraftStore({ profileAddress, storage: reviewStorage ?? globalThis.localStorage, requireEditor: true });
      const reset = store.resetCorruptDraft({ expectedFingerprint: failure.fingerprint, profileAddress });
      setResetting(false);
      if (reset) { setState('LOADING'); setAttempt(value => value + 1); }
      else setResetError('The draft changed or browser storage is unavailable. Reload before trying again.');
    }).catch(() => {
      if (!active) return;
      setResetting(false);
      setResetError('The local draft could not be reset. Reload to try again.');
    });
    return () => { active = false; };
  }, [resetting, failure, profileAddress, reviewStorage]);
  if (state === 'LOADING') return null;
  if (state === 'ERROR') return <StartupDestinationFailure title="Local workspace could not be opened">
    <p>{failure?.code === 'LOCAL_DRAFT_UNAVAILABLE'
      ? 'The saved draft could not be read. It has not been replaced.'
      : failure?.code === 'HYDRATED_WITHOUT_BASELINE'
        ? 'The published workspace was saved locally, but its reconciliation record could not be saved.'
        : 'The published workspace could not be aligned with the local draft.'}</p>
    <p>Details: {failure?.code}{failure?.reason ? ` / ${failure.reason}` : ''}</p>
    {failure?.issues?.map((issue, index) => <p key={index}>{issue.path}: {issue.code}{issue.message ? ` — ${issue.message}` : ''}</p>)}
    {failure?.store && <WorkbenchBackupControls store={failure.store} storage={reviewStorage ?? globalThis.localStorage}
      onRestored={warning => { if (!warning) { setState('LOADING'); setAttempt(value => value + 1); } }} />}
    {failure?.fingerprint && publishedDocument && <>
      <p>Discard this profile’s incompatible local draft and try restoring its published workspace.</p>
      <button className="published-profile-retry" type="button" disabled={resetting}
        onClick={() => { setResetError(null); setResetting(true); }}>
        {resetting ? 'RESETTING…' : 'RESET LOCAL DRAFT AND RELOAD'}
      </button>
    </>}
    {resetError && <p role="alert">{resetError}</p>}
  </StartupDestinationFailure>;
  return <Suspense fallback={null}><OwnerSystemWorkflowRuntime {...props} /></Suspense>;
}
