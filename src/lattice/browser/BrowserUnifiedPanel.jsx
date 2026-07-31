import { Folder, Grid3X3, Layers3, Plus, SquareStack } from 'lucide-react';
import BrowserAssetResults from './BrowserAssetResults.jsx';
import { BROWSER_SORTS, BROWSER_VIEW_KINDS, categoryAssetIds } from './browserWorkspaceModel.js';

function NavButton({ active, categoryId, count, dropTarget, Icon = Folder, label, onClick, onContextMenu, unresolved = 0 }) {
  return <button aria-label={label} data-active={active || undefined} data-browser-category-id={categoryId}
    data-drop-target={dropTarget || undefined} onClick={onClick} onContextMenu={onContextMenu} title={label} type="button">
    <span><Icon aria-hidden="true" size={14} strokeWidth={2} /><b>{label}</b></span>
    <i title={unresolved ? `${count} visible / ${unresolved} unresolved` : `${count} visible`}>{count}{unresolved ? ` / ${unresolved} U` : ''}</i>
  </button>;
}

export default function BrowserUnifiedPanel({ categoryDropTargetId, categorySectionRef, data, onAssetContext, onAssetPointerDown, onCategoryContext, onCreateCategory, workspace }) {
  const assets = workspace.renderableAssets; const categories = data.categories || [];
  const renderableIds = new Set(workspace.renderableAssetIds);
  const filed = categoryAssetIds(categories); const used = new Set(data.usedAssetIds || []);
  const title = workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY
    ? workspace.selectedCategory?.name || 'CATEGORY'
    : workspace.view.kind.toLocaleUpperCase();
  const categoryUnresolved = workspace.selectedCategory
    ? workspace.selectedCategory.assetIds.filter((id) => !renderableIds.has(id)).length : 0;
  return <div className="lattice-browser-panel" style={{ '--lattice-browser-sidebar-width': `${workspace.sidebarWidth}px` }}>
    <nav aria-label="Browser navigation" className="lattice-browser-sidebar">
      <small data-compact-label="01" title="Index">INDEX</small>
      <NavButton active={workspace.view.kind === BROWSER_VIEW_KINDS.ALL} count={assets.length} Icon={Layers3} label="All Assets" onClick={() => workspace.selectView({ kind: BROWSER_VIEW_KINDS.ALL, id: null })} />
      <NavButton active={workspace.view.kind === BROWSER_VIEW_KINDS.UNSORTED} count={assets.filter((asset) => !filed.has(asset.stableAssetId || asset.id)).length} Icon={SquareStack} label="Unsorted" onClick={() => workspace.selectView({ kind: BROWSER_VIEW_KINDS.UNSORTED, id: null })} />
      <NavButton active={workspace.view.kind === BROWSER_VIEW_KINDS.USED} count={assets.filter((asset) => used.has(asset.stableAssetId || asset.id)).length} Icon={Grid3X3} label="Used on Canvas" onClick={() => workspace.selectView({ kind: BROWSER_VIEW_KINDS.USED, id: null })} />
      <div className="lattice-browser-sidebar__category-heading"><small data-compact-label="02" ref={categorySectionRef} tabIndex={-1} title="Categories">CATEGORIES</small>
        {onCreateCategory && <button aria-label="Create category" className="lattice-browser-sidebar__create" onClick={(event) => onCreateCategory(event.currentTarget)} type="button"><Plus aria-hidden="true" size={14} /><span>CREATE</span></button>}
      </div>
      <div className="lattice-browser-category-list">
        {categories.map((category) => <NavButton active={workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY && workspace.view.id === category.id}
          categoryId={category.id} count={category.assetIds.filter((id) => renderableIds.has(id)).length}
          dropTarget={categoryDropTargetId === category.id}
          key={category.id} label={category.name} onClick={() => workspace.selectView({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: category.id })}
          onContextMenu={onCategoryContext ? (event) => { event.preventDefault(); onCategoryContext(event, category); } : undefined}
          unresolved={category.assetIds.filter((id) => !renderableIds.has(id)).length} />)}
        {!categories.length && <p>NO CATEGORIES</p>}
      </div>
    </nav>
    <button aria-label="Resize Browser navigation" className="lattice-browser-sidebar-resize"
      onLostPointerCapture={workspace.sidebarResize.finish} onPointerCancel={workspace.sidebarResize.finish}
      onPointerDown={workspace.sidebarResize.begin} onPointerMove={workspace.sidebarResize.update}
      onPointerUp={workspace.sidebarResize.finish} title="Resize Browser navigation" type="button" />
    <main className="lattice-browser-results">
      <div className="lattice-browser-toolbar">
        <label><span>COLLECTION</span><select aria-label="Filter collection" onChange={(event) => workspace.setCollection(event.target.value)} value={workspace.collection}><option value="all">ALL</option>{workspace.collections.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label><span>SORT</span><select aria-label="Sort assets" onChange={(event) => workspace.setSort(event.target.value)} value={workspace.sort}><option value={BROWSER_SORTS.TITLE_ASC}>TITLE A–Z</option><option value={BROWSER_SORTS.TITLE_DESC}>TITLE Z–A</option><option value={BROWSER_SORTS.COLLECTION}>COLLECTION</option></select></label>
        <label className="lattice-browser-label-toggle"><input checked={workspace.hideLabels} onChange={(event) => workspace.setHideLabels(event.target.checked)} type="checkbox" /><span>HIDE LABELS</span></label>
        <label className="lattice-browser-size-control"><span>SIZE</span><input aria-label="Asset preview size"
          aria-valuetext={workspace.assetSize === workspace.assetSizeBounds.LIST ? 'LIST' : `${workspace.assetSize} PIXELS`}
          max={workspace.assetSizeBounds.MAXIMUM} min={workspace.assetSizeBounds.MINIMUM}
          onChange={(event) => workspace.setAssetSize(Number(event.target.value))} step="1" type="range" value={workspace.assetSize} />
          <output>{workspace.assetSize === workspace.assetSizeBounds.LIST ? 'LIST' : workspace.assetSize}</output></label>
        {workspace.unavailableCount > 0 && <span className="lattice-browser-unavailable-count">{workspace.unavailableCount} UNAVAILABLE</span>}
      </div>
      <header><div><strong>{title}</strong><small>{workspace.hasActiveFilters
        ? `${workspace.filteredAssets.length} OF ${workspace.viewAssetCount} VISIBLE / FILTERED${categoryUnresolved ? ` / ${categoryUnresolved} UNRESOLVED` : ''}`
        : `${workspace.filteredAssets.length} VISIBLE${categoryUnresolved ? ` / ${categoryUnresolved} UNRESOLVED` : ''}`}</small></div>
        {workspace.hasActiveFilters && <button className="lattice-browser-clear-filters" onClick={workspace.clearFilters} type="button">CLEAR SEARCH / FILTERS</button>}
      </header>
      {data.error && <p className="lattice-browser-notice" data-error>{data.error}</p>}
      <BrowserAssetResults assetSize={workspace.assetSize} assets={workspace.filteredAssets} hideLabels={workspace.hideLabels}
        emptyLabel={workspace.hasActiveFilters && workspace.viewAssetCount
          ? `${workspace.viewAssetCount} ASSETS ARE IN THIS VIEW / NONE MATCH THE ACTIVE SEARCH OR FILTERS`
          : 'NO ASSETS IN THIS VIEW'}
        onContext={onAssetContext} onMediaUnavailable={workspace.markAssetUnavailable}
        onPointerDown={onAssetPointerDown} onSelect={workspace.selectAsset}
        onSelectAll={workspace.selectAllVisible} selectedAssetIds={workspace.selectedAssetIds} />
    </main>
  </div>;
}
