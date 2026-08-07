import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import BrowserCategoryDialog from '../browser/BrowserCategoryDialog.jsx';
import { BrowserFilterControls } from '../browser/BrowserUnifiedPanel.jsx';
import Modul8rLibraryPanel from './Modul8rLibraryPanel.jsx';
import { BROWSER_VIEW_KINDS, categoryMembershipState } from '../browser/browserWorkspaceModel.js';
import useBrowserWorkspace from '../browser/useBrowserWorkspace.js';
import RackMenu from '../../public/menus/RackMenu.jsx';
import '../browser/browserWorkspace.css';
import './modul8rLibrary.css';

function contextAnchor(event) {
  if (event.type === 'contextmenu') return { x: event.clientX, y: event.clientY };
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: bounds.left + Math.min(18, bounds.width / 2), y: bounds.bottom };
}

export default function Modul8rLibraryAdapter({
  categoryCommands = null,
  collectionContext = null,
  data,
  faceplateTargetRef,
  onAssetPointerDown,
  onAssetActivate,
  onExitCollection,
  onRenderableAssetsChange,
  onRetryCollection,
  onRetryCreated,
}) {
  const workspace = useBrowserWorkspace(data);
  const categorySectionRef = useRef(null);
  const organizationGestureRef = useRef(null);
  const suppressSelectionRef = useRef(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [faceplateTarget, setFaceplateTarget] = useState(null);
  const [organizationDrag, setOrganizationDrag] = useState(null);
  const [relationshipView, setRelationshipView] = useState('all');

  useEffect(() => () => organizationGestureRef.current?.cancel?.(), []);
  useEffect(() => {
    setFaceplateTarget(faceplateTargetRef?.current || null);
  }, [faceplateTargetRef]);
  const renderableAssetKey = workspace.renderableAssetIds.join('\n');
  useEffect(() => {
    const renderable = new Set(workspace.renderableAssetIds);
    if (organizationGestureRef.current?.assetIds.some((id) => !renderable.has(id))) {
      organizationGestureRef.current.cancel();
    }
    onRenderableAssetsChange?.(workspace.renderableAssetIds);
  }, [onRenderableAssetsChange, renderableAssetKey]);

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
    if (contextMenu?.kind !== 'membership') return;
    if (!workspace.areAssetsRenderable(contextMenu.assetIds)) { closeContextMenu(); return; }
    if (commandId.startsWith('remove-current:')) {
      categoryCommands.setCategoryAssets(commandId.slice('remove-current:'.length), contextMenu.assetIds, false);
      closeContextMenu();
      return;
    }
    const categoryId = commandId.slice('membership:'.length);
    const category = data.categories.find(({ id }) => id === categoryId);
    if (category) categoryCommands.setCategoryAssets(category.id, contextMenu.assetIds,
      categoryMembershipState(category, contextMenu.assetIds) !== 'all');
    closeContextMenu();
  };

  const beginOrganizationDrag = (event, asset) => {
    if (asset.isCollection && asset.collectionRole !== 'cover') return;
    const assetId = asset.stableAssetId || asset.id;
    const selectedIds = workspace.selectedAssetIds.includes(assetId)
      ? [...workspace.selectedAssetIds] : [assetId];
    if (event.button !== 0) return;
    if (selectedIds.length === 1) onAssetPointerDown?.(event, asset, workspace, { placementPreset: 'compact' });
    if (!categoryCommands) return;
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    let started = false;
    const categoryAt = (pointerEvent) => document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
      ?.closest?.('[data-browser-category-id]')?.dataset.browserCategoryId || null;
    const move = (pointerEvent) => {
      if (Math.hypot(pointerEvent.clientX - start.x, pointerEvent.clientY - start.y) < 6) return;
      const categoryId = categoryAt(pointerEvent);
      if (!categoryId) {
        if (started) setOrganizationDrag(null);
        return;
      }
      started = true;
      setOrganizationDrag({ assetIds: selectedIds, categoryId, point: { x: pointerEvent.clientX, y: pointerEvent.clientY } });
    };
    const cleanup = () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', finish);
      element.removeEventListener('pointercancel', cancel);
      if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
      organizationGestureRef.current = null;
      setOrganizationDrag(null);
    };
    const finish = (pointerEvent) => {
      const categoryId = started ? categoryAt(pointerEvent) : null;
      if (started) { pointerEvent.preventDefault(); pointerEvent.stopPropagation(); suppressSelectionRef.current = true; }
      cleanup();
      if (categoryId && workspace.areAssetsRenderable(selectedIds)
        && data.categories.some(({ id }) => id === categoryId)) {
        categoryCommands.setCategoryAssets(categoryId, selectedIds, true);
      }
      if (started) setTimeout(() => { suppressSelectionRef.current = false; }, 0);
    };
    const cancel = () => cleanup();
    organizationGestureRef.current = { assetIds: selectedIds, cancel };
    element.setPointerCapture?.(pointerId);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', cancel);
  };
  const panelWorkspace = { ...workspace, selectAsset: (assetId, event) => {
    if (!suppressSelectionRef.current) workspace.selectAsset(assetId, event);
  } };
  const confirmDialog = (name) => {
    const dialog = workspace.dialog;
    if (!dialog) return;
    const result = dialog.type === 'create' ? categoryCommands?.createCategory(name)
      : dialog.type === 'rename' ? categoryCommands?.renameCategory(dialog.category.id, name)
        : categoryCommands?.deleteCategory(dialog.category.id);
    if (!result) {
      workspace.setDialog({ ...dialog, error: 'PROFILE AUTHORITY CHANGED OR COMMAND COULD NOT BE SAVED.' });
      return;
    }
    if (dialog.type === 'create') workspace.selectView({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: result });
    closeDialog();
  };

  const faceplateControls = <div className="modul8r-library__faceplate-controls">
    <div className="modul8r-library__controls">
      <label className="modul8r-library__search"><Search aria-hidden="true" size={13} /><input aria-label="Search assets" onChange={(event) => workspace.setQuery(event.target.value)} placeholder="SEARCH" type="search" value={workspace.query} /></label>
      <label className="modul8r-library__size"><span>SIZE</span><input aria-label="Asset thumbnail size" max={workspace.assetSizeBounds.MAXIMUM} min={workspace.assetSizeBounds.MINIMUM} onChange={(event) => workspace.setAssetSize(Number(event.target.value))} type="range" value={workspace.assetSize} /><output>{workspace.assetSize}</output></label>
      <span className="modul8r-library__indicators">
        {data.status === 'loading' && <output className="modul8r-library__progress">{data.progress?.resolved || 0} / {data.progress?.total || 0}</output>}
        {workspace.unavailableCount > 0 && <output aria-label={`${workspace.unavailableCount} unavailable assets`}
          className="modul8r-library__unavailable" title={`${workspace.unavailableCount} unavailable assets`}>{workspace.unavailableCount}</output>}
      </span>
    </div>
    <BrowserFilterControls className="modul8r-library__filters" labelsControlMode="show" workspace={workspace} />
  </div>;

  return <div className="modul8r-library" onKeyDown={(event) => {
    if (event.key !== 'Escape') return;
    if (workspace.dialog) { event.stopPropagation(); closeDialog(); }
    else if (contextMenu) { event.stopPropagation(); closeContextMenu(); }
    else if (workspace.selectedAssetIds.length) { event.stopPropagation(); workspace.clearSelection(); }
  }}>
    {faceplateTarget && createPortal(faceplateControls, faceplateTarget)}
    <Modul8rLibraryPanel categoryDropTargetId={organizationDrag?.categoryId} categorySectionRef={categorySectionRef}
      collectionContext={collectionContext} data={data} onAssetActivate={onAssetActivate} onAssetContext={openAssetContext}
      onAssetPointerDown={beginOrganizationDrag}
      onCategoryContext={openCategoryContext}
      onCreateCategory={categoryCommands ? (trigger) => workspace.setDialog({ trigger, type: 'create' }) : null}
      onExitCollection={onExitCollection} onRetryCollection={onRetryCollection} onRetryCreated={onRetryCreated}
      relationshipView={relationshipView} selectRelationshipView={setRelationshipView}
      workspace={panelWorkspace} />
    {contextMenu && createPortal(<RackMenu anchor={contextMenu.anchor}
      commands={contextMenu.kind === 'category' ? categoryMenuCommands : membershipCommands}
      label={contextMenu.kind === 'category' ? 'Category commands' : 'NFT category membership'}
      onClose={() => closeContextMenu()} onCommand={handleContextCommand} returnFocus={contextMenu.trigger} />, document.body)}
    {organizationDrag && createPortal(<div aria-hidden="true" className="modul8r-library__drag-ghost"
      data-valid={organizationDrag.categoryId ? true : undefined}
      style={{ left: organizationDrag.point.x, top: organizationDrag.point.y }}>{organizationDrag.assetIds.length} ASSETS</div>, document.body)}
    <BrowserCategoryDialog dialog={workspace.dialog} onCancel={closeDialog} onConfirm={confirmDialog} />
  </div>;
}
