import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, X } from 'lucide-react';
import BrowserCategoryDialog from './BrowserCategoryDialog.jsx';
import BrowserUnifiedPanel from './BrowserUnifiedPanel.jsx';
import RackMenu from '../../public/menus/RackMenu.jsx';
import { BROWSER_VIEW_KINDS, categoryMembershipState } from './browserWorkspaceModel.js';
import useBrowserWorkspace from './useBrowserWorkspace.js';
import useLatticeChromePresence from '../windows/useLatticeChromePresence.js';
import '../rendering/latticeChromePrimitives.css';
import './browserWorkspace.css';

function contextAnchor(event) {
  if (event.type === 'contextmenu') return { x: event.clientX, y: event.clientY };
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: bounds.left + Math.min(18, bounds.width / 2), y: bounds.bottom };
}

export default function BrowserWorkspace({
  categoryCommands = null,
  data,
  onActiveTabChange,
  onAssetPointerDown,
  onPlaceAsset,
  onRenderableAssetsChange,
  onRequestClose,
  open = false,
  tabRequest = null,
}) {
  const workspace = useBrowserWorkspace(data);
  const presence = useLatticeChromePresence(open ? 'browser' : null);
  const categorySectionRef = useRef(null);
  const organizationGestureRef = useRef(null);
  const suppressSelectionRef = useRef(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [organizationDrag, setOrganizationDrag] = useState(null);

  useEffect(() => () => organizationGestureRef.current?.cancel?.(), []);
  const renderableAssetKey = workspace.renderableAssetIds.join('\n');
  useEffect(() => {
    const renderable = new Set(workspace.renderableAssetIds);
    if (organizationGestureRef.current?.assetIds.some((id) => !renderable.has(id))) {
      organizationGestureRef.current.cancel();
    }
    onRenderableAssetsChange?.(workspace.renderableAssetIds);
  }, [onRenderableAssetsChange, renderableAssetKey]);

  useEffect(() => {
    if (!open) return;
    if (tabRequest?.id === 'categories' || tabRequest?.destination === 'categories') {
      const selected = workspace.selectCategoriesDestination();
      if (!selected) requestAnimationFrame(() => categorySectionRef.current?.focus?.({ preventScroll: true }));
    }
  }, [open, tabRequest?.requestId]);

  useEffect(() => {
    onActiveTabChange?.(workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY ? 'categories' : 'index');
  }, [onActiveTabChange, workspace.view.kind]);

  if (!presence.renderedValue) return null;

  const restoreFocus = (trigger) => requestAnimationFrame(() => trigger?.focus?.({ preventScroll: true }));
  const closeContextMenu = (restore = true) => {
    const trigger = contextMenu?.trigger;
    setContextMenu(null);
    if (restore) restoreFocus(trigger);
  };
  const closeDialog = () => {
    const trigger = workspace.dialog?.trigger;
    workspace.setDialog(null);
    restoreFocus(trigger);
  };
  const handleEscape = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (workspace.dialog) { closeDialog(); return; }
    if (contextMenu) { closeContextMenu(); return; }
    if (workspace.selectedAssetIds.length) { workspace.clearSelection(); return; }
    onRequestClose?.('escape');
  };
  const selectedPlacementReason = workspace.selectedAssetIds.length > 1 ? 'PLACE ONE ASSET AT A TIME'
    : !workspace.selectedAsset ? 'SELECT ASSET'
    : !workspace.selectedAsset.placeable
      ? workspace.selectedAsset.placementUnavailableReason || 'ASSET UNAVAILABLE'
      : null;
  const placementUnavailableReason = data.activeTable?.placementUnavailableReason || selectedPlacementReason;
  const placementEnabled = Boolean(!placementUnavailableReason && workspace.selectedAsset && onPlaceAsset);
  const placementLabel = placementEnabled
    ? `PLACE PUBLIC / ${data.activeTable?.label || 'ACTIVE TABLE'}`
    : placementUnavailableReason || 'PLACE UNAVAILABLE';
  const openCategoryContext = categoryCommands ? (event, category) => {
    setContextMenu({ anchor: contextAnchor(event), categoryId: category.id, kind: 'category', trigger: event.currentTarget });
  } : null;
  const openAssetContext = categoryCommands ? (event, asset) => {
    const assetId = asset.stableAssetId || asset.id;
    const assetIds = workspace.selectForContext(assetId);
    setContextMenu({ anchor: contextAnchor(event), assetIds, kind: 'membership', trigger: event.currentTarget });
  } : null;
  const categoryMenuCommands = contextMenu?.kind === 'category' ? (() => {
    const category = data.categories.find(({ id }) => id === contextMenu.categoryId);
    return category ? [
      { id: 'rename', label: 'RENAME' },
      { id: 'visibility', label: category.public ? 'MAKE PRIVATE' : 'MAKE PUBLIC' },
      { id: 'delete', label: 'DELETE' },
    ] : [];
  })() : [];
  const membershipIds = contextMenu?.kind === 'membership' ? contextMenu.assetIds : workspace.selectedAssetIds;
  const currentMembershipCategory = workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY
    ? data.categories.find(({ id }) => id === workspace.view.id) : null;
  const categoryMembershipCommands = data.categories.length ? data.categories.map((category) => {
    const state = categoryMembershipState(category, membershipIds);
    return { checkable: true, id: `membership:${category.id}`, label: category.name, mixed: state === 'mixed', selected: state === 'all' };
  }) : [{ id: 'no-categories', label: 'NO CATEGORIES YET', disabled: true }];
  const membershipCommands = currentMembershipCategory && contextMenu?.kind === 'membership'
    ? [{ id: `remove-current:${currentMembershipCategory.id}`, label: `REMOVE FROM ${currentMembershipCategory.name}` },
      ...categoryMembershipCommands] : categoryMembershipCommands;
  const handleContextCommand = (commandId) => {
    if (!categoryCommands) { closeContextMenu(); return; }
    if (contextMenu?.kind === 'category') {
      const category = data.categories.find(({ id }) => id === contextMenu.categoryId);
      if (!category) { closeContextMenu(); return; }
      if (commandId === 'rename' || commandId === 'delete') {
        const trigger = contextMenu.trigger;
        closeContextMenu(false);
        workspace.setDialog({ category, trigger, type: commandId });
        return;
      }
      if (commandId === 'visibility') categoryCommands.setCategoryPublic(category.id, !category.public);
      closeContextMenu();
      return;
    }
    if (contextMenu?.kind === 'membership') {
      if (!workspace.areAssetsRenderable(contextMenu.assetIds)) { closeContextMenu(); return; }
      if (commandId.startsWith('remove-current:')) {
        categoryCommands.setCategoryAssets(commandId.slice('remove-current:'.length), contextMenu.assetIds, false);
        closeContextMenu(); return;
      }
      const categoryId = commandId.slice('membership:'.length);
      const category = data.categories.find(({ id }) => id === categoryId);
      if (category) categoryCommands.setCategoryAssets(category.id, contextMenu.assetIds,
        categoryMembershipState(category, contextMenu.assetIds) !== 'all');
      closeContextMenu();
    }
  };
  const beginOrganizationDrag = (event, asset) => {
    const assetId = asset.stableAssetId || asset.id;
    const assetIds = workspace.selectedAssetIds.includes(assetId) ? [...workspace.selectedAssetIds] : [];
    if (!categoryCommands || assetIds.length < 2 || event.button !== 0) {
      onAssetPointerDown?.(event, asset, workspace); return;
    }
    const element = event.currentTarget; const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY }; let started = false;
    const categoryAt = (pointerEvent) => document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
      ?.closest?.('[data-browser-category-id]')?.dataset.browserCategoryId || null;
    const move = (pointerEvent) => {
      if (!started && Math.hypot(pointerEvent.clientX - start.x, pointerEvent.clientY - start.y) < 6) return;
      started = true; const categoryId = categoryAt(pointerEvent);
      setOrganizationDrag({ assetIds, categoryId, point: { x: pointerEvent.clientX, y: pointerEvent.clientY } });
    };
    const cleanup = () => {
      element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', finish);
      element.removeEventListener('pointercancel', cancel);
      if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
      organizationGestureRef.current = null; setOrganizationDrag(null);
    };
    const finish = (pointerEvent) => {
      const categoryId = started ? categoryAt(pointerEvent) : null;
      if (started) { pointerEvent.preventDefault(); pointerEvent.stopPropagation(); suppressSelectionRef.current = true; }
      cleanup();
      if (categoryId && workspace.areAssetsRenderable(assetIds)
        && data.categories.some(({ id }) => id === categoryId)) {
        categoryCommands.setCategoryAssets(categoryId, assetIds, true);
      }
      if (started) setTimeout(() => { suppressSelectionRef.current = false; }, 0);
    };
    const cancel = () => cleanup();
    organizationGestureRef.current = { assetIds, cancel };
    element.setPointerCapture?.(pointerId);
    element.addEventListener('pointermove', move); element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', cancel);
  };
  const panelWorkspace = { ...workspace, selectAsset: (assetId, event) => {
    if (!suppressSelectionRef.current) workspace.selectAsset(assetId, event);
  } };
  const confirmDialog = (name) => {
    const dialog = workspace.dialog;
    if (!dialog) return;
    if (!categoryCommands) {
      workspace.setDialog({ ...dialog, error: 'PROFILE AUTHORITY CHANGED OR COMMAND COULD NOT BE SAVED.' });
      return;
    }
    const result = dialog.type === 'create' ? categoryCommands.createCategory(name)
      : dialog.type === 'rename' ? categoryCommands.renameCategory(dialog.category.id, name)
        : categoryCommands.deleteCategory(dialog.category.id);
    if (!result) {
      workspace.setDialog({ ...dialog, error: 'PROFILE AUTHORITY CHANGED OR COMMAND COULD NOT BE SAVED.' });
      return;
    }
    if (dialog.type === 'create') workspace.selectView({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: result });
    closeDialog();
  };
  return (
    <section
      aria-label="Owner asset Browser"
      className="lattice-browser-workspace"
      data-lattice-chrome
      data-phase={presence.phase}
      aria-hidden={presence.phase === 'exiting' || undefined}
      inert={presence.phase === 'exiting' ? '' : undefined}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) presence.completeAnimation(); }}
      onKeyDown={handleEscape}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ height: workspace.windowSize.height, width: workspace.windowSize.width }}
    >
      <header className="lattice-browser-header">
        <div><Archive aria-hidden="true" size={15} strokeWidth={2} /><strong>BROWSER</strong></div>
        {data.ownerContext && <span>{data.ownerContext}</span>}
        <button aria-label="Close Browser" className="lattice-chrome-close-control" onClick={() => onRequestClose?.('close-control')} type="button"><X aria-hidden="true" size={15} strokeWidth={2} /></button>
      </header>
      <label className="lattice-browser-search">
        <span>SEARCH ASSET POOL</span>
        <input aria-label="Search asset pool" onChange={(event) => workspace.setQuery(event.target.value)} placeholder=" " type="search" value={workspace.query} />
      </label>
      <div className="lattice-browser-body">
        <BrowserUnifiedPanel categoryDropTargetId={organizationDrag?.categoryId} categorySectionRef={categorySectionRef}
          data={data} onAssetContext={openAssetContext} onAssetPointerDown={beginOrganizationDrag}
          onCategoryContext={openCategoryContext}
          onCreateCategory={categoryCommands ? (trigger) => workspace.setDialog({ trigger, type: 'create' }) : null}
          workspace={panelWorkspace} />
      </div>
      <footer className="lattice-browser-footer">
        <button className="lattice-browser-footer__category" disabled={!workspace.selectedAssetIds.length || !data.categories.length || !categoryCommands}
          onClick={(event) => setContextMenu({ anchor: contextAnchor(event), assetIds: [...workspace.selectedAssetIds], kind: 'membership', trigger: event.currentTarget })} type="button">ADD TO CATEGORY / {workspace.selectedAssetIds.length} SELECTED</button>
        <button
          disabled={!placementEnabled}
          onClick={() => {
            if (workspace.isAssetRenderable(workspace.selectedAsset?.stableAssetId)) {
              onPlaceAsset?.(workspace.selectedAsset.stableAssetId);
            }
          }}
          type="button"
        >{placementLabel}</button>
      </footer>
      <button
        aria-label="Resize Browser"
        className="lattice-browser-resize"
        onKeyDown={workspace.resize.keyDown}
        onLostPointerCapture={workspace.resize.finish}
        onPointerCancel={workspace.resize.finish}
        onPointerDown={workspace.resize.begin}
        onPointerMove={workspace.resize.update}
        onPointerUp={workspace.resize.finish}
        title="Drag to resize around center; arrow keys resize in steps"
        type="button"
      />
      {contextMenu && createPortal(<RackMenu
        anchor={contextMenu.anchor}
        commands={contextMenu.kind === 'category' ? categoryMenuCommands : membershipCommands}
        label={contextMenu.kind === 'category' ? 'Category commands' : 'NFT category membership'}
        onClose={() => closeContextMenu()}
        onCommand={handleContextCommand}
        returnFocus={contextMenu.trigger}
      />, document.querySelector('.owner-lattice-shell') || document.body)}
      {organizationDrag && createPortal(<div aria-hidden="true" className="lattice-browser-organization-ghost"
        data-valid={organizationDrag.categoryId ? true : undefined}
        style={{ left: organizationDrag.point.x, top: organizationDrag.point.y }}>
        {organizationDrag.assetIds.length} ASSETS
      </div>, document.querySelector('.owner-lattice-shell') || document.body)}
      <BrowserCategoryDialog dialog={workspace.dialog} onCancel={closeDialog} onConfirm={confirmDialog} />
    </section>
  );
}
