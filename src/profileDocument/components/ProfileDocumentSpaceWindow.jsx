import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import AssetGrid from '../../library/components/AssetGrid.jsx';
import AssetPreview from '../../library/components/AssetPreview.jsx';
import { useLibraryStore } from '../../library/state/useLibraryStore.js';
import { projectDocumentSpace } from '../domain/documentProjection.js';

const EMPTY_WORKSPACE = Object.freeze({ favorites: [], folders: [] });
export default function ProfileDocumentSpaceWindow({ space, onClose }) {
  const assets = useLibraryStore((state) => state.assets);
  const load = useLibraryStore((state) => state.load);
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => { load(); }, [load]);
  const projected = useMemo(() => projectDocumentSpace(space, assets), [assets, space]);
  const selected = projected.find((asset) => asset.id === selectedId) || null;
  return <article className="collection-window folder-window profile-document-space-window">
    <header className="collection-window__header"><div><span>Public space / document</span><h2>{space.label}</h2></div><p>{projected.length} assets</p><button type="button" onClick={onClose} aria-label={`Close ${space.label}`}><X aria-hidden="true" /></button></header>
    <div className="collection-window__body folder-window__body"><main className="collection-content">
      <div className="collection-content__heading"><h3>{space.label}</h3><div><span>{projected.length} references</span></div></div>
      <AssetGrid assets={projected} workspace={EMPTY_WORKSPACE} onSelect={setSelectedId} emptyMessage={`${space.label} is empty.`} />
    </main><AssetPreview asset={selected} workspace={EMPTY_WORKSPACE} onClose={() => setSelectedId(null)} /></div>
  </article>;
}
