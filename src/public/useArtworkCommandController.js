import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_OBJECT_KIND, getCanvasObjectDefinition } from '../library/domain/canvasObjectRegistry.js';
import { CANVAS_OBJECT_ORDER_COMMAND } from '../library/domain/canvasObjects.js';
import { normalizeGridRect } from './gridGeometry.js';
import { findScenePlacement, findScenePlacementAtPointer, packCompactCanvasObjects } from './sceneGrid.js';
import { gallerySpanForAspectRatio } from './galleryLayout.js';
import { presentationPatchForCommand, resolveContextTarget } from './menus/contextMenuModel.js';
import { runOwnerAuthoringMutation } from './publicAccess.js';

const ARTWORK_AUTHORING_COMMANDS = new Set([
  'create-framed-artwork', 'add-gallery-artwork', 'toggle-artwork-lock',
  'lock-all-artwork', 'unlock-all-artwork', 'edit-artwork', 'replace-artwork',
  'toggle-object-visibility', 'object-forward', 'object-backward', 'object-front',
  'object-back', 'remove-artwork', 'menu-layer', 'menu-appearance',
  'menu-presentation', 'menu-image-fit', 'menu-frame', 'menu-mat',
  'menu-background', 'presentation-transparent', 'presentation-framed',
  'image-fit-contain', 'image-fit-cover', 'frame-none', 'frame-thin', 'frame-heavy',
  'mat-none', 'mat-light', 'mat-dark', 'background-dark', 'background-light',
  'background-neutral'
]);

const MENU_COMMANDS = new Set([
  'menu-view', 'menu-layer', 'menu-appearance', 'menu-presentation',
  'menu-image-fit', 'menu-frame', 'menu-mat', 'menu-background', 'menu-root'
]);

export function isArtworkAuthoringCommand(command) {
  return ARTWORK_AUTHORING_COMMANDS.has(command);
}

export function artworkChoiceOperation(chooser, asset) {
  if (chooser?.mode === 'replace' && chooser.targetId) {
    return { type: 'replace', targetId: chooser.targetId, assetId: asset.id };
  }
  const ratio = asset.imageWidth && asset.imageHeight ? asset.imageWidth / asset.imageHeight : null;
  return {
    type: 'create',
    input: {
      kind: CANVAS_OBJECT_KIND.FRAMED_ARTWORK,
      stableAssetId: asset.id,
      placement: chooser.placement,
      span: chooser.mode === 'gallery-create' ? gallerySpanForAspectRatio(ratio) : undefined,
      locked: false
    },
    gallery: chooser.mode === 'gallery-create'
  };
}

export function contextTargetExists(target, { canvasObjectById, openRuntimeIds, sceneById }) {
  if (!target) return false;
  return ['canvas', 'gallery-canvas'].includes(target.type)
    || Boolean(sceneById[target.id])
    || Boolean(canvasObjectById[target.id])
    || openRuntimeIds.includes(target.id?.replace?.('-panel', ''))
    || Boolean(target.id?.startsWith?.('folder-panel:'));
}

export function useArtworkCommandController({
  canvasObjectById,
  canvasObjects,
  geometry,
  gridRef,
  homeZoom,
  interfaceVisible,
  libraryAssets,
  libraryStatus,
  loadLibrary,
  mutations,
  onClearSceneSelection,
  onShellCommand,
  openRuntimeIds,
  ownerAuthoringEnabled,
  placementGeometry,
  profileAddress,
  registerWorldContextMenu,
  sceneById,
  spatialSceneItems
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [galleryPresentationPreview, setGalleryPresentationPreview] = useState(null);
  const [artworkInspector, setArtworkInspector] = useState(null);
  const [selectedCanvasObjectId, setSelectedCanvasObjectId] = useState(null);
  const [galleryRemovalPending, setGalleryRemovalPending] = useState(null);
  const [artworkChooser, setArtworkChooser] = useState(null);
  const [previewObjectId, setPreviewObjectId] = useState(null);
  const artworkChoicePendingRef = useRef(false);
  const canvasObjectRefs = useRef(new Map());
  const previousProfileRef = useRef(profileAddress);
  const canvasObjectScenes = useMemo(() => {
    const items = canvasObjects.map((object) => {
      const definition = getCanvasObjectDefinition(object.kind);
      const rect = normalizeGridRect({
        column: object.placement.column,
        row: object.placement.row,
        columnSpan: object.span.columns,
        rowSpan: object.span.rows
      }, placementGeometry, { minimumSpan: definition.minimumSpan });
      return {
        ...object,
        geometry: rect,
        position: { column: rect.column, row: rect.row },
        span: { columns: rect.columnSpan, rows: rect.rowSpan }
      };
    });
    const responsive = geometry.narrow ? packCompactCanvasObjects(items, geometry) : items;
    return Object.fromEntries(responsive.map((item) => [item.id, item]));
  }, [canvasObjects, geometry, placementGeometry]);

  const closeContextMenu = useCallback(() => {
    setGalleryPresentationPreview(null);
    setContextMenu(null);
  }, []);

  const openWorldContextMenu = useCallback((event) => {
    if (!interfaceVisible) return;
    event.preventDefault();
    setGalleryPresentationPreview(null);
    setContextMenu({
      target: { type: 'canvas', id: 'canvas' },
      menu: 'root',
      anchor: { x: event.clientX, y: event.clientY },
      returnFocus: null
    });
  }, [interfaceVisible]);

  const openTargetContextMenu = useCallback((event, desktop) => {
    const target = resolveContextTarget(event.target, desktop);
    if (!target) return;
    event.preventDefault();
    setGalleryPresentationPreview(null);
    setContextMenu({
      target,
      menu: 'root',
      anchor: { x: event.clientX, y: event.clientY },
      returnFocus: event.target.closest?.('button,[tabindex]')
    });
  }, []);

  const openGalleryContextMenu = useCallback((event, target) => {
    if (!ownerAuthoringEnabled || !target) return;
    event.preventDefault();
    setGalleryPresentationPreview(null);
    setContextMenu({
      target,
      menu: 'root',
      galleryPlacement: target.placement || null,
      anchor: { x: event.clientX, y: event.clientY },
      returnFocus: event.target.closest?.('button,[tabindex]') || null
    });
  }, [ownerAuthoringEnabled]);

  useEffect(() => {
    registerWorldContextMenu?.(openWorldContextMenu);
    return () => registerWorldContextMenu?.(null);
  }, [openWorldContextMenu, registerWorldContextMenu]);

  const openArtworkInspector = useCallback((id, preferredAnchor) => {
    if (!ownerAuthoringEnabled) return;
    const rect = canvasObjectRefs.current.get(id)?.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    const anchor = preferredAnchor || (rect ? {
      x: rect.right + 10 + width <= window.innerWidth - 12 ? rect.right + 10 : Math.max(12, rect.left - width - 10),
      y: Math.max(12, Math.min(rect.top, window.innerHeight - 520))
    } : { x: Math.max(12, (window.innerWidth - width) / 2), y: 72 });
    setArtworkInspector({ id, anchor });
    setSelectedCanvasObjectId(id);
    onClearSceneSelection();
  }, [onClearSceneSelection, ownerAuthoringEnabled]);

  const closeArtworkInspector = useCallback((id) => {
    setArtworkInspector(null);
    setSelectedCanvasObjectId(null);
    canvasObjectRefs.current.get(id)?.querySelector('button')?.focus();
  }, []);

  const beginArtworkChoice = useCallback((mode, targetId = null) => {
    if (!ownerAuthoringEnabled) return;
    artworkChoicePendingRef.current = false;
    const definition = getCanvasObjectDefinition(CANVAS_OBJECT_KIND.FRAMED_ARTWORK);
    const bounds = gridRef.current?.getBoundingClientRect();
    const anchor = contextMenu?.anchor || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const span = {
      columns: Math.min(definition.defaultSpan.columns, placementGeometry.columns),
      rows: Math.min(definition.defaultSpan.rows, placementGeometry.rows)
    };
    const occupied = [
      ...spatialSceneItems,
      ...Object.values(canvasObjectScenes).map((object) => ({ id: object.id, position: object.position, span: object.span }))
    ];
    const placement = bounds
      ? findScenePlacementAtPointer({
        id: 'canvas:artwork:pending', pointer: anchor, gridClientRect: bounds,
        zoom: homeZoom, span, items: occupied, geometry: placementGeometry
      })
      : findScenePlacement('canvas:artwork:pending', { column: 0, row: 2 }, span, occupied, placementGeometry);
    setArtworkChooser({ mode, targetId, placement, anchor });
    closeContextMenu();
    if (libraryStatus === 'idle') loadLibrary();
  }, [canvasObjectScenes, closeContextMenu, contextMenu?.anchor, gridRef, homeZoom, libraryStatus, loadLibrary, ownerAuthoringEnabled, placementGeometry, spatialSceneItems]);

  const beginGalleryArtworkChoice = useCallback(() => {
    if (!ownerAuthoringEnabled || contextMenu?.target?.type !== 'gallery-canvas' || !contextMenu.galleryPlacement) return;
    artworkChoicePendingRef.current = false;
    setArtworkChooser({ mode: 'gallery-create', placement: contextMenu.galleryPlacement, anchor: contextMenu.anchor });
    closeContextMenu();
    if (libraryStatus === 'idle') loadLibrary();
  }, [closeContextMenu, contextMenu, libraryStatus, loadLibrary, ownerAuthoringEnabled]);

  const chooseArtwork = useCallback((asset) => {
    if (!ownerAuthoringEnabled || !artworkChooser || artworkChoicePendingRef.current) return;
    artworkChoicePendingRef.current = true;
    const operation = artworkChoiceOperation(artworkChooser, asset);
    if (operation.type === 'replace') {
      runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.replaceAsset(operation.targetId, operation.assetId));
      setArtworkChooser(null);
      setSelectedCanvasObjectId(operation.targetId);
      return;
    }
    const id = runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.create(operation.input));
    setArtworkChooser(null);
    if (id && operation.gallery) setSelectedCanvasObjectId(id);
    else if (id) openArtworkInspector(id, artworkChooser.anchor);
  }, [artworkChooser, mutations, openArtworkInspector, ownerAuthoringEnabled]);

  const cancelArtworkChoice = useCallback(() => {
    artworkChoicePendingRef.current = false;
    setArtworkChooser(null);
  }, []);

  const openArtworkPreview = useCallback((id) => {
    setPreviewObjectId(id);
    setArtworkInspector(null);
    setSelectedCanvasObjectId(null);
  }, []);

  const closeArtworkPreview = useCallback(() => {
    const id = previewObjectId;
    setPreviewObjectId(null);
    window.requestAnimationFrame(() => canvasObjectRefs.current.get(id)?.querySelector('button')?.focus());
  }, [previewObjectId]);

  const requestGalleryArtworkRemoval = useCallback((id) => {
    if (!ownerAuthoringEnabled) return;
    const object = canvasObjectById[id];
    if (!object) return;
    const asset = libraryAssets.find((entry) => entry.id === object.stableAssetId);
    closeContextMenu();
    setArtworkInspector(null);
    setSelectedCanvasObjectId(null);
    setGalleryRemovalPending({ id, name: asset?.name || 'Untitled artwork' });
  }, [canvasObjectById, closeContextMenu, libraryAssets, ownerAuthoringEnabled]);

  const confirmGalleryArtworkRemoval = useCallback(() => {
    if (!galleryRemovalPending) return;
    runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.remove(galleryRemovalPending.id));
    setGalleryRemovalPending(null);
  }, [galleryRemovalPending, mutations, ownerAuthoringEnabled]);

  const cancelGalleryArtworkRemoval = useCallback(() => setGalleryRemovalPending(null), []);

  const selectArtwork = useCallback((id) => {
    if (id && !ownerAuthoringEnabled) return;
    setSelectedCanvasObjectId(id);
  }, [ownerAuthoringEnabled]);

  const changeArtworkGeometry = useCallback((id, rect) => {
    runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.setGeometry(id, rect));
  }, [mutations, ownerAuthoringEnabled]);

  const changeInspectorGeometry = useCallback((id, span) => {
    const object = canvasObjectById[id];
    if (!object) return;
    const definition = getCanvasObjectDefinition(object.kind);
    const columns = Math.max(definition.minimumSpan.columns, Math.min(definition.maximumSpan.columns, Math.round(span.columns) || object.span.columns));
    const rows = Math.max(definition.minimumSpan.rows, Math.min(definition.maximumSpan.rows, Math.round(span.rows) || object.span.rows));
    changeArtworkGeometry(id, {
      column: object.placement.column,
      row: object.placement.row,
      columnSpan: columns,
      rowSpan: rows
    });
  }, [canvasObjectById, changeArtworkGeometry]);

  const changePresentation = useCallback((id, patch) => {
    runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.setPresentation(id, patch));
  }, [mutations, ownerAuthoringEnabled]);

  const toggleVisitorVisibility = useCallback((id) => {
    const object = canvasObjectById[id];
    if (!object) return;
    runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.setVisitorVisibility(id, !object.visitorVisible));
  }, [canvasObjectById, mutations, ownerAuthoringEnabled]);

  const reorderArtwork = useCallback((id, command) => {
    runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.reorder(id, command));
  }, [mutations, ownerAuthoringEnabled]);

  const previewContextCommand = useCallback((command) => {
    const target = contextMenu?.target;
    const patch = command ? presentationPatchForCommand(command, canvasObjectById[target?.id]?.presentation) : null;
    setGalleryPresentationPreview(patch ? { id: target.id, patch } : null);
  }, [canvasObjectById, contextMenu?.target]);

  const executeContextCommand = useCallback((command) => {
    const target = contextMenu?.target;
    if (!target) return;
    setGalleryPresentationPreview(null);
    if (isArtworkAuthoringCommand(command) && !ownerAuthoringEnabled) {
      closeContextMenu();
      return;
    }
    if (MENU_COMMANDS.has(command)) {
      setContextMenu((current) => ({ ...current, menu: command === 'menu-root' ? 'root' : command.slice(5) }));
      return;
    }
    const object = canvasObjectById[target.id];
    const presentationPatch = presentationPatchForCommand(command, object?.presentation);
    if (command === 'create-framed-artwork') { beginArtworkChoice('create'); return; }
    if (command === 'add-gallery-artwork') { beginGalleryArtworkChoice(); return; }
    if (command === 'open-artwork') openArtworkPreview(target.id);
    else if (command === 'toggle-artwork-lock' && object) {
      const locked = !object.locked;
      runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.setLocked(target.id, locked));
      setSelectedCanvasObjectId(locked ? null : target.id);
    } else if (command === 'lock-all-artwork') {
      runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.setAllLocked(true));
      setSelectedCanvasObjectId(null);
      setArtworkInspector(null);
    } else if (command === 'unlock-all-artwork') {
      runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.setAllLocked(false));
    } else if (presentationPatch) changePresentation(target.id, presentationPatch);
    else if (command === 'edit-artwork') openArtworkInspector(target.id);
    else if (command === 'replace-artwork') { beginArtworkChoice('replace', target.id); return; }
    else if (command === 'toggle-object-visibility' && object) toggleVisitorVisibility(target.id);
    else if (command === 'object-forward') reorderArtwork(target.id, CANVAS_OBJECT_ORDER_COMMAND.FORWARD);
    else if (command === 'object-backward') reorderArtwork(target.id, CANVAS_OBJECT_ORDER_COMMAND.BACKWARD);
    else if (command === 'object-front') reorderArtwork(target.id, CANVAS_OBJECT_ORDER_COMMAND.FRONT);
    else if (command === 'object-back') reorderArtwork(target.id, CANVAS_OBJECT_ORDER_COMMAND.BACK);
    else if (command === 'remove-artwork' && target.type === 'gallery-object') {
      requestGalleryArtworkRemoval(target.id);
      return;
    } else if (command === 'remove-artwork' && window.confirm('Remove this artwork from the canvas? The owned asset will remain in your library.')) {
      runOwnerAuthoringMutation(ownerAuthoringEnabled, () => mutations.remove(target.id));
      setArtworkInspector(null);
      setSelectedCanvasObjectId(null);
    } else if (!isArtworkAuthoringCommand(command)) {
      onShellCommand(command, target);
    }
    closeContextMenu();
  }, [beginArtworkChoice, beginGalleryArtworkChoice, canvasObjectById, changePresentation, closeContextMenu, contextMenu?.target, mutations, onShellCommand, openArtworkInspector, openArtworkPreview, ownerAuthoringEnabled, reorderArtwork, requestGalleryArtworkRemoval, toggleVisitorVisibility]);

  const clearForSpatialNavigation = useCallback(() => {
    setSelectedCanvasObjectId(null);
    setArtworkInspector(null);
    closeContextMenu();
  }, [closeContextMenu]);

  const clearOwnerUi = useCallback(() => {
    setSelectedCanvasObjectId(null);
    setArtworkInspector(null);
    setArtworkChooser(null);
    closeContextMenu();
  }, [closeContextMenu]);

  const registerArtworkElement = useCallback((id, node) => {
    if (node) canvasObjectRefs.current.set(id, node);
    else canvasObjectRefs.current.delete(id);
  }, []);

  useEffect(() => {
    if (!previewObjectId) return undefined;
    const close = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeArtworkPreview();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [closeArtworkPreview, previewObjectId]);

  useEffect(() => {
    if (ownerAuthoringEnabled) return;
    clearOwnerUi();
  }, [clearOwnerUi, ownerAuthoringEnabled]);

  useEffect(() => {
    if (previousProfileRef.current === profileAddress) return;
    previousProfileRef.current = profileAddress;
    setPreviewObjectId(null);
    setGalleryRemovalPending(null);
    clearOwnerUi();
  }, [clearOwnerUi, profileAddress]);

  useEffect(() => {
    if (selectedCanvasObjectId && !canvasObjectById[selectedCanvasObjectId]) setSelectedCanvasObjectId(null);
    if (artworkInspector && !canvasObjectById[artworkInspector.id]) setArtworkInspector(null);
    if (previewObjectId && !canvasObjectById[previewObjectId]) setPreviewObjectId(null);
    if (galleryRemovalPending && !canvasObjectById[galleryRemovalPending.id]) setGalleryRemovalPending(null);
  }, [artworkInspector, canvasObjectById, galleryRemovalPending, previewObjectId, selectedCanvasObjectId]);

  useEffect(() => {
    if (contextMenu && !contextTargetExists(contextMenu.target, {
      canvasObjectById, openRuntimeIds, sceneById
    })) closeContextMenu();
  }, [canvasObjectById, closeContextMenu, contextMenu, openRuntimeIds, sceneById]);

  const actions = useMemo(() => ({
    beginArtworkChoice,
    cancelArtworkChoice,
    cancelGalleryArtworkRemoval,
    changeArtworkGeometry,
    changeInspectorGeometry,
    changePresentation,
    chooseArtwork,
    clearForSpatialNavigation,
    clearOwnerUi,
    closeArtworkInspector,
    closeArtworkPreview,
    closeContextMenu,
    confirmGalleryArtworkRemoval,
    executeContextCommand,
    openArtworkPreview,
    openGalleryContextMenu,
    openTargetContextMenu,
    openWorldContextMenu,
    previewContextCommand,
    registerArtworkElement,
    reorderArtwork,
    requestGalleryArtworkRemoval,
    selectArtwork,
    toggleVisitorVisibility
  }), [beginArtworkChoice, cancelArtworkChoice, cancelGalleryArtworkRemoval, changeArtworkGeometry, changeInspectorGeometry, changePresentation, chooseArtwork, clearForSpatialNavigation, clearOwnerUi, closeArtworkInspector, closeArtworkPreview, closeContextMenu, confirmGalleryArtworkRemoval, executeContextCommand, openArtworkPreview, openGalleryContextMenu, openTargetContextMenu, openWorldContextMenu, previewContextCommand, registerArtworkElement, reorderArtwork, requestGalleryArtworkRemoval, selectArtwork, toggleVisitorVisibility]);

  return {
    actions,
    artworkChooser,
    artworkInspector,
    canvasObjectRefs,
    contextMenu,
    galleryPresentationPreview,
    galleryRemovalPending,
    previewObjectId,
    selectedCanvasObjectId
  };
}
