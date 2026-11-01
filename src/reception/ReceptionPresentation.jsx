import { createContext, useContext, useMemo } from 'react';
import { SceneNavigationProvider } from '../text/SceneNavigation.jsx';
import { workbenchOverviewModel } from '../public/workbenchOverview/workbenchOverviewModel.js';

const Presentation = createContext(null);
export const useReceptionPresentation = () => useContext(Presentation);
const noAssets = new Map();

// Receives already-authorized immutable snapshots. It has no storage, editor,
// account or publication capabilities. The caller owns which snapshot is read.
export default function ReceptionPresentation({ snapshot, assets = noAssets, assetStatus = 'ready', children }) {
  const value = useMemo(() => snapshot ? { snapshot, assets, assetStatus, previews: snapshot.entries.map(entry => ({ ...entry,
    model: workbenchOverviewModel(entry.draft, assets) })) } : null, [snapshot, assets, assetStatus]);
  const content = <Presentation.Provider value={value}>{children}</Presentation.Provider>;
  return snapshot ? snapshot.entries.reduceRight((child, entry) => <SceneNavigationProvider key={entry.id}
    scope={{ profileAddress: snapshot.profileAddress, canvasId: entry.id, revision: snapshot.revision }} content={entry.draft}>
    {child}</SceneNavigationProvider>, content) : content;
}
