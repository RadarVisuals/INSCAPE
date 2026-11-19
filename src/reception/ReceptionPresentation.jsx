import { createContext, useContext, useMemo } from 'react';
import { SceneNavigationProvider } from '../text/SceneNavigation.jsx';

const Presentation = createContext(null);
export const useReceptionPresentation = () => useContext(Presentation);
const noAssets = new Map();

// Receives already-authorized immutable snapshots. It has no storage, editor,
// account or publication capabilities. The caller owns which snapshot is read.
export default function ReceptionPresentation({ snapshot, assets = noAssets, assetStatus = 'ready', profile, onOpenSource, scenes = true, children }) {
  const value = useMemo(() => snapshot ? { snapshot, assets, assetStatus, profile, onOpenSource } : null,
    [snapshot, assets, assetStatus, profile, onOpenSource]);
  const content = <Presentation.Provider value={value}>{children}</Presentation.Provider>;
  return snapshot && scenes ? snapshot.entries.reduceRight((child, entry) => <SceneNavigationProvider key={entry.id}
    scope={{ profileAddress: snapshot.profileAddress, canvasId: entry.id, revision: snapshot.revision }} content={entry.draft}>
    {child}</SceneNavigationProvider>, content) : content;
}
