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

export function BrowserFilterControls({ className = 'lattice-browser-toolbar', labelsControlMode = 'hide', workspace }) {
  const labelsChecked = labelsControlMode === 'show' ? !workspace.hideLabels : workspace.hideLabels;
  return <div className={className}>
    <label className="lattice-browser-toolbar-select" data-display={workspace.collection === 'all' ? 'ALL' : workspace.collection}>
      <select aria-label="Filter collection" onChange={(event) => workspace.setCollection(event.target.value)} value={workspace.collection}>
        <option disabled>COLLECTIONS</option><option disabled>────────────</option>
        <option value="all">ALL</option><option disabled>────────────</option>
        {workspace.collections.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
    <label className="lattice-browser-toolbar-select" data-display="SORT" title={`Sort: ${workspace.sort}`}>
      <select aria-label="Sort assets" onChange={(event) => workspace.setSort(event.target.value)} value={workspace.sort}>
        <option disabled>SORT</option><option disabled>────────────</option>
        <option value={BROWSER_SORTS.TITLE_ASC}>TITLE A–Z</option><option value={BROWSER_SORTS.TITLE_DESC}>TITLE Z–A</option><option value={BROWSER_SORTS.COLLECTION}>COLLECTION</option>
      </select>
    </label>
    <label className="lattice-browser-label-toggle"><input checked={labelsChecked}
      onChange={(event) => workspace.setHideLabels(labelsControlMode === 'show' ? !event.target.checked : event.target.checked)}
      type="checkbox" /><span>LABELS</span></label>
    {workspace.hasActiveFilters && <button className="lattice-browser-clear-filters" onClick={workspace.clearFilters} type="button">CLEAR FILTERS</button>}
  </div>;
}

export default function BrowserUnifiedPanel({ assetDisplayMode = null, categoryDropTargetId, categorySectionRef, data, onAssetContext, onAssetPointerDown, onCategoryContext, onCreateCategory, showToolbar = true, workspace }) {
  const assets = workspace.renderableAssets; const categories = data.categories || [];
  const renderableIds = new Set(workspace.renderableAssetIds);
  const filed = categoryAssetIds(categories); const used = new Set(data.usedAssetIds || []);
  return <div className="lattice-browser-panel" style={{ '--lattice-browser-sidebar-width': `${workspace.sidebarWidth}px` }}>
    <nav aria-label="Browser navigation" className="lattice-browser-sidebar">
      <NavButton active={workspace.view.kind === BROWSER_VIEW_KINDS.ALL} count={assets.length} Icon={Layers3} label="All Assets" onClick={() => workspace.selectView({ kind: BROWSER_VIEW_KINDS.ALL, id: null })} />
      <NavButton active={workspace.view.kind === BROWSER_VIEW_KINDS.UNSORTED} count={assets.filter((asset) => !filed.has(asset.stableAssetId || asset.id)).length} Icon={SquareStack} label="Unsorted" onClick={() => workspace.selectView({ kind: BROWSER_VIEW_KINDS.UNSORTED, id: null })} />
      <NavButton active={workspace.view.kind === BROWSER_VIEW_KINDS.USED} count={assets.filter((asset) => used.has(asset.stableAssetId || asset.id)).length} Icon={Grid3X3} label="Used on Canvas" onClick={() => workspace.selectView({ kind: BROWSER_VIEW_KINDS.USED, id: null })} />
      <div className="lattice-browser-sidebar__category-heading" ref={categorySectionRef} tabIndex={-1}>
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
      {showToolbar && <BrowserFilterControls workspace={workspace} />}
      {data.error && <p className="lattice-browser-notice" data-error>{data.error}</p>}
      <BrowserAssetResults assetSize={workspace.assetSize} assets={workspace.filteredAssets} displayMode={assetDisplayMode} hideLabels={workspace.hideLabels}
        emptyLabel={workspace.hasActiveFilters && workspace.viewAssetCount
          ? `${workspace.viewAssetCount} ASSETS ARE IN THIS VIEW / NONE MATCH THE ACTIVE SEARCH OR FILTERS`
          : 'NO ASSETS IN THIS VIEW'}
        onContext={onAssetContext} onMediaUnavailable={workspace.markAssetUnavailable}
        onPointerDown={onAssetPointerDown} onSelect={workspace.selectAsset}
        onSelectAll={workspace.selectAllVisible} selectedAssetIds={workspace.selectedAssetIds} />
    </main>
  </div>;
}
