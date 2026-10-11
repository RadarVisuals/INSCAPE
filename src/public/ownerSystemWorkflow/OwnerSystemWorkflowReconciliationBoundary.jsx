import { lazy, Suspense, useEffect, useState } from 'react';
import { StartupDestinationFailure } from '../../startveil/StartupDestinationContext.jsx';

const OwnerSystemWorkflowRuntime = lazy(() => import('./OwnerSystemWorkflowRuntime.jsx'));

export default function OwnerSystemWorkflowReconciliationBoundary(props) {
  const { profileAddress, publishedResolution, reviewStorage } = props;
  const publishedDocument = ['RESOLVED', 'STALE'].includes(publishedResolution?.status)
    ? publishedResolution.document
    : null;
  const [state, setState] = useState(publishedDocument ? 'LOADING' : 'READY');
  const [failure, setFailure] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!publishedDocument) {
      setState('READY');
      return () => { active = false; };
    }
    setState('LOADING');
    setFailure(null);
    let phase = 'LOAD_RECONCILIATION';
    import('../../profileDocument/storage/ownerDraftReconciliation.js')
      .then(({ reconcileStoredOwnerDraftWithPublishedProfile }) => {
        if (!active) return null;
        phase = 'RECONCILE_DRAFT';
        return reconcileStoredOwnerDraftWithPublishedProfile({
          document: publishedDocument,
          profileAddress,
          storage: reviewStorage ?? globalThis.localStorage,
        });
      })
      .then(result => {
        if (!active) return;
        if (['HYDRATION_FAILED', 'LOCAL_DRAFT_UNAVAILABLE', 'HYDRATED_WITHOUT_BASELINE'].includes(result?.status)) {
          setFailure({ code: result.status, reason: result.reason, issues: result.issues, fingerprint: result.fingerprint });
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
      const store = createSystemWorkflowDraftStore({ profileAddress, storage: reviewStorage ?? globalThis.localStorage });
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
  if (state === 'ERROR') return <StartupDestinationFailure title="Published workspace alignment failed">
    <p>{failure?.code === 'LOCAL_DRAFT_UNAVAILABLE'
      ? 'The saved draft could not be read. It has not been replaced.'
      : failure?.code === 'HYDRATED_WITHOUT_BASELINE'
        ? 'The published workspace was saved locally, but its reconciliation record could not be saved.'
        : 'The published workspace could not be aligned with the local draft.'}</p>
    <p>Details: {failure?.code}{failure?.reason ? ` / ${failure.reason}` : ''}</p>
    {failure?.issues?.map((issue, index) => <p key={index}>{issue.path}: {issue.code}{issue.message ? ` — ${issue.message}` : ''}</p>)}
    {failure?.fingerprint && <>
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
