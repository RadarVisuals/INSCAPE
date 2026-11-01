import { lazy, Suspense, useMemo, useState, useSyncExternalStore } from 'react';
import { createProfileDraftReader } from '../systemWorkflow/profileDraftReader.js';
import { useProfileIdentity } from '../profileIdentity/state/useProfileIdentity.js';
import { createProductionIdentityDossierViewModel } from '../public/identity/productionIdentityDossierViewModel.js';
import { createPublishedIdentityRackViewModel } from '../profileDocument/components/publishedIdentityRackViewModel.js';
import ReceptionOverview from './ReceptionOverview.jsx';
import { createReception, projectReception } from '../profileDocument/domain/receptionPresentation.js';
import { publishedPresentationSnapshot } from '../presentation/presentationSources.js';
const OwnerReceptionCollection = lazy(() => import('./OwnerReceptionCollection.jsx'));

export default function OwnerReception({ address, document, onEditReception, onCanvases, onDiscover, onReturn }) {
  const [reader] = useState(() => createProfileDraftReader({ profileAddress: address, storage: localStorage }));
  const { draft, collection, status, stale } = useSyncExternalStore(reader.subscribe, reader.getSnapshot);
  const publicSnapshot = useMemo(() => document ? publishedPresentationSnapshot(document) : null, [document]);
  const [blank] = useState(createReception), identity = useProfileIdentity(address);
  const reception = useMemo(() => projectReception(draft?.reception || document?.reception || blank), [draft?.reception, document?.reception, blank]);
  const model = useMemo(() => draft || !document
    ? createProductionIdentityDossierViewModel({ identity, identityPresentation: draft?.identityPresentation, cachedIdentity: document?.profile.cachedIdentity })
    : createPublishedIdentityRackViewModel({ document, identity }), [draft, document, identity]);
  const failed = status === 'corrupt' || status === 'unavailable';
  const notice = failed ? `Your local Reception could not be read. ${stale ? 'Showing the last saved view.' : document ? 'Showing the published version.' : 'No saved view is available.'} Open Edit Reception to recover your draft.` : null;
  const View = collection ? OwnerReceptionCollection : ReceptionOverview;
  return <Suspense fallback={<p role="status">Opening Reception…</p>}><View snapshot={collection || publicSnapshot} reception={reception} model={model} address={address}
    notice={notice} onRetry={failed ? reader.refresh : undefined} ownerEditingAllowed onEdit={onEditReception}
    onReturnToWorkbench={onReturn} onOpenCanvas={onCanvases} onOpenDirectory={onDiscover} /></Suspense>;
}
