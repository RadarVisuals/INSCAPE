import BrowserAssetResults from './BrowserAssetResults.jsx';
import { BROWSER_FILING_FILTERS } from './browserWorkspaceModel.js';

const FILTER_LABELS = Object.freeze({
  [BROWSER_FILING_FILTERS.ALL]: 'ALL OWNED',
  [BROWSER_FILING_FILTERS.FAVORITES]: 'FAVORITES',
  [BROWSER_FILING_FILTERS.SORTED]: 'SORTED',
  [BROWSER_FILING_FILTERS.UNSORTED]: 'UNSORTED',
});

export default function BrowserIndexPanel({ data, workspace }) {
  const loading = data.assetLoadState === 'loading';
  const partial = data.assetLoadState === 'partial';
  const failed = data.assetLoadState === 'error';
  const progress = data.assetProgress;
  return (
    <div className="lattice-browser-panel">
      <aside className="lattice-browser-sidebar lattice-chrome-scroll-region">
        <small>ASSET VIEWS</small>
        {Object.values(BROWSER_FILING_FILTERS).map((filter) => (
          <button data-active={workspace.filing === filter || undefined} key={filter} onClick={() => workspace.setFiling(filter)} type="button">
            <span>{FILTER_LABELS[filter]}</span>
          </button>
        ))}
        <div className="lattice-browser-sidebar__rule" />
        <small>MEDIA</small>
        <button data-active={workspace.mediaType === 'all' || undefined} onClick={() => workspace.setMediaType('all')} type="button"><span>ALL MEDIA</span></button>
        {workspace.mediaTypes.map((type) => <button data-active={workspace.mediaType === type || undefined} key={type} onClick={() => workspace.setMediaType(type)} type="button"><span>{type.toUpperCase()}</span></button>)}
      </aside>
      <section className="lattice-browser-results lattice-chrome-scroll-region" aria-label="Indexed assets">
        <header>
          <strong>{FILTER_LABELS[workspace.filing]}</strong>
          <small>{workspace.filteredAssets.length} RESULTS</small>
        </header>
        {loading && <p className="lattice-browser-notice">RESOLVING ASSET POOL{Number.isFinite(progress?.total) && progress.total > 0 ? ` / ${progress.resolved || 0} OF ${progress.total}` : ''}</p>}
        {partial && <p className="lattice-browser-notice">PARTIAL ASSET RECORDS / UNRESOLVED VALUES REMAIN ABSENT</p>}
        {failed && <p className="lattice-browser-notice" data-error>ASSET INDEX UNAVAILABLE{data.assetError ? ` / ${data.assetError}` : ''}</p>}
        {data.rejectedAssetCount > 0 && <p className="lattice-browser-notice">{data.rejectedAssetCount} INVALID OR CROSS-PROFILE RECORDS REJECTED</p>}
        <BrowserAssetResults
          assets={workspace.filteredAssets}
          emptyLabel={loading ? 'WAITING FOR RESOLVED ASSETS' : failed ? 'NO CACHED ASSETS AVAILABLE' : 'NO ASSETS MATCH THIS VIEW'}
          onSelect={(id) => workspace.setSelectedAssetId(workspace.selectedAssetId === id ? null : id)}
          selectedAssetId={workspace.selectedAssetId}
        />
      </section>
    </div>
  );
}
