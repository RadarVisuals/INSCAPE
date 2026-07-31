import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import BrowserCategoryDialog from './BrowserCategoryDialog.jsx';
import BrowserUnifiedPanel from './BrowserUnifiedPanel.jsx';
import RackMenu from '../../public/menus/RackMenu.jsx';
import LatticeRackShell, { LatticeRackModule } from '../windows/LatticeRackShell.jsx';
import LatticeWorkspaceToolbar from '../rendering/LatticeWorkspaceToolbar.jsx';
import LatticeLayersModule from '../rendering/LatticeLayersModule.jsx';
import { moveLatticeLayerEntries } from '../rendering/latticeLayersModel.js';
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
  onLayerReorder,
  onLayerSelectionChange,
  onRenderableAssetsChange,
  onRequestClose,
  onWorkspaceToolActivate,
  open = false,
  layers = [],
  selectedLayerIds = [],
  systemTools = [],
  tabRequest = null,
  workspaceActiveToolIds = [],
  workspaceArrangeEnabled = false,
  workspaceTools = [],
}) {
  const workspace = useBrowserWorkspace(data);
  const presence = useLatticeChromePresence(open ? 'browser' : null);
  const categorySectionRef = useRef(null);
  const organizationGestureRef = useRef(null);
  const suppressSelectionRef = useRef(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [rackMenu, setRackMenu] = useState(null);
  const [organizationDrag, setOrganizationDrag] = useState(null);
  const [compactMode, setCompactMode] = useState(false);
  const [moduleVisibility, setModuleVisibility] = useState({ browser: true, layers: true, tools: true });
  const [rackExpanded, setRackExpanded] = useState(true);
  const [browserModuleExpanded, setBrowserModuleExpanded] = useState(true);
  const [layersModuleExpanded, setLayersModuleExpanded] = useState(false);

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
  const closeRackMenu = (restore = true) => {
    const trigger = rackMenu?.trigger;
    setRackMenu(null);
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
    if (rackMenu) { closeRackMenu(); return; }
    if (contextMenu) { closeContextMenu(); return; }
    if (workspace.selectedAssetIds.length) { workspace.clearSelection(); return; }
    onRequestClose?.('escape');
  };
  const openCategoryContext = categoryCommands ? (event, category) => {
    setRackMenu(null);
    setContextMenu({ anchor: contextAnchor(event), categoryId: category.id, kind: 'category', trigger: event.currentTarget });
  } : null;
  const openAssetContext = categoryCommands ? (event, asset) => {
    setRackMenu(null);
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
  const availableModules = {
    browser: true,
    layers: true,
    tools: workspaceTools.length > 0,
  };
  const hasBrowserModule = moduleVisibility.browser;
  const hasToolsModule = availableModules.tools && moduleVisibility.tools;
  const hasLayersModule = moduleVisibility.layers;
  const browserExpanded = rackExpanded && hasBrowserModule && browserModuleExpanded;
  const layersExpanded = rackExpanded && layersModuleExpanded;
  const moduleFaceplateCount = Number(hasBrowserModule) + Number(hasToolsModule) + Number(hasLayersModule);
  const rackTailHeight = hasLayersModule ? 38 + (layersExpanded ? 220 : 0) : 0;
  const compactRackHeight = 38 + (moduleFaceplateCount * 38)
    + (layersExpanded ? 220 : 0);
  const rackCommands = [
    { id: 'rack:toggle', label: rackExpanded ? 'COLLAPSE THE RACK' : 'EXPAND THE RACK' },
    { checkable: true, id: 'compact', label: 'COMPACT MODE', selected: compactMode },
    { checkable: true, id: 'module:browser', label: 'BROWSER MODULE', selected: hasBrowserModule },
    ...(availableModules.tools ? [{ checkable: true, id: 'module:tools', label: 'TOOLS MODULE', selected: hasToolsModule }] : []),
    { checkable: true, id: 'module:layers', label: 'LAYERS MODULE', selected: hasLayersModule },
    { id: 'modules:show-all', label: 'SHOW ALL MODULES' },
  ];
  const handleRackCommand = (commandId) => {
    if (commandId === 'rack:toggle') setRackExpanded((current) => !current);
    else if (commandId === 'compact') setCompactMode((current) => !current);
    else if (commandId === 'modules:show-all') setModuleVisibility({ browser: true, layers: true, tools: true });
    else if (commandId.startsWith('module:')) {
      const moduleId = commandId.slice('module:'.length);
      setModuleVisibility((current) => ({ ...current, [moduleId]: !current[moduleId] }));
    }
    closeRackMenu();
  };
  const selectedLayerSet = new Set(selectedLayerIds);
  const selectedLayerIndexes = layers.map(({ id }, index) => selectedLayerSet.has(id) ? index : -1)
    .filter((index) => index >= 0);
  const layerOrderingBlocked = !workspaceArrangeEnabled || !selectedLayerIndexes.length
    || layers.some(({ locked }) => locked);
  const layerStepTarget = (direction) => {
    if (layerOrderingBlocked) return null;
    const edge = direction === 'up' ? Math.min(...selectedLayerIndexes) : Math.max(...selectedLayerIndexes);
    return layers[edge + (direction === 'up' ? -1 : 1)] || null;
  };
  const stepSelectedLayers = (direction) => {
    const target = layerStepTarget(direction);
    if (!target) return;
    const next = moveLatticeLayerEntries(layers, selectedLayerIds, target.id);
    if (next) onLayerReorder?.(next.map(({ id }) => id));
  };
  return (
    <section
      aria-label="Owner asset Browser"
      className="lattice-browser-workspace"
      data-compact={compactMode || undefined}
      data-lattice-chrome
      data-phase={presence.phase}
      aria-hidden={presence.phase === 'exiting' || undefined}
      inert={presence.phase === 'exiting' ? '' : undefined}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) presence.completeAnimation(); }}
      onKeyDown={handleEscape}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        height: browserExpanded ? workspace.windowSize.height : rackExpanded ? compactRackHeight : 38,
        left: workspace.windowPosition.left,
        top: workspace.windowPosition.top,
        width: workspace.windowSize.width,
      }}
    >
      <LatticeRackShell expanded={rackExpanded} masterAccessory={systemTools.length ?
        <LatticeWorkspaceToolbar activeToolIds={workspaceActiveToolIds}
          compact faceplate owner tools={systemTools} onToolActivate={onWorkspaceToolActivate} /> : null}
        move={workspace.move} onClose={() => onRequestClose?.('close-control')}
        onExpandedChange={setRackExpanded}
        onMenuRequest={(event) => {
          setContextMenu(null);
          setRackMenu({ anchor: contextAnchor(event), trigger: event.currentTarget });
        }}>
        {rackExpanded && <>{hasToolsModule && <LatticeRackModule expandable={false} faceplateAccessory={
          <LatticeWorkspaceToolbar activeToolIds={workspaceActiveToolIds} arrangeEnabled={workspaceArrangeEnabled}
            compact faceplate owner tools={workspaceTools} onToolActivate={onWorkspaceToolActivate} />
        } label="TOOLS" signal="tools" />}
        {hasBrowserModule && <LatticeRackModule contentClassName="lattice-browser-module-content" expanded={browserExpanded}
          faceplateAccessory={<>
            <label className="lattice-browser-faceplate-size" onClick={(event) => event.stopPropagation()} title="Asset thumbnail size">
              <span>SIZE</span>
              <input aria-label="Asset thumbnail size" aria-valuetext={workspace.assetSize === workspace.assetSizeBounds.LIST ? 'LIST' : `${workspace.assetSize} PIXELS`}
                max={workspace.assetSizeBounds.MAXIMUM} min={workspace.assetSizeBounds.MINIMUM}
                onChange={(event) => workspace.setAssetSize(Number(event.target.value))} step="1" type="range" value={workspace.assetSize} />
              <output>{workspace.assetSize === workspace.assetSizeBounds.LIST ? 'LIST' : workspace.assetSize}</output>
            </label>
            <label className="lattice-browser-faceplate-search" onClick={(event) => event.stopPropagation()} title="Search assets">
              <Search aria-hidden="true" size={13} strokeWidth={2} />
              <input aria-label="Search assets" onChange={(event) => workspace.setQuery(event.target.value)}
                onFocus={() => { setRackExpanded(true); setBrowserModuleExpanded(true); }} placeholder="SEARCH"
                type="search" value={workspace.query} />
            </label>
            {workspace.unavailableCount > 0 && <output className="lattice-browser-faceplate-unavailable"
              title={`${workspace.unavailableCount} unavailable assets`}>{workspace.unavailableCount}</output>}
          </>} fill label="BROWSER" signal="browser"
          onExpandedChange={(expanded) => { setBrowserModuleExpanded(expanded); if (expanded) setRackExpanded(true); }}>
          <div className="lattice-browser-body">
            <BrowserUnifiedPanel categoryDropTargetId={organizationDrag?.categoryId} categorySectionRef={categorySectionRef}
              data={data} onAssetContext={openAssetContext} onAssetPointerDown={beginOrganizationDrag}
              onCategoryContext={openCategoryContext}
              onCreateCategory={categoryCommands ? (trigger) => workspace.setDialog({ trigger, type: 'create' }) : null}
              workspace={panelWorkspace} />
          </div>
        </LatticeRackModule>}
        {hasLayersModule && <LatticeRackModule contentHeight={220} expanded={layersExpanded} faceplateAccessory={
          <div className="lattice-browser-layer-steps" onClick={(event) => event.stopPropagation()}>
            <button aria-label="Move selected layer forward" disabled={!layerStepTarget('up')}
              onClick={() => stepSelectedLayers('up')} title="Move selected layer one position forward" type="button">
              <ChevronUp aria-hidden="true" size={21} strokeWidth={2.4} />
            </button>
            <button aria-label="Move selected layer backward" disabled={!layerStepTarget('down')}
              onClick={() => stepSelectedLayers('down')} title="Move selected layer one position backward" type="button">
              <ChevronDown aria-hidden="true" size={21} strokeWidth={2.4} />
            </button>
          </div>
        } label="LAYERS" signal="layers"
          onExpandedChange={(expanded) => { setLayersModuleExpanded(expanded); if (expanded) setRackExpanded(true); }}>
          <LatticeLayersModule layers={layers} onReorder={onLayerReorder}
            onSelectionChange={onLayerSelectionChange} reorderDisabled={!workspaceArrangeEnabled}
            selectedIds={selectedLayerIds} />
        </LatticeRackModule>}</>}
      </LatticeRackShell>
      {rackExpanded && <button
        aria-label="Resize The Rack width"
        className="lattice-rack-width-resize"
        onKeyDown={workspace.rackWidthResize.keyDown}
        onLostPointerCapture={workspace.rackWidthResize.finish}
        onPointerCancel={workspace.rackWidthResize.finish}
        onPointerDown={workspace.rackWidthResize.begin}
        onPointerMove={workspace.rackWidthResize.update}
        onPointerUp={workspace.rackWidthResize.finish}
        title="Drag to resize The Rack horizontally; Left and Right arrows resize in steps"
        type="button"
      />}
      {browserExpanded && <button
        aria-label="Resize Browser"
        className="lattice-browser-resize"
        onKeyDown={workspace.resize.keyDown}
        onLostPointerCapture={workspace.resize.finish}
        onPointerCancel={workspace.resize.finish}
        onPointerDown={workspace.resize.begin}
        onPointerMove={workspace.resize.update}
        onPointerUp={workspace.resize.finish}
        style={{ bottom: rackTailHeight + 1 }}
        title="Drag to resize around center; arrow keys resize in steps"
        type="button"
      />}
      {contextMenu && createPortal(<RackMenu
        anchor={contextMenu.anchor}
        commands={contextMenu.kind === 'category' ? categoryMenuCommands : membershipCommands}
        label={contextMenu.kind === 'category' ? 'Category commands' : 'NFT category membership'}
        onClose={() => closeContextMenu()}
        onCommand={handleContextCommand}
        returnFocus={contextMenu.trigger}
      />, document.querySelector('.owner-lattice-shell') || document.body)}
      {rackMenu && createPortal(<RackMenu
        anchor={rackMenu.anchor}
        commands={rackCommands}
        label="The Rack options"
        onClose={() => closeRackMenu()}
        onCommand={handleRackCommand}
        returnFocus={rackMenu.trigger}
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
