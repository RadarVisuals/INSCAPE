import BrowserAssetResults from './BrowserAssetResults.jsx';

const assetId = (asset) => asset?.stableAssetId || asset?.id;

export default function BrowserCategoriesPanel({ commands, data, workspace }) {
  const category = workspace.selectedCategory;
  const assignedIds = new Set(category?.assetIds || []);
  const assignedAssets = data.assets.filter((asset) => assignedIds.has(assetId(asset)));
  return (
    <div className="lattice-browser-panel">
      <aside className="lattice-browser-sidebar lattice-chrome-scroll-region">
        <small>PUBLIC STRUCTURE</small>
        {data.categories.map((entry) => (
          <button data-active={category?.id === entry.id || undefined} key={entry.id} onClick={() => workspace.setSelectedCategoryId(entry.id)} type="button">
            <span title={entry.name}>{entry.name}</span><i>{entry.public ? 'PUBLIC' : 'PRIVATE'} · {entry.assetIds.length}</i>
          </button>
        ))}
        {!data.categories.length && <p>NO CATEGORIES</p>}
        <button className="lattice-browser-sidebar__create" onClick={(event) => workspace.setDialog({ returnFocus: event.currentTarget, type: 'create' })} type="button">+ CREATE CATEGORY</button>
      </aside>
      <section className="lattice-browser-results lattice-chrome-scroll-region" aria-label="Category organization">
        {category ? <>
          <header>
            <div><strong title={category.name}>{category.name}</strong><small>{category.public ? 'PUBLIC CATEGORY' : 'PRIVATE CATEGORY'}</small></div>
            <div className="lattice-browser-category-actions">
              <button onClick={(event) => workspace.setDialog({ category, returnFocus: event.currentTarget, type: 'rename' })} type="button">RENAME</button>
              <button onClick={() => commands.setCategoryPublic(category.id, !category.public)} type="button">{category.public ? 'UNPUBLISH' : 'PUBLISH'}</button>
              <button onClick={(event) => workspace.setDialog({ category, returnFocus: event.currentTarget, type: 'delete' })} type="button">DELETE</button>
            </div>
          </header>
          <div className="lattice-browser-category-section">
            <div className="lattice-browser-section-label"><span>ASSIGNED ASSETS</span><small>{assignedAssets.length}</small></div>
            <BrowserAssetResults
              actionLabel="REMOVE"
              assets={assignedAssets}
              emptyLabel="NO ASSETS ASSIGNED"
              onSelect={(id) => commands.setCategoryAsset(category.id, id, false)}
              selectedAssetId={null}
            />
          </div>
          <div className="lattice-browser-category-section">
            <div className="lattice-browser-section-label"><span>INDEX ASSIGNMENT</span><small>ADD OR REMOVE</small></div>
            <div className="lattice-browser-assignment-list">
              {data.assets.map((asset) => {
                const id = assetId(asset);
                const included = assignedIds.has(id);
                return <button aria-pressed={included} data-active={included || undefined} key={id} onClick={() => commands.setCategoryAsset(category.id, id, !included)} type="button"><span>{asset.title || 'UNRESOLVED ASSET'}</span><small>{included ? 'REMOVE' : 'ADD'}</small></button>;
              })}
            </div>
          </div>
        </> : <p className="lattice-browser-status">CREATE A CATEGORY TO ORGANIZE ASSETS</p>}
      </section>
    </div>
  );
}
