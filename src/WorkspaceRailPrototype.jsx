import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  FolderTree,
  Grid2X2,
  Layers3,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import './workspaceRailPrototype.css';

const PROFILE_ITEMS = [
  { id: 'categories', label: 'Categories', icon: FolderTree, meta: '03 PUBLIC' },
  { id: 'creations', label: 'Creations', icon: Sparkles, meta: 'AUTHORED' },
  { id: 'activity', label: 'Activity', icon: Activity, meta: 'ON-CHAIN' },
  { id: 'discover', label: 'Discover', icon: Compass, meta: 'WORLDS' },
];

const WORKSPACE_ITEMS = [
  { id: 'browser', label: 'Browser', icon: Archive },
  { id: 'arrange', label: 'Arrange', icon: Grid2X2 },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'publish', label: 'Publish', icon: Upload },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

const CATEGORY_ROWS = ['ART', 'MUSIC', 'KEEPERS'];
const ASSET_ROWS = ['ALL OWNED', 'UNFILED', 'RECENT'];
const TYPE_SYSTEMS = [
  { id: 'ibm', label: 'IBM PLEX' },
  { id: 'geist', label: 'GEIST MONO' },
  { id: 'space', label: 'SPACE MONO' },
];
const SURFACE_SYSTEMS = [
  { id: 'carbon', label: 'CARBON 02', spatialTheme: 'dark' },
  { id: 'graphite', label: 'GRAPHITE 02B', spatialTheme: 'dark' },
  { id: 'slate', label: 'SLATE 03', spatialTheme: 'dark' },
  { id: 'ash', label: 'ASH 04', spatialTheme: 'light' },
  { id: 'mist', label: 'MIST 05', spatialTheme: 'light' },
  { id: 'paper', label: 'PAPER', spatialTheme: 'light' },
];
const LATTICE_CANVASES = [
  { id: 'identity', label: 'IDENTITY', note: 'PROFILE DOSSIER', x: 0, y: -1 },
  { id: 'collections', label: 'COLLECTIONS', note: 'CURATED SETS', x: -1, y: 0 },
  { id: 'archive', label: 'ARCHIVE', note: 'PRIMARY TABLE', x: 0, y: 0 },
  { id: 'drops', label: 'DROPS', note: 'AVAILABLE WORKS', x: 1, y: 0 },
  { id: 'index', label: 'INDEX', note: 'PROFILE RECORDS', x: 0, y: 1 },
];
const LATTICE_COORDINATES = new Set(LATTICE_CANVASES.map(({ x, y }) => `${x}:${y}`));
const CURATED_LOCAL_ASSETS = [
  { id: '01', src: '/assets/ratio/1.webp', dimensions: '2000 × 2000', shape: 'square' },
  { id: '03', src: '/assets/ratio/3.webp', dimensions: '2000 × 2829', shape: 'poster' },
  { id: '07', src: '/assets/ratio/7.webp', dimensions: '2000 × 2000', shape: 'square' },
];
const PLACEMENT_ASSETS = [
  { id: 'local-01', src: '/assets/ratio/1.webp', file: '1.webp', ratio: 1 },
  { id: 'local-02', src: '/assets/ratio/2.webp', file: '2.webp', ratio: 1 },
  { id: 'local-03', src: '/assets/ratio/3.webp', file: '3.webp', ratio: 2000 / 2829 },
  { id: 'local-04', src: '/assets/ratio/4.webp', file: '4.webp', ratio: 2000 / 2829 },
  { id: 'local-05', src: '/assets/ratio/5.webp', file: '5.webp', ratio: 1 },
  { id: 'local-06', src: '/assets/ratio/6.webp', file: '6.webp', ratio: 2000 / 2829 },
  { id: 'local-07', src: '/assets/ratio/7.webp', file: '7.webp', ratio: 1 },
];

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function PlacedAssetCard({ asset, placement, selected, onPointerDown, onResizePointerDown }) {
  return <article
    className="workspace-rail-study__placed-asset"
    data-selected={selected || undefined}
    style={{
      left: `${placement.x}%`,
      top: `${placement.y}%`,
      width: `${placement.width}px`,
      height: `${(placement.width / asset.ratio) + 50}px`,
    }}
    onPointerDown={(event) => onPointerDown(event, placement)}
  >
    <header><span>INSCAPE / ASSET</span><b>{asset.file}</b></header>
    <div><img src={asset.src} alt={`Placed prototype artwork ${asset.file}`} draggable="false" /></div>
    <footer><span>LOCAL / {asset.id.slice(-2)}</span><span>CLICK / OPEN</span></footer>
    {selected && <button
      type="button"
      className="workspace-rail-study__placed-resize"
      aria-label={`Resize ${asset.file}`}
      onPointerDown={(event) => onResizePointerDown(event, placement)}
    />}
  </article>;
}

function PlacedAssetViewer({ asset, index, onClose, onNavigate, total }) {
  const [openPanel, setOpenPanel] = useState(null);
  const swipeRef = useRef(null);
  const suppressSideClickRef = useRef(false);
  const wheelCooldownRef = useRef(false);

  useEffect(() => {
    setOpenPanel(null);
  }, [asset.id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (openPanel) setOpenPanel(null);
        else onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onNavigate(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNavigate(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, openPanel]);

  const togglePanel = (panel) => {
    if (suppressSideClickRef.current) return;
    setOpenPanel((current) => current === panel ? null : panel);
  };

  const handleWheel = (event) => {
    if (openPanel || wheelCooldownRef.current) return;
    const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(movement) < 18) return;
    event.preventDefault();
    wheelCooldownRef.current = true;
    onNavigate(movement > 0 ? 1 : -1);
    window.setTimeout(() => { wheelCooldownRef.current = false; }, 320);
  };

  const beginSwipe = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    swipeRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      captureTarget: event.currentTarget,
      captured: false,
    };
  };

  const updateSwipe = (event) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.id !== event.pointerId || swipe.captured) return;
    const deltaX = event.clientX - swipe.x;
    const deltaY = event.clientY - swipe.y;
    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
    swipe.captureTarget?.setPointerCapture?.(event.pointerId);
    swipe.captured = true;
    suppressSideClickRef.current = true;
  };

  const finishSwipe = (event) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.id !== event.pointerId) return;
    swipeRef.current = null;
    if (swipe.captureTarget?.hasPointerCapture?.(event.pointerId)) {
      swipe.captureTarget.releasePointerCapture(event.pointerId);
    }
    const deltaX = event.clientX - swipe.x;
    const deltaY = event.clientY - swipe.y;
    if (swipe.captured && Math.abs(deltaX) >= 48 && Math.abs(deltaX) >= Math.abs(deltaY) * 1.25) {
      onNavigate(deltaX < 0 ? 1 : -1);
    }
    window.setTimeout(() => { suppressSideClickRef.current = false; }, 0);
  };

  return <section className="workspace-rail-study__placed-viewer" role="dialog" aria-modal="true" aria-label={`Preview ${asset.file}`}>
    <div className="workspace-rail-study__placed-composition" onWheel={handleWheel}>
      <aside className="workspace-rail-study__placed-dossier workspace-rail-study__placed-dossier--story" data-open={openPanel === 'story' || undefined} aria-hidden={openPanel !== 'story'}>
        <header><span>INSCAPE / ASSET NARRATIVE</span><b>{asset.file}</b></header>
        <div><small>DESCRIPTION</small><h2>NOT RESOLVED</h2><p>No NFT description is attached to this local prototype artwork.</p><section><small>TRAITS</small><p>NO TRAITS RESOLVED</p></section></div>
        <footer><span>INSCAPE PROTOCOL</span><span>LEFT SIDE / DESCRIPTION</span></footer>
      </aside>
      <article className="workspace-rail-study__placed-focus" style={{ '--placed-ratio': asset.ratio }}>
        <header><span>INSCAPE / LOCAL ARCHIVE</span><b>{asset.file}</b><button type="button" onClick={onClose} aria-label="Return artwork to table"><X size={15} /></button></header>
        <div className="workspace-rail-study__placed-focus-artwork" onPointerDown={beginSwipe} onPointerMove={updateSwipe} onPointerUp={finishSwipe} onPointerCancel={() => { swipeRef.current = null; suppressSideClickRef.current = false; }}>
          <button type="button" className="workspace-rail-study__placed-side workspace-rail-study__placed-side--left" aria-label="Toggle description and traits" aria-pressed={openPanel === 'story'} onClick={() => togglePanel('story')} />
          <button type="button" className="workspace-rail-study__placed-side workspace-rail-study__placed-side--right" aria-label="Toggle technical record" aria-pressed={openPanel === 'technical'} onClick={() => togglePanel('technical')} />
          <img src={asset.src} alt={`Focused prototype artwork ${asset.file}`} />
        </div>
        <footer>
          <button type="button" aria-label="Previous artwork" onClick={() => onNavigate(-1)}><ChevronLeft size={13} /></button>
          <span>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
          <button type="button" aria-label="Next artwork" onClick={() => onNavigate(1)}><ChevronRight size={13} /></button>
        </footer>
      </article>
      <aside className="workspace-rail-study__placed-dossier workspace-rail-study__placed-dossier--technical" data-open={openPanel === 'technical' || undefined} aria-hidden={openPanel !== 'technical'}>
        <header><span>INSCAPE / TECHNICAL RECORD</span><b>{asset.file}</b></header>
        <div><small>FILE RECORD</small><h2>{asset.file}</h2><p>Original artwork preserved at its native ratio. Token metadata has not been attached to this local prototype record.</p><dl><div><dt>ASPECT RATIO</dt><dd>{asset.ratio.toFixed(3)}</dd></div><div><dt>SOURCE</dt><dd>LOCAL ARTWORK</dd></div><div><dt>METADATA</dt><dd>NOT RESOLVED</dd></div><div><dt>NETWORK</dt><dd>NOT RESOLVED</dd></div></dl></div>
        <footer><span>INSCAPE PROTOCOL</span><span>RIGHT SIDE / RECORD</span></footer>
      </aside>
    </div>
  </section>;
}
const COMPOSITION_LAYERS = [
  { id: 'CHARACTER / 01', src: '/assets/characters/01/lineart.webp', position: 'left' },
  { id: 'SKULL REAPER', src: '/assets/actors/skull_reaper/lineart.webp', position: 'center' },
  { id: 'CHARACTER / 03', src: '/assets/characters/03/lineart.webp', position: 'right' },
];
function CuratedTableStudy() {
  return <section className="workspace-rail-study__curated-table" aria-label="Curated local artwork table">
    <header><span>CURATED LOCAL FILES</span><b>03 / NATIVE RATIO</b></header>
    <div className="workspace-rail-study__curated-field">
      {CURATED_LOCAL_ASSETS.map((asset) => <figure key={asset.id} data-shape={asset.shape}>
        <div><img src={asset.src} alt={`Local prototype artwork ${asset.id}`} /></div>
        <figcaption><span>IMAGE / {asset.id}</span><small>{asset.dimensions} · WEBP</small></figcaption>
      </figure>)}
    </div>
    <footer><span>LOCAL PROTOTYPE</span><span>NO TOKEN DATA ATTACHED</span></footer>
  </section>;
}

function CompositionTableStudy() {
  return <section className="workspace-rail-study__composition-table" aria-label="Transparent artwork composition table">
    <header><span>COMPOSITION FIELD</span><b>03 TRANSPARENT SOURCES</b></header>
    <div className="workspace-rail-study__composition-field" aria-hidden="true">
      <i className="workspace-rail-study__composition-orbit" />
      {COMPOSITION_LAYERS.map((layer) => <img
        key={layer.id}
        src={layer.src}
        alt=""
        data-position={layer.position}
      />)}
    </div>
    <footer>
      {COMPOSITION_LAYERS.map((layer, index) => <span key={layer.id}>{String(index + 1).padStart(2, '0')} / {layer.id}</span>)}
    </footer>
  </section>;
}

function RailButton({ item, active, collapsed, onClick }) {
  const Icon = item.icon;
  return <button
    type="button"
    className="workspace-rail-study__nav-button"
    data-active={active || undefined}
    aria-label={item.label}
    title={collapsed ? item.label : undefined}
    onClick={onClick}
  >
    <Icon size={15} strokeWidth={1.45} aria-hidden="true" />
    {!collapsed && <>
      <strong>{item.label}</strong>
      <small>{item.meta}</small>
      <ChevronRight size={13} strokeWidth={1.35} aria-hidden="true" />
    </>}
  </button>;
}

function ToolButton({ item, active, onClick }) {
  const Icon = item.icon;
  return <button
    type="button"
    className="workspace-rail-study__tool-button"
    data-active={active || undefined}
    aria-label={item.label}
    onClick={onClick}
  >
    <Icon size={15} strokeWidth={1.4} aria-hidden="true" />
    <span>{item.label}</span>
  </button>;
}

function ShareableProfileCard({ onClose }) {
  const [cardSurface, setCardSurface] = useState('paper');
  const cardSurfaceIndex = SURFACE_SYSTEMS.findIndex((surface) => surface.id === cardSurface);
  const cycleCardSurface = () => setCardSurface(SURFACE_SYSTEMS[(cardSurfaceIndex + 1) % SURFACE_SYSTEMS.length].id);

  return <section className="workspace-rail-study__share-preview" role="dialog" aria-modal="true" aria-label="Shareable profile card preview">
    <article className="workspace-rail-study__dossier-card" data-card-surface={cardSurface}>
      <button type="button" className="workspace-rail-study__share-close" aria-label="Close shareable preview" onClick={onClose}><X size={16} /></button>
      <header className="workspace-rail-study__dossier-header">
        <span>+ &nbsp; INSCAPE / UNIVERSAL PROFILES ARCHIVE</span>
        <b>[ IU-UP-A7812 ]</b>
        <button type="button" className="workspace-rail-study__dossier-theme" onClick={cycleCardSurface}>DOSSIER / {SURFACE_SYSTEMS[cardSurfaceIndex].label}</button>
      </header>

      <div className="workspace-rail-study__dossier-body">
        <section className="workspace-rail-study__dossier-emblem">
          <header><small>EMBLEM ID</small><strong>IU-UP-0000</strong></header>
          <div className="workspace-rail-study__dossier-portrait">
            <i>+</i><i>+</i>
            <img src="/assets/PFP/PFP.webp" alt="VXCTXR profile emblem" />
            <span>VERIFY VISUALLY</span>
          </div>
          <footer><span><small>STATUS</small>ACTIVE</span><span><small>CLEARANCE</small>LSP-8</span></footer>
        </section>

        <section className="workspace-rail-study__dossier-profile">
          <div className="workspace-rail-study__dossier-title">
            <small>UNIVERSAL PROFILE</small>
            <h2>RESIDENT ZERO</h2>
            <p>@vxctxr</p>
          </div>
          <div className="workspace-rail-study__dossier-class"><i /> UNIVERSAL PROFILE <span /></div>
          <p className="workspace-rail-study__dossier-bio">Faceless nomad. Builder of the Underneath.</p>
          <div className="workspace-rail-study__dossier-tags"><span>ART</span><span>1/1</span><span>LSP8</span><span>INSCAPE</span></div>
          <div className="workspace-rail-study__dossier-stats">
            <span><small>ASSETS</small><strong>72</strong></span>
            <span><small>COLLECTIONS</small><strong>4</strong></span>
            <span><small>NETWORK</small><strong>LUKSO MAINNET</strong></span>
          </div>
          <footer>
            <span><small>PROFILE URL</small>enterinscape.com/vxctxr</span>
            <span>SHARE ON X <Share2 size={16} strokeWidth={1.25} /></span>
          </footer>
        </section>
      </div>

      <footer className="workspace-rail-study__dossier-footer"><span>+ &nbsp; INSCAPE PROTOCOL</span><span>IDENTITY FILE</span><span>DATE ISSUED: 2026-07-26 &nbsp; VER: 1.0 &nbsp; +</span></footer>
    </article>
  </section>;
}

export default function WorkspaceRailPrototype() {
  const [owner, setOwner] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [activeProfile, setActiveProfile] = useState('categories');
  const [activeTool, setActiveTool] = useState(null);
  const [browserMode, setBrowserMode] = useState('index');
  const [surface, setSurface] = useState('carbon');
  const [menuSurface, setMenuSurface] = useState('carbon');
  const [typeSystem, setTypeSystem] = useState('ibm');
  const [keeperDocked, setKeeperDocked] = useState(true);
  const [activeCanvas, setActiveCanvas] = useState({ x: 0, y: 0 });
  const [latticeDrag, setLatticeDrag] = useState({ x: 0, y: 0 });
  const [latticeDragging, setLatticeDragging] = useState(false);
  const [placementAssetId, setPlacementAssetId] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [selectedPlacementId, setSelectedPlacementId] = useState(null);
  const [viewerPlacementId, setViewerPlacementId] = useState(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const latticePointerRef = useRef(null);
  const placementPointerRef = useRef(null);
  const wheelCooldownRef = useRef(false);
  const activeSurface = SURFACE_SYSTEMS.find((system) => system.id === surface) || SURFACE_SYSTEMS[0];
  const activeCanvasRecord = LATTICE_CANVASES.find(({ x, y }) => x === activeCanvas.x && y === activeCanvas.y) || LATTICE_CANVASES[2];
  const latticeOffset = {
    x: (-activeCanvas.x * viewport.width) + latticeDrag.x,
    y: (-activeCanvas.y * viewport.height) + latticeDrag.y,
  };

  useEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const moveToCanvas = (x, y) => {
    if (!LATTICE_COORDINATES.has(`${x}:${y}`)) return;
    setLatticeDrag({ x: 0, y: 0 });
    setActiveCanvas({ x, y });
  };

  const commitSelectedAssetPlacement = (canvasId, x, y) => {
    if (!placementAssetId) return;
    const asset = PLACEMENT_ASSETS.find(({ id }) => id === placementAssetId);
    if (!asset) return;
    const id = `placement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlacements((current) => [...current, {
      id,
      assetId: asset.id,
      canvasId,
      x: clamp(x, 8, 92),
      y: clamp(y, 12, 88),
      width: asset.ratio < .85 ? 142 : 180,
    }]);
    setSelectedPlacementId(id);
    setPlacementAssetId(null);
  };

  const placeSelectedAsset = (event, canvasId) => {
    if (!placementAssetId || event.target.closest('button, [data-placement-card]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    commitSelectedAssetPlacement(
      canvasId,
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  };

  const beginPlacementGesture = (event, placement, mode = 'move') => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    placementPointerRef.current = {
      id: event.pointerId,
      placementId: placement.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originX: placement.x,
      originY: placement.y,
      originWidth: placement.width,
      captureTarget: event.currentTarget,
      moved: false,
    };
    setSelectedPlacementId(placement.id);
  };

  const updatePlacementGesture = (event) => {
    const gesture = placementPointerRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (Math.hypot(deltaX, deltaY) > 3) gesture.moved = true;
    setPlacements((current) => current.map((placement) => {
      if (placement.id !== gesture.placementId) return placement;
      if (gesture.mode === 'resize') {
        return { ...placement, width: clamp(gesture.originWidth + deltaX, 96, 420) };
      }
      return {
        ...placement,
        x: clamp(gesture.originX + ((deltaX / viewport.width) * 100), 2, 98),
        y: clamp(gesture.originY + ((deltaY / viewport.height) * 100), 4, 96),
      };
    }));
  };

  const finishPlacementGesture = (event) => {
    const gesture = placementPointerRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (gesture.captureTarget?.hasPointerCapture?.(event.pointerId)) {
      gesture.captureTarget.releasePointerCapture(event.pointerId);
    }
    if (!gesture.moved && gesture.mode === 'move') {
      setViewerPlacementId(gesture.placementId);
    }
    placementPointerRef.current = null;
  };

  const finishLatticeGesture = (event) => {
    const pointer = latticePointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const elapsed = Math.max(16, performance.now() - pointer.startedAt);
    const rawX = event.clientX - pointer.startX;
    const rawY = event.clientY - pointer.startY;
    const speedX = rawX / elapsed;
    const speedY = rawY / elapsed;
    const distance = Math.hypot(rawX, rawY);
    let target = activeCanvasRecord;

    if (distance >= 54 || Math.hypot(speedX, speedY) >= .42) {
      const projectedX = activeCanvas.x - ((rawX / viewport.width) * 3.15) - (speedX * .42);
      const projectedY = activeCanvas.y - ((rawY / viewport.height) * 3.15) - (speedY * .42);
      target = LATTICE_CANVASES.reduce((nearest, candidate) => {
        const nearestDistance = Math.hypot(nearest.x - projectedX, nearest.y - projectedY);
        const candidateDistance = Math.hypot(candidate.x - projectedX, candidate.y - projectedY);
        return candidateDistance < nearestDistance ? candidate : nearest;
      }, activeCanvasRecord);
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    latticePointerRef.current = null;
    setLatticeDragging(false);
    setLatticeDrag({ x: 0, y: 0 });
    setActiveCanvas({ x: target.x, y: target.y });
  };

  const handleLatticePointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('button, a, input, [role="dialog"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    latticePointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
    };
    setLatticeDragging(true);
    setLatticeDrag({ x: 0, y: 0 });
  };

  const handleLatticePointerMove = (event) => {
    const pointer = latticePointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const rawX = event.clientX - pointer.startX;
    const rawY = event.clientY - pointer.startY;
    const minX = -(1 - activeCanvas.x) * viewport.width;
    const maxX = (activeCanvas.x + 1) * viewport.width;
    const minY = -(1 - activeCanvas.y) * viewport.height;
    const maxY = (activeCanvas.y + 1) * viewport.height;
    const resist = (value, min, max) => value < min ? min + ((value - min) * .16) : value > max ? max + ((value - max) * .16) : value;
    setLatticeDrag({ x: resist(rawX, minX, maxX), y: resist(rawY, minY, maxY) });
  };

  const handleLatticeKeyDown = (event) => {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    moveToCanvas(activeCanvas.x + direction[0], activeCanvas.y + direction[1]);
  };

  const handleLatticeWheel = (event) => {
    if (wheelCooldownRef.current || Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY)) < 22) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const direction = horizontal
      ? [Math.sign(event.deltaX), 0]
      : [0, Math.sign(event.deltaY)];
    const nextX = activeCanvas.x + direction[0];
    const nextY = activeCanvas.y + direction[1];
    if (!LATTICE_COORDINATES.has(`${nextX}:${nextY}`)) return;
    wheelCooldownRef.current = true;
    moveToCanvas(nextX, nextY);
    setTimeout(() => { wheelCooldownRef.current = false; }, 620);
  };

  const selectTool = (id) => {
    if (id === 'theme') {
      setSurface((current) => {
        const index = SURFACE_SYSTEMS.findIndex((system) => system.id === current);
        return SURFACE_SYSTEMS[(index + 1) % SURFACE_SYSTEMS.length].id;
      });
      return;
    }
    if (id === 'preview') {
      setActiveTool((current) => current === id ? null : id);
      return;
    }
    setActiveTool((current) => current === id ? null : id);
  };

  const openProfileShareable = () => {
    if (collapsed) {
      setCollapsed(false);
      return;
    }
    setActiveTool((current) => current === 'preview' ? null : 'preview');
  };

  return <main
    className="workspace-rail-study"
    data-spatial-theme={activeSurface.spatialTheme}
    data-surface={surface}
    data-owner={owner || undefined}
    data-type-system={typeSystem}
    data-menu-surface={menuSurface}
  >
    <section
      className="workspace-rail-study__lattice-viewport"
      data-dragging={latticeDragging || undefined}
      tabIndex={0}
      aria-label={`Canvas lattice. Active canvas: ${activeCanvasRecord.label}`}
      onPointerDown={handleLatticePointerDown}
      onPointerMove={handleLatticePointerMove}
      onPointerUp={finishLatticeGesture}
      onPointerCancel={finishLatticeGesture}
      onKeyDown={handleLatticeKeyDown}
      onWheel={handleLatticeWheel}
    >
      <div className="workspace-rail-study__lattice-fixed-grid" aria-hidden="true" />
      <div
        className="workspace-rail-study__lattice-stage"
        style={{ transform: `translate3d(${latticeOffset.x}px, ${latticeOffset.y}px, 0)` }}
      >
        {LATTICE_CANVASES.map((canvas, index) => <article
          key={canvas.id}
          className="workspace-rail-study__lattice-canvas"
          data-canvas={canvas.id}
          data-active={canvas.id === activeCanvasRecord.id || undefined}
          style={{ transform: `translate3d(${canvas.x * 100}vw, ${canvas.y * 100}vh, 0)` }}
          aria-hidden={canvas.id !== activeCanvasRecord.id}
          onClick={(event) => placeSelectedAsset(event, canvas.id)}
          onPointerMove={updatePlacementGesture}
          onPointerUp={finishPlacementGesture}
          onPointerCancel={finishPlacementGesture}
        >
          <header><span>{String(index + 1).padStart(2, '0')} / {canvas.label}</span><b>{canvas.note}</b></header>
          {canvas.id === 'collections' && <CuratedTableStudy />}
          {canvas.id === 'drops' && <CompositionTableStudy />}
          {!['collections', 'drops'].includes(canvas.id) && <div className="workspace-rail-study__canvas-template" aria-hidden="true">
            <span>{canvas.label}</span>
            <i />
            <i />
            <i />
          </div>}
          <div className="workspace-rail-study__placement-layer">
            {placements.filter(({ canvasId }) => canvasId === canvas.id).map((placement) => {
              const asset = PLACEMENT_ASSETS.find(({ id }) => id === placement.assetId);
              if (!asset) return null;
              return <div key={placement.id} data-placement-card>
                <PlacedAssetCard
                  asset={asset}
                  placement={placement}
                  selected={selectedPlacementId === placement.id}
                  onPointerDown={(event, target) => beginPlacementGesture(event, target)}
                  onResizePointerDown={(event, target) => beginPlacementGesture(event, target, 'resize')}
                />
              </div>;
            })}
          </div>
        </article>)}
      </div>
    </section>
    <div className="workspace-rail-study__coordinates" aria-hidden="true">
      <span>Y {activeCanvas.y}</span><span>X {activeCanvas.x}</span>
    </div>

    <aside className="workspace-rail-study__profile-anchor" data-collapsed={collapsed || undefined}>
      {!collapsed && <header className="workspace-rail-study__rail-index"><span>PROFILE / NAVIGATION</span><b>01</b></header>}
      <button
        type="button"
        className="workspace-rail-study__identity"
        aria-label={collapsed ? 'Expand profile navigation' : 'Open shareable profile card'}
        onClick={openProfileShareable}
      >
        <img src="/assets/PFP/PFP.webp" alt="VXCTXR" />
        {!collapsed && <span><strong>VXCTXR <small>#E3C1</small></strong><em>UNIVERSAL PROFILE</em></span>}
      </button>
      <nav className="workspace-rail-study__profile-nav" aria-label="Profile navigation">
        {PROFILE_ITEMS.map((item) => <RailButton
          key={item.id}
          item={item}
          active={activeProfile === item.id}
          collapsed={collapsed}
          onClick={() => setActiveProfile(item.id)}
        />)}
      </nav>
      <button
        type="button"
        className="workspace-rail-study__collapse"
        aria-label={collapsed ? 'Expand profile rail' : 'Collapse profile rail'}
        onClick={() => setCollapsed((value) => !value)}
      >
        {collapsed ? <PanelLeftOpen size={14} /> : <><PanelLeftClose size={14} /><span>COLLAPSE</span></>}
      </button>
      {!collapsed && <footer className="workspace-rail-study__rail-footer"><span>INSCAPE</span><span>ACTIVE PROFILE</span></footer>}
    </aside>

    {owner && <nav className="workspace-rail-study__toolbar" aria-label="Workspace tools">
      <span className="workspace-rail-study__toolbar-label">OWNER / WORKSPACE</span>
      {WORKSPACE_ITEMS.map((item) => <ToolButton
        key={item.id}
        item={item}
        active={activeTool === item.id || (item.id === 'theme' && surface === 'paper')}
        onClick={() => selectTool(item.id)}
      />)}
    </nav>}

    {activeTool === 'browser' && owner && <section className="workspace-rail-study__browser" aria-label="Workspace browser">
      <header>
        <div><Archive size={15} /><strong>BROWSER</strong><small>OWNER TOOL / 01</small></div>
        <button type="button" aria-label="Close browser" onClick={() => setActiveTool(null)}><X size={15} /></button>
      </header>
      <div className="workspace-rail-study__browser-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={browserMode === 'index'} onClick={() => setBrowserMode('index')}><Layers3 size={14} /> INDEX</button>
        <button type="button" role="tab" aria-selected={browserMode === 'categories'} onClick={() => setBrowserMode('categories')}><FolderTree size={14} /> CATEGORIES</button>
      </div>
      <label className="workspace-rail-study__search">
        <span>SEARCH ASSET POOL</span>
        <input aria-label="Search asset pool" />
      </label>
      <div className="workspace-rail-study__browser-content">
        <aside>
          <small>{browserMode === 'index' ? 'ASSET VIEWS' : 'PUBLIC STRUCTURE'}</small>
          {(browserMode === 'index' ? ASSET_ROWS : CATEGORY_ROWS).map((row, index) => <button type="button" key={row} data-active={!index || undefined}>{row}<span>{index ? '—' : '12'}</span></button>)}
          {browserMode === 'categories' && <button type="button" className="workspace-rail-study__create">+ CREATE CATEGORY</button>}
        </aside>
        <div className="workspace-rail-study__asset-field">
          <header><strong>{browserMode === 'index' ? 'ALL OWNED' : 'ART'}</strong><small>12 RESULTS</small></header>
          <div>{PLACEMENT_ASSETS.map((asset) => <button
            type="button"
            key={asset.id}
            data-selected={placementAssetId === asset.id || undefined}
            aria-label={`Place ${asset.file} on ${activeCanvasRecord.label}`}
            onClick={() => {
              setPlacementAssetId((current) => current === asset.id ? null : asset.id);
              setActiveTool(null);
            }}
          ><i><img src={asset.src} alt="" /></i><span>{asset.file}</span></button>)}</div>
        </div>
      </div>
      <footer className="workspace-rail-study__browser-footer"><span>LOCAL DRAFT</span><span>SELECT ASSET / CLICK ACTIVE TABLE</span><span>INSCAPE SYSTEM</span></footer>
    </section>}

    {activeTool === 'more' && owner && <section className="workspace-rail-study__more">
      <button type="button"><Settings size={14} /> SETTINGS</button>
      <button type="button"><SlidersHorizontal size={14} /> INTERFACE</button>
    </section>}

    {activeTool === 'preview' && <ShareableProfileCard onClose={() => setActiveTool(null)} />}
    {placementAssetId && <button
      type="button"
      className="workspace-rail-study__placement-cursor"
      onClick={() => commitSelectedAssetPlacement(activeCanvasRecord.id, 50, 50)}
    >PLACE / {PLACEMENT_ASSETS.find(({ id }) => id === placementAssetId)?.file} / {activeCanvasRecord.label}</button>}
    {viewerPlacementId && (() => {
      const tablePlacements = placements.filter(({ canvasId }) => canvasId === activeCanvasRecord.id);
      const index = tablePlacements.findIndex(({ id }) => id === viewerPlacementId);
      const placement = tablePlacements[index];
      const asset = placement && PLACEMENT_ASSETS.find(({ id }) => id === placement.assetId);
      const navigate = (direction) => {
        if (tablePlacements.length < 2) return;
        const nextIndex = (index + direction + tablePlacements.length) % tablePlacements.length;
        setViewerPlacementId(tablePlacements[nextIndex].id);
      };
      return asset ? <PlacedAssetViewer
        asset={asset}
        index={index}
        total={tablePlacements.length}
        onNavigate={navigate}
        onClose={() => setViewerPlacementId(null)}
      /> : null;
    })()}

    <nav className="workspace-rail-study__lattice-map" aria-label="Canvas position">
      {LATTICE_CANVASES.map((canvas) => <button
        key={canvas.id}
        type="button"
        data-active={canvas.id === activeCanvasRecord.id || undefined}
        style={{ '--map-x': canvas.x, '--map-y': canvas.y }}
        aria-label={`Open ${canvas.label} canvas`}
        aria-current={canvas.id === activeCanvasRecord.id ? 'page' : undefined}
        onClick={() => moveToCanvas(canvas.x, canvas.y)}
      />)}
      <span>{activeCanvasRecord.label}</span>
    </nav>

    <div className="workspace-rail-study__brand-signature" aria-label="INSCAPE">
      <b>INSCAPE</b>
      <span>SPATIAL PROFILE SYSTEM / ACTIVE</span>
    </div>

    <div
      className="workspace-rail-study__keeper-resident"
      data-contained={keeperDocked || undefined}
      aria-hidden="true"
    >
      <img src="/assets/actors/abyssal_eye/full.webp" alt="" />
    </div>

    <button
      type="button"
      className="workspace-rail-study__keeper-containment"
      aria-label={keeperDocked ? 'Release Keeper' : 'Call Keeper to corner'}
      aria-pressed={keeperDocked}
      onClick={() => setKeeperDocked((value) => !value)}
    >
      <span aria-hidden="true" />
    </button>

    {!placementAssetId && <section className="workspace-rail-study__preview-controls" aria-label="Prototype controls">
      <button type="button" aria-pressed={owner} onClick={() => { setOwner((value) => !value); setActiveTool(null); }}>{owner ? 'OWNER' : 'VISITOR'}</button>
      <button type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />} RAIL</button>
      <button type="button" onClick={() => setSurface((current) => {
        const index = SURFACE_SYSTEMS.findIndex((system) => system.id === current);
        return SURFACE_SYSTEMS[(index + 1) % SURFACE_SYSTEMS.length].id;
      })}>SURFACE / {activeSurface.label}</button>
      <button type="button" onClick={() => setMenuSurface((current) => {
        const index = SURFACE_SYSTEMS.findIndex((system) => system.id === current);
        return SURFACE_SYSTEMS[(index + 1) % SURFACE_SYSTEMS.length].id;
      })}>MENUS / {SURFACE_SYSTEMS.find((system) => system.id === menuSurface)?.label}</button>
      <button type="button" onClick={() => setTypeSystem((current) => {
        const index = TYPE_SYSTEMS.findIndex((system) => system.id === current);
        return TYPE_SYSTEMS[(index + 1) % TYPE_SYSTEMS.length].id;
      })}>LABEL / {TYPE_SYSTEMS.find((system) => system.id === typeSystem)?.label}</button>
    </section>}
  </main>;
}
