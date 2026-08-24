import { ChevronDown, ChevronRight, Folder, Layers3, Plus, SquareStack, UserRound, WandSparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BROWSER_ASSET_SIZE, BROWSER_VIEW_KINDS, categoryAssetIds, categoryMembershipState } from '../../lattice/browser/browserWorkspaceModel.js';
import RackMenu from '../menus/RackMenu.jsx';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';
import { OwnerSystemWorkflowSidebarDeleteConfirmation, OwnerSystemWorkflowSidebarEditor } from './OwnerSystemWorkflowBrowserWorkspace.jsx';

const assetId = (asset) => asset?.stableAssetId || asset?.id;

function LibraryNavigationButton({ active, categoryId, count, draggable = false, dropTarget, icon: Icon = Folder,
  label, onClick, onContextMenu, onDragEnd, onDragStart, unresolved = 0 }) {
  return <button aria-label={label} aria-pressed={active} data-active={active || undefined}
    data-browser-category-id={categoryId} data-drop-target={dropTarget || undefined} draggable={draggable}
    onClick={onClick} onContextMenu={onContextMenu} onDragEnd={onDragEnd} onDragStart={onDragStart}
    title={label} type="button">
    <span><Icon aria-hidden="true" size={14} strokeWidth={2} /><b>{label}</b></span>
    <i title={unresolved ? `${count} visible / ${unresolved} unresolved` : `${count} visible`}>
      {count}{unresolved ? ` / ${unresolved} U` : ''}
    </i>
  </button>;
}

function LibraryResults({ assets, emptyLabel, onActivate, onContext, onPointerDown, workspace }) {
  const [decodedRatios, setDecodedRatios] = useState(() => new Map());
  if (!assets.length) return <p className="lattice-browser-status">{emptyLabel}</p>;
  const selected = new Set(workspace.selectedAssetIds);
  const size = Math.min(BROWSER_ASSET_SIZE.MAXIMUM, Math.max(BROWSER_ASSET_SIZE.MINIMUM,
    Number(workspace.assetSize) || BROWSER_ASSET_SIZE.DEFAULT));
  return <div className="lattice-browser-assets" data-labels={workspace.hideLabels ? 'hidden' : 'visible'} data-size="grid"
    onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault(); event.stopPropagation(); workspace.selectAllVisible();
    } }} style={{ '--lattice-browser-asset-media-max': `${Math.round(size * 1.15)}px`, '--lattice-browser-asset-min': `${size}px` }}>
    {assets.map((asset) => {
      const id = assetId(asset); const isSelected = selected.has(id);
      const ratio = decodedRatios.get(id)
        || (Number(asset.width) > 0 && Number(asset.height) > 0 ? `${asset.width} / ${asset.height}` : undefined);
      const opensCollection = asset.isCollection && asset.collectionRole !== 'cover';
      const relationships = asset.collectionRole === 'cover'
        ? [asset.collectionPreviewTokenId ? 'COLLECTION · TOKEN PREVIEW' : 'COLLECTION COVER']
        : [asset.owned ? 'OWNED' : null, asset.collectionPreviewTokenId ? 'TOKEN PREVIEW' : null,
          asset.creatorRelationship === 'collection' ? 'FROM CREATED COLLECTION' : asset.created ? 'CREATED' : null,
          asset.created && !asset.owned ? 'NOT OWNED' : null].filter(Boolean);
      return <button aria-label={[asset.title || id, asset.collection].filter(Boolean).join(' / ')} aria-pressed={isSelected}
        className="lattice-browser-asset" data-collection={opensCollection || undefined}
        data-multi-selected={isSelected && selected.size > 1 || undefined} data-selected={isSelected || undefined} key={id}
        onClick={(event) => opensCollection ? onActivate?.(event, asset) : workspace.selectAsset(id, event)}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContext?.(event, asset); }}
        onDoubleClick={(event) => onActivate?.(event, asset)} onPointerDown={(event) => onPointerDown?.(event, asset)}
        onKeyDown={(event) => { if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') {
          event.preventDefault(); event.stopPropagation(); onContext?.(event, asset);
        } }} type="button">
        <span className="lattice-browser-asset__media" style={ratio ? { aspectRatio: ratio } : undefined}><img alt="" aria-hidden="true"
          className="lattice-browser-asset__decoded-image" decoding="async" draggable="false" loading="lazy"
          onError={() => workspace.markAssetUnavailable(id, asset.previewSrc)}
          onLoad={(event) => {
            const { naturalHeight: height, naturalWidth: width } = event.currentTarget;
            if (!width || !height) return;
            setDecodedRatios((current) => {
              const value = `${width} / ${height}`;
              if (current.get(id) === value) return current;
              const next = new Map(current); next.set(id, value); return next;
            });
          }} src={asset.previewSrc} /></span>
        {!workspace.hideLabels && <span className="lattice-browser-asset__record"><strong>{asset.title || id}</strong>
          {asset.collection && <small>{asset.collection}</small>}
          {relationships.length > 0 && <span className="lattice-browser-asset__relationships">
            {relationships.map((relationship) => <small key={relationship}>{relationship}</small>)}
          </span>}
        </span>}
      </button>;
    })}
  </div>;
}

function contextAnchor(event) {
  if (event.type === 'contextmenu') return { x: event.clientX, y: event.clientY };
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: bounds.left + Math.min(18, bounds.width / 2), y: bounds.bottom };
}

export default function OwnerSystemWorkflowLibraryPresenter({ categoryCommands, data, menuSurfaceId,
  onAssetActivate, onAssetPointerDown, workspace }) {
  const categorySectionRef = useRef(null); const organizationGestureRef = useRef(null); const suppressSelectionRef = useRef(false);
  const [contextMenu, setContextMenu] = useState(null); const [organizationDrag, setOrganizationDrag] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());
  const [relationshipView, setRelationshipView] = useState('all');
  useEffect(() => () => organizationGestureRef.current?.cancel?.(), []);
  const restoreFocus = (trigger) => requestAnimationFrame(() => trigger?.focus?.({ preventScroll: true }));
  const closeContextMenu = (restore = true) => { const trigger = contextMenu?.trigger; clearOwnerSystemWorkflowDocumentSelection(); setContextMenu(null); if (restore) restoreFocus(trigger); };
  const closeDialog = () => { const trigger = workspace.dialog?.trigger; clearOwnerSystemWorkflowDocumentSelection(); workspace.setDialog(null); restoreFocus(trigger); };
  const openCreateDialog = (event, kind = 'category') => { workspace.ensureSidebarWidth?.();
    workspace.setDialog({ trigger: event.currentTarget, type: `create-${kind}` }); };
  const openCategoryContext = (event, category) => setContextMenu({ anchor: contextAnchor(event), categoryId: category.id, kind: 'category', trigger: event.currentTarget });
  const openSectionContext = (event, section) => setContextMenu({ anchor: contextAnchor(event), sectionId: section.id, kind: 'section', trigger: event.currentTarget });
  const openAssetContext = (event, asset) => {
    const ids = workspace.selectForContext(assetId(asset));
    setContextMenu({ anchor: contextAnchor(event), assetIds: ids, kind: 'membership', trigger: event.currentTarget });
  };
  const categoryMenuCommands = contextMenu?.kind === 'category' ? (() => {
    const category = data.categories.find(({ id }) => id === contextMenu.categoryId);
    return category ? [{ id: 'rename', label: 'Rename' },
      ...(categoryCommands?.moveCategory ? [{ id: 'move-root', label: 'Move / Outside sections' },
        ...(data.categoryOrganization?.sections || []).map((section) => ({ id: `move-section:${section.id}`, label: `Move / ${section.name}` }))] : []),
      { id: 'delete', label: 'Delete' }] : [];
  })() : [];
  const sectionMenuCommands = contextMenu?.kind === 'section' ? [{ id: 'rename-section', label: 'Rename' },
    { id: 'delete-section', label: 'Delete section / keep categories' }] : [];
  const membershipIds = contextMenu?.kind === 'membership' ? contextMenu.assetIds : workspace.selectedAssetIds;
  const currentMembershipCategory = workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY
    ? data.categories.find(({ id }) => id === workspace.view.id) : null;
  const membershipCommands = data.categories.length ? data.categories.flatMap((category) => {
    const command = { checkable: true, id: `membership:${category.id}`, label: category.name,
      mixed: categoryMembershipState(category, membershipIds) === 'mixed',
      selected: categoryMembershipState(category, membershipIds) === 'all' };
    return currentMembershipCategory?.id === category.id
      ? [{ id: `remove-current:${category.id}`, label: `Remove from ${category.name}` }, command] : [command];
  }) : [{ id: 'no-categories', label: 'No categories yet', disabled: true }];
  const handleContextCommand = (commandId) => {
    if (contextMenu?.kind === 'section') {
      const section = data.categoryOrganization?.sections?.find(({ id }) => id === contextMenu.sectionId);
      if (!section) return closeContextMenu();
      const trigger = contextMenu.trigger; closeContextMenu(false);
      if (commandId === 'delete-section') { workspace.setDialog({ section, trigger, type: 'delete-section' }); return; }
      workspace.setDialog({ section, trigger, type: commandId }); return;
    }
    if (contextMenu?.kind === 'category') {
      const category = data.categories.find(({ id }) => id === contextMenu.categoryId);
      if (!category) return closeContextMenu();
      const trigger = contextMenu.trigger; closeContextMenu(false);
      if (commandId === 'move-root' || commandId.startsWith('move-section:')) {
        categoryCommands.moveCategory?.(category.id, commandId === 'move-root' ? null : commandId.slice('move-section:'.length));
        restoreFocus(trigger); return;
      }
      if (commandId === 'rename') workspace.ensureSidebarWidth?.();
      workspace.setDialog({ category, trigger, type: commandId === 'rename' ? 'rename-category' : commandId }); return;
    }
    if (contextMenu?.kind !== 'membership' || !workspace.areAssetsRenderable(contextMenu.assetIds)) return closeContextMenu();
    if (commandId.startsWith('remove-current:')) {
      categoryCommands.setCategoryAssets(commandId.slice('remove-current:'.length), contextMenu.assetIds, false);
    } else {
      const categoryId = commandId.slice('membership:'.length);
      const category = data.categories.find(({ id }) => id === categoryId);
      if (category) categoryCommands.setCategoryAssets(category.id, contextMenu.assetIds, true);
    }
    closeContextMenu();
  };
  const beginOrganizationDrag = (event, asset) => {
    if (asset.isCollection && asset.collectionRole !== 'cover') return;
    const id = assetId(asset); const selectedIds = workspace.selectedAssetIds.includes(id) ? [...workspace.selectedAssetIds] : [id];
    if (event.button !== 0) return;
    if (selectedIds.length === 1) onAssetPointerDown?.(event, asset, workspace, { placementPreset: 'compact' });
    const element = event.currentTarget; const pointerId = event.pointerId; const start = { x: event.clientX, y: event.clientY };
    let started = false;
    const categoryAt = (pointerEvent) => document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
      ?.closest?.('[data-browser-category-id]')?.dataset.browserCategoryId || null;
    const move = (pointerEvent) => {
      if (Math.hypot(pointerEvent.clientX - start.x, pointerEvent.clientY - start.y) < 6) return;
      const categoryId = categoryAt(pointerEvent); if (!categoryId) { if (started) setOrganizationDrag(null); return; }
      started = true; setOrganizationDrag({ assetIds: selectedIds, categoryId, point: { x: pointerEvent.clientX, y: pointerEvent.clientY } });
    };
    const cleanup = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', finish);
      element.removeEventListener('pointercancel', cancel); if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
      organizationGestureRef.current = null; setOrganizationDrag(null); };
    const finish = (pointerEvent) => { const categoryId = started ? categoryAt(pointerEvent) : null;
      if (started) { pointerEvent.preventDefault(); pointerEvent.stopPropagation(); suppressSelectionRef.current = true; }
      cleanup(); if (categoryId && workspace.areAssetsRenderable(selectedIds)
        && data.categories.some(({ id: category }) => category === categoryId)) categoryCommands.setCategoryAssets(categoryId, selectedIds, true);
      if (started) setTimeout(() => { suppressSelectionRef.current = false; }, 0); };
    const cancel = () => cleanup(); organizationGestureRef.current = { assetIds: selectedIds, cancel };
    element.setPointerCapture?.(pointerId); element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', finish); element.addEventListener('pointercancel', cancel);
  };
  const confirmDialog = (name) => {
    const dialog = workspace.dialog; if (!dialog) return;
    const result = dialog.type === 'create-category' ? categoryCommands.createCategory(name)
      : dialog.type === 'create-section' ? categoryCommands.createSection?.(name)
        : dialog.type === 'rename-category' ? categoryCommands.renameCategory(dialog.category.id, name)
          : dialog.type === 'rename-section' ? categoryCommands.renameSection?.(dialog.section.id, name)
            : dialog.type === 'delete-section' ? categoryCommands.deleteSection?.(dialog.section.id)
              : categoryCommands.deleteCategory(dialog.category.id);
    if (!result) { workspace.setDialog({ ...dialog, error: 'Profile authority changed or command could not be saved.' }); return; }
    if (dialog.type === 'create-category') workspace.selectView({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: result }); closeDialog();
  };
  const confirmDeleteDialog = () => {
    const dialog = workspace.dialog; if (!dialog) return;
    const result = dialog.type === 'delete-section'
      ? categoryCommands.deleteSection?.(dialog.section.id)
      : categoryCommands.deleteCategory?.(dialog.category.id);
    if (!result) { workspace.setDialog({ ...dialog, error: 'Profile authority changed or command could not be saved.' }); return; }
    closeDialog();
  };
  const assets = workspace.renderableAssets; const categories = data.categories || []; const renderableIds = new Set(workspace.renderableAssetIds);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const organization = data.categoryOrganization || { rootCategoryIds: categories.map(({ id }) => id), sections: [] };
  const organizedIds = new Set([...(organization.rootCategoryIds || []),
    ...(organization.sections || []).flatMap(({ categoryIds }) => categoryIds || [])]);
  const rootCategoryIds = [...(organization.rootCategoryIds || []), ...categories.filter(({ id }) => !organizedIds.has(id)).map(({ id }) => id)];
  const filed = categoryAssetIds(categories); const related = relationshipView === 'owned'
    ? workspace.filteredAssets.filter((asset) => asset.owned) : relationshipView === 'created'
      ? workspace.filteredAssets.filter((asset) => asset.created) : workspace.filteredAssets;
  const selectBuiltIn = (view) => { setRelationshipView('all'); workspace.selectView(view); };
  const beginTreeDrag = (event, payload) => {
    event.stopPropagation(); event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-inscape-library-tree', JSON.stringify(payload));
    setOrganizationDrag({ tree: payload });
  };
  const readTreeDrag = (event) => { try { return JSON.parse(event.dataTransfer.getData('application/x-inscape-library-tree')); } catch { return null; } };
  const acceptTreeDrop = (event, target) => {
    event.preventDefault(); event.stopPropagation(); const payload = readTreeDrag(event); setOrganizationDrag(null); if (!payload) return;
    if (payload.kind === 'category') categoryCommands.moveCategory?.(payload.id, target.sectionId || null, target.beforeId || null);
    if (payload.kind === 'section' && target.kind === 'section') categoryCommands.moveSection?.(payload.id, target.beforeId || null);
  };
  const renderCategory = (categoryId, sectionId = null) => {
    const category = categoriesById.get(categoryId); if (!category) return null;
    const editing = workspace.dialog?.type === 'rename-category' && workspace.dialog.category?.id === category.id;
    const deleting = workspace.dialog?.type === 'delete' && workspace.dialog.category?.id === category.id;
    const active = relationshipView === 'all' && workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY
      && workspace.view.id === category.id;
    return <div className="system-workflow__library-tree-category" data-nested={sectionId ? true : undefined}
      data-active={active || undefined} key={category.id}
      onDragOver={(event) => { if (organizationDrag?.tree?.kind === 'category') event.preventDefault(); }}
      onDrop={(event) => acceptTreeDrop(event, { sectionId, beforeId: category.id })}>
      {deleting ? <OwnerSystemWorkflowSidebarDeleteConfirmation entityLabel="category" name={category.name}
        onCancel={closeDialog} onConfirm={confirmDeleteDialog} />
        : editing ? <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel="category"
          onCancel={closeDialog} onConfirm={confirmDialog} /> : <LibraryNavigationButton
        active={active}
        categoryId={category.id} count={category.assetIds.filter((id) => renderableIds.has(id)).length}
        draggable dropTarget={organizationDrag?.categoryId === category.id} label={category.name}
        onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: category.id })}
        onContextMenu={(event) => { event.preventDefault(); openCategoryContext(event, category); }}
        onDragEnd={() => setOrganizationDrag(null)}
        onDragStart={(event) => beginTreeDrag(event, { kind: 'category', id: category.id })}
        unresolved={category.assetIds.filter((id) => !renderableIds.has(id)).length} />}
    </div>;
  };
  const emptyLabel = workspace.hasActiveFilters && workspace.viewAssetCount
    ? `${workspace.viewAssetCount} assets are in this view / none match the active search or filters`
    : relationshipView === 'created' && data.createdStatus === 'loading' ? 'Loading creator-attributed works'
      : relationshipView === 'created' && data.createdStatus === 'error' ? 'Created source unavailable' : 'No assets in this view';
  return <div className="system-workflow__library-presenter" onKeyDown={(event) => {
    if (event.key !== 'Escape') return;
    if (workspace.dialog) { event.stopPropagation(); closeDialog(); }
    else if (contextMenu) { event.stopPropagation(); closeContextMenu(); }
    else if (workspace.selectedAssetIds.length) { event.stopPropagation(); workspace.clearSelection(); }
  }}>
    <div className="lattice-browser-panel" style={{ '--lattice-browser-sidebar-width': `${workspace.sidebarWidth}px` }}>
      <nav aria-label="Browser navigation" className="lattice-browser-sidebar">
        <LibraryNavigationButton active={relationshipView === 'all' && workspace.view.kind === BROWSER_VIEW_KINDS.ALL}
          count={assets.length} icon={Layers3} label="All Assets" onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.ALL, id: null })} />
        <LibraryNavigationButton active={relationshipView === 'owned'} count={assets.filter((asset) => asset.owned).length}
          icon={UserRound} label="Owned" onClick={() => { setRelationshipView('owned'); workspace.selectView({ kind: BROWSER_VIEW_KINDS.ALL, id: null }); }} />
        <LibraryNavigationButton active={relationshipView === 'created'} count={assets.filter((asset) => asset.created).length}
          icon={WandSparkles} label="Created" onClick={() => { setRelationshipView('created'); workspace.selectView({ kind: BROWSER_VIEW_KINDS.ALL, id: null }); }} />
        <LibraryNavigationButton active={relationshipView === 'all' && workspace.view.kind === BROWSER_VIEW_KINDS.UNSORTED}
          count={assets.filter((asset) => !filed.has(assetId(asset))).length} icon={SquareStack} label="Unsorted"
          onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.UNSORTED, id: null })} />
        <div className="lattice-browser-sidebar__category-heading system-workflow__library-create-row"
          data-single={!categoryCommands?.createSection || undefined}
          onDragOver={(event) => { if (organizationDrag?.tree?.kind === 'category') event.preventDefault(); }}
          onDrop={(event) => acceptTreeDrop(event, { sectionId: null })} ref={categorySectionRef} tabIndex={-1}>
          {workspace.dialog?.type === 'create-category' || workspace.dialog?.type === 'create-section'
            ? <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog}
              entityLabel={workspace.dialog.type === 'create-section' ? 'section' : 'category'}
              onCancel={closeDialog} onConfirm={confirmDialog} /> : <>
              <button aria-label="Create Category" className="lattice-browser-sidebar__create"
                onClick={(event) => openCreateDialog(event, 'category')} type="button">
                <Plus aria-hidden="true" size={13} /><span>Category</span></button>
              {categoryCommands?.createSection && <button aria-label="Create Section" className="lattice-browser-sidebar__create"
                onClick={(event) => openCreateDialog(event, 'section')} type="button">
                <Plus aria-hidden="true" size={13} /><span>Section</span></button>}
            </>}
        </div>
        <div className="lattice-browser-category-list system-workflow__library-tree">
          {rootCategoryIds.map((id) => renderCategory(id))}
          {(organization.sections || []).map((section) => {
            const collapsed = collapsedSections.has(section.id);
            const editing = workspace.dialog?.type === 'rename-section' && workspace.dialog.section?.id === section.id;
            const deleting = workspace.dialog?.type === 'delete-section' && workspace.dialog.section?.id === section.id;
            return <section className="system-workflow__library-section" data-collapsed={collapsed || undefined}
              data-drop-target={organizationDrag?.tree?.kind === 'category' ? true : undefined} key={section.id}
              onDragOver={(event) => event.preventDefault()} onDrop={(event) => acceptTreeDrop(event,
                organizationDrag?.tree?.kind === 'section' ? { kind: 'section', beforeId: section.id } : { sectionId: section.id })}>
              <header>
                {deleting ? <OwnerSystemWorkflowSidebarDeleteConfirmation entityLabel="section" name={section.name}
                  onCancel={closeDialog} onConfirm={confirmDeleteDialog} />
                  : editing ? <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel="section"
                    onCancel={closeDialog} onConfirm={confirmDialog} /> : <button aria-expanded={!collapsed}
                    draggable="true"
                    onClick={() => setCollapsedSections((current) => { const next = new Set(current);
                      if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}
                    onContextMenu={(event) => { event.preventDefault(); openSectionContext(event, section); }}
                    onDragEnd={() => setOrganizationDrag(null)}
                    onDragStart={(event) => beginTreeDrag(event, { kind: 'section', id: section.id })}
                    type="button">
                    <span>{collapsed ? <ChevronRight aria-hidden="true" size={12} /> : <ChevronDown aria-hidden="true" size={12} />}
                      <b>{section.name}</b></span><i>{section.categoryIds.length}</i>
                  </button>}
              </header>
              {!collapsed && <div className="system-workflow__library-section-children">
                {section.categoryIds.map((id) => renderCategory(id, section.id))}
                {!section.categoryIds.length && organizationDrag?.tree?.kind === 'category'
                  && <span className="system-workflow__library-section-empty">Drop category here</span>}
              </div>}
            </section>;
          })}
        </div>
      </nav>
      <button aria-label="Resize Browser navigation" className="lattice-browser-sidebar-resize"
        disabled={Boolean(workspace.dialog)}
        onLostPointerCapture={workspace.sidebarResize.finish} onPointerCancel={workspace.sidebarResize.finish}
        onPointerDown={workspace.sidebarResize.begin} onPointerMove={workspace.sidebarResize.update}
        onPointerUp={workspace.sidebarResize.finish} title="Resize Browser navigation" type="button" />
      <main className="lattice-browser-results">
        {data.error && <div className="lattice-browser-notice" data-error role="status">{data.error}</div>}
        {data.createdError && <div className="lattice-browser-notice" data-error role="status">Created source unavailable{data.createdRetained ? ' / retained results' : ''}</div>}
        {data.createdStatus === 'loading' && <p className="lattice-browser-notice" role="status">Loading created {data.createdProgress?.resolved || 0} / {data.createdProgress?.total || 0}</p>}
        <LibraryResults assets={related} emptyLabel={emptyLabel} onActivate={onAssetActivate}
          onContext={openAssetContext} onPointerDown={beginOrganizationDrag}
          workspace={{ ...workspace, selectAsset: (id, event) => { if (!suppressSelectionRef.current) workspace.selectAsset(id, event); } }} />
      </main>
    </div>
    {contextMenu && createPortal(<RackMenu anchor={contextMenu.anchor}
      commands={contextMenu.kind === 'category' ? categoryMenuCommands : contextMenu.kind === 'section' ? sectionMenuCommands : membershipCommands}
      label={contextMenu.kind === 'category' ? 'Category commands' : contextMenu.kind === 'section' ? 'Section commands' : 'NFT category membership'}
      menuSurfaceId={menuSurfaceId} onClose={() => closeContextMenu()} onCommand={handleContextCommand}
      returnFocus={contextMenu.trigger} systemWorkflowOverlay />, document.body)}
    {organizationDrag?.assetIds && createPortal(<div aria-hidden="true" className="system-workflow__library-drag-ghost"
      data-valid={organizationDrag.categoryId ? true : undefined}
      style={{ left: organizationDrag.point.x, top: organizationDrag.point.y }}>{organizationDrag.assetIds.length} assets</div>, document.body)}
  </div>;
}
