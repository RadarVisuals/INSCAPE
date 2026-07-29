import BrowserAssetResults from './BrowserAssetResults.jsx';

const assetId = (asset) => asset?.stableAssetId || asset?.id;

export default function BrowserCategoriesPanel({ data, workspace }) {
  const category = workspace.selectedCategory;
  const assignedIds = new Set(category?.assetIds || []);
  const assignedAssets = data.assets.filter((asset) => assignedIds.has(assetId(asset)));
  return (
    <div className="lattice-browser-panel">
      <aside className="lattice-browser-sidebar lattice-chrome-scroll-region">
        <small>CATEGORY STRUCTURE / READ ONLY</small>
        {data.categories.map((entry) => (
          <button data-active={category?.id === entry.id || undefined} key={entry.id} onClick={() => workspace.setSelectedCategoryId(entry.id)} type="button">
            <span title={entry.name}>{entry.name}</span><i>{entry.public ? 'PUBLIC' : 'PRIVATE'} · {entry.assetIds.length}</i>
          </button>
        ))}
        {!data.categories.length && <p>NO CATEGORIES</p>}
      </aside>
      <section className="lattice-browser-results lattice-chrome-scroll-region" aria-label="Category organization">
        {category ? <>
          <header>
            <div><strong title={category.name}>{category.name}</strong><small>{category.public ? 'PUBLIC CATEGORY' : 'PRIVATE CATEGORY'}</small></div>
            <small>ORGANIZATION COMMANDS UNAVAILABLE</small>
          </header>
          <div className="lattice-browser-category-section">
            <div className="lattice-browser-section-label"><span>ASSIGNED ASSETS</span><small>{assignedAssets.length}</small></div>
            <BrowserAssetResults
              assets={assignedAssets}
              emptyLabel="NO ASSETS ASSIGNED"
              onSelect={workspace.setSelectedAssetId}
              selectedAssetId={workspace.selectedAssetId}
            />
          </div>
          <div className="lattice-browser-category-section">
            <div className="lattice-browser-section-label"><span>INDEX MEMBERSHIP</span><small>READ ONLY</small></div>
            <div className="lattice-browser-assignment-list">
              {data.assets.map((asset) => {
                const id = assetId(asset);
                const included = assignedIds.has(id);
                return <div data-active={included || undefined} key={id}><span>{asset.title || 'UNRESOLVED ASSET'}</span><small>{included ? 'MEMBER' : 'NOT ASSIGNED'}</small></div>;
              })}
            </div>
          </div>
        </> : <p className="lattice-browser-status">CREATE A CATEGORY TO ORGANIZE ASSETS</p>}
      </section>
    </div>
  );
}
