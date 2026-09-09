import { lazy, Suspense, useEffect, useState } from 'react';

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
      .then(({ reconcileStoredOwnerDraftWithPublishedProfile }) => reconcileStoredOwnerDraftWithPublishedProfile({
        document: publishedDocument,
        profileAddress,
        storage: reviewStorage ?? globalThis.localStorage,
      }))
      .then(() => active && setState('READY'))
      .catch(() => active && setState('ERROR'));
    return () => { active = false; };
  }, [profileAddress, publishedDocument, reviewStorage]);
  if (state === 'LOADING') return null;
  if (state === 'ERROR') return <div className="public-profile-state"><p>Published workspace alignment failed</p></div>;
  return <Suspense fallback={null}><OwnerSystemWorkflowRuntime {...props} /></Suspense>;
}
