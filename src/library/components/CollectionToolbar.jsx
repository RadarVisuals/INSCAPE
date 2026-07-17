import { Search, X } from 'lucide-react';

export default function CollectionToolbar({ inputRef, query, onQueryChange, sourceMode, status, progress, liveError, onRetry }) {
  const loading = status === 'loading' || status === 'fallback';
  return (
    <div className="collection-toolbar">
      <label className="collection-search">
        <span className="sr-only">Search owned images</span>
        <Search aria-hidden="true" />
        <input ref={inputRef} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search owned images…" />
        {query && <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search"><X aria-hidden="true" /></button>}
      </label>
      <div className="collection-status" role="status" aria-live="polite">
        <strong data-source={sourceMode || 'pending'}>{sourceMode || 'CONNECTING'}</strong>
        <span>{progress.resolved}{progress.total ? ` / ${progress.total}` : ''}</span>
        {loading && <span>Resolving metadata</span>}
        {progress.failures > 0 && <span>{progress.failures} incomplete</span>}
        {(sourceMode === 'FIXTURE' || liveError) && <button type="button" onClick={onRetry}>Retry live data</button>}
      </div>
    </div>
  );
}
