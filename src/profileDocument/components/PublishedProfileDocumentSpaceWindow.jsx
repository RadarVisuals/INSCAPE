import { useMemo, useState } from 'react';
import { Minus, X } from 'lucide-react';
import AssetGrid from '../../library/components/AssetGrid.jsx';
import AssetPreview from '../../library/components/AssetPreview.jsx';
import { projectDocumentSpace } from '../domain/documentProjection.js';

const EMPTY_WORKSPACE = Object.freeze({ favorites: [], folders: [] });
export default function PublishedProfileDocumentSpaceWindow({ space, minimized = false, dragHandleProps = {}, onMinimize, onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const projected = useMemo(() => projectDocumentSpace(space), [space]);
  const selected = projected.find((asset) => asset.id === selectedId) || null;
  return <article className="collection-window folder-window profile-document-space-window" data-published-document-only data-minimized={minimized || undefined}>
    <header className="collection-window__header published-space-window__drag-handle" {...dragHandleProps}><div><span>Published space / verified document</span><h2>{space.label}</h2></div><p>{projected.length} assets</p><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onMinimize} aria-label={`${minimized ? 'Restore' : 'Minimize'} ${space.label}`}><Minus aria-hidden="true" /></button><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label={`Close ${space.label}`}><X aria-hidden="true" /></button></header>
    {!minimized && <div className="collection-window__body folder-window__body"><main className="collection-content">
      <div className="collection-content__heading"><h3>{space.label}</h3><div><span>{projected.length} references</span></div></div>
      <AssetGrid assets={projected} workspace={EMPTY_WORKSPACE} onSelect={setSelectedId} emptyMessage={`${space.label} is empty.`} />
    </main><AssetPreview asset={selected} workspace={EMPTY_WORKSPACE} onClose={() => setSelectedId(null)} /></div>}
  </article>;
}
