import { Folder, Layers3, Plus, SquareStack, UserRound, WandSparkles } from 'lucide-react';
import { BROWSER_ASSET_SIZE, BROWSER_VIEW_KINDS, categoryAssetIds } from '../browser/browserWorkspaceModel.js';

const assetId = (asset) => asset?.stableAssetId || asset?.id;

function NavButton({ active, categoryId, count, dropTarget, Icon = Folder, label, onClick, onContextMenu, unresolved = 0 }) {
  return <button aria-label={label} data-active={active || undefined} data-browser-category-id={categoryId}
    data-drop-target={dropTarget || undefined} onClick={onClick} onContextMenu={onContextMenu} title={label} type="button">
    <span><Icon aria-hidden="true" size={14} strokeWidth={2} /><b>{label}</b></span>
    <i title={unresolved ? `${count} visible / ${unresolved} unresolved` : `${count} visible`}>{count}{unresolved ? ` / ${unresolved} U` : ''}</i>
  </button>;
}

function RelatedAssetResults({ assets, onActivate, onContext, onPointerDown, workspace }) {
  if (!assets.length) return <p className="lattice-browser-status">{workspace.emptyLabel}</p>;
  const selected = new Set(workspace.selectedAssetIds);
  const size = Math.min(BROWSER_ASSET_SIZE.MAXIMUM, Math.max(BROWSER_ASSET_SIZE.MINIMUM, Number(workspace.assetSize) || BROWSER_ASSET_SIZE.DEFAULT));
  return <div className="lattice-browser-assets" data-labels={workspace.hideLabels ? 'hidden' : 'visible'} data-size="grid"
    onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault(); event.stopPropagation(); workspace.selectAllVisible();
    } }} style={{ '--lattice-browser-asset-media-max': `${Math.round(size * 1.15)}px`, '--lattice-browser-asset-min': `${size}px` }}>
    {assets.map((asset) => {
      const id = assetId(asset); const isSelected = selected.has(id);
      const ratio = Number(asset.width) > 0 && Number(asset.height) > 0 ? `${asset.width} / ${asset.height}` : '1 / 1';
      return <button aria-label={[asset.title || id, asset.collection].filter(Boolean).join(' / ')} aria-pressed={isSelected}
        className="lattice-browser-asset" data-multi-selected={isSelected && selected.size > 1 || undefined}
        data-selected={isSelected || undefined} key={id} onClick={(event) => workspace.selectAsset(id, event)}
        onDoubleClick={(event) => onActivate?.(event, asset)} onPointerDown={(event) => onPointerDown?.(event, asset)}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContext?.(event, asset); }}
        onKeyDown={(event) => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault(); event.stopPropagation(); onContext?.(event, asset);
        } }} type="button">
        <span className="lattice-browser-asset__media" style={{ aspectRatio: ratio }}><img alt="" aria-hidden="true"
          className="lattice-browser-asset__decoded-image" decoding="async" draggable="false" loading="lazy"
          onError={() => workspace.markAssetUnavailable(id, asset.previewSrc)} src={asset.previewSrc} /></span>
        {!workspace.hideLabels && <span className="lattice-browser-asset__record"><strong>{asset.title || id}</strong>
          {asset.collection && <small>{asset.collection}</small>}
          <small className="lattice-browser-asset__relationships">{[asset.owned ? 'OWNED' : null, asset.created ? 'CREATED' : null,
            asset.created && !asset.owned ? 'NOT OWNED' : null].filter(Boolean).join(' · ')}</small></span>}
      </button>;
    })}
  </div>;
}

export default function Modul8rLibraryPanel({ categoryDropTargetId, categorySectionRef, data, onAssetActivate,
  onAssetContext, onAssetPointerDown, onCategoryContext, onCreateCategory, onRetryCreated, relationshipView,
  selectRelationshipView, workspace }) {
  const assets = workspace.renderableAssets; const categories = data.categories || [];
  const renderableIds = new Set(workspace.renderableAssetIds); const filed = categoryAssetIds(categories);
  const related = relationshipView === 'owned' ? workspace.filteredAssets.filter((asset) => asset.owned)
    : relationshipView === 'created' ? workspace.filteredAssets.filter((asset) => asset.created) : workspace.filteredAssets;
  const emptyLabel = workspace.hasActiveFilters && workspace.viewAssetCount
    ? `${workspace.viewAssetCount} ASSETS ARE IN THIS VIEW / NONE MATCH THE ACTIVE SEARCH OR FILTERS`
    : relationshipView === 'created' && data.createdStatus === 'loading' ? 'LOADING CREATOR-ATTRIBUTED WORKS'
      : relationshipView === 'created' && data.createdStatus === 'error' ? 'CREATED SOURCE UNAVAILABLE' : 'NO ASSETS IN THIS VIEW';
  const selectBuiltIn = (view) => { selectRelationshipView('all'); workspace.selectView(view); };
  return <div className="lattice-browser-panel" style={{ '--lattice-browser-sidebar-width': `${workspace.sidebarWidth}px` }}>
    <nav aria-label="Browser navigation" className="lattice-browser-sidebar">
      <NavButton active={relationshipView === 'all' && workspace.view.kind === BROWSER_VIEW_KINDS.ALL} count={assets.length} Icon={Layers3} label="All Assets" onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.ALL, id: null })} />
      <NavButton active={relationshipView === 'owned'} count={assets.filter((asset) => asset.owned).length} Icon={UserRound} label="Owned" onClick={() => { selectRelationshipView('owned'); workspace.selectView({ kind: BROWSER_VIEW_KINDS.ALL, id: null }); }} />
      <NavButton active={relationshipView === 'created'} count={assets.filter((asset) => asset.created).length} Icon={WandSparkles} label="Created" onClick={() => { selectRelationshipView('created'); workspace.selectView({ kind: BROWSER_VIEW_KINDS.ALL, id: null }); }} />
      <NavButton active={relationshipView === 'all' && workspace.view.kind === BROWSER_VIEW_KINDS.UNSORTED} count={assets.filter((asset) => !filed.has(assetId(asset))).length} Icon={SquareStack} label="Unsorted" onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.UNSORTED, id: null })} />
      <div className="lattice-browser-sidebar__category-heading" ref={categorySectionRef} tabIndex={-1}>{onCreateCategory && <button
        aria-label="Create category" className="lattice-browser-sidebar__create" onClick={(event) => onCreateCategory(event.currentTarget)} type="button"><Plus aria-hidden="true" size={14} /><span>CREATE</span></button>}</div>
      <div className="lattice-browser-category-list">{categories.map((category) => <NavButton
        active={relationshipView === 'all' && workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY && workspace.view.id === category.id}
        categoryId={category.id} count={category.assetIds.filter((id) => renderableIds.has(id)).length}
        dropTarget={categoryDropTargetId === category.id} key={category.id} label={category.name}
        onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: category.id })}
        onContextMenu={(event) => { event.preventDefault(); onCategoryContext?.(event, category); }}
        unresolved={category.assetIds.filter((id) => !renderableIds.has(id)).length} />)}{!categories.length && <p>NO CATEGORIES</p>}</div>
    </nav>
    <button aria-label="Resize Browser navigation" className="lattice-browser-sidebar-resize" onLostPointerCapture={workspace.sidebarResize.finish}
      onPointerCancel={workspace.sidebarResize.finish} onPointerDown={workspace.sidebarResize.begin} onPointerMove={workspace.sidebarResize.update}
      onPointerUp={workspace.sidebarResize.finish} title="Resize Browser navigation" type="button" />
    <main className="lattice-browser-results">{data.error && <p className="lattice-browser-notice" data-error>{data.error}</p>}
      {data.createdError && <div className="lattice-browser-notice" data-error role="status">CREATED SOURCE UNAVAILABLE{data.createdRetained ? ' / RETAINED RESULTS' : ''}{onRetryCreated && <button onClick={onRetryCreated} type="button">RETRY</button>}</div>}
      {data.createdStatus === 'loading' && <p className="lattice-browser-notice" role="status">LOADING CREATED {data.createdProgress?.resolved || 0} / {data.createdProgress?.total || 0}</p>}
      <RelatedAssetResults assets={related} onActivate={onAssetActivate} onContext={onAssetContext} onPointerDown={onAssetPointerDown}
        workspace={{ ...workspace, emptyLabel }} />
    </main>
  </div>;
}
