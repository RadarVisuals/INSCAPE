import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, FolderTree, Layers3, X } from 'lucide-react';
import BrowserCategoriesPanel from './BrowserCategoriesPanel.jsx';
import BrowserCategoryDialog from './BrowserCategoryDialog.jsx';
import BrowserIndexPanel from './BrowserIndexPanel.jsx';
import RackMenu from '../../public/menus/RackMenu.jsx';
import { BROWSER_TABS } from './browserWorkspaceModel.js';
import useBrowserWorkspace from './useBrowserWorkspace.js';
import useLatticeChromePresence from '../windows/useLatticeChromePresence.js';
import '../rendering/latticeChromePrimitives.css';
import './browserWorkspace.css';

const TABS = Object.freeze([
  { id: BROWSER_TABS.INDEX, label: 'INDEX', Icon: Layers3 },
  { id: BROWSER_TABS.CATEGORIES, label: 'CATEGORIES', Icon: FolderTree },
]);

function contextAnchor(event) {
  if (event.type === 'contextmenu') return { x: event.clientX, y: event.clientY };
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: bounds.left + Math.min(18, bounds.width / 2), y: bounds.bottom };
}

export default function BrowserWorkspace({
  categoryCommands = null,
  data,
  onActiveTabChange,
  onPlaceAsset,
  onRequestClose,
  open = false,
  tabRequest = null,
}) {
  const workspace = useBrowserWorkspace(data);
  const presence = useLatticeChromePresence(open ? 'browser' : null);
  const tabRefs = useRef(new Map());
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    if (!open) return;
    const requestedTab = TABS.some(({ id }) => id === tabRequest?.id) ? tabRequest.id : workspace.activeTab;
    if (requestedTab !== workspace.activeTab) workspace.setActiveTab(requestedTab);
    requestAnimationFrame(() => tabRefs.current.get(requestedTab)?.focus({ preventScroll: true }));
  }, [open, tabRequest?.requestId]);

  useEffect(() => {
    onActiveTabChange?.(workspace.activeTab);
  }, [onActiveTabChange, workspace.activeTab]);

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
    onRequestClose?.('escape');
  };
  const selectTab = (tabId, focus = false) => {
    workspace.setActiveTab(tabId);
    if (focus) requestAnimationFrame(() => tabRefs.current.get(tabId)?.focus({ preventScroll: true }));
  };
  const selectedPlacementReason = !workspace.selectedAsset ? 'SELECT ASSET'
    : !workspace.selectedAsset.placeable
      ? workspace.selectedAsset.placementUnavailableReason || 'ASSET UNAVAILABLE'
      : null;
  const placementUnavailableReason = data.activeTable?.placementUnavailableReason || selectedPlacementReason;
  const placementEnabled = Boolean(!placementUnavailableReason && workspace.selectedAsset && onPlaceAsset);
  const placementLabel = placementEnabled
    ? `PLACE PUBLIC / ${data.activeTable?.label || 'ACTIVE TABLE'}`
    : placementUnavailableReason || 'PLACE UNAVAILABLE';
  const handleTabKeyDown = (event, tabId) => {
    const index = TABS.findIndex(({ id }) => id === tabId);
    const destination = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length]
      : event.key === 'ArrowLeft' ? TABS[(index - 1 + TABS.length) % TABS.length]
        : event.key === 'Home' ? TABS[0] : event.key === 'End' ? TABS.at(-1) : null;
    if (!destination) return;
    event.preventDefault();
    event.stopPropagation();
    selectTab(destination.id, true);
  };
  const openCategoryContext = categoryCommands ? (event, category) => {
    setContextMenu({ anchor: contextAnchor(event), categoryId: category.id, kind: 'category', trigger: event.currentTarget });
  } : null;
  const openAssetContext = categoryCommands ? (event, asset) => {
    setContextMenu({ anchor: contextAnchor(event), assetId: asset.stableAssetId || asset.id, kind: 'asset', trigger: event.currentTarget });
  } : null;
  const categoryMenuCommands = contextMenu?.kind === 'category' ? (() => {
    const category = data.categories.find(({ id }) => id === contextMenu.categoryId);
    return category ? [
      { id: 'rename', label: 'RENAME' },
      { id: 'visibility', label: category.public ? 'MAKE PRIVATE' : 'MAKE PUBLIC' },
      { id: 'delete', label: 'DELETE' },
    ] : [];
  })() : [];
  const assetMenuCategories = contextMenu?.kind === 'asset' ? data.categories : [];
  const assetMenuGroups = assetMenuCategories.reduce((groups, category, index) => {
    groups[category.assetIds.includes(contextMenu.assetId) ? 'remove' : 'add'].push({
      id: `membership:${category.assetIds.includes(contextMenu.assetId) ? 'remove' : 'add'}:${index}`,
      label: category.name,
    });
    return groups;
  }, { add: [], remove: [] });
  const assetMenuCommands = assetMenuCategories.length ? [
    { id: 'membership:add', label: 'ADD TO >', disabled: !assetMenuGroups.add.length },
    { id: 'membership:remove', label: 'REMOVE FROM >', disabled: !assetMenuGroups.remove.length },
  ] : [{ id: 'no-categories', label: 'NO CATEGORIES YET', disabled: true }];
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
    if (contextMenu?.kind === 'asset') {
      const [, operation, indexValue] = commandId.split(':');
      const index = Number(indexValue);
      const category = assetMenuCategories[index];
      if (category && ['add', 'remove'].includes(operation)) categoryCommands.setCategoryAsset(
        category.id, contextMenu.assetId, operation === 'add');
      closeContextMenu();
    }
  };
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
    if (dialog.type === 'create') workspace.setSelectedCategoryId(result);
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
        <div><Archive aria-hidden="true" size={15} strokeWidth={2} /><strong>BROWSER</strong><small>{data.fixture ? 'OWNER TOOL / FIXTURE' : 'OWNER TOOL / 01'}</small></div>
        {data.ownerContext && <span>{data.ownerContext}</span>}
        <button aria-label="Close Browser" className="lattice-chrome-close-control" onClick={() => onRequestClose?.('close-control')} type="button"><X aria-hidden="true" size={15} strokeWidth={2} /></button>
      </header>
      <div aria-label="Browser sections" className="lattice-browser-tabs" role="tablist">
        {TABS.map(({ Icon, id, label }) => <button
          aria-controls={`lattice-browser-panel-${id}`}
          aria-selected={workspace.activeTab === id}
          id={`lattice-browser-tab-${id}`}
          key={id}
          onClick={() => selectTab(id)}
          onKeyDown={(event) => handleTabKeyDown(event, id)}
          ref={(node) => { if (node) tabRefs.current.set(id, node); else tabRefs.current.delete(id); }}
          role="tab"
          tabIndex={workspace.activeTab === id ? 0 : -1}
          type="button"
        ><Icon aria-hidden="true" size={14} strokeWidth={2} />{label}</button>)}
      </div>
      <label className="lattice-browser-search">
        <span>SEARCH ASSET POOL</span>
        <input aria-label="Search asset pool" onChange={(event) => workspace.setQuery(event.target.value)} placeholder=" " type="search" value={workspace.query} />
      </label>
      <div
        aria-labelledby={`lattice-browser-tab-${workspace.activeTab}`}
        className="lattice-browser-body"
        id={`lattice-browser-panel-${workspace.activeTab}`}
        role="tabpanel"
      >
        {workspace.activeTab === BROWSER_TABS.INDEX
          ? <BrowserIndexPanel data={data} onAssetContext={openAssetContext} workspace={workspace} />
          : <BrowserCategoriesPanel data={{ ...data, assets: workspace.categoryAssets }} onAssetContext={openAssetContext}
            onCategoryContext={openCategoryContext}
            onCreateCategory={categoryCommands ? (trigger) => workspace.setDialog({ trigger, type: 'create' }) : null}
            workspace={workspace} />}
      </div>
      <footer className="lattice-browser-footer">
        <span>{data.fixture ? 'ISOLATED FIXTURE SESSION' : 'ORGANIZATION WRITABLE / PROFILE SCOPED'}</span>
        <span>{workspace.selectedAsset ? workspace.selectedAsset.title || 'ASSET SELECTED' : 'SELECT ASSET'}</span>
        <button
          disabled={!placementEnabled}
          onClick={() => onPlaceAsset?.(workspace.selectedAsset.stableAssetId)}
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
        commands={contextMenu.kind === 'category' ? categoryMenuCommands : assetMenuCommands}
        getSubmenuCommands={contextMenu.kind === 'asset'
          ? (commandId) => commandId === 'membership:add' ? assetMenuGroups.add
            : commandId === 'membership:remove' ? assetMenuGroups.remove : [] : undefined}
        label={contextMenu.kind === 'category' ? 'Category commands' : 'NFT category membership'}
        onClose={() => closeContextMenu()}
        onCommand={handleContextCommand}
        returnFocus={contextMenu.trigger}
      />, document.querySelector('.owner-lattice-shell') || document.body)}
      <BrowserCategoryDialog dialog={workspace.dialog} onCancel={closeDialog} onConfirm={confirmDialog} />
    </section>
  );
}
