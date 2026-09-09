import { lazy, Suspense, useEffect, useState } from 'react';
import { StartupDestinationFailure } from '../../startveil/StartupDestinationContext.jsx';

const OwnerSystemWorkflowRuntime = lazy(() => import('./OwnerSystemWorkflowRuntime.jsx'));

export default function OwnerSystemWorkflowReconciliationBoundary(props) {
  const { profileAddress, publishedResolution, reviewStorage } = props;
  const publishedDocument = ['RESOLVED', 'STALE'].includes(publishedResolution?.status)
    ? publishedResolution.document
    : null;
  const [state, setState] = useState(publishedDocument ? 'LOADING' : 'READY');
  useEffect(() => {
    let active = true;
    if (!publishedDocument) {
      setState('READY');
      return () => { active = false; };
    }
    setState('LOADING');
    import('../../profileDocument/storage/ownerDraftReconciliation.js')
      .then(({ reconcileStoredOwnerDraftWithPublishedProfile }) => active && reconcileStoredOwnerDraftWithPublishedProfile({
        document: publishedDocument,
        profileAddress,
        storage: reviewStorage ?? globalThis.localStorage,
      }))
      .then(result => active && setState(['HYDRATION_FAILED', 'LOCAL_DRAFT_UNAVAILABLE', 'HYDRATED_WITHOUT_BASELINE'].includes(result?.status) ? 'ERROR' : 'READY'))
      .catch(() => active && setState('ERROR'));
    return () => { active = false; };
  }, [profileAddress, publishedDocument, reviewStorage]);
  if (state === 'LOADING') return null;
  if (state === 'ERROR') return <StartupDestinationFailure title="Published workspace alignment failed" />;
  return <Suspense fallback={null}><OwnerSystemWorkflowRuntime {...props} /></Suspense>;
}
