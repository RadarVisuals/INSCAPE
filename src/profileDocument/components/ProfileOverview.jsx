import { useMemo, useState } from 'react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import ReceptionOverview from '../../reception/ReceptionOverview.jsx';
import { createReception } from '../domain/receptionPresentation.js';
import { publishedPresentationSnapshot } from '../../presentation/presentationSources.js';

// Public projection; owner drafts are resolved at PublishedProfileBoundary.
export default function ProfileOverview({ document: publication, onReturnToWorkbench, unavailableTarget = false, onOpenDirectory, onReturn, onOpenCanvas }) {
  const identity = useProfileIdentity(publication.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document: publication, identity }), [publication, identity]);
  const [blank] = useState(createReception), reception = publication.reception || blank;
  const snapshot = useMemo(() => publishedPresentationSnapshot(publication), [publication]);
  return <ReceptionOverview snapshot={snapshot} reception={reception} model={model} address={publication.profile.address} menuSurface={publication.appearance.menuSurfaceId}
    onReturnToWorkbench={onReturnToWorkbench} unavailableTarget={unavailableTarget} onOpenDirectory={onOpenDirectory} onReturn={onReturn} onOpenCanvas={onOpenCanvas} />;
}
