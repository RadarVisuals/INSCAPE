import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FramedArtwork from '../../public/FramedArtwork.jsx';
import HomeWorldSurface from '../../public/HomeWorldSurface.jsx';
import { iconGlyph } from '../../public/sceneIcons.js';
import { clampHomeWorldCamera } from '../../public/homeWorldCamera.js';
import { projectDocumentAsset } from '../domain/documentProjection.js';
import {
  clampVisitorWindowRect,
  createPublishedVisitorLayout,
  createVisitorWindowState,
  initialVisitorWindowRect,
  publishedItemPixelRect,
  publishedNavigatorLocations,
  publishedWorldTransform,
  visitorWindowTransition
} from '../domain/publishedVisitorWorld.js';
import PublishedProfileDocumentSpaceWindow from './PublishedProfileDocumentSpaceWindow.jsx';

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
  const artworkDialogRef = useRef(null);
  const interactionRef = useRef(null);
  const cached = document.profile.cachedIdentity;
  const displayName = cached.name || `${document.profile.address.slice(0, 8)}…${document.profile.address.slice(-6)}`;

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
  const openSpace = useCallback((space) => transitionWindow({ type: 'open', id: space.id, rect: windowState.windows[space.id]?.rect || initialVisitorWindowRect(space, layout, camera) }), [camera, layout, transitionWindow, windowState.windows]);
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
    transitionWindow({ type: 'geometry', id: active.id, rect: clampVisitorWindowRect(rect, viewport) });
  }, [transitionWindow, viewport]);
  const finishWindowInteraction = useCallback((event) => { if (interactionRef.current?.pointerId === event.pointerId) interactionRef.current = null; }, []);

  const openArtwork = document.canvasObjects.find((object) => object.id === openArtworkId) || null;
  useEffect(() => {
    if (!openArtwork) return undefined;
    const previous = globalThis.document.activeElement;
    const frame = window.requestAnimationFrame(() => artworkDialogRef.current?.querySelector('button')?.focus());
    const close = (event) => { if (event.key === 'Escape') { event.preventDefault(); setOpenArtworkId(null); } };
    window.addEventListener('keydown', close);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('keydown', close); previous?.focus?.(); };
  }, [openArtwork]);

  const locations = useMemo(() => publishedNavigatorLocations(layout), [layout]);
  const transform = publishedWorldTransform(layout, camera);
  return <main className="public-shell published-home-world" data-interface-visible data-preview-mode="visitor" aria-label="Published profile visitor world" style={THEME}>
    <header className="public-shell__masthead published-home-world__header"><div className="system-hud__identity"><h1>[ <span className="system-hud__brand-accent">PUBLISHED WORLD</span> ]</h1><span className="system-hud__operator">{displayName}</span><span className="system-hud__live"><i aria-hidden="true" />Document v{document.version}</span></div></header>
    <section className="published-home-world__identity" aria-label="Public profile identity">{cached.avatarUrl ? <img src={cached.avatarUrl} alt="" /> : <span aria-hidden="true">UP</span>}<div><strong>{displayName}</strong><small>{document.profile.address}</small></div></section>
    <HomeWorldSurface camera={camera} geometry={layout.geometry} world={layout.world} locations={locations} gridVisible theme={THEME} visible onCameraChange={setCamera} onMoveKeeper={onMoveKeeper} />
    <section className="published-home-world__spatial" aria-label="Published Canvas Spaces and artwork" style={{ width: layout.placementGeometry.usableWidth, height: layout.placementGeometry.usableHeight, transform, '--grid-cell-width': `${layout.geometry.cellWidth}px`, '--grid-cell-height': `${layout.geometry.cellHeight}px` }}>
      {layout.spaces.map((item) => <button className="module-shell module-button module-button--folder" data-entry-state="ready" data-launcher-id={item.id} data-active={windowState.windows[item.id] ? true : undefined} key={item.id} type="button" style={publishedItemPixelRect(item, layout)} onClick={() => openSpace(item.space)} aria-expanded={Boolean(windowState.windows[item.id])} aria-label={`Open ${item.space.label}, ${item.space.assets.length} assets`}>
        {item.appearance.mode !== 'label' && <b className="module-button__icon" aria-hidden="true">{iconGlyph(item.appearance.iconKey)}</b>}{item.appearance.showLabel !== false && item.appearance.mode !== 'icon' && <span className="module-button__label">{item.space.label}</span>}{item.appearance.mode !== 'icon' && <small>{item.space.assets.length}</small>}
      </button>)}
      {layout.objects.map((object) => <FramedArtwork key={object.id} object={{ ...object, stableAssetId: object.asset.stableAssetId, visitorVisible: true }} asset={projectDocumentAsset(object.asset)} arranging={false} compact={layout.geometry.narrow} selected={false} style={{ ...publishedItemPixelRect(object, layout), zIndex: 10 + object.order }} onActivate={() => setOpenArtworkId(object.id)} onEdit={() => {}} />)}
    </section>
    {windowState.zOrder.map((id, index) => { const entry = windowState.windows[id]; const space = document.spaces.find((candidate) => candidate.id === id); if (!entry || !space) return null; return <section key={id} className="module-shell module-shell--expanded module-shell--collection module-shell--folder published-home-world__window" data-minimized={entry.minimized || undefined} style={{ ...entry.rect, zIndex: 60 + index }} role="dialog" aria-modal="false" aria-label={`Published space: ${space.label}`} onPointerDownCapture={() => transitionWindow({ type: 'focus', id })}>
      <PublishedProfileDocumentSpaceWindow space={space} minimized={entry.minimized} dragHandleProps={{ onPointerDown: (event) => beginWindowInteraction(event, id, 'move'), onPointerMove: moveWindowInteraction, onPointerUp: finishWindowInteraction, onPointerCancel: finishWindowInteraction, onLostPointerCapture: finishWindowInteraction }} onMinimize={() => transitionWindow({ type: 'minimize', id })} onClose={() => transitionWindow({ type: 'close', id })} />
      {!layout.geometry.narrow && !entry.minimized && <i className="module-window__resize" data-resize-control tabIndex="0" aria-label={`Resize ${space.label} window`} onPointerDown={(event) => beginWindowInteraction(event, id, 'resize')} onPointerMove={moveWindowInteraction} onPointerUp={finishWindowInteraction} onPointerCancel={finishWindowInteraction} onLostPointerCapture={finishWindowInteraction} />}
    </section>; })}
    {openArtwork && (() => { const asset = projectDocumentAsset(openArtwork.asset); return <section ref={artworkDialogRef} className="profile-document-preview__artwork" role="dialog" aria-modal="true" aria-label={`Artwork preview: ${asset.name}`}><header><strong>{asset.name}</strong><button type="button" onClick={() => setOpenArtworkId(null)} aria-label="Close artwork preview">×</button></header>{asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} /> : <p>Artwork unavailable</p>}</section>; })()}
  </main>;
}
