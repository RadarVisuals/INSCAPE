import { useMemo } from 'react';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import WorkbenchOverview from '../../public/workbenchOverview/WorkbenchOverview.jsx';
import { workbenchOverviewModel } from '../../public/workbenchOverview/workbenchOverviewModel.js';
import { publishedPresentationSnapshot } from '../../presentation/presentationSources.js';

// A distinct overview of verified public canvases. Browsing has no local draft,
// editor or publication capabilities; layout and selection remain temporary.
export default function PublishedCanvasGallery({ document, persona, onAbout, view, onViewChange, selectedId, onSelect, cardSize, onCardSize, cameraMemory, visitorHeader }) {
  useStartupDestinationReady();
  const previews = useMemo(() => publishedPresentationSnapshot(document).entries.map(entry => ({ ...entry,
    model: workbenchOverviewModel(entry.draft) })), [document]);
  const selected = previews.find(item => item.id === selectedId) || previews[0];
  return <WorkbenchOverview items={previews} previews={previews} selected={selected} model={selected.model}
    profile={{ name: persona?.profile.displayName || document.profile.cachedIdentity.name, avatarUrl: persona?.profile.avatarUrl }}
    onSelect={onSelect} view={view} onViewChange={onViewChange} cardSize={cardSize} onCardSize={onCardSize} onOpenReception={onAbout}
    visitorHeader={visitorHeader} cameraMemory={cameraMemory} />;
}
