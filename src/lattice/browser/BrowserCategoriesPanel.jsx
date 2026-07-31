import BrowserAssetResults from './BrowserAssetResults.jsx';

const assetId = (asset) => asset?.stableAssetId || asset?.id;

export default function BrowserCategoriesPanel({ data, onAssetContext, onCategoryContext, onCreateCategory, workspace }) {
  const category = workspace.selectedCategory;
  const assignedIds = new Set(category?.assetIds || []);
  const assignedAssets = data.assets.filter((asset) => assignedIds.has(assetId(asset)));
  return (
    <div className="lattice-browser-panel">
      <aside className="lattice-browser-sidebar lattice-chrome-scroll-region">
        <small>CATEGORY STRUCTURE / PROFILE SCOPED</small>
        {data.categories.map((entry) => (
          <button data-active={category?.id === entry.id || undefined} key={entry.id} onClick={() => workspace.setSelectedCategoryId(entry.id)}
            onContextMenu={onCategoryContext ? (event) => { event.preventDefault(); event.stopPropagation(); onCategoryContext(event, entry); } : undefined}
            onKeyDown={onCategoryContext ? (event) => {
              if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
              event.preventDefault(); event.stopPropagation(); onCategoryContext(event, entry);
            } : undefined} type="button">
            <span title={entry.name}>{entry.name}</span><i>{entry.public ? 'PUBLIC' : 'PRIVATE'} · {entry.assetIds.length}</i>
          </button>
        ))}
        {!data.categories.length && <p>NO CATEGORIES</p>}
        {onCreateCategory && <button className="lattice-browser-sidebar__create" onClick={(event) => onCreateCategory(event.currentTarget)} type="button"><span>+ NEW CATEGORY</span></button>}
      </aside>
      <section className="lattice-browser-results lattice-chrome-scroll-region" aria-label="Category organization">
        {category ? <>
          <header>
            <div><strong title={category.name}>{category.name}</strong><small>{category.public ? 'PUBLIC CATEGORY' : 'PRIVATE CATEGORY'}</small></div>
            <small>RIGHT-CLICK FOR CATEGORY COMMANDS</small>
          </header>
          <div className="lattice-browser-category-section">
            <div className="lattice-browser-section-label"><span>ASSIGNED ASSETS</span><small>{assignedAssets.length}</small></div>
            <BrowserAssetResults
              assets={assignedAssets}
              emptyLabel="NO ASSETS ASSIGNED"
              onContext={onAssetContext}
              onSelect={workspace.setSelectedAssetId}
              selectedAssetId={workspace.selectedAssetId}
            />
          </div>
        </> : <p className="lattice-browser-status">CREATE A CATEGORY TO ORGANIZE ASSETS</p>}
      </section>
    </div>
  );
}
