import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Compass, Copy, Crop, Eye, FlipHorizontal2, FlipVertical2, Folder, Frame, Grid3X3, History, Library, MoreHorizontal, Plus, RotateCw, Search, Settings2, Trash2, Upload, UserCheck, UserRound, UsersRound, X } from 'lucide-react';
import {
  createLatticeProductionCropPanGesture,
  createLatticeProductionCropSession,
  setLatticeProductionCropZoom,
  updateLatticeProductionCropPanGesture,
} from '../../lattice/authoring/latticeProductionCrop.js';
import { LATTICE_PRODUCTION_SURFACE_IDS } from '../../lattice/domain/latticeProductionDraft.js';
import Modul8rLibraryAdapter from '../../lattice/modul8r/Modul8rLibraryAdapter.jsx';
import useBrowserWorkspace from '../../lattice/browser/useBrowserWorkspace.js';
import { BROWSER_SORTS } from '../../lattice/browser/browserWorkspaceModel.js';
import { projectCroppedMediaRectangle } from '../../lattice/rendering/latticeCrop.js';
import LatticeFocusViewer from '../../lattice/rendering/LatticeFocusViewer.jsx';
import '../../lattice/rendering/latticeMenuSurface.css';
import OwnerShellSystemIdentityDossier from './OwnerShellSystemIdentityDossier.jsx';
import './ownerShellSystemPrototype.css';

const ASSETS = Object.freeze([
  { stableAssetId: '42:0x1111111111111111111111111111111111111111:contract', title: 'Abyssal Study', collection: 'INSCAPE Studies', owned: true, created: true, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/actors/abyssal_eye/full.webp', previewSrc: '/assets/actors/abyssal_eye/full.webp', previewCandidates: ['/assets/actors/abyssal_eye/full.webp'] },
  { stableAssetId: '42:0x2222222222222222222222222222222222222222:contract', title: 'Skull Reaper', collection: 'INSCAPE Studies', owned: true, created: true, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/actors/skull_reaper/full.webp', previewSrc: '/assets/actors/skull_reaper/full.webp', previewCandidates: ['/assets/actors/skull_reaper/full.webp'] },
  { stableAssetId: '42:0x3333333333333333333333333333333333333333:contract', title: 'Mountain Signal I', collection: 'Field Signals', owned: true, created: false, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/stage/mountains/mountain_01.webp', previewSrc: '/assets/stage/mountains/mountain_01.webp', previewCandidates: ['/assets/stage/mountains/mountain_01.webp'] },
  { stableAssetId: '42:0x4444444444444444444444444444444444444444:contract', title: 'Mountain Signal II', collection: 'Field Signals', owned: true, created: false, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/stage/mountains/mountain_02.webp', previewSrc: '/assets/stage/mountains/mountain_02.webp', previewCandidates: ['/assets/stage/mountains/mountain_02.webp'] },
  { stableAssetId: '42:0x5555555555555555555555555555555555555555:contract', title: 'Digital Membrane', collection: 'Surface Archive', owned: false, created: true, mediaType: 'image', placeable: true, width: 2000, height: 2000, src: '/assets/stage/patterns/digitalblob_top.webp', previewSrc: '/assets/stage/patterns/digitalblob_top.webp', previewCandidates: ['/assets/stage/patterns/digitalblob_top.webp'] },
  { stableAssetId: '42:0x6666666666666666666666666666666666666666:contract', title: 'Zebra Field', collection: 'Surface Archive', owned: true, created: false, mediaType: 'image', placeable: true, width: 1024, height: 1024, src: '/assets/stage/patterns/zebra_top.webp', previewSrc: '/assets/stage/patterns/zebra_top.webp', previewCandidates: ['/assets/stage/patterns/zebra_top.webp'] },
  { stableAssetId: '42:0x7777777777777777777777777777777777777777:contract', title: 'Moon Purple', collection: 'Chromatic Fields', owned: true, created: true, mediaType: 'image', placeable: true, width: 4636, height: 2000, src: '/assets/stage/backdrops/backdrop_moonpurple.webp', previewSrc: '/assets/stage/backdrops/backdrop_moonpurple.webp', previewCandidates: ['/assets/stage/backdrops/backdrop_moonpurple.webp'] },
]);

const INITIAL_CATEGORIES = Object.freeze([
  { id: 'portfolio', name: 'PORTFOLIO', public: true, assetIds: [ASSETS[0].stableAssetId, ASSETS[1].stableAssetId, ASSETS[6].stableAssetId] },
  { id: 'field-notes', name: 'FIELD NOTES', public: false, assetIds: [ASSETS[2].stableAssetId, ASSETS[3].stableAssetId] },
]);

const INITIAL_TABLES = Object.freeze([
  { id: 'home', name: 'HOME', public: true },
]);

const INITIAL_PLACEMENTS = Object.freeze([
  { id: 'placement-1', assetId: ASSETS[0].stableAssetId, crop: null, left: 690, tableId: 'home', top: 176, width: 190, height: 190 },
  { id: 'placement-2', assetId: ASSETS[3].stableAssetId, crop: { x: 0.5, y: 0.5, zoom: 1 }, left: 920, tableId: 'home', top: 420, width: 240, height: 135 },
]);

const GRID_CELL = 40;

const placementRectangleFromPointer = (asset, bounds, clientX, clientY) => {
  if (!asset || !bounds || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return null;
  const width = asset.width > asset.height ? 240 : 180;
  const height = Math.round(width * asset.height / asset.width);
  const left = Math.round((clientX - bounds.left - width / 2) / GRID_CELL) * GRID_CELL;
  const top = Math.round((clientY - bounds.top - height / 2) / GRID_CELL) * GRID_CELL;
  return {
    height,
    left: Math.max(0, Math.min(bounds.width - width, left)),
    top: Math.max(0, Math.min(bounds.height - height, top)),
    width,
  };
};

const cropForPlacementFrame = (crop, asset, width, height) => {
  if (crop || !asset) return crop;
  return width * asset.height === height * asset.width
    ? null
    : { x: 0.5, y: 0.5, zoom: 1 };
};

const clampUnit = (value) => Math.min(1, Math.max(0, value));
const smoothStep = (value) => {
  const progress = clampUnit(value);
  return progress * progress * (3 - (2 * progress));
};
const interpolateCrop = (start, end, progress) => ({
  x: start.x + ((end.x - start.x) * progress),
  y: start.y + ((end.y - start.y) * progress),
  zoom: start.zoom + ((end.zoom - start.zoom) * progress),
});

function OwnerShellFocusArtwork({ entry, phase }) {
  const rootRef = useRef(null);
  const imageRef = useRef(null);

  useLayoutEffect(() => {
    const image = imageRef.current;
    const parent = rootRef.current?.parentElement;
    if (!image || !parent) return undefined;
    const authoredCrop = entry.placement.crop || { x: 0.5, y: 0.5, zoom: 1 };
    const nativeCrop = { x: 0.5, y: 0.5, zoom: 1 };
    const startedAt = performance.now();
    let frame = null;

    const renderFrame = (time = startedAt) => {
      const parentRectangle = parent.getBoundingClientRect();
      const scaleX = parentRectangle.width / parent.offsetWidth;
      const scaleY = parentRectangle.height / parent.offsetHeight;
      if (!(scaleX > 0 && scaleY > 0)) return;
      const elapsed = clampUnit((time - startedAt) / 420);
      const cropProgress = phase === 'opening'
        ? smoothStep((elapsed - 0.35) / 0.65)
        : phase === 'closing' ? smoothStep(elapsed / 0.45)
          : phase === 'open' || phase === 'outgoing' ? 1 : 0;
      const crop = phase === 'closing'
        ? interpolateCrop(nativeCrop, authoredCrop, cropProgress)
        : interpolateCrop(authoredCrop, nativeCrop, cropProgress);
      const rectangle = projectCroppedMediaRectangle(
        { left: 0, top: 0, width: parentRectangle.width, height: parentRectangle.height },
        entry.focusDimensions,
        crop,
      );
      Object.assign(image.style, {
        height: `${rectangle.height / scaleY}px`,
        left: `${rectangle.left / scaleX}px`,
        top: `${rectangle.top / scaleY}px`,
        width: `${rectangle.width / scaleX}px`,
      });
      if ((phase === 'opening' || phase === 'closing') && elapsed < 1) {
        frame = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => cancelAnimationFrame(frame);
  }, [entry.focusDimensions, entry.placement.crop, phase]);

  return <div className="owner-shell-system__focus-artwork" ref={rootRef}>
    <img alt={entry.media.accessibleLabel} draggable="false" ref={imageRef} src={entry.media.src} />
  </div>;
}

const PEOPLE = Object.freeze([
  { id: 'signal-archive', name: 'SIGNAL ARCHIVE', role: 'CURATOR', following: true, follower: false, groups: ['references'], asset: ASSETS[2] },
  { id: 'surface-unit', name: 'SURFACE UNIT', role: 'ARTIST', following: false, follower: true, groups: ['collaborators'], asset: ASSETS[4] },
  { id: 'chromatic-office', name: 'CHROMATIC OFFICE', role: 'PUBLISHER', following: true, follower: true, groups: ['references', 'collaborators'], asset: ASSETS[6] },
]);

const DISCOVER_GROUPS = Object.freeze([
  { id: 'references', name: 'REFERENCES' },
  { id: 'collaborators', name: 'COLLABORATORS' },
]);

const ACTIVITY = Object.freeze([
  { id: 'activity-1', type: 'ASSETS', date: 'TODAY', time: 'NOW', label: 'ASSET RECEIVED', detail: 'ABYSSAL STUDY · FROM 0x8A…92F1', unread: true },
  { id: 'activity-2', type: 'SOCIAL', date: 'TODAY', time: '12M', label: 'NEW FOLLOWER', detail: 'SIGNAL ARCHIVE', unread: true },
  { id: 'activity-3', type: 'LYX', date: 'TODAY', time: '2H', label: 'LYX RECEIVED', detail: '4.25 LYX · FROM 0x17…A340', unread: false },
  { id: 'activity-4', type: 'ASSETS', date: 'YESTERDAY', time: '1D', label: 'ASSET SENT', detail: 'MOUNTAIN SIGNAL I · TO 0x73…B112', unread: false },
  { id: 'activity-5', type: 'SOCIAL', date: '11 AUG', time: '2D', label: 'PROFILE FOLLOWED', detail: 'CHROMATIC OFFICE', unread: false },
  { id: 'activity-6', type: 'ASSETS', date: '09 AUG', time: '4D', label: 'ASSET PUBLISHED', detail: 'MOON PURPLE · HOME TABLE', unread: false },
  { id: 'activity-7', type: 'LYX', date: '06 AUG', time: '7D', label: 'LYX SENT', detail: '1.00 LYX · TO 0x91…44C2', unread: false },
  { id: 'activity-8', type: 'SOCIAL', date: '02 AUG', time: '11D', label: 'PROFILE UNFOLLOWED', detail: 'SURFACE UNIT', unread: false },
]);

const SIGNAL_OPTIONS = Object.freeze([
  ['notifications', 'KEEPER NOTIFICATIONS'],
  ['speech', 'SPEECH'],
  ['visualEffects', 'VISUAL SIGNAL EFFECTS'],
  ['audio', 'AUDIO NOTIFICATIONS'],
]);

const VISITOR_OPTIONS = Object.freeze([
  ['showCategories', 'SHOW CATEGORIES'],
  ['showCreations', 'SHOW CREATIONS'],
]);

const IDENTITY_DOSSIER_FIXTURE = Object.freeze({
  key: '0x1111111111111111111111111111111111111111',
  address: '0x1111111111111111111111111111111111111111',
  profile: Object.freeze({
    displayName: 'RADAR VISUALS',
    nameProvenance: 'LSP3_NAME',
    avatarUrl: null,
    avatarProvenance: 'UNRESOLVED',
    avatarShape: 'round',
    profileImageTokenReference: null,
    backgroundUrl: null,
    backgroundProvenance: null,
    description: 'Identity RÄCK workflow fixture for the owner-shell study. Production profile metadata remains the source of truth in the real application.',
    descriptionProvenance: 'LSP3_DESCRIPTION',
    tags: Object.freeze(['ARTIST', 'CURATOR']),
    metadataIntegrity: 'VERIFIED',
  }),
  links: Object.freeze([
    Object.freeze({ id: 'inscape', label: 'INSCAPE PROFILE', url: 'https://enterinscape.netlify.app/', kind: 'SYSTEM' }),
  ]),
  technical: Object.freeze([
    Object.freeze({ id: 'address', label: 'UNIVERSAL PROFILE ADDRESS', value: '0x1111111111111111111111111111111111111111', provenance: 'CANONICAL_ADDRESS' }),
    Object.freeze({ id: 'metadata-integrity', label: 'LSP3 METADATA INTEGRITY', value: 'WORKFLOW FIXTURE', provenance: 'RESOLUTION_STATUS' }),
    Object.freeze({ id: 'network', label: 'NETWORK', value: 'LUKSO / CHAIN 42', provenance: 'DIRECT_RPC' }),
    Object.freeze({ id: 'type', label: 'PROFILE TYPE', value: 'LSP0 UNIVERSAL PROFILE', provenance: 'DIRECT_RPC' }),
  ]),
  status: Object.freeze({ metadata: 'RESOLVED' }),
});

const PANEL_EXIT_MS = 140;
const DISCOVER_EXIT_MS = 200;
const SIDEBAR_COLLAPSED_WIDTH = 48;
const SIDEBAR_EXPANDED_WIDTH = 174;
const SIDEBAR_MAX_WIDTH = 300;

function usePrototypePresence(open, exitMs = PANEL_EXIT_MS, entranceFrames = 1) {
  const [present, setPresent] = useState(open);
  const [phase, setPhase] = useState(open ? 'open' : 'closed');

  useEffect(() => {
    let frame;
    let settleFrame;
    let timer;
    if (open) {
      setPresent(true);
      setPhase('entering');
      frame = requestAnimationFrame(() => {
        if (entranceFrames > 1) settleFrame = requestAnimationFrame(() => setPhase('open'));
        else setPhase('open');
      });
    } else if (present) {
      setPhase('closing');
      const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      timer = setTimeout(() => setPresent(false), reducedMotion ? 0 : exitMs);
    } else {
      setPhase('closed');
    }
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
      clearTimeout(timer);
    };
  }, [entranceFrames, exitMs, open, present]);

  return { phase, present };
}

function usePrototypeSidebarGeometry(initialWidth = SIDEBAR_EXPANDED_WIDTH) {
  const [width, setWidth] = useState(initialWidth);
  const gestureRef = useRef(null);
  const clamp = (value) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_COLLAPSED_WIDTH, value));
  const resize = {
    begin(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      gestureRef.current = { pointerId: event.pointerId, startWidth: width, startX: event.clientX };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    update(event) {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      setWidth(clamp(gesture.startWidth + event.clientX - gesture.startX));
    },
    finish(event) {
      if (gestureRef.current?.pointerId !== event.pointerId) return;
      gestureRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
  };
  return { collapsed: width === SIDEBAR_COLLAPSED_WIDTH, resize, setWidth: (value) => setWidth(clamp(value)), width };
}

const LIBRARY_SORT_OPTIONS = Object.freeze([
  { label: 'TITLE / A–Z', value: BROWSER_SORTS.TITLE_ASC },
  { label: 'TITLE / Z–A', value: BROWSER_SORTS.TITLE_DESC },
  { label: 'COLLECTION', value: BROWSER_SORTS.COLLECTION },
]);

const DISCOVER_ROLE_OPTIONS = Object.freeze([
  { label: 'ALL ROLES', value: 'ALL' },
  { label: 'ARTIST', value: 'ARTIST' },
  { label: 'CURATOR', value: 'CURATOR' },
  { label: 'PUBLISHER', value: 'PUBLISHER' },
]);

const DISCOVER_SORT_OPTIONS = Object.freeze([
  { label: 'NAME / A–Z', value: 'name-asc' },
  { label: 'NAME / Z–A', value: 'name-desc' },
  { label: 'ROLE', value: 'role' },
]);

function PrototypeSelectMenu({ className = '', label, menuSurface, onChange, options, triggerLabel, value }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const updatePosition = () => {
    const rectangle = triggerRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    const width = Math.min(252, globalThis.innerWidth - 24);
    setPosition({
      bottom: globalThis.innerHeight - rectangle.top + 6,
      left: Math.max(12, Math.min(rectangle.right - width, globalThis.innerWidth - width - 12)),
      width,
    });
  };
  const show = (index = selectedIndex) => {
    setActiveIndex(index);
    updatePosition();
    setOpen(true);
  };
  const select = (option) => {
    onChange(option.value);
    close(true);
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    optionRefs.current[activeIndex]?.focus();
    return undefined;
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const reposition = () => updatePosition();
    globalThis.addEventListener('pointerdown', dismiss, true);
    globalThis.addEventListener('resize', reposition);
    globalThis.addEventListener('scroll', reposition, true);
    return () => {
      globalThis.removeEventListener('pointerdown', dismiss, true);
      globalThis.removeEventListener('resize', reposition);
      globalThis.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const moveActive = (offset) => setActiveIndex((current) => (current + offset + options.length) % options.length);
  const handleMenuKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
  };

  return <>
    <button aria-expanded={open} aria-haspopup="listbox" className={`owner-shell-system__rail-select ${className}`.trim()} onClick={() => open ? close(false) : show()} onKeyDown={(event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      show(event.key === 'ArrowDown' ? selectedIndex : (selectedIndex - 1 + options.length) % options.length);
    }} ref={triggerRef} type="button">
      <span>{triggerLabel || label}</span><ChevronUp aria-hidden="true" size={12} />
    </button>
    {open && position && createPortal(<div className="owner-shell-system__select-popover" data-lattice-menu-surface data-menu-surface={menuSurface}
      onKeyDown={handleMenuKeyDown} ref={menuRef} role="listbox" style={position}>
      <header>{label}</header>
      {options.map((option, index) => <button aria-selected={option.value === value} key={option.value}
        onClick={() => select(option)} onFocus={() => setActiveIndex(index)} ref={(node) => { optionRefs.current[index] = node; }} role="option" tabIndex={index === activeIndex ? 0 : -1} type="button">
        <Check aria-hidden="true" size={13} /><span>{option.label}</span>
      </button>)}
    </div>, document.body)}
  </>;
}

function PrototypeSearch({ onChange, placeholder = '', value }) {
  return <label className="owner-shell-system__workspace-search">
    <Search aria-hidden="true" size={13} /><span>SEARCH</span>
    <input aria-label="Search" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" value={value} />
  </label>;
}

function OwnerShellWorkspaceRail({ clearFilters, hasActiveFilters, labelsVisible, menuSurface, onLabelsVisibleChange,
  onQueryChange, onSizeChange, primaryMenu, query, secondaryMenu, size, sizeBounds }) {
  return <div className="owner-shell-system__workspace-rail-controls">
    <PrototypeSearch onChange={onQueryChange} value={query} />
    <label className="owner-shell-system__workspace-size">
      <span>SIZE</span><input aria-label="Card size" max={sizeBounds.maximum} min={sizeBounds.minimum}
        onChange={(event) => onSizeChange(Number(event.target.value))} type="range" value={size} />
      <output>{size}</output>
    </label>
    <PrototypeSelectMenu menuSurface={menuSurface} {...primaryMenu} />
    <PrototypeSelectMenu menuSurface={menuSurface} {...secondaryMenu} />
    <label className="owner-shell-system__workspace-labels"><input checked={labelsVisible}
      onChange={(event) => onLabelsVisibleChange(event.target.checked)} type="checkbox" /><span>LABELS</span></label>
    {hasActiveFilters && <button aria-label="Clear filters" className="owner-shell-system__workspace-clear" onClick={clearFilters} title="Clear filters" type="button"><X size={13} /></button>}
  </div>;
}

function OwnerShellLibraryRail({ menuSurface, workspace }) {
  const collectionOptions = useMemo(() => [
    { label: 'ALL', value: 'all' },
    ...workspace.collections.map((collection) => ({ label: collection, value: collection })),
  ], [workspace.collections]);
  return <OwnerShellWorkspaceRail clearFilters={workspace.clearFilters} hasActiveFilters={workspace.hasActiveFilters}
    labelsVisible={!workspace.hideLabels} menuSurface={menuSurface} onLabelsVisibleChange={(visible) => workspace.setHideLabels(!visible)}
    onQueryChange={workspace.setQuery} onSizeChange={workspace.setAssetSize}
    primaryMenu={{ label: 'COLLECTIONS', onChange: workspace.setCollection, options: collectionOptions, value: workspace.collection }}
    query={workspace.query} secondaryMenu={{ label: 'SORT', onChange: workspace.setSort, options: LIBRARY_SORT_OPTIONS, value: workspace.sort }}
    size={workspace.assetSize} sizeBounds={{ maximum: workspace.assetSizeBounds.MAXIMUM, minimum: workspace.assetSizeBounds.MINIMUM }} />;
}

export default function OwnerShellSystemPrototype() {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverFilter, setDiscoverFilter] = useState('ALL');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverSort, setDiscoverSort] = useState('name-asc');
  const [discoverCardSize, setDiscoverCardSize] = useState(220);
  const [discoverLabelsVisible, setDiscoverLabelsVisible] = useState(true);
  const [discoverSection, setDiscoverSection] = useState('all');
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityTab, setActivityTab] = useState('ALL');
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const [activityHistoryFilter, setActivityHistoryFilter] = useState('ALL');
  const [activityHistoryQuery, setActivityHistoryQuery] = useState('');
  const [activityReadIds, setActivityReadIds] = useState([]);
  const [tableMapOpen, setTableMapOpen] = useState(false);
  const [gridSurface, setGridSurface] = useState('mist');
  const [menuSurface, setMenuSurface] = useState('mist');
  const [signalSettings, setSignalSettings] = useState({ audio: false, notifications: true, speech: true, visualEffects: true });
  const [visitorPresentation, setVisitorPresentation] = useState({ showCategories: true, showCreations: true });
  const [categories, setCategories] = useState(() => INITIAL_CATEGORIES.map((category) => ({ ...category, assetIds: [...category.assetIds] })));
  const [tables, setTables] = useState(() => INITIAL_TABLES.map((table) => ({ ...table })));
  const [activeTableId, setActiveTableId] = useState('home');
  const [tableActionId, setTableActionId] = useState(null);
  const [tableRename, setTableRename] = useState(null);
  const [tableDeleteId, setTableDeleteId] = useState(null);
  const [placements, setPlacements] = useState(() => INITIAL_PLACEMENTS.map((placement) => ({ ...placement })));
  const [selectedPlacementId, setSelectedPlacementId] = useState(null);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState([]);
  const [cropSession, setCropSession] = useState(null);
  const [presentationSession, setPresentationSession] = useState(null);
  const [removeCandidateId, setRemoveCandidateId] = useState(null);
  const [viewerPlacementId, setViewerPlacementId] = useState(null);
  const [viewerOriginRectangle, setViewerOriginRectangle] = useState(null);
  const [identityDossierSession, setIdentityDossierSession] = useState(null);
  const [drag, setDrag] = useState(null);
  const [notice, setNotice] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [viewport, setViewport] = useState(() => ({ height: globalThis.innerHeight || 1000, width: globalThis.innerWidth || 1440 }));
  const [dockAnchors, setDockAnchors] = useState({ activity: 182 });
  const libraryPresence = usePrototypePresence(libraryOpen);
  const activityPresence = usePrototypePresence(activityOpen);
  const activityHistoryPresence = usePrototypePresence(activityHistoryOpen);
  const discoverPresence = usePrototypePresence(discoverOpen, DISCOVER_EXIT_MS, 2);
  const profilePresence = usePrototypePresence(profileOpen);
  const settingsPresence = usePrototypePresence(settingsOpen);
  const tablePresence = usePrototypePresence(tableMapOpen);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const cropDragRef = useRef(null);
  const placementGestureRef = useRef(null);
  const placementClickSuppressedRef = useRef(false);
  const marqueeRef = useRef(null);
  const placementRefs = useRef(new Map());
  const dockTriggerRefs = useRef(new Map());
  const profileIdentityRef = useRef(null);
  const profilePanelRef = useRef(null);
  const tableRowRefs = useRef(new Map());
  const tableActionRefs = useRef(new Map());
  const data = useMemo(() => ({
    assetError: null, assetLoadState: 'ready', assetProgress: { failures: 0, resolved: ASSETS.length, total: ASSETS.length },
    assets: ASSETS, categories, createdStatus: 'ready', ownerContext: '0xprototype', usedAssetIds: placements.map(({ assetId }) => assetId),
  }), [categories, placements]);
  const workspace = useBrowserWorkspace(data);
  const librarySidebar = usePrototypeSidebarGeometry(workspace.sidebarWidth);
  const discoverSidebar = usePrototypeSidebarGeometry();
  const prototypeWorkspace = { ...workspace, sidebarResize: librarySidebar.resize, sidebarWidth: librarySidebar.width };

  const visibleDiscoverPeople = useMemo(() => PEOPLE.filter((person) => {
    if (discoverSection === 'following' && !person.following) return false;
    if (discoverSection === 'followers' && !person.follower) return false;
    if (!['all', 'following', 'followers'].includes(discoverSection) && !person.groups.includes(discoverSection)) return false;
    return (discoverFilter === 'ALL' || person.role === discoverFilter)
      && `${person.name} ${person.role}`.includes(discoverQuery.trim().toUpperCase());
  }).sort((left, right) => {
    const direction = discoverSort === 'name-desc' ? -1 : 1;
    return discoverSort === 'role'
      ? left.role.localeCompare(right.role) || left.name.localeCompare(right.name)
      : direction * left.name.localeCompare(right.name);
  }), [discoverFilter, discoverQuery, discoverSection, discoverSort]);

  useEffect(() => {
    const updateViewport = () => setViewport({ height: globalThis.innerHeight, width: globalThis.innerWidth });
    globalThis.addEventListener('resize', updateViewport);
    return () => globalThis.removeEventListener('resize', updateViewport);
  }, []);

  useLayoutEffect(() => {
    const next = {};
    dockTriggerRefs.current.forEach((node, key) => { next[key] = Math.round(node.getBoundingClientRect().left); });
    setDockAnchors((current) => Object.keys(next).every((key) => current[key] === next[key]) ? current : { ...current, ...next });
  }, [viewport.width]);

  useEffect(() => {
    if (identityDossierSession || (!activityOpen && !activityHistoryOpen && !discoverOpen && !profileOpen && !settingsOpen && !tableMapOpen)) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.owner-shell-system__select-popover')) return;
      if (tableRename) { event.stopPropagation(); finishTableRename(false); return; }
      if (tableDeleteId) { event.stopPropagation(); setTableDeleteId(null); return; }
      if (tableActionId) { event.stopPropagation(); setTableActionId(null); return; }
      setActivityOpen(false);
      setActivityHistoryOpen(false);
      setDiscoverOpen(false);
      setProfileOpen(false);
      setSettingsOpen(false);
      setTableMapOpen(false);
    };
    globalThis.addEventListener('keydown', closeOnEscape, true);
    return () => globalThis.removeEventListener('keydown', closeOnEscape, true);
  }, [activityHistoryOpen, activityOpen, discoverOpen, identityDossierSession, profileOpen, settingsOpen, tableActionId, tableDeleteId, tableMapOpen, tableRename]);

  useEffect(() => {
    if (!cropSession && !presentationSession && !removeCandidateId) return undefined;
    const cancelContextOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setCropSession(null);
      setPresentationSession(null);
      setRemoveCandidateId(null);
    };
    globalThis.addEventListener('keydown', cancelContextOnEscape, true);
    return () => globalThis.removeEventListener('keydown', cancelContextOnEscape, true);
  }, [cropSession, presentationSession, removeCandidateId]);

  const updateCategory = (id, update) => setCategories((current) => current.map((category) => category.id === id
    ? { ...category, ...update(category) } : category));
  const categoryCommands = {
    createCategory(name) {
      const id = `category-${Date.now()}`;
      setCategories((current) => [...current, { id, name, public: false, assetIds: [] }]);
      return id;
    },
    deleteCategory(id) { setCategories((current) => current.filter((category) => category.id !== id)); return true; },
    renameCategory(id, name) { updateCategory(id, () => ({ name })); return true; },
    setCategoryAssets(id, assetIds, value) {
      updateCategory(id, (category) => ({ assetIds: value
        ? [...new Set([...category.assetIds, ...assetIds])] : category.assetIds.filter((assetId) => !assetIds.includes(assetId)) }));
      return true;
    },
    setCategoryPublic(id, value) { updateCategory(id, () => ({ public: value })); return true; },
  };

  const finishAssetDrag = (event) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    const rectangle = gesture.moved
      ? placementRectangleFromPointer(gesture.asset, bounds, event.clientX, event.clientY)
      : null;
    if (rectangle) {
      const placement = { id: `placement-${Date.now()}`, assetId: gesture.asset.stableAssetId,
        crop: cropForPlacementFrame(null, gesture.asset, rectangle.width, rectangle.height), tableId: activeTableId,
        ...rectangle };
      setPlacements((current) => [...current, placement]);
      setSelectedPlacementId(placement.id);
      setSelectedPlacementIds([placement.id]);
    }
    globalThis.removeEventListener('pointermove', moveAssetDrag, true);
    globalThis.removeEventListener('pointerup', finishAssetDrag, true);
    globalThis.removeEventListener('pointercancel', cancelAssetDrag, true);
    dragRef.current = null;
    setDrag(null);
  };
  const moveAssetDrag = (event) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 6) gesture.moved = true;
    const previewRectangle = gesture.moved
      ? placementRectangleFromPointer(gesture.asset, canvasRef.current?.getBoundingClientRect(), event.clientX, event.clientY)
      : null;
    setDrag({ asset: gesture.asset, moved: gesture.moved, previewRectangle });
  };
  const cancelAssetDrag = (event) => finishAssetDrag({ pointerId: event.pointerId, clientX: -1, clientY: -1 });
  const beginAssetDrag = (event, asset) => {
    if (event.button !== 0 || preview) return;
    dragRef.current = { asset, moved: false, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    setDrag({ asset, moved: false, previewRectangle: null });
    globalThis.addEventListener('pointermove', moveAssetDrag, true);
    globalThis.addEventListener('pointerup', finishAssetDrag, true);
    globalThis.addEventListener('pointercancel', cancelAssetDrag, true);
  };
  const activeTable = tables.find(({ id }) => id === activeTableId) || tables[0];
  const activePlacements = placements.filter(({ tableId }) => tableId === activeTableId);
  const selectedPlacements = activePlacements.filter(({ id }) => selectedPlacementIds.includes(id));
  const selectedPlacement = activePlacements.find(({ id }) => id === selectedPlacementId) || selectedPlacements[0] || null;
  const selectionBounds = selectedPlacements.length ? {
    left: Math.min(...selectedPlacements.map(({ left }) => left)),
    top: Math.min(...selectedPlacements.map(({ top }) => top)),
    right: Math.max(...selectedPlacements.map(({ left, width }) => left + width)),
    bottom: Math.max(...selectedPlacements.map(({ top, height }) => top + height)),
  } : null;
  const viewerIndex = activePlacements.findIndex(({ id }) => id === viewerPlacementId);
  const viewerPlacement = viewerIndex >= 0 ? activePlacements[viewerIndex] : null;
  const viewerAsset = viewerPlacement ? ASSETS.find(({ stableAssetId }) => stableAssetId === viewerPlacement.assetId) : null;
  const viewerEntry = viewerPlacement && viewerAsset ? {
    dossier: {
      title: viewerAsset.title,
      description: 'A focused artwork presentation. Narrative and creator context appear before technical metadata.',
      traits: [
        { label: 'COLLECTION', value: viewerAsset.collection },
        { label: 'FORMAT', value: `${viewerAsset.width} × ${viewerAsset.height}` },
        { label: 'MEDIA', value: viewerAsset.mediaType.toUpperCase() },
      ],
      technical: [
        { label: 'CREATOR', value: 'RADAR VISUALS' },
        { label: 'STANDARD', value: 'LSP8' },
        { label: 'NETWORK', value: 'LUKSO / 42' },
        { label: 'ASSET ID', value: viewerAsset.stableAssetId },
      ],
    },
    accessibleLabel: viewerAsset.title,
    focusDimensions: { height: viewerAsset.height, width: viewerAsset.width },
    media: { accessibleLabel: viewerAsset.title, src: viewerAsset.src },
    placement: {
      backing: { enabled: false, color: '#d8d4ca' },
      column: 0,
      columnSpan: viewerPlacement.width / 100,
      crop: viewerPlacement.crop,
      id: viewerPlacement.id,
      mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
      row: 0,
      rowSpan: viewerPlacement.height / 100,
      transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
      transparencyMode: 'AUTO',
    },
  } : null;
  const inspectorHeight = cropSession ? 112 : presentationSession ? 184 : Math.min(480, 78 + activePlacements.length * 38);
  const inspectorTop = viewport.height - 64 - inspectorHeight;
  const inspectorOverlap = (left) => {
    if (!selectionBounds) return 0;
    const right = left + 402;
    const overlapWidth = Math.max(0, Math.min(selectionBounds.right + 8, right) - Math.max(selectionBounds.left - 8, left));
    const overlapHeight = Math.max(0, Math.min(selectionBounds.bottom + 8, viewport.height - 64) - Math.max(selectionBounds.top - 8, inspectorTop));
    return overlapWidth * overlapHeight;
  };
  const inspectorSide = inspectorOverlap(viewport.width - 414) > inspectorOverlap(12) ? 'left' : 'right';

  useLayoutEffect(() => {
    if (!tableMapOpen) return undefined;
    const frame = requestAnimationFrame(() => tableRowRefs.current.get(activeTableId)?.scrollIntoView({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [activeTableId, tableMapOpen, tables.length]);
  const closeTransientPanels = () => {
    setCropSession(null);
    setPresentationSession(null);
    setRemoveCandidateId(null);
    setSettingsOpen(false);
    setProfileOpen(false);
    setDiscoverOpen(false);
    setActivityOpen(false);
    setActivityHistoryOpen(false);
    setTableMapOpen(false);
    setLibraryOpen(false);
  };
  const toggleDockPanel = (setter, open) => {
    const next = !open;
    closeTransientPanels();
    if (next) setter(true);
  };
  const openIdentityDossier = () => {
    const source = profilePanelRef.current;
    if (!source) return;
    const rectangle = source.getBoundingClientRect();
    setIdentityDossierSession({
      originRectangle: {
        bottom: rectangle.bottom,
        height: rectangle.height,
        left: rectangle.left,
        right: rectangle.right,
        top: rectangle.top,
        width: rectangle.width,
      },
      viewport: { height: globalThis.innerHeight, width: globalThis.innerWidth },
    });
  };
  const visitTable = (tableId) => {
    setActiveTableId(tableId);
    setSelectedPlacementId(null);
    setSelectedPlacementIds([]);
    setViewerPlacementId(null);
    setCropSession(null);
    setPresentationSession(null);
    setRemoveCandidateId(null);
  };
  const eventIsUnread = (event) => event.unread && !activityReadIds.includes(event.id);
  const visibleActivityHistory = ACTIVITY.filter((event) => {
    const matchesFilter = activityHistoryFilter === 'ALL'
      || (activityHistoryFilter === 'UNREAD' ? eventIsUnread(event) : event.type === activityHistoryFilter);
    const query = activityHistoryQuery.trim().toUpperCase();
    return matchesFilter && (!query || `${event.label} ${event.detail} ${event.type} ${event.date}`.includes(query));
  });
  const openPlacementViewer = async (placementId) => {
    const source = placementRefs.current.get(placementId);
    if (!source) return;
    const placement = placements.find(({ id }) => id === placementId);
    const asset = ASSETS.find(({ stableAssetId }) => stableAssetId === placement?.assetId);
    if (!asset) return;
    const rectangle = source.getBoundingClientRect();
    const nativeImage = new Image();
    nativeImage.decoding = 'async';
    nativeImage.src = asset.src;
    try { await nativeImage.decode(); } catch { /* The viewer retains its media fallback if decoding fails. */ }
    if (!source.isConnected) return;
    setViewerOriginRectangle({
      bottom: rectangle.bottom,
      height: rectangle.height,
      left: rectangle.left,
      right: rectangle.right,
      top: rectangle.top,
      width: rectangle.width,
    });
    setSelectedPlacementId(placementId);
    setSelectedPlacementIds([placementId]);
    setViewerPlacementId(placementId);
    setLibraryOpen(false);
    closeTransientPanels();
  };
  const closePlacementViewer = () => {
    setViewerPlacementId(null);
    setViewerOriginRectangle(null);
  };
  const navigateViewer = (direction) => {
    if (!activePlacements.length) return;
    const nextIndex = (viewerIndex + direction + activePlacements.length) % activePlacements.length;
    setViewerPlacementId(activePlacements[nextIndex].id);
    setSelectedPlacementId(activePlacements[nextIndex].id);
    setSelectedPlacementIds([activePlacements[nextIndex].id]);
  };

  const addTable = () => {
    const table = { id: `table-${Date.now()}`, name: `TABLE ${String(tables.length + 1).padStart(2, '0')}`, public: false };
    setTables((current) => [...current, table]);
    visitTable(table.id);
  };
  const updateActiveTable = (patch) => setTables((current) => current.map((table) => table.id === activeTableId ? { ...table, ...patch } : table));
  const beginTableRename = (table, keyboardFocus = false) => {
    setTableActionId(null);
    setTableDeleteId(null);
    setTableRename({ id: table.id, keyboardFocus, name: table.name });
  };
  const finishTableRename = (save = true) => {
    if (!tableRename) return;
    const name = tableRename.name.trim().toUpperCase();
    if (save && name) setTables((current) => current.map((table) => table.id === tableRename.id ? { ...table, name } : table));
    const id = tableRename.id;
    setTableRename(null);
    requestAnimationFrame(() => tableActionRefs.current.get(id)?.focus());
  };
  const deleteTable = (tableId) => {
    if (tables.length <= 1) return;
    const index = tables.findIndex(({ id }) => id === tableId);
    const survivors = tables.filter(({ id }) => id !== tableId);
    const fallback = survivors[Math.min(index, survivors.length - 1)];
    setTables(survivors);
    setPlacements((current) => current.filter(({ tableId: placementTableId }) => placementTableId !== tableId));
    setTableDeleteId(null);
    setTableActionId(null);
    if (activeTableId === tableId) visitTable(fallback.id);
    requestAnimationFrame(() => tableActionRefs.current.get(fallback.id)?.focus());
  };
  const selectPlacement = (placementId, additive = false) => {
    if (!additive) {
      setSelectedPlacementId(placementId);
      setSelectedPlacementIds([placementId]);
      return;
    }
    setSelectedPlacementIds((current) => {
      const exists = current.includes(placementId);
      const next = exists ? current.filter((id) => id !== placementId) : [...current, placementId];
      setSelectedPlacementId(exists ? next.at(-1) || null : placementId);
      return next;
    });
  };
  const moveSelectedLayer = (direction) => {
    if (!selectedPlacements.length) return;
    const selected = new Set(selectedPlacementIds);
    let reordered = [...activePlacements];
    if (direction <= -activePlacements.length) reordered = [...reordered.filter(({ id }) => selected.has(id)), ...reordered.filter(({ id }) => !selected.has(id))];
    else if (direction >= activePlacements.length) reordered = [...reordered.filter(({ id }) => !selected.has(id)), ...reordered.filter(({ id }) => selected.has(id))];
    else if (direction < 0) {
      for (let index = 1; index < reordered.length; index += 1) if (selected.has(reordered[index].id) && !selected.has(reordered[index - 1].id)) [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    } else {
      for (let index = reordered.length - 2; index >= 0; index -= 1) if (selected.has(reordered[index].id) && !selected.has(reordered[index + 1].id)) [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    }
    setPlacements((current) => {
      const queue = [...reordered];
      return current.map((placement) => placement.tableId === activeTableId ? queue.shift() : placement);
    });
  };
  const duplicateSelected = () => {
    if (!selectedPlacements.length) return;
    const stamp = Date.now();
    const duplicates = selectedPlacements.map((placement, index) => ({ ...placement, id: `placement-${stamp}-${index}`, left: placement.left + 40, top: placement.top + 40 }));
    setPlacements((current) => [...current, ...duplicates]);
    setSelectedPlacementId(duplicates.at(-1).id);
    setSelectedPlacementIds(duplicates.map(({ id }) => id));
  };
  const removePlacement = (placementId) => {
    const index = activePlacements.findIndex(({ id }) => id === placementId);
    const remaining = activePlacements.filter(({ id }) => id !== placementId);
    const retainedSelection = selectedPlacementIds.filter((id) => id !== placementId);
    const fallbackId = remaining[Math.min(index, remaining.length - 1)]?.id || null;
    setPlacements((current) => current.filter(({ id }) => id !== placementId));
    setSelectedPlacementId(retainedSelection.includes(selectedPlacementId) ? selectedPlacementId : retainedSelection.at(-1) || fallbackId);
    setSelectedPlacementIds(retainedSelection.length ? retainedSelection : fallbackId ? [fallbackId] : []);
    setRemoveCandidateId(null);
    showStudyNotice('PLACEMENT REMOVED FROM THIS TABLE / ASSET RETAINED');
  };
  const beginPresentation = () => setPresentationSession({
    backing: false, backingColor: '#d8d4ca', frame: 'NONE', mat: 'NONE', matColor: '#d8d4ca',
    placementId: selectedPlacement.id, transparency: 'AUTO',
  });
  const showStudyNotice = (message) => {
    setNotice(message);
    globalThis.setTimeout(() => setNotice(null), 2400);
  };
  const beginCrop = () => {
    if (!selectedPlacement) return;
    const asset = ASSETS.find(({ stableAssetId }) => stableAssetId === selectedPlacement.assetId);
    if (!asset) return;
    setCropSession(createLatticeProductionCropSession(selectedPlacement, {
      height: asset.height, stableAssetId: asset.stableAssetId, width: asset.width,
    }, { left: 0, top: 0, width: selectedPlacement.width, height: selectedPlacement.height }));
  };
  const updateCropFromPointer = (event) => {
    const active = cropDragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const gesture = updateLatticeProductionCropPanGesture(active.gesture, { x: event.clientX, y: event.clientY });
    cropDragRef.current = { ...active, gesture };
    if (gesture.activated) setCropSession((current) => current && ({ ...current, dirty: true, previewCrop: { ...gesture.previewCrop } }));
  };
  const finishCropDrag = (event) => {
    const gesture = cropDragRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    globalThis.removeEventListener('pointermove', updateCropFromPointer, true);
    globalThis.removeEventListener('pointerup', finishCropDrag, true);
    globalThis.removeEventListener('pointercancel', finishCropDrag, true);
    if (gesture.target?.hasPointerCapture?.(gesture.pointerId)) gesture.target.releasePointerCapture(gesture.pointerId);
    cropDragRef.current = null;
  };
  const beginCropDrag = (event, placementId) => {
    if (cropSession?.placementId !== placementId || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    cropDragRef.current = { gesture: createLatticeProductionCropPanGesture(cropSession, { x: event.clientX, y: event.clientY }), pointerId: event.pointerId, target: event.currentTarget };
    globalThis.addEventListener('pointermove', updateCropFromPointer, true);
    globalThis.addEventListener('pointerup', finishCropDrag, true);
    globalThis.addEventListener('pointercancel', finishCropDrag, true);
  };
  const cleanupPlacementGesture = () => {
    globalThis.removeEventListener('pointermove', updatePlacementGesture, true);
    globalThis.removeEventListener('pointerup', finishPlacementGesture, true);
    globalThis.removeEventListener('pointercancel', cancelPlacementGesture, true);
    globalThis.removeEventListener('keydown', cancelPlacementGestureOnEscape, true);
    placementGestureRef.current = null;
  };
  const updatePlacementGesture = (event) => {
    const gesture = placementGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const cell = 40;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.hypot(dx, dy) > 6) gesture.moved = true;
    let nextBounds = { ...gesture.bounds };
    if (gesture.kind === 'move') {
      const moveX = Math.max(-gesture.bounds.left, Math.min(gesture.canvas.width - gesture.bounds.right, Math.round(dx / cell) * cell));
      const moveY = Math.max(-gesture.bounds.top, Math.min(gesture.canvas.height - gesture.bounds.bottom, Math.round(dy / cell) * cell));
      setPlacements((current) => current.map((placement) => {
        const start = gesture.placements.find(({ id }) => id === placement.id);
        return start ? { ...placement, left: start.left + moveX, top: start.top + moveY } : placement;
      }));
      return;
    } else {
      const west = gesture.corner.includes('w');
      const north = gesture.corner.includes('n');
      const movingX = west ? -dx : dx;
      const movingY = north ? -dy : dy;
      let width = Math.max(80, gesture.bounds.width + movingX);
      let height = Math.max(80, gesture.bounds.height + movingY);
      if (event.shiftKey) {
        const ratio = gesture.bounds.width / gesture.bounds.height;
        if (Math.abs(movingX) >= Math.abs(movingY)) height = width / ratio;
        else width = height * ratio;
      }
      width = Math.max(80, Math.round(width / cell) * cell);
      height = Math.max(80, Math.round(height / cell) * cell);
      nextBounds = {
        left: west ? gesture.bounds.right - width : gesture.bounds.left,
        top: north ? gesture.bounds.bottom - height : gesture.bounds.top,
        width, height,
      };
      nextBounds.left = Math.max(0, Math.min(gesture.canvas.width - nextBounds.width, nextBounds.left));
      nextBounds.top = Math.max(0, Math.min(gesture.canvas.height - nextBounds.height, nextBounds.top));
    }
    const scaleX = nextBounds.width / gesture.bounds.width;
    const scaleY = nextBounds.height / gesture.bounds.height;
    setPlacements((current) => current.map((placement) => {
      const start = gesture.placements.find(({ id }) => id === placement.id);
      if (!start) return placement;
      const width = Math.max(40, Math.round((start.width * scaleX) / cell) * cell);
      const height = Math.max(40, Math.round((start.height * scaleY) / cell) * cell);
      const asset = ASSETS.find(({ stableAssetId }) => stableAssetId === start.assetId);
      return { ...placement,
        crop: cropForPlacementFrame(start.crop, asset, width, height),
        left: Math.round((nextBounds.left + ((start.left - gesture.bounds.left) * scaleX)) / cell) * cell,
        top: Math.round((nextBounds.top + ((start.top - gesture.bounds.top) * scaleY)) / cell) * cell,
        width,
        height,
      };
    }));
  };
  const finishPlacementGesture = (event) => {
    const gesture = placementGestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    if (gesture.moved) {
      placementClickSuppressedRef.current = true;
      globalThis.setTimeout(() => { placementClickSuppressedRef.current = false; }, 0);
    }
    cleanupPlacementGesture();
  };
  const cancelPlacementGesture = (event) => {
    const gesture = placementGestureRef.current;
    if (!gesture || (event.pointerId != null && gesture.pointerId !== event.pointerId)) return;
    setPlacements((current) => current.map((placement) => gesture.placements.find(({ id }) => id === placement.id) || placement));
    cleanupPlacementGesture();
  };
  const cancelPlacementGestureOnEscape = (event) => {
    if (event.key === 'Escape') cancelPlacementGesture(event);
  };
  const beginPlacementGesture = (event, placement, kind = 'move', corner = null) => {
    if (preview || cropSession || presentationSession || event.button !== 0) return;
    if (kind === 'move' && event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!canvas) return;
    const gesturePlacements = selectedPlacementIds.includes(placement.id) ? selectedPlacements : [placement];
    const bounds = {
      left: Math.min(...gesturePlacements.map(({ left }) => left)),
      top: Math.min(...gesturePlacements.map(({ top }) => top)),
      right: Math.max(...gesturePlacements.map(({ left, width }) => left + width)),
      bottom: Math.max(...gesturePlacements.map(({ top, height }) => top + height)),
    };
    bounds.width = bounds.right - bounds.left;
    bounds.height = bounds.bottom - bounds.top;
    setSelectedPlacementId(placement.id);
    if (!selectedPlacementIds.includes(placement.id)) setSelectedPlacementIds([placement.id]);
    placementGestureRef.current = { bounds, canvas, corner, kind, moved: false, placements: gesturePlacements.map((item) => ({ ...item })), pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    globalThis.addEventListener('pointermove', updatePlacementGesture, true);
    globalThis.addEventListener('pointerup', finishPlacementGesture, true);
    globalThis.addEventListener('pointercancel', cancelPlacementGesture, true);
    globalThis.addEventListener('keydown', cancelPlacementGestureOnEscape, true);
  };
  const cleanupMarquee = () => {
    globalThis.removeEventListener('pointermove', updateMarquee, true);
    globalThis.removeEventListener('pointerup', finishMarquee, true);
    globalThis.removeEventListener('pointercancel', cancelMarquee, true);
    marqueeRef.current = null;
    setMarquee(null);
  };
  const updateMarquee = (event) => {
    const gesture = marqueeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const x = Math.max(0, Math.min(gesture.canvas.width, event.clientX - gesture.canvas.left));
    const y = Math.max(0, Math.min(gesture.canvas.height, event.clientY - gesture.canvas.top));
    const moved = gesture.moved || Math.hypot(x - gesture.startX, y - gesture.startY) > 6;
    marqueeRef.current = { ...gesture, moved, x, y };
    if (moved) setMarquee({ height: Math.abs(y - gesture.startY), left: Math.min(x, gesture.startX), top: Math.min(y, gesture.startY), width: Math.abs(x - gesture.startX) });
  };
  const finishMarquee = (event) => {
    const gesture = marqueeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.moved) {
      const rectangle = { left: Math.min(gesture.x, gesture.startX), right: Math.max(gesture.x, gesture.startX), top: Math.min(gesture.y, gesture.startY), bottom: Math.max(gesture.y, gesture.startY) };
      const ids = activePlacements.filter((placement) => placement.left < rectangle.right && placement.left + placement.width > rectangle.left
        && placement.top < rectangle.bottom && placement.top + placement.height > rectangle.top).map(({ id }) => id);
      setSelectedPlacementIds(ids);
      setSelectedPlacementId(ids.at(-1) || null);
    } else {
      setSelectedPlacementIds([]);
      setSelectedPlacementId(null);
      closeTransientPanels();
    }
    cleanupMarquee();
  };
  const cancelMarquee = (event) => {
    if (marqueeRef.current?.pointerId !== event.pointerId) return;
    cleanupMarquee();
  };
  const beginCanvasSelection = (event) => {
    if (event.target !== event.currentTarget || event.button !== 0 || preview) return;
    event.preventDefault();
    const canvas = event.currentTarget.getBoundingClientRect();
    marqueeRef.current = { canvas, moved: false, pointerId: event.pointerId, startX: event.clientX - canvas.left, startY: event.clientY - canvas.top, x: event.clientX - canvas.left, y: event.clientY - canvas.top };
    globalThis.addEventListener('pointermove', updateMarquee, true);
    globalThis.addEventListener('pointerup', finishMarquee, true);
    globalThis.addEventListener('pointercancel', cancelMarquee, true);
  };

  const canvasContext = drag
    ? 'placing'
    : libraryPresence.present || activityHistoryPresence.present || discoverPresence.present
        ? 'workspace'
        : 'canvas';

  return <main className="owner-shell-system" data-canvas-context={canvasContext} data-lattice-menu-surface data-menu-surface={menuSurface} data-preview={preview || undefined} data-surface={gridSurface}
    style={Object.fromEntries(Object.entries(dockAnchors).map(([key, left]) => [`--dock-${key}-left`, `${left}px`]))}>
    <header className="owner-shell-system__global">
      <div className="owner-shell-system__identity">
        <strong>INSCAPE</strong>
        <button aria-expanded={profileOpen} disabled={preview} onClick={() => toggleDockPanel(setProfileOpen, profileOpen)} type="button"><UserRound size={13} />PROFILE</button>
        <button aria-expanded={activityOpen || activityHistoryOpen} className="owner-shell-system__activity-trigger" disabled={preview} onClick={() => toggleDockPanel(setActivityOpen, activityOpen || activityHistoryOpen)} ref={(node) => { if (node) dockTriggerRefs.current.set('activity', node); }} type="button"><Bell size={13} />ACTIVITY<i aria-label="2 unread">2</i></button>
        <button aria-pressed={discoverOpen} disabled={preview} onClick={() => toggleDockPanel(setDiscoverOpen, discoverOpen)} type="button"><Compass size={13} />DISCOVER</button>
      </div>
      <button aria-expanded={tableMapOpen} className="owner-shell-system__table" disabled={preview} onClick={() => toggleDockPanel(setTableMapOpen, tableMapOpen)} type="button"><Grid3X3 className="owner-shell-system__table-icon" size={14} /><small>ACTIVE TABLE</small><b>{activeTable?.name || 'HOME'}</b><ChevronUp className="owner-shell-system__table-chevron" size={12} /></button>
      <nav aria-label="Owner workspace">
        <button aria-pressed={libraryOpen} disabled={preview} onClick={() => toggleDockPanel(setLibraryOpen, libraryOpen)} type="button"><Library size={14} />LIBRARY</button>
        <button aria-pressed={preview} onClick={() => { setPreview((value) => !value); closeTransientPanels(); }} type="button"><Eye size={14} />{preview ? 'RETURN' : 'PREVIEW'}</button>
        <button onClick={() => showStudyNotice('PUBLICATION IS NOT CONNECTED IN THIS STUDY')} type="button"><Upload size={14} />PUBLISH</button>
        <button aria-expanded={settingsOpen} disabled={preview} onClick={() => toggleDockPanel(setSettingsOpen, settingsOpen)} type="button"><Settings2 size={14} />SETTINGS</button>
      </nav>
    </header>

    <section aria-label="Central lattice" className="owner-shell-system__canvas" onPointerDown={beginCanvasSelection} ref={canvasRef}>
      {activePlacements.map((placement, index) => {
        const asset = ASSETS.find(({ stableAssetId }) => stableAssetId === placement.assetId);
        const cropping = cropSession?.placementId === placement.id;
        const selected = selectedPlacementIds.includes(placement.id);
        const presenting = presentationSession?.placementId === placement.id;
        const visibleCrop = cropping ? cropSession.previewCrop : placement.crop;
        const imageRectangle = visibleCrop && asset ? projectCroppedMediaRectangle(
          { left: 0, top: 0, width: placement.width, height: placement.height },
          { width: asset.width, height: asset.height },
          visibleCrop,
        ) : null;
        return <Fragment key={placement.id}><div aria-label={`Select ${asset?.title || 'artwork'}`} aria-pressed={selected}
          className="owner-shell-system__placement" data-cropped={Boolean(visibleCrop) || undefined} data-cropping={cropping || undefined} data-frame={presenting ? presentationSession.frame : undefined} data-viewing={viewerPlacementId === placement.id || undefined} key={placement.id}
          onClick={(event) => { if (placementClickSuppressedRef.current) return; if (preview) openPlacementViewer(placement.id); else if (!cropSession && !presentationSession) selectPlacement(placement.id, event.shiftKey); }}
          onDoubleClick={(event) => { if (!cropSession && !presentationSession) { event.stopPropagation(); openPlacementViewer(placement.id); } }}
          onKeyDown={(event) => { if (event.key === 'Enter' && !cropSession && !presentationSession) { event.preventDefault(); openPlacementViewer(placement.id); } }}
          onPointerDown={(event) => cropping ? beginCropDrag(event, placement.id) : beginPlacementGesture(event, placement)}
          ref={(node) => { if (node) placementRefs.current.set(placement.id, node); else placementRefs.current.delete(placement.id); }}
          role="button" style={{ left: placement.left, top: placement.top, width: placement.width, height: placement.height, zIndex: index + 1 }} tabIndex={0}>
          <img alt="" draggable="false" src={asset?.src} style={imageRectangle ? { height: imageRectangle.height, left: imageRectangle.left, position: 'absolute', top: imageRectangle.top, width: imageRectangle.width } : undefined} /><span>{asset?.title}</span>
        </div></Fragment>;
      })}
      {selectionBounds && !cropSession && !presentationSession && selectedPlacement && <>{selectedPlacements.length > 1 && <div aria-hidden="true" className="owner-shell-system__group-selection" style={{ height: selectionBounds.bottom - selectionBounds.top, left: selectionBounds.left, top: selectionBounds.top, width: selectionBounds.right - selectionBounds.left }} />}{['nw', 'ne', 'se', 'sw'].map((corner) => {
        const east = corner.includes('e');
        const south = corner.includes('s');
        return <button aria-label={`Resize selection from ${corner}`} className={`owner-shell-system__resize-handle is-${corner}`} key={corner}
          onPointerDown={(event) => beginPlacementGesture(event, selectedPlacement, 'resize', corner)}
          style={{ left: (east ? selectionBounds.right : selectionBounds.left) - 6, top: (south ? selectionBounds.bottom : selectionBounds.top) - 6, zIndex: activePlacements.length + 12 }} type="button" />;
      })}</>}
      {marquee && <div aria-hidden="true" className="owner-shell-system__marquee" style={marquee} />}
      {drag?.moved && drag.previewRectangle && <div aria-hidden="true" className="owner-shell-system__placement-preview" style={drag.previewRectangle}><img alt="" src={drag.asset.previewSrc} /><span>{drag.asset.title} / RELEASE TO PLACE</span></div>}
    </section>

    {!preview && libraryPresence.present && <section aria-hidden={libraryPresence.phase === 'closing' || undefined} aria-label="Library workspace" className="owner-shell-system__workspace-window owner-shell-system__library owner-shell-system__motion-panel" data-panel-phase={libraryPresence.phase} data-placing={Boolean(drag) || undefined} data-sidebar-collapsed={librarySidebar.collapsed || undefined} inert={libraryPresence.phase === 'closing' ? '' : undefined} style={{ '--prototype-sidebar-width': `${librarySidebar.width}px` }}>
      <Modul8rLibraryAdapter categoryCommands={categoryCommands} data={data}
        onAssetPointerDown={beginAssetDrag} workspace={prototypeWorkspace} />
      <footer className="owner-shell-system__local-rail"><OwnerShellLibraryRail menuSurface={menuSurface} workspace={prototypeWorkspace} /></footer>
    </section>}

    {!preview && !viewerPlacementId && !libraryPresence.present && !settingsPresence.present && !profilePresence.present && !activityPresence.present && !activityHistoryPresence.present && !discoverPresence.present && selectedPlacement && <aside aria-label="Selection and layers inspector" className="owner-shell-system__inspector" data-side={inspectorSide}>
      {cropSession ? <section aria-label="Crop controls" className="owner-shell-system__crop-controls">
        <div><strong>CROP / DRAG IMAGE</strong><output>{Math.round(cropSession.previewCrop.zoom * 100)}%</output></div>
        <input aria-label="Crop zoom" max="4" min="1" onChange={(event) => setCropSession((current) => current && ({ ...current, dirty: true, previewCrop: setLatticeProductionCropZoom(current.previewCrop, current.media, current.mask, Number(event.target.value)) }))} step="0.05" type="range" value={cropSession.previewCrop.zoom} />
        <footer><button onClick={() => { setPlacements((current) => current.map((placement) => placement.id === cropSession.placementId ? { ...placement, crop: null } : placement)); setCropSession(null); showStudyNotice('NATIVE FIT RESTORED IN SESSION STUDY'); }} type="button">NATIVE FIT</button><button onClick={() => setCropSession(null)} type="button">CANCEL</button><button onClick={() => { setPlacements((current) => current.map((placement) => placement.id === cropSession.placementId ? { ...placement, crop: { ...cropSession.previewCrop } } : placement)); setCropSession(null); showStudyNotice('CROP APPLIED IN SESSION STUDY'); }} type="button">DONE</button></footer>
      </section> : presentationSession ? <section aria-label="Frame and mat controls" className="owner-shell-system__presentation-controls">
        <div className="owner-shell-system__presentation-fields">
          <label><span>FRAME</span><select onChange={(event) => setPresentationSession((current) => ({ ...current, frame: event.target.value }))} value={presentationSession.frame}>{['NONE', 'DOSSIER', 'CAPTION'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>MAT</span><select onChange={(event) => setPresentationSession((current) => ({ ...current, mat: event.target.value }))} value={presentationSession.mat}>{['NONE', 'DOSSIER', 'CAPTION'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>MAT COLOR</span><input onChange={(event) => setPresentationSession((current) => ({ ...current, matColor: event.target.value }))} type="color" value={presentationSession.matColor} /></label>
          <label><span>BACKING</span><input checked={presentationSession.backing} onChange={(event) => setPresentationSession((current) => ({ ...current, backing: event.target.checked }))} type="checkbox" /></label>
          <label><span>BACKING COLOR</span><input disabled={!presentationSession.backing} onChange={(event) => setPresentationSession((current) => ({ ...current, backingColor: event.target.value }))} type="color" value={presentationSession.backingColor} /></label>
          <label><span>TRANSPARENCY</span><select onChange={(event) => setPresentationSession((current) => ({ ...current, transparency: event.target.value }))} value={presentationSession.transparency}>{['AUTO', 'PRESERVE_ALPHA', 'OPAQUE'].map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <footer><button onClick={() => setPresentationSession(null)} type="button">CANCEL</button><button onClick={() => { setPresentationSession(null); showStudyNotice('FRAME & MAT APPLIED IN SESSION STUDY'); }} type="button">APPLY</button></footer>
      </section> : <><nav aria-label="Selection actions" className="owner-shell-system__selection-actions">
        <button aria-label="Rotate" onClick={() => showStudyNotice('ROTATE CONTROL PLACED HERE / NOT CONNECTED')} title="Rotate" type="button"><RotateCw size={15} /></button>
        <button aria-label="Mirror horizontal" onClick={() => showStudyNotice('MIRROR H CONTROL PLACED HERE / NOT CONNECTED')} title="Mirror horizontal" type="button"><FlipHorizontal2 size={15} /></button>
        <button aria-label="Mirror vertical" onClick={() => showStudyNotice('MIRROR V CONTROL PLACED HERE / NOT CONNECTED')} title="Mirror vertical" type="button"><FlipVertical2 size={15} /></button>
        <button aria-label="Duplicate" onClick={duplicateSelected} title="Duplicate" type="button"><Copy size={15} /></button>
        <button aria-label="Send to back" onClick={() => moveSelectedLayer(-activePlacements.length)} title="Send to back" type="button"><ChevronsDown size={15} /></button>
        <button aria-label="Move backward" onClick={() => moveSelectedLayer(-1)} title="Move backward" type="button"><ChevronDown size={15} /></button>
        <button aria-label="Move forward" onClick={() => moveSelectedLayer(1)} title="Move forward" type="button"><ChevronUp size={15} /></button>
        <button aria-label="Bring to front" onClick={() => moveSelectedLayer(activePlacements.length)} title="Bring to front" type="button"><ChevronsUp size={15} /></button>
        <button aria-label="Crop" disabled={selectedPlacements.length !== 1} onClick={beginCrop} title={selectedPlacements.length === 1 ? 'Crop' : 'Crop requires one artwork'} type="button"><Crop size={15} /></button>
        <button aria-label="Frame and mat" disabled={selectedPlacements.length !== 1} onClick={beginPresentation} title={selectedPlacements.length === 1 ? 'Frame and mat' : 'Frame and mat requires one artwork'} type="button"><Frame size={15} /></button>
      </nav>
      <section className="owner-shell-system__layers"><small>LAYERS / THIS TABLE{selectedPlacements.length > 1 ? ` / ${selectedPlacements.length} SELECTED` : ''}</small>
        <div className="owner-shell-system__layer-list">{[...activePlacements].reverse().map((placement) => {
          const asset = ASSETS.find(({ stableAssetId }) => stableAssetId === placement.assetId);
          const confirming = removeCandidateId === placement.id;
          return <div className="owner-shell-system__layer-row" data-confirming={confirming || undefined} data-selected={selectedPlacementIds.includes(placement.id) || undefined} key={placement.id}>
            <button className="owner-shell-system__layer-select" onClick={(event) => { selectPlacement(placement.id, event.shiftKey); setRemoveCandidateId(null); }} type="button"><img alt="" src={asset?.previewSrc} /><span>{asset?.title}</span></button><button aria-label={`Remove ${asset?.title} from table`} className="owner-shell-system__layer-remove" onClick={() => setRemoveCandidateId(placement.id)} title="Remove from table" type="button"><Trash2 size={14} /></button>
            {confirming && <div className="owner-shell-system__remove-confirm"><img alt="" src={asset?.previewSrc} /><span>REMOVE FROM TABLE?</span><button onClick={() => setRemoveCandidateId(null)} type="button">CANCEL</button><button onClick={() => removePlacement(placement.id)} type="button">REMOVE</button></div>}
          </div>;
        })}</div>
      </section>
      </>}
    </aside>}

    {profilePresence.present && !preview && <aside aria-hidden={profilePresence.phase === 'closing' || undefined} aria-label="Profile" className="owner-shell-system__profile owner-shell-system__motion-panel" data-panel-phase={profilePresence.phase} data-viewing={Boolean(identityDossierSession) || undefined} inert={profilePresence.phase === 'closing' ? '' : undefined} ref={profilePanelRef}>
      <button aria-expanded={Boolean(identityDossierSession)} className="owner-shell-system__profile-card" data-identity-dossier-source="true" data-viewing={Boolean(identityDossierSession) || undefined} onClick={openIdentityDossier} ref={profileIdentityRef} type="button"><div>RV</div><span><b>RADAR VISUALS</b><small>0xPROTOTYPE · OWNER</small></span></button>
    </aside>}

    {identityDossierSession && <OwnerShellSystemIdentityDossier
      getReturnRectangle={() => profilePanelRef.current?.getBoundingClientRect() || identityDossierSession.originRectangle}
      menuSurfaceId={menuSurface}
      model={IDENTITY_DOSSIER_FIXTURE}
      onClosed={() => setIdentityDossierSession(null)}
      originRectangle={identityDossierSession.originRectangle}
      returnFocus={profileIdentityRef.current}
      sourceIdentity={{ displayName: 'RADAR VISUALS', secondaryLabel: '0xPROTOTYPE · OWNER' }}
      viewport={identityDossierSession.viewport}
    />}

    {activityPresence.present && !preview && <aside aria-hidden={activityPresence.phase === 'closing' || undefined} aria-label="Activity notifications" className="owner-shell-system__activity-drawer owner-shell-system__motion-panel" data-panel-phase={activityPresence.phase} inert={activityPresence.phase === 'closing' ? '' : undefined}>
      <ol>{ACTIVITY.filter(({ type }) => activityTab === 'ALL' || type === activityTab).map((event) => <li data-unread={eventIsUnread(event) || undefined} key={event.id}><i aria-hidden="true" className="owner-shell-system__activity-state-indicator" /><time>{event.time}</time><span><b>{event.label}</b><small>{event.detail}</small></span></li>)}</ol>
      <nav aria-label="Activity filters" className="owner-shell-system__local-rail">{['ALL', 'ASSETS', 'LYX', 'SOCIAL'].map((tab) => <button aria-pressed={activityTab === tab} key={tab} onClick={() => setActivityTab(tab)} type="button">{tab}</button>)}<button aria-label="Open full activity history" onClick={() => { setActivityOpen(false); setActivityHistoryOpen(true); }} title="Open full history" type="button"><History size={13} /></button></nav>
    </aside>}

    {activityHistoryPresence.present && !preview && <section aria-hidden={activityHistoryPresence.phase === 'closing' || undefined} aria-label="Full activity history" className="owner-shell-system__activity-history owner-shell-system__motion-panel" data-panel-phase={activityHistoryPresence.phase} inert={activityHistoryPresence.phase === 'closing' ? '' : undefined}>
      {visibleActivityHistory.length > 0 ? <ol>{visibleActivityHistory.map((event) => <li data-unread={eventIsUnread(event) || undefined} key={event.id}>
        <time><strong>{event.date}</strong><small>{event.time}</small></time><i aria-hidden="true" className="owner-shell-system__activity-state-indicator" />
        <span><strong>{event.label}</strong><small>{event.detail}</small></span><em>{event.type}</em><button onClick={() => showStudyNotice('EVENT DETAIL NAVIGATION IS NOT CONNECTED IN THIS STUDY')} type="button">OPEN →</button>
      </li>)}</ol> : <p>NO EVENTS MATCH THIS VIEW.</p>}
      <footer aria-label="Activity history controls" className="owner-shell-system__activity-history-rail owner-shell-system__local-rail">
        <PrototypeSearch onChange={setActivityHistoryQuery} placeholder="EVENT, ASSET OR PROFILE" value={activityHistoryQuery} />
        <nav aria-label="Full activity history filters">{['ALL', 'UNREAD', 'ASSETS', 'LYX', 'SOCIAL'].map((filter) => <button aria-pressed={activityHistoryFilter === filter} key={filter} onClick={() => setActivityHistoryFilter(filter)} type="button">{filter}</button>)}</nav>
        <PrototypeSelectMenu className="owner-shell-system__activity-history-filter" label="FILTER" menuSurface={menuSurface} onChange={setActivityHistoryFilter} options={['ALL', 'UNREAD', 'ASSETS', 'LYX', 'SOCIAL'].map((value) => ({ label: value, value }))} triggerLabel={`FILTER: ${activityHistoryFilter}`} value={activityHistoryFilter} />
        <button aria-label="Mark all activity read" className="owner-shell-system__activity-history-read" onClick={() => setActivityReadIds(ACTIVITY.filter(({ unread }) => unread).map(({ id }) => id))} title="Mark all read" type="button"><Check size={13} /><span>MARK ALL READ</span></button>
        <button aria-label="Close full activity history" onClick={() => setActivityHistoryOpen(false)} title="Close" type="button"><X size={15} /></button>
      </footer>
    </section>}

    {discoverPresence.present && !preview && <section aria-hidden={discoverPresence.phase === 'closing' || undefined} aria-label="Discover directory" className="owner-shell-system__workspace-window owner-shell-system__discover owner-shell-system__motion-panel" data-panel-phase={discoverPresence.phase} inert={discoverPresence.phase === 'closing' ? '' : undefined}>
      <div className="owner-shell-system__discover-browser" data-sidebar-collapsed={discoverSidebar.collapsed || undefined}
        style={{ '--discover-card-size': `${discoverCardSize}px`, '--prototype-sidebar-width': `${discoverSidebar.width}px` }}>
        <aside aria-label="Discover sections" className="owner-shell-system__discover-sidebar">
          {[
            { id: 'all', label: 'ALL PEOPLE', icon: UsersRound, count: PEOPLE.length },
            { id: 'following', label: 'FOLLOWING', icon: UserCheck, count: PEOPLE.filter(({ following }) => following).length },
            { id: 'followers', label: 'FOLLOWERS', icon: UserRound, count: PEOPLE.filter(({ follower }) => follower).length },
          ].map(({ count, icon: Icon, id, label }) => <button aria-label={label} aria-pressed={discoverSection === id} data-active={discoverSection === id || undefined} key={id} onClick={() => setDiscoverSection(id)} title={label} type="button"><span><Icon size={15} /><b>{label}</b></span><i>{count}</i></button>)}
          <div className="owner-shell-system__discover-group-heading">
            <button aria-label="Create people group" onClick={() => showStudyNotice('PEOPLE GROUP CREATION WILL OPEN HERE')} title="Create group" type="button"><Plus size={15} /><span>CREATE GROUP</span></button>
          </div>
          {DISCOVER_GROUPS.map((group) => <button aria-label={group.name} aria-pressed={discoverSection === group.id} data-active={discoverSection === group.id || undefined} key={group.id} onClick={() => setDiscoverSection(group.id)} title={group.name} type="button"><span><Folder size={15} /><b>{group.name}</b></span><i>{PEOPLE.filter((person) => person.groups.includes(group.id)).length}</i></button>)}
        </aside>
        <button aria-label="Resize Discover sidebar" className="owner-shell-system__discover-sidebar-resize"
          onPointerCancel={discoverSidebar.resize.finish} onPointerDown={discoverSidebar.resize.begin} onPointerMove={discoverSidebar.resize.update} onPointerUp={discoverSidebar.resize.finish} type="button" />
        {visibleDiscoverPeople.length > 0 ? <div className="owner-shell-system__discover-grid">{visibleDiscoverPeople.map((person) => <button key={person.id} onClick={() => showStudyNotice('PUBLIC PROFILE NAVIGATION IS NOT CONNECTED IN THIS STUDY')} type="button"><img alt="" src={person.asset.previewSrc} />{discoverLabelsVisible && <span><small>{person.role}</small><b>{person.name}</b><em>OPEN PUBLIC PROFILE →</em></span>}</button>)}</div>
          : <p className="owner-shell-system__discover-empty">NO PEOPLE MATCH THIS VIEW.</p>}
      </div>
      <footer className="owner-shell-system__local-rail"><OwnerShellWorkspaceRail clearFilters={() => { setDiscoverQuery(''); setDiscoverFilter('ALL'); }}
        hasActiveFilters={Boolean(discoverQuery.trim() || discoverFilter !== 'ALL')} labelsVisible={discoverLabelsVisible} menuSurface={menuSurface}
        onLabelsVisibleChange={setDiscoverLabelsVisible} onQueryChange={setDiscoverQuery} onSizeChange={setDiscoverCardSize}
        primaryMenu={{ label: 'ROLE', onChange: setDiscoverFilter, options: DISCOVER_ROLE_OPTIONS, value: discoverFilter }} query={discoverQuery}
        secondaryMenu={{ label: 'SORT', onChange: setDiscoverSort, options: DISCOVER_SORT_OPTIONS, value: discoverSort }} size={discoverCardSize}
        sizeBounds={{ maximum: 320, minimum: 160 }} /></footer>
    </section>}

    {settingsPresence.present && !preview && <aside aria-hidden={settingsPresence.phase === 'closing' || undefined} aria-label="Settings" className="owner-shell-system__settings owner-shell-system__motion-panel" data-panel-phase={settingsPresence.phase} inert={settingsPresence.phase === 'closing' ? '' : undefined}>
      <section className="owner-shell-system__settings-section">
        <header><strong>ACTIVITY</strong><span>KEEPER SIGNALS</span></header>
        <div className="owner-shell-system__settings-options">{SIGNAL_OPTIONS.map(([key, label]) => <label key={key}>
          <span>{label}{key === 'audio' && <small>DEFAULT OFF</small>}</span>
          <input checked={signalSettings[key]} onChange={(event) => setSignalSettings((current) => ({ ...current, [key]: event.target.checked }))} type="checkbox" />
        </label>)}</div>
        {!signalSettings.notifications && <p>HISTORY AND REFRESH REMAIN ACTIVE.</p>}
      </section>
      <section className="owner-shell-system__settings-section owner-shell-system__settings-theme">
        <header><strong>THEME</strong><span>SEPARATE SURFACES</span></header>
        <label><span>WORKSPACE / GRID</span><PrototypeSelectMenu label={gridSurface.toUpperCase()} menuSurface={menuSurface} onChange={setGridSurface} options={LATTICE_PRODUCTION_SURFACE_IDS.map((id) => ({ label: id.toUpperCase(), value: id }))} value={gridSurface} /></label>
        <label><span>WINDOWS / INTERFACE</span><PrototypeSelectMenu label={menuSurface.toUpperCase()} menuSurface={menuSurface} onChange={setMenuSurface} options={LATTICE_PRODUCTION_SURFACE_IDS.map((id) => ({ label: id.toUpperCase(), value: id }))} value={menuSurface} /></label>
        <p>SESSION ONLY / NOT PERSISTED</p>
      </section>
      <section className="owner-shell-system__settings-section">
        <header><strong>VISITOR PRESENTATION</strong><span>NEXT PUBLICATION</span></header>
        <div className="owner-shell-system__settings-options">{VISITOR_OPTIONS.map(([key, label]) => <label key={key}>
          <span>{label}</span>
          <input checked={visitorPresentation[key]} onChange={(event) => setVisitorPresentation((current) => ({ ...current, [key]: event.target.checked }))} type="checkbox" />
        </label>)}</div>
        <p>THEME EXISTS HERE ONCE. NO DUPLICATE GLOBAL CONTROL.</p>
      </section>
    </aside>}

    {tablePresence.present && !preview && <aside aria-hidden={tablePresence.phase === 'closing' || undefined} aria-label="Tables" className="owner-shell-system__table-switcher owner-shell-system__motion-panel" data-panel-phase={tablePresence.phase} inert={tablePresence.phase === 'closing' ? '' : undefined}>
      <div aria-label="Profile tables" className="owner-shell-system__table-list" role="listbox" onKeyDown={(event) => {
        const row = event.target.closest('[data-table-row]');
        if (event.target !== row) return;
        const index = tables.findIndex(({ id }) => id === row?.dataset.tableRow);
        let next = null;
        if (event.key === 'ArrowDown') next = Math.min(tables.length - 1, index + 1);
        else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tables.length - 1;
        else if (event.key === 'Enter' && row) { event.preventDefault(); visitTable(row.dataset.tableRow); return; }
        if (next !== null) { event.preventDefault(); tableRowRefs.current.get(tables[next].id)?.focus(); }
      }}>{tables.map((table, index) => {
        const renaming = tableRename?.id === table.id;
        const confirming = tableDeleteId === table.id;
        const actionsOpen = tableActionId === table.id;
        return <div aria-current={table.id === activeTableId ? 'page' : undefined} className="owner-shell-system__table-row" data-table-row={table.id} key={table.id} role="option" tabIndex={table.id === activeTableId ? 0 : -1} ref={(node) => { if (node) tableRowRefs.current.set(table.id, node); }}>
          <small>{String(index + 1).padStart(2, '0')}</small>
          {renaming ? <div className="owner-shell-system__table-rename" data-keyboard-focus={tableRename.keyboardFocus || undefined}><input aria-label={`Rename ${table.name}`} autoFocus maxLength="24" onBlur={() => finishTableRename(Boolean(tableRename.name.trim()))} onChange={(event) => setTableRename((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') finishTableRename(true); if (event.key === 'Escape') { event.stopPropagation(); finishTableRename(false); } }} value={tableRename.name} /></div> : <button className="owner-shell-system__table-activate" onClick={() => visitTable(table.id)} type="button"><b>{table.name}</b><span>{table.public ? 'PUBLIC' : 'PRIVATE'}</span></button>}
          <button aria-expanded={actionsOpen} aria-label={`Actions for ${table.name}`} className="owner-shell-system__table-actions-trigger" onClick={() => { setTableDeleteId(null); setTableActionId(actionsOpen ? null : table.id); }} ref={(node) => { if (node) tableActionRefs.current.set(table.id, node); }} type="button"><MoreHorizontal size={14} /></button>
          {actionsOpen && <div className="owner-shell-system__table-actions"><button onClick={(event) => beginTableRename(table, event.detail === 0)} type="button">RENAME</button><button aria-describedby={tables.length === 1 ? 'final-table-explanation' : undefined} disabled={tables.length === 1} onClick={() => { setTableActionId(null); setTableDeleteId(table.id); }} title={tables.length === 1 ? 'The final table cannot be deleted' : `Delete ${table.name}`} type="button">DELETE</button></div>}
          {confirming && <div className="owner-shell-system__table-delete-confirm"><span>DELETE {table.name}?</span><button onClick={() => { setTableDeleteId(null); tableActionRefs.current.get(table.id)?.focus(); }} type="button">CANCEL</button><button onClick={() => deleteTable(table.id)} type="button">DELETE</button></div>}
        </div>;
      })}<span className="owner-shell-system__sr-only" id="final-table-explanation">The final remaining table cannot be deleted.</span></div>
      <footer aria-label="Active table controls" className="owner-shell-system__local-rail"><button className="owner-shell-system__table-new" onClick={addTable} type="button"><Plus size={13} /><span>NEW TABLE</span></button><button aria-pressed={activeTable?.public} onClick={() => updateActiveTable({ public: !activeTable?.public })} type="button"><span>VISIBILITY</span><b>{activeTable?.public ? 'PUBLIC' : 'PRIVATE'}</b></button></footer>
    </aside>}
    {viewerEntry && viewerOriginRectangle && <LatticeFocusViewer
      dossier={viewerEntry.dossier}
      entry={viewerEntry}
      getReturnRectangle={() => placementRefs.current.get(viewerPlacementId)?.getBoundingClientRect() || viewerOriginRectangle}
      gridVariables={{ '--lattice-grid-cell-size': '40px', '--lattice-grid-origin-x': '0px', '--lattice-grid-origin-y': '0px' }}
      gridVisible
      inspectionVariant="rack"
      menuSurfaceId={menuSurface}
      onClosed={closePlacementViewer}
      onNavigate={navigateViewer}
      originRectangle={viewerOriginRectangle}
      position={viewerIndex}
      renderArtwork={(focusEntry, context) => <OwnerShellFocusArtwork
        entry={focusEntry}
        phase={context.phase}
      />}
      returnFocus={placementRefs.current.get(viewerPlacementId)}
      surfaceColor="var(--lattice-menu-panel)"
      total={activePlacements.length}
    />}
    {notice && <output className="owner-shell-system__notice">{notice}</output>}
    {preview && <div className="owner-shell-system__preview-label">VISITOR PREVIEW / EDITING HIDDEN</div>}
  </main>;
}
