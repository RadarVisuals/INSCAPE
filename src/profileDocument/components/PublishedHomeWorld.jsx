import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FramedArtwork from '../../public/FramedArtwork.jsx';
import PublishedImage from './PublishedImage.jsx';
import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import HomeWorldSurface from '../../public/HomeWorldSurface.jsx';
import { iconGlyph } from '../../public/sceneIcons.js';
import { clampHomeWorldCamera } from '../../public/homeWorldCamera.js';
import { exceedsSpatialPointerDragThreshold, shouldActivateSpatialPointer } from '../../public/spatialWorldCamera.js';
import { projectDocumentAsset } from '../domain/documentProjection.js';
import {
  clampVisitorWindowRect,
  createPublishedVisitorLayout,
  createVisitorWindowState,
  initialVisitorWindowRect,
  publishedItemPixelRect,
  publishedNavigatorLocations,
  publishedWorldTransform,
  resizeVisitorWindowByKey,
  snapVisitorWindowRect,
  visitorWindowTransition
} from '../domain/publishedVisitorWorld.js';
import PublishedProfileDocumentSpaceWindow from './PublishedProfileDocumentSpaceWindow.jsx';
import { projectPublishedIdentityRack } from '../domain/publishedIdentityRack.js';

const PublishedIdentityRack = lazy(() => import('./PublishedIdentityRack.jsx'));

const THEME = Object.freeze({ '--os-accent': '#e87945', '--module-accent': '#e87945', '--hu-text': '#eeebdf', '--hu-text-muted': '#a9a59c' });

function viewportSize() {
  return { width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 };
}

export default function PublishedHomeWorld({ document, onMoveKeeper }) {
  const [viewport, setViewport] = useState(viewportSize);
  const layout = useMemo(() => createPublishedVisitorLayout(document, viewport.width, viewport.height), [document, viewport]);
  const [camera, setCamera] = useState(layout.camera);
  const [windowState, setWindowState] = useState(() => createVisitorWindowState(
    document.spaces.filter((space) => space.startOpen).map((space) => ({ id: space.id, rect: initialVisitorWindowRect(space, layout, layout.camera) }))
  ));
  const [openArtworkId, setOpenArtworkId] = useState(null);
  const worldRef = useRef(null);
  const artworkDialogRef = useRef(null);
  const artworkTriggerRef = useRef(null);
  const launcherRefs = useRef(new Map());
  const interactionRef = useRef(null);
  const compactTapRef = useRef({ activePointers: new Set(), candidate: null, multiTouch: false });
  const cached = document.profile.cachedIdentity;
  const avatarUrl = resolvePublishedAssetUrl(cached.avatarUrl);
  const displayName = cached.name || `${document.profile.address.slice(0, 8)}…${document.profile.address.slice(-6)}`;
  const identityRack = useMemo(() => projectPublishedIdentityRack(document), [document]);

  useEffect(() => {
    const resize = () => setViewport(viewportSize());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    setCamera(layout.camera);
    setWindowState(createVisitorWindowState(document.spaces.filter((space) => space.startOpen).map((space) => ({ id: space.id, rect: initialVisitorWindowRect(space, layout, layout.camera) }))));
    setOpenArtworkId(null);
  }, [document]);

  useEffect(() => {
    setCamera((current) => layout.geometry.narrow ? layout.camera : clampHomeWorldCamera(current, layout.world));
    setWindowState((current) => ({
      ...current,
      windows: Object.fromEntries(Object.entries(current.windows).map(([id, entry]) => [id, { ...entry, rect: clampVisitorWindowRect(entry.rect, viewport) }]))
    }));
  }, [layout.geometry.narrow, layout.world, viewport]);

  const transitionWindow = useCallback((action) => setWindowState((state) => visitorWindowTransition(state, action)), []);
  const toggleSpace = useCallback((space) => transitionWindow({ type: 'toggle', id: space.id, rect: initialVisitorWindowRect(space, layout, camera) }), [camera, layout, transitionWindow]);
  const closeSpace = useCallback((id) => {
    transitionWindow({ type: 'close', id });
    window.requestAnimationFrame(() => {
      const launcher = launcherRefs.current.get(id);
      (launcher?.isConnected ? launcher : worldRef.current)?.focus?.();
    });
  }, [transitionWindow]);
  const beginWindowInteraction = useCallback((event, id, kind) => {
    if (layout.geometry.narrow || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const entry = windowState.windows[id]; if (!entry) return;
    interactionRef.current = { id, kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect: entry.rect };
    transitionWindow({ type: 'focus', id });
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [layout.geometry.narrow, transitionWindow, windowState.windows]);
  const moveWindowInteraction = useCallback((event) => {
    const active = interactionRef.current; if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.x; const dy = event.clientY - active.y;
    const rect = active.kind === 'resize'
      ? { ...active.rect, width: active.rect.width + dx, height: active.rect.height + dy }
      : { ...active.rect, left: active.rect.left + dx, top: active.rect.top + dy };
    transitionWindow({ type: 'geometry', id: active.id, rect: snapVisitorWindowRect(rect, viewport) });
  }, [transitionWindow, viewport]);
  const finishWindowInteraction = useCallback((event) => { if (interactionRef.current?.pointerId === event.pointerId) interactionRef.current = null; }, []);
  const resizeWindowByKeyboard = useCallback((event, id) => {
    const entry = windowState.windows[id];
    const rect = entry && resizeVisitorWindowByKey(entry.rect, event.key, viewport);
    if (!rect) return;
    event.preventDefault(); event.stopPropagation();
    transitionWindow({ type: 'geometry', id, rect });
  }, [transitionWindow, viewport, windowState.windows]);
  const beginCompactTap = useCallback((event) => {
    if (!layout.geometry.narrow) return;
    const tracking = compactTapRef.current;
    if (event.pointerType !== 'mouse') tracking.activePointers.add(event.pointerId);
    if (tracking.activePointers.size > 1) {
      tracking.multiTouch = true;
      if (tracking.candidate) tracking.candidate.multiTouch = true;
      return;
    }
    const primaryButton = event.pointerType !== 'mouse' || event.button === 0;
    if (!primaryButton || event.isPrimary === false || event.target !== event.currentTarget) return;
    tracking.candidate = { pointerId: event.pointerId, originPointer: { x: event.clientX, y: event.clientY }, moved: false, panning: false, multiTouch: false };
  }, [layout.geometry.narrow]);
  const moveCompactTap = useCallback((event) => {
    const candidate = compactTapRef.current.candidate;
    if (!candidate || candidate.pointerId !== event.pointerId) return;
    candidate.moved ||= exceedsSpatialPointerDragThreshold(candidate.originPointer, { x: event.clientX, y: event.clientY });
  }, []);
  const finishCompactTap = useCallback((event, cancelled = false) => {
    const tracking = compactTapRef.current;
    if (event.pointerType !== 'mouse') tracking.activePointers.delete(event.pointerId);
    const candidate = tracking.candidate;
    if (!candidate || candidate.pointerId !== event.pointerId) {
      if (tracking.activePointers.size === 0) tracking.multiTouch = false;
      return;
    }
    tracking.candidate = null;
    if (shouldActivateSpatialPointer(candidate, cancelled || tracking.multiTouch)) onMoveKeeper?.(event.clientX, event.clientY);
    if (tracking.activePointers.size === 0) tracking.multiTouch = false;
  }, [onMoveKeeper]);

  const openArtwork = document.canvasObjects.find((object) => object.id === openArtworkId) || null;
  useEffect(() => {
    if (!openArtwork) return undefined;
    const dialog = artworkDialogRef.current;
    const isolated = [];
    let branch = dialog;
    while (branch?.parentElement) {
      const parent = branch.parentElement;
      for (const sibling of parent.children) {
        if (sibling === branch) continue;
        isolated.push({ node: sibling, hadAttribute: sibling.hasAttribute('inert'), value: sibling.inert });
        sibling.inert = true;
      }
      if (parent.matches('.application-root')) break;
      branch = parent;
    }
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.closest('[inert]') && node.getClientRects().length > 0);
    const focusDialog = () => (focusable()[0] || dialog).focus();
    const frame = window.requestAnimationFrame(focusDialog);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpenArtworkId(null); return; }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const containFocus = (event) => { if (!dialog.contains(event.target)) focusDialog(); };
    globalThis.document.addEventListener('keydown', handleKeyDown, true);
    globalThis.document.addEventListener('focusin', containFocus, true);
    return () => {
      window.cancelAnimationFrame(frame);
      globalThis.document.removeEventListener('keydown', handleKeyDown, true);
      globalThis.document.removeEventListener('focusin', containFocus, true);
      for (const { node, hadAttribute, value } of isolated) {
        if (hadAttribute) node.inert = value;
        else node.removeAttribute('inert');
      }
      const trigger = artworkTriggerRef.current;
      (trigger?.isConnected ? trigger : worldRef.current)?.focus?.();
      artworkTriggerRef.current = null;
    };
  }, [openArtwork]);

  const locations = useMemo(() => publishedNavigatorLocations(layout), [layout]);
  const transform = publishedWorldTransform(layout, camera);
  return <main ref={worldRef} className="public-shell published-home-world" data-interface-visible data-preview-mode="visitor" data-published-focus-fallback tabIndex="-1" aria-label="Published profile visitor world" style={THEME} onKeyDownCapture={(event) => { if (event.code === 'Space' && event.target.closest?.('button,a[href],[role="button"]')) event.stopPropagation(); }}>
    {identityRack ? <Suspense fallback={null}><PublishedIdentityRack key={`${document.profile.address}:${document.documentId || ''}:${document.revision || ''}`} rack={identityRack} /></Suspense> : <><header className="public-shell__masthead published-home-world__header"><div className="system-hud__identity"><h1>[ <span className="system-hud__brand-accent">PUBLISHED WORLD</span> ]</h1><span className="system-hud__operator">{displayName}</span><span className="system-hud__live"><i aria-hidden="true" />Document v{document.version}</span></div></header><section className="published-home-world__identity" aria-label="Public profile identity">{avatarUrl ? <PublishedImage src={avatarUrl} alt="" fallback={<span aria-hidden="true">UP</span>} /> : <span aria-hidden="true">UP</span>}<div><strong>{displayName}</strong><small>{document.profile.address}</small></div></section></>}
    <HomeWorldSurface camera={camera} geometry={layout.geometry} world={layout.world} locations={locations} gridVisible theme={THEME} visible onCameraChange={setCamera} onMoveKeeper={onMoveKeeper} narrowGestureRef={compactTapRef} />
    <section className="published-home-world__spatial" aria-label="Published Canvas Spaces and artwork" style={{ width: layout.placementGeometry.usableWidth, height: layout.placementGeometry.usableHeight, transform, '--grid-cell-width': `${layout.geometry.cellWidth}px`, '--grid-cell-height': `${layout.geometry.cellHeight}px` }} onPointerDown={beginCompactTap} onPointerMove={moveCompactTap} onPointerUp={finishCompactTap} onPointerCancel={(event) => finishCompactTap(event, true)} onPointerLeave={(event) => { if (event.pointerType === 'mouse') finishCompactTap(event, true); }}>
      {layout.spaces.map((item) => { const entry = windowState.windows[item.id]; const launcherAction = !entry ? 'Open' : entry.minimized ? 'Restore' : 'Close'; return <button ref={(node) => { if (node) launcherRefs.current.set(item.id, node); else launcherRefs.current.delete(item.id); }} className="module-shell module-button module-button--folder" data-entry-state="ready" data-launcher-id={item.id} data-window-state={!entry ? 'closed' : entry.minimized ? 'minimized' : 'open'} data-active={entry ? true : undefined} key={item.id} type="button" style={publishedItemPixelRect(item, layout)} onClick={() => toggleSpace(item.space)} aria-expanded={Boolean(entry && !entry.minimized)} aria-label={`${launcherAction} ${item.space.label}, ${item.space.assets.length} assets`}>
        {item.appearance.mode !== 'label' && <b className="module-button__icon" aria-hidden="true">{iconGlyph(item.appearance.iconKey)}</b>}{item.appearance.showLabel !== false && item.appearance.mode !== 'icon' && <span className="module-button__label">{item.space.label}</span>}{item.appearance.mode !== 'icon' && <small>{item.space.assets.length}</small>}
      </button>; })}
      {layout.objects.map((object) => <FramedArtwork key={object.id} object={{ ...object, stableAssetId: object.asset.stableAssetId, visitorVisible: true }} asset={projectDocumentAsset(object.asset)} arranging={false} compact={layout.geometry.narrow} selected={false} style={{ ...publishedItemPixelRect(object, layout), zIndex: 10 + object.order }} renderImage={(props) => <PublishedImage {...props} />} onActivate={(event) => { artworkTriggerRef.current = event.currentTarget; setOpenArtworkId(object.id); }} />)}
    </section>
    {windowState.zOrder.map((id, index) => { const entry = windowState.windows[id]; const space = document.spaces.find((candidate) => candidate.id === id); if (!entry || !space) return null; return <section key={id} className="module-shell module-shell--expanded module-shell--collection module-shell--folder published-home-world__window" data-minimized={entry.minimized || undefined} style={{ ...entry.rect, zIndex: 60 + index }} role="dialog" aria-modal="false" aria-label={`Published space: ${space.label}`} onPointerDownCapture={() => transitionWindow({ type: 'focus', id })}>
      <PublishedProfileDocumentSpaceWindow space={space} minimized={entry.minimized} dragHandleProps={{ onPointerDown: (event) => beginWindowInteraction(event, id, 'move'), onPointerMove: moveWindowInteraction, onPointerUp: finishWindowInteraction, onPointerCancel: finishWindowInteraction, onLostPointerCapture: finishWindowInteraction }} onMinimize={() => transitionWindow({ type: entry.minimized ? 'restore' : 'minimize', id })} onClose={() => closeSpace(id)} />
      {!layout.geometry.narrow && !entry.minimized && <><button type="button" className="module-window__resize" data-resize-control aria-label={`Resize ${space.label} window`} aria-describedby={`published-resize-help-${id}`} onKeyDown={(event) => resizeWindowByKeyboard(event, id)} onPointerDown={(event) => beginWindowInteraction(event, id, 'resize')} onPointerMove={moveWindowInteraction} onPointerUp={finishWindowInteraction} onPointerCancel={finishWindowInteraction} onLostPointerCapture={finishWindowInteraction} /><span className="sr-only" id={`published-resize-help-${id}`}>Use the arrow keys to resize in 40 pixel steps.</span></>}
    </section>; })}
    {openArtwork && (() => { const asset = projectDocumentAsset(openArtwork.asset); return <section ref={artworkDialogRef} className="profile-document-preview__artwork" role="dialog" aria-modal="true" aria-label={`Artwork preview: ${asset.name}`}><header><strong>{asset.name}</strong><button type="button" onClick={() => setOpenArtworkId(null)} aria-label="Close artwork preview">×</button></header>{asset.imageUrl ? <PublishedImage src={asset.imageUrl} alt={asset.name} fallback="Artwork unavailable" /> : <p>Artwork unavailable</p>}</section>; })()}
  </main>;
}
