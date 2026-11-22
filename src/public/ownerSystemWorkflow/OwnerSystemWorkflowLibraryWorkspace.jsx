import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBrowserWorkspace from '../../lattice/browser/useBrowserWorkspace.js';
import '../../lattice/browser/browserWorkspace.css';
import { X } from 'lucide-react';
import { OwnerSystemWorkflowWorkspaceShell } from './OwnerSystemWorkflowBrowserWorkspace.jsx';
import { decodeOwnerSystemWorkflowAssetDimensions, ownerSystemWorkflowAssetDimensions } from './ownerSystemWorkflowAssetDimensions.js';
import OwnerSystemWorkflowLibraryPresenter from './OwnerSystemWorkflowLibraryPresenter.jsx';
import { libraryCategoryImage, libraryImageChoices } from './OwnerSystemWorkflowLibraryImages.jsx';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';
import './libraryWorkspace.css';

const DRAG_THRESHOLD = 6;
const sourceFor = (asset) => asset?.previewSrc || asset?.src || asset?.imageUrl || asset?.thumbnailUrl || null;
const ownerLibraryPreviewRecords = new Map();

export default function OwnerSystemWorkflowLibraryWorkspace({ authoringLocked = false, categoryCommands, placementScope, data, onClose, phase, open = phase !== 'closing' && phase !== 'closed',
  preferences, preferenceStore, previewRecords = ownerLibraryPreviewRecords, resolveAssetDimensions, workbenchImageTargetRef, moduleAssetTargetRef, placementTargetRef, shortcutTargetRef, workspaceRef, className = '', label = 'Library workspace', resizable = true, overlayPlacement = false, selectionAction, selectionEnabled = true, onPlacingChange, header, embedded = false }) {
  // Host closure invalidates pending drops immediately, before exit animation.
  const libraryClosed = !open;
  const workspace = useBrowserWorkspace(data, previewRecords, preferences, preferenceStore, !libraryClosed);
  const onSourceCriteria = data.onSourceCriteria;
  useLayoutEffect(() => {
    onSourceCriteria?.({query:workspace.query.trim(), collection:workspace.collection, relationship:workspace.relationshipView});
  }, [onSourceCriteria, workspace.query, workspace.collection, workspace.relationshipView]);
  const onBrowse = data.onBrowse;
  useEffect(() => {
    if (!libraryClosed && data.workspaceReady !== false && !data.collectionContext) onBrowse?.({ ...workspace.view, relationship: workspace.relationshipView });
  }, [libraryClosed, data.workspaceReady, data.collectionContext, onBrowse, workspace.view, workspace.relationshipView]);
  // Source identity and the selected image travel together to category and
  // placement actions. Neither changes the NFT's ownership or creator facts.
  const [imageSelection, setImageSelection] = useState(null);
  const source = workspace.selectedAsset;
  const imageChoice = source && imageSelection?.assetId === (source.stableAssetId || source.id) ? imageSelection : null;
  const selectedAsset = imageChoice ? imageChoice.ownerContext === data.ownerContext
    && (libraryImageChoices(source).some(choice => choice.sources.includes(imageChoice.media.url))
      || workspace.selectedCategory?.imageSelections?.some(entry => entry.assetId === imageChoice.assetId && entry.url === imageChoice.media.url))
      ? assetForPlacement(source, { selectedMedia: imageChoice.media }) : null : source;
  const resolveDimensions = asset => decodeOwnerSystemWorkflowAssetDimensions(asset, { preferMetadata: true });
  const preload = asset => { void (resolveAssetDimensions || decodeOwnerSystemWorkflowAssetDimensions)(asset).catch(() => {}); };
  const [dragPreview, setDragPreview] = useState(null);
  const [categoryDrag, setCategoryDrag] = useState(null);
  const [dropFeedback, setDropFeedback] = useState(null);
  const dragRef = useRef(null), navigationTargetRef = useRef(null);
  const suppressSelection = useRef(false);
  const latestLibrary = useRef(null);
  latestLibrary.current = { data, categoryCommands };
  const placementContext = useMemo(() => ({ placementScope, ownerContext: data.ownerContext, authoringLocked, libraryClosed }),
    [placementScope, data.ownerContext, authoringLocked, libraryClosed]);
  const currentPlacementContext = useRef(placementContext);
  currentPlacementContext.current = placementContext;
  const mounted = useRef(true);
  const { libraryWidth, setLibraryWidth } = workspace;
  const resizeRef = useRef(null);
  const clampWidth = (width) => Math.min(window.innerWidth * 0.48, Math.max(300, width));
  const finishResize = (event) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const [placing, setPlacing] = useState(false);
  useEffect(() => { onPlacingChange?.(placing); return () => onPlacingChange?.(false); }, [placing, onPlacingChange]);
  const place = async (asset) => {
    if (authoringLocked || libraryClosed) return false;
    // Registry wrappers follow selection. Retain the receiving module/Grid
    // before asynchronous media work, rather than selecting again afterward.
    const target = placementTargetRef?.current?.captureTarget();
    if (!target) return false;
    preload(asset);
    let dimensions;
    try { dimensions = await resolveDimensions(asset); } catch { return false; }
    if (!dimensions || !mounted.current || currentPlacementContext.current !== placementContext) return false;
    try {
      const accepted = await target?.placeAsset(asset, dimensions);
      if (!accepted && mounted.current && currentPlacementContext.current === placementContext) setDropFeedback('Artwork could not be placed here.');
      return accepted || false;
    } catch (error) { if (mounted.current && currentPlacementContext.current === placementContext) setDropFeedback(error.message); return false; }
  };
  const activate = asset => asset.isCollection && asset.collectionRole !== 'cover'
    ? data.onOpenCollection?.(asset.assetRecord)
    : asset.placeable && (asset.selectedMedia || workspace.isAssetRenderable(asset.stableAssetId || asset.id)) && place(asset);
  const cleanup = () => {
    const active = dragRef.current;
    if (!active) return;
    globalThis.removeEventListener('pointermove', active.move, true);
    globalThis.removeEventListener('pointerup', active.finish, true);
    globalThis.removeEventListener('pointercancel', active.cancel, true);
    globalThis.removeEventListener('keydown', active.escape, true);
    globalThis.removeEventListener('blur', active.cancel);
    document.removeEventListener('visibilitychange', active.visibility);
    active.source?.removeEventListener('lostpointercapture', active.lostCapture);
    active.dropNode?.removeAttribute('data-curation-hover');
    active.source?.removeAttribute('data-workflow-dragging');
    dragRef.current = null;
    if (active.source?.hasPointerCapture?.(active.pointerId)) active.source.releasePointerCapture(active.pointerId);
    setPlacing(false);
    setDragPreview(null);
    setCategoryDrag(null);
    navigationTargetRef.current?.finish();
  };
  const beginAssetDrag = (event, asset, workspaceState, options = {}) => {
    const id = asset?.stableAssetId || asset?.id;
    if (authoringLocked || libraryClosed || dragRef.current || event.button !== 0) return;
    suppressSelection.current = false;
    setDropFeedback(null);
    const assetIds = options.assetIds || [id];
    const canPlace = data.curationRole !== 'source' && assetIds.length === 1 && asset.placeable && workspaceState?.isAssetRenderable(id);
    const origin = { x: event.clientX, y: event.clientY };
    const active = { target: placementTargetRef?.current, dimensions: ownerSystemWorkflowAssetDimensions(asset), lastPointer: null,
      moduleTarget: moduleAssetTargetRef?.current,
      pointerId: event.pointerId, moved: false, source: event.currentTarget };
    const library = event.currentTarget.closest('.system-workflow__library');
    const overLibraryNavigation = (pointerEvent) => {
      return [...(library?.querySelectorAll('.lattice-browser-sidebar, .library-folder-drop-picker') || [])].some(node => {
        const bounds = node.getBoundingClientRect();
        return pointerEvent.clientX >= bounds.left && pointerEvent.clientX <= bounds.right
          && pointerEvent.clientY >= bounds.top && pointerEvent.clientY <= bounds.bottom;
      });
    };
    // Hover and release use the same routing decision. Each receiver supplies
    // its preview, validity check and action; only module code authors content.
    const receiverAt = (pointerEvent) => {
      const point = { x: pointerEvent.clientX, y: pointerEvent.clientY };
      const hit = document.elementFromPoint(point.x, point.y);
      if (data.curationRole === 'source') {
        const node = hit?.closest('[data-browser-category-id], [data-curation-folder], button[aria-label="All Assets"]');
        if (!node?.closest('[data-curation-pane="destination"]')) return null;
        const folder = node.dataset.browserCategoryId || node.dataset.curationFolder || null;
        return { kind: 'curation', node, isCurrent: () => node.isConnected, preview: () => null,
          place: () => data.onCurationAction(assetIds, folder, asset.selectedMedia?.url), rejection: 'Could not add the selected works.' };
      }
      if (data.onReorder && workspaceState.sort === 'curated' && library.contains(hit)
        && hit?.closest('[data-curation-folder]') && !hit.closest('[data-browser-category-id]')) {
        const tile = hit.closest('[data-library-asset-id]');
        const node = tile || hit.closest('[data-curation-folder]');
        return { kind: 'curation', node, isCurrent: () => node.isConnected, preview: () => null,
          place: () => data.onReorder(assetIds, tile?.dataset.libraryAssetId) };
      }
      if (overLibraryNavigation(pointerEvent) || hit?.closest('[data-library-folder-tile]')) {
        const categoryId = hit?.closest('[data-browser-category-id]')?.dataset.browserCategoryId;
        const fromId = options.sourceFolderId;
        if (!categoryId || categoryId === fromId) return null;
        const imageUrl = assetIds.length === 1 && asset.selectedMedia ? libraryCategoryImage(asset) : null;
        return { kind: 'category', categoryId, point, preview: () => null,
          isCurrent: () => latestLibrary.current.data.categories.some(({ id }) => id === categoryId)
            && assetIds.every(id => latestLibrary.current.data.assets.some(asset => (asset.stableAssetId || asset.id) === id)),
          place: () => {
            const commands = latestLibrary.current.categoryCommands;
            if (fromId) return commands?.moveCategoryAssets(fromId, categoryId, assetIds, imageUrl);
            return imageUrl ? commands?.setCategoryImage(categoryId, id, imageUrl, true)
              : commands?.setCategoryAssets(categoryId, assetIds, true);
          },
          rejection: 'Artwork could not be added to this category.' };
      }
      if (!canPlace) return null;
      const surfacePreview = (target, kind, label) => {
        const bounds = target.node.getBoundingClientRect();
        return { kind, label, rectangle: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } };
      };
      const workbench = workbenchImageTargetRef?.current;
      const workbenchTarget = workbench?.targetAt?.(point);
      const moduleTarget = active.moduleTarget?.targetAt?.(point) || active.moduleTarget;
      if (!workbenchTarget?.acceptsModuleSurface && moduleTarget && moduleAssetTargetRef?.current === active.moduleTarget && moduleTarget.node?.contains(hit)) {
        return { preview: () => surfacePreview(moduleTarget, 'module', moduleTarget.label),
          isCurrent: () => moduleAssetTargetRef?.current === active.moduleTarget
            && active.moduleTarget?.has?.(moduleTarget) !== false && moduleTarget.node?.isConnected,
          place: () => moduleTarget.placeAsset(asset, point), rejection: 'This module could not accept the artwork.' };
      }
      // The native Reception scope can explicitly accept a cell's surface as
      // its canvas. Other modules still reject drops outside registered targets.
      if (hit?.closest('[data-workbench-module]') && !workbenchTarget) return { preview: () => null, isCurrent: () => true,
        place: () => false, rejection: 'This module cannot accept artwork here.' };
      const shortcut = shortcutTargetRef?.current?.targetAt?.(point) || shortcutTargetRef?.current;
      if (shortcut?.node?.contains(hit)) {
        return { preview: () => surfacePreview(shortcut, 'shortcut'),
          isCurrent: () => shortcut.node?.isConnected && (shortcutTargetRef?.current?.has
            ? shortcutTargetRef?.current.has(shortcut) : shortcutTargetRef?.current === shortcut),
          place: () => shortcut.placeAsset(asset), rejection: 'This shortcut could not accept the artwork.' };
      }
      const display = active.target?.targetAt?.(point);
      const target = display || workbenchTarget;
      if (!target) return null;
      return { preview: dimensions => target.previewAt(point, dimensions, options),
        isCurrent: () => target.isCurrent?.() !== false && (display || workbenchImageTargetRef?.current === workbench),
        place: (dimensions, preview, isCurrent) => dimensions && preview?.destination
          && target.placeAsset(asset, dimensions, preview.destination, isCurrent),
        reject: target.rejectDrop, rejection: 'Artwork could not be placed here.' };
    };
    const updatePreview = (pointerEvent) => {
      navigationTargetRef.current?.hover({ x: pointerEvent.clientX, y: pointerEvent.clientY });
      const receiver = receiverAt(pointerEvent);
      if (data.curationRole) {
        active.dropNode?.removeAttribute('data-curation-hover');
        active.dropNode = receiver?.node;
        active.dropNode?.setAttribute('data-curation-hover', '');
      }
      const category = receiver?.kind === 'category';
      setCategoryDrag(category ? { assetIds, categoryId: receiver.categoryId, point: receiver.point } : null);
      setDragPreview(canPlace && !overLibraryNavigation(pointerEvent)
        ? { asset, ...receiver?.preview(active.dimensions) } : null);
    };
    const move = (pointerEvent) => {
      if (pointerEvent.pointerId !== active.pointerId || active.released) return;
      active.moved ||= Math.hypot(pointerEvent.clientX - origin.x, pointerEvent.clientY - origin.y) > DRAG_THRESHOLD;
      if (!active.moved) return;
      pointerEvent.preventDefault();
      suppressSelection.current = true;
      if (canPlace) {
        if (!active.preloaded) { active.preloaded = true; preload(asset); }
        const bounds = library?.getBoundingClientRect();
        const inside = bounds && pointerEvent.clientX >= bounds.left && pointerEvent.clientX <= bounds.right
          && pointerEvent.clientY >= bounds.top && pointerEvent.clientY <= bounds.bottom;
        setPlacing(!inside);
      }
      active.lastPointer = pointerEvent;
      active.source?.setAttribute('data-workflow-dragging', '');
      updatePreview(pointerEvent);
    };
    const finish = async (pointerEvent) => {
      if (pointerEvent.pointerId !== active.pointerId || active.released) return;
      if (!active.moved) { cleanup(); return; }
      active.released = true;
      // Resolve routing at release while drag-only surfaces remain visible.
      // Decoding can refine size, but must never choose another destination.
      const receiver = receiverAt(pointerEvent);
      if (!receiver) { cleanup(); return; }
      const isCurrent = () => mounted.current && currentPlacementContext.current === placementContext
        && !active.cancelled && receiver.isCurrent();
      const reject = message => {
        if (!isCurrent()) return;
        if (receiver.reject) receiver.reject(); else setDropFeedback(message || receiver.rejection);
      };
      try {
        const dimensions = ['category', 'curation'].includes(receiver.kind) ? null : await active.dimensionPromise;
        if (dragRef.current !== active) return;
        if (!isCurrent()) { cleanup(); return; }
        const preview = receiver.preview(dimensions);
        cleanup();
        if (!await receiver.place(dimensions, preview, isCurrent)) reject();
      } catch (error) {
        if (dragRef.current === active) cleanup();
        reject(error.message);
      }
    };
    const cancel = (event) => {
      if (event?.type === 'pointercancel' && event.pointerId !== active.pointerId) return;
      active.cancelled = true;
      cleanup();
    };
    const lostCapture = (event) => { if (event.pointerId === active.pointerId && !active.released) cancel(); };
    const visibility = () => { if (document.hidden) cancel(); };
    const escape = (keyEvent) => {
      if (keyEvent.key !== 'Escape') return;
      if (active.moved) { keyEvent.preventDefault(); keyEvent.stopPropagation(); }
      cancel();
    };
    Object.assign(active, { move, finish, cancel, escape, lostCapture, visibility }); dragRef.current = active;
    active.dimensionPromise = Promise.resolve().then(() => canPlace ? resolveDimensions(asset) : null).then((dimensions) => {
      active.dimensions = dimensions;
      if (dragRef.current === active && !active.released && active.moved && active.lastPointer && dimensions) {
        updatePreview(active.lastPointer);
      }
      return active.dimensions;
    }).catch(() => null);
    globalThis.addEventListener('pointermove', move, true); globalThis.addEventListener('pointerup', finish, true); globalThis.addEventListener('pointercancel', cancel, true);
    globalThis.addEventListener('keydown', escape, true);
    globalThis.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    active.source.addEventListener('lostpointercapture', lostCapture);
    active.source.setPointerCapture?.(active.pointerId);
  };
  useEffect(() => { cleanup(); setDropFeedback(null); }, [placementContext]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cleanup(); }; }, []);
  return <OwnerSystemWorkflowWorkspaceShell className={`system-workflow__library system-workflow__library-editor workbench-editor-panel ${className}`} label={label} phase={phase}
    header={header || (onClose && <header className="workbench-tool-panel-header system-workflow__library-header"><span>Library</span>
      <button type="button" className="workbench-tool-panel-close" aria-label="Close Library" onClick={onClose}><X /></button></header>)} embedded={embedded} palette="editor"
    style={libraryWidth === null ? undefined : { '--workflow-library-width': `${libraryWidth}px` }}
    resizeHandle={resizable && <button aria-label="Resize Library" className="system-workflow__library-resize" type="button"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        resizeRef.current = { pointerId: event.pointerId, x: event.clientX, width: event.currentTarget.parentElement.getBoundingClientRect().width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={(event) => {
        const gesture = resizeRef.current;
        if (gesture?.pointerId === event.pointerId) setLibraryWidth(clampWidth(gesture.width + event.clientX - gesture.x));
      }} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={() => { resizeRef.current = null; }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const width = event.currentTarget.parentElement.getBoundingClientRect().width;
        setLibraryWidth(clampWidth(event.key === 'Home' ? 300 : event.key === 'End' ? window.innerWidth
          : width + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 80 : 20)));
      }} />}
    placing={placing} rail={selectionAction ? <button type="button" className="workflow-tactile-control system-workflow__library-selection-action"
        disabled={authoringLocked || !selectionEnabled || !selectedAsset}
        onClick={() => { if (selectedAsset) activate(selectedAsset); }}>{selectionAction}</button> : null}
    >
    <OwnerSystemWorkflowLibraryPresenter key={data.ownerContext} categoryCommands={categoryCommands} data={data} open={!libraryClosed}
      navigationTargetRef={navigationTargetRef}
      categoryDrag={categoryDrag} dropFeedback={dropFeedback}
       onAssetActivate={(_event, asset) => data.curationRole === 'source' && !asset.isCollection ? data.onCurationAction([asset.stableAssetId || asset.id]) : activate(asset)}
      onAssetPointerDown={beginAssetDrag} onImageActivate={(_event, asset) => data.curationRole === 'source'
        ? data.onCurationAction([asset.stableAssetId || asset.id], null, asset.selectedMedia.url) : place(asset)}
      workspace={{ ...workspace, curationRole: data.curationRole, collectionContext:data.collectionContext, curatedImages: data.curatedImages, selectedImage: imageChoice, selectAsset: (id, event, media = null) => {
        if (!suppressSelection.current || event.detail === 0) {
          workspace.selectAsset(id, event);
          setImageSelection(media ? { assetId: id, ownerContext: data.ownerContext, media } : null);
        }
      } }} />
    {dragPreview?.rectangle && createPortal(<div aria-hidden="true" className="system-workflow__placement-preview" data-stack-drop={dragPreview.kind === 'stack' || undefined} style={dragPreview.rectangle}>
      {dragPreview.kind !== 'stack' && sourceFor(dragPreview.asset) && <img alt="" src={sourceFor(dragPreview.asset)} />}
      <span>{dragPreview.label || (dragPreview.kind === 'workbench-image' ? 'Release to place Image' : dragPreview.kind === 'shortcut' ? 'Release to replace icon' : 'Release to add layer')}</span>
    </div>, workspaceRef?.current || document.body)}
  </OwnerSystemWorkflowWorkspaceShell>;
}
