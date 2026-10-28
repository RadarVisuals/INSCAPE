import { useMemo, useState } from 'react';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import WorkbenchOverview from '../../public/workbenchOverview/WorkbenchOverview.jsx';
import { workbenchOverviewModel } from '../../public/workbenchOverview/workbenchOverviewModel.js';
import { publishedPresentationSnapshot } from '../../presentation/presentationSources.js';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';

// A distinct overview of verified public canvases. Browsing has no local draft,
// editor or publication capabilities; layout and selection remain temporary.
export default function PublishedCanvasGallery({ document, onAbout }) {
  useStartupDestinationReady();
  const identity = useProfileIdentity(document.profile.address);
  const persona = useMemo(() => createPublishedIdentityRackViewModel({ document, identity }), [document, identity]);
  const previews = useMemo(() => publishedPresentationSnapshot(document).entries.map(entry => ({ ...entry,
    model: workbenchOverviewModel(entry.draft) })), [document]);
  const [selectedId, select] = useState(previews[0].id);
  const [view, setView] = useState({ layout: 'grid', wrap: true });
  const [cardSize, setCardSize] = useState(2);
  const selected = previews.find(item => item.id === selectedId) || previews[0];
  return <WorkbenchOverview items={previews} previews={previews} selected={selected} model={selected.model}
    profile={{ name: persona?.profile.displayName || document.profile.cachedIdentity.name, avatarUrl: persona?.profile.avatarUrl }}
    onSelect={select} view={view} onViewChange={setView} cardSize={cardSize} onCardSize={setCardSize} onOpenReception={onAbout} />;
}
