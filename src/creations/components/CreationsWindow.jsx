import { useEffect, useMemo, useRef } from 'react';
import { RotateCw, Search, X } from 'lucide-react';
import { searchCreations } from '../domain/searchCreations.js';
import { useCreationsStore } from '../state/useCreationsStore.js';
import CreationCard from './CreationCard.jsx';
import CreationPreview from './CreationPreview.jsx';

export default function CreationsWindow({ viewedProfileAddress, onClose, dragHandleProps, dragEnabled, escapeEnabled = true }) {
  const state = useCreationsStore();
  const searchRef = useRef(null);
  useEffect(() => { state.load(viewedProfileAddress); }, [viewedProfileAddress]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || !escapeEnabled) return;
      if (useCreationsStore.getState().selectedAssetId) useCreationsStore.getState().selectAsset(null);
      else onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [escapeEnabled, onClose]);

  const visible = useMemo(() => searchCreations(state.assets, state.searchQuery), [state.assets, state.searchQuery]);
  const selected = state.assets.find((creation) => creation.id === state.selectedAssetId) || null;
  const emptyMessage = state.searchQuery ? 'No creations match this search.' : 'No creator-attributed NFTs were found for this profile.';

  return <div className="creations-window">
    <header className="creations-window__header" {...(dragEnabled ? dragHandleProps : {})}>
      <div><h2 id="creations-title">Creations</h2><p>LSP4 creator-attributed works</p></div>
      <div className="creations-window__source" data-source={state.sourceMode}>{state.sourceMode === 'FIXTURE' ? 'FIXTURE DATA' : 'LIVE INDEXER'}</div>
      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label="Close Creations"><X aria-hidden="true" /></button>
    </header>
    <div className="creations-toolbar">
      <label><Search aria-hidden="true" /><input ref={searchRef} type="search" value={state.searchQuery} onChange={(event) => state.setSearchQuery(event.target.value)} placeholder="Search creations" aria-label="Search Creations" /></label>
      <span>{visible.length} result{visible.length === 1 ? '' : 's'}</span>
      {(state.status === 'loading' || state.status === 'fallback') && <strong role="status">Loading {state.progress.total ? `${state.progress.resolved}/${state.progress.total}` : ''}</strong>}
      {(state.status === 'error' || state.liveError) && <button type="button" onClick={state.retry}><RotateCw aria-hidden="true" /> Retry live</button>}
    </div>
    {state.liveError && <p className="creations-window__notice" role="alert">Live indexer failed: {state.liveError}{state.sourceMode === 'FIXTURE' ? ' · Showing fixture data.' : ''}</p>}
    <div className="creations-grid">
      {visible.length ? visible.map((creation) => <CreationCard key={creation.id} creation={creation} onOpen={() => state.selectAsset(creation.id)} />)
        : state.status !== 'loading' && <p className="creations-empty" role="status">{emptyMessage}</p>}
    </div>
    <CreationPreview creation={selected} onClose={() => state.selectAsset(null)} />
  </div>;
}
