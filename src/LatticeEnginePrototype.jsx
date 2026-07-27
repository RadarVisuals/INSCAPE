import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANONICAL_LATTICE_ARTBOARD,
  FRAME_IDS,
  LATTICE_COORDINATES,
  TABLE_LABEL_ANCHORS,
  TABLE_VISIBILITY,
  TRANSPARENCY_MODES,
  latticeTableId,
  latticeTableFallbackTitle,
} from './lattice/domain/latticeProfile.js';
import {
  DEFAULT_LATTICE_INTERACTION_CONFIG,
  addWheelDelta,
  createPointerGesture,
  entryLatticeCoordinate,
  finishPointerGesture,
  keyboardDirection,
  latticeDestination,
  resolveWheelDestination,
  updatePointerGesture,
} from './lattice/controller/latticeNavigation.js';
import {
  createPlacementGesture,
  finishPlacementGesture,
  nudgePlacementByPixels,
  updatePlacementGesture,
} from './lattice/controller/latticePlacementAuthoring.js';
import {
  createPlacementResizeGesture,
  finishPlacementResizeGesture,
  updatePlacementResizeGesture,
} from './lattice/controller/latticePlacementResize.js';
import {
  PLACEMENT_LAYER_DIRECTIONS,
  movePlacementLayer,
  placementLayerAvailability,
  removePlacement,
  replacePlacementAsset,
} from './lattice/controller/latticePlacementLifecycle.js';
import {
  createCropFocusGesture,
  finishCropFocusGesture,
  nudgeCropFocus,
  restoreNativePlacement,
  setCropZoom,
  squareCropPlacement,
  updateCropFocusGesture,
} from './lattice/controller/latticePlacementCrop.js';
import { reframePlacementForMat } from './lattice/controller/latticePlacementMat.js';
import {
  createArtboardFramingGesture,
  finishArtboardFramingGesture,
  updateArtboardFramingGesture,
} from './lattice/controller/latticeArtboardFraming.js';
import LatticeTableRenderer from './lattice/rendering/LatticeTableRenderer.jsx';
import LatticeGridPlane from './lattice/rendering/LatticeGridPlane.jsx';
import {
  LATTICE_GEOMETRY_PRESETS,
  LATTICE_ARTBOARD_FITS,
  LATTICE_SURFACES,
  PROTOTYPE_START_GEOMETRY,
  clampLatticeArtboardOffset,
  latticeArtboardFramingBounds,
  projectCanonicalLatticeArtboard,
  projectPlacementRectangle,
} from './lattice/rendering/latticeGeometry.js';
import {
  ARTWORK_MAT_INSET_MAX,
  ARTWORK_MAT_PRESET_IDS,
  DEFAULT_ARTWORK_BACKING,
  DEFAULT_ARTWORK_MAT,
  normalizeArtworkBacking,
  normalizeArtworkMat,
  projectArtworkMat,
  resolveArtworkMatPreset,
} from './lattice/rendering/latticeMat.js';
import './latticeEnginePrototype.css';

const CONTROL_FIELDS = [
  ['deadZone', 'Dead zone', 0, 40, 1],
  ['commitThreshold', 'Commit threshold', 20, 240, 1],
  ['diagonalTolerance', 'Diagonal tolerance', 0, 1, 0.01],
  ['edgeResistance', 'Edge resistance', 0, 0.5, 0.01],
  ['wheelAccumulationThreshold', 'Wheel threshold', 20, 240, 1],
  ['wheelCooldown', 'Wheel cooldown', 0, 1500, 10],
  ['snapDuration', 'Snap duration', 0, 1000, 10],
  ['guideThreshold', 'Guide threshold', 1, 30, 1],
  ['guideReleaseThreshold', 'Guide release', 1, 50, 1],
  ['minimumArtworkPixels', 'Minimum artwork size', 16, 160, 1],
];
const CUSTOM_MAT_PRESET_ID = 'CUSTOM';

const interactiveChrome = (target) => target.closest('[data-lattice-chrome]');
const unmodifiedPrimaryPointer = (event) => event.button === 0
  && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

const FIXTURE_ASSET_IDS = Object.freeze({
  landscape: '42:0x1111111111111111111111111111111111111111:0x01',
  portrait: '42:0x2222222222222222222222222222222222222222:0x02',
  transparent: '42:0x3333333333333333333333333333333333333333:0x03',
});

const FIXTURE_MEDIA = Object.freeze({
  [FIXTURE_ASSET_IDS.landscape]: Object.freeze({
    src: '/assets/stage/backdrops/backdrop_moonpurple.webp',
    width: 4636,
    height: 2000,
    accessibleLabel: 'Landscape rendering fixture',
  }),
  [FIXTURE_ASSET_IDS.portrait]: Object.freeze({
    src: '/assets/ratio/3.webp',
    width: 2000,
    height: 2829,
    accessibleLabel: 'Portrait rendering fixture',
  }),
  [FIXTURE_ASSET_IDS.transparent]: Object.freeze({
    src: '/assets/actors/abyssal_eye/full.webp',
    width: 2000,
    height: 2000,
    accessibleLabel: 'Transparent rendering fixture',
  }),
});

function createFixturePlacements(transparencyMode) {
  const common = {
    crop: null,
    frameId: FRAME_IDS.NONE,
    visitorVisible: true,
  };
  return [
    {
      ...common,
      id: 'phase-2-landscape',
      stableAssetId: FIXTURE_ASSET_IDS.landscape,
      x: 0.46, y: 0.13, width: 0.4, height: 0.4 * (16 / 9) * (2000 / 4636),
      layer: 0,
      navigationOrder: 2,
      transparencyMode: TRANSPARENCY_MODES.AUTO,
    },
    {
      ...common,
      id: 'phase-2-portrait',
      stableAssetId: FIXTURE_ASSET_IDS.portrait,
      x: 0.14, y: 0.16, width: 0.22, height: 0.22 * (16 / 9) * (2829 / 2000),
      layer: 1,
      navigationOrder: 0,
      transparencyMode: TRANSPARENCY_MODES.PRESERVE_ALPHA,
    },
    {
      ...common,
      id: 'phase-2-transparent',
      stableAssetId: FIXTURE_ASSET_IDS.transparent,
      x: 0.35, y: 0.42, width: 0.27, height: 0.27 * (16 / 9),
      layer: 2,
      navigationOrder: 1,
      transparencyMode,
    },
  ];
}

const boundsFromPlacement = ({ x, y, width, height }) => ({ x, y, width, height });

const createDefaultPlacementBounds = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, boundsFromPlacement(placement)]),
);

const createDefaultPlacementCrops = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, placement.crop]),
);

const createDefaultArtworkMats = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, resolveArtworkMatPreset(ARTWORK_MAT_PRESET_IDS.NONE)]),
);

const createDefaultArtworkBackings = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, normalizeArtworkBacking(DEFAULT_ARTWORK_BACKING)]),
);

const createDefaultMatPresetIds = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, ARTWORK_MAT_PRESET_IDS.NONE]),
);

const createDefaultPlacementDefinitions = () => createFixturePlacements(TRANSPARENCY_MODES.AUTO);
const withoutRecordKey = (record, key) => Object.fromEntries(
  Object.entries(record).filter(([candidate]) => candidate !== key),
);

function applyPlacementAuthoring(placements, placementBounds, placementCrops, preview, cropPreview) {
  return placements.map((placement) => ({
    ...placement,
    ...(placementBounds[placement.id] || {}),
    ...(preview?.placementId === placement.id ? preview.bounds : {}),
    crop: cropPreview?.placementId === placement.id
      ? cropPreview.crop
      : placementCrops[placement.id] ?? null,
  }));
}

const createDefaultRenderPreview = () => ({
  geometry: { ...PROTOTYPE_START_GEOMETRY },
  surfaceId: LATTICE_SURFACES[0].id,
  title: '',
  subtitle: '',
  labelVisible: true,
  labelAnchor: 'top-left',
  labelOffset: { column: 0, row: 0 },
  transparencyMode: TRANSPARENCY_MODES.AUTO,
});

export default function LatticeEnginePrototype() {
  const viewportRef = useRef(null);
  const gestureRef = useRef(null);
  const activeRef = useRef(entryLatticeCoordinate());
  const configRef = useRef({ ...DEFAULT_LATTICE_INTERACTION_CONFIG });
  const snapTimerRef = useRef(null);
  const wheelResetTimerRef = useRef(null);
  const wheelAccumulatorRef = useRef({ x: 0, y: 0 });
  const wheelBlockedUntilRef = useRef(0);
  const settlingRef = useRef(false);
  const spaceHeldRef = useRef(false);

  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState(activeRef.current);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapping, setSnapping] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [config, setConfig] = useState(configRef.current);
  const [renderPreview, setRenderPreview] = useState(createDefaultRenderPreview);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [arrangeEnabled, setArrangeEnabled] = useState(false);
  const [selectedPlacementId, setSelectedPlacementId] = useState(null);
  const [placementDragging, setPlacementDragging] = useState(false);
  const [placementResizing, setPlacementResizing] = useState(false);
  const [placementDefinitions, setPlacementDefinitions] = useState(createDefaultPlacementDefinitions);
  const [placementBounds, setPlacementBounds] = useState(createDefaultPlacementBounds);
  const [placementCrops, setPlacementCrops] = useState(createDefaultPlacementCrops);
  const [artworkMats, setArtworkMats] = useState(createDefaultArtworkMats);
  const [artworkBackings, setArtworkBackings] = useState(createDefaultArtworkBackings);
  const [matPresetIds, setMatPresetIds] = useState(createDefaultMatPresetIds);
  const [placementPreview, setPlacementPreview] = useState(null);
  const [cropPreview, setCropPreview] = useState(null);
  const [cropEditPlacementId, setCropEditPlacementId] = useState(null);
  const [cropDragging, setCropDragging] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState([]);
  const [smartGuides, setSmartGuides] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [gridSnap, setGridSnap] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [framingDragging, setFramingDragging] = useState(false);
  const [framingOffset, setFramingOffset] = useState({ x: 0, y: 0 });
  const [framingPreview, setFramingPreview] = useState(null);
  const framingBounds = latticeArtboardFramingBounds(
    CANONICAL_LATTICE_ARTBOARD,
    dimensions,
    LATTICE_ARTBOARD_FITS.COVER,
  );
  const visibleFramingOffset = clampLatticeArtboardOffset(
    framingPreview || framingOffset,
    framingBounds,
  );
  const framing = {
    fit: LATTICE_ARTBOARD_FITS.COVER,
    offset: visibleFramingOffset,
  };
  const projectedArtboard = projectCanonicalLatticeArtboard(
    CANONICAL_LATTICE_ARTBOARD,
    dimensions,
    framing,
  );
  const centerPlacements = applyPlacementAuthoring(
    placementDefinitions.map((placement) => placement.id === 'phase-2-transparent'
      ? { ...placement, transparencyMode: renderPreview.transparencyMode }
      : placement),
    placementBounds,
    placementCrops,
    placementPreview,
    cropPreview,
  );
  const selectedPlacement = centerPlacements.find(({ id }) => id === selectedPlacementId) || null;
  const selectedMedia = selectedPlacement ? FIXTURE_MEDIA[selectedPlacement.stableAssetId] : null;
  const selectedMat = selectedPlacement ? artworkMats[selectedPlacement.id] || DEFAULT_ARTWORK_MAT : DEFAULT_ARTWORK_MAT;
  const selectedBacking = selectedPlacement ? artworkBackings[selectedPlacement.id] || DEFAULT_ARTWORK_BACKING : DEFAULT_ARTWORK_BACKING;
  const selectedLayerAvailability = selectedPlacement
    ? placementLayerAvailability(placementDefinitions, selectedPlacement.id)
    : { backward: false, forward: false };
  const selectedMaskRectangle = selectedPlacement
    ? projectArtworkMat(
      projectPlacementRectangle(selectedPlacement, CANONICAL_LATTICE_ARTBOARD, dimensions, framing),
      selectedMat,
    ).mediaOpeningRectangle
    : null;

  useEffect(() => {
    activeRef.current = active;
    if (active.x !== 0 || active.y !== 0) {
      setSelectedPlacementId(null);
      setCropEditPlacementId(null);
    }
  }, [active]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const resize = () => setDimensions({
      width: Math.max(1, viewport.clientWidth),
      height: Math.max(1, viewport.clientHeight),
    });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const editableTarget = (target) => target?.closest?.('input, textarea, select, [contenteditable="true"]');
    const pressSpace = (event) => {
      if (event.code !== 'Space' || editableTarget(event.target)) return;
      event.preventDefault();
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const releaseSpace = (event) => {
      if (event?.code && event.code !== 'Space') return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener('keydown', pressSpace);
    window.addEventListener('keyup', releaseSpace);
    window.addEventListener('blur', releaseSpace);
    return () => {
      window.removeEventListener('keydown', pressSpace);
      window.removeEventListener('keyup', releaseSpace);
      window.removeEventListener('blur', releaseSpace);
    };
  }, []);

  useEffect(() => {
    setFramingOffset((current) => {
      const bounded = clampLatticeArtboardOffset(current, framingBounds);
      return bounded.x === current.x && bounded.y === current.y ? current : bounded;
    });
  }, [framingBounds.x, framingBounds.y]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(snapTimerRef.current);
    window.clearTimeout(wheelResetTimerRef.current);
  }, []);

  const settle = useCallback((destination, offset = dragOffset) => {
    if (settlingRef.current) return;
    settlingRef.current = true;
    const duration = reducedMotion ? 0 : configRef.current.snapDuration;
    setDragOffset(offset);
    requestAnimationFrame(() => {
      activeRef.current = destination;
      setSnapping(true);
      setActive(destination);
      setDragOffset({ x: 0, y: 0 });
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = window.setTimeout(() => {
        settlingRef.current = false;
        setSnapping(false);
      }, duration);
    });
  }, [dragOffset, reducedMotion]);

  const finishGesture = useCallback((cancelled = false) => {
    const activeGesture = gestureRef.current;
    if (!activeGesture || settlingRef.current) return;
    gestureRef.current = null;

    if (activeGesture.kind === 'framing') {
      const result = finishArtboardFramingGesture(activeGesture.gesture, { cancelled });
      setFramingOffset(result.offset);
      setFramingPreview(null);
      setFramingDragging(false);
      return;
    }

    if (activeGesture.kind === 'crop') {
      const result = finishCropFocusGesture(activeGesture.gesture, { cancelled });
      if (result.committed) {
        setPlacementCrops((current) => ({
          ...current,
          [activeGesture.gesture.placementId]: result.crop,
        }));
      }
      setCropPreview(null);
      setCropDragging(false);
      return;
    }

    if (activeGesture.kind === 'placement' || activeGesture.kind === 'resize') {
      const result = activeGesture.kind === 'resize'
        ? finishPlacementResizeGesture(activeGesture.gesture, { cancelled })
        : finishPlacementGesture(activeGesture.gesture, { cancelled });
      if (result.committed) {
        setPlacementBounds((current) => ({
          ...current,
          [activeGesture.gesture.placementId]: result.bounds,
        }));
      }
      setPlacementPreview(null);
      setAlignmentGuides([]);
      setPlacementDragging(false);
      setPlacementResizing(false);
      return;
    }

    setGestureActive(false);
    if (!activeGesture.gesture.activated) {
      setSelectedPlacementId(null);
      setCropEditPlacementId(null);
      return;
    }
    const destination = cancelled
      ? { ...activeRef.current }
      : finishPointerGesture(activeGesture.gesture, activeRef.current, configRef.current);
    settle(destination, activeGesture.gesture.offset);
  }, [settle]);

  const handlePointerDown = (event) => {
    if (settlingRef.current || !unmodifiedPrimaryPointer(event) || interactiveChrome(event.target)) return;
    if (spaceHeldRef.current) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gestureRef.current = {
        kind: 'framing',
        captureTarget: event.currentTarget,
        pointerId: event.pointerId,
        gesture: createArtboardFramingGesture(
          visibleFramingOffset,
          { x: event.clientX, y: event.clientY },
          framingBounds,
        ),
      };
      viewportRef.current?.focus({ preventScroll: true });
      return;
    }
    gestureRef.current = {
      kind: 'navigation',
      gesture: createPointerGesture({ x: event.clientX, y: event.clientY }),
    };
    viewportRef.current?.focus({ preventScroll: true });
  };

  const handlePlacementPointerDown = (event, placement) => {
    if (event.target.closest?.('[data-resize-corner]')
      || spaceHeldRef.current || !arrangeEnabled || settlingRef.current || !unmodifiedPrimaryPointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    setSelectedPlacementId(placement.id);
    if (cropEditPlacementId === placement.id && placement.crop && FIXTURE_MEDIA[placement.stableAssetId]) {
      const cropMask = projectArtworkMat(
        projectPlacementRectangle(placement, CANONICAL_LATTICE_ARTBOARD, dimensions, framing),
        artworkMats[placement.id] || DEFAULT_ARTWORK_MAT,
      ).mediaOpeningRectangle;
      gestureRef.current = {
        kind: 'crop',
        captureTarget: event.currentTarget,
        pointerId: event.pointerId,
        gesture: createCropFocusGesture(
          placement,
          FIXTURE_MEDIA[placement.stableAssetId],
          cropMask,
          { x: event.clientX, y: event.clientY },
        ),
      };
      return;
    }
    setCropEditPlacementId(null);
    gestureRef.current = {
      kind: 'placement',
      captureTarget: event.currentTarget,
      pointerId: event.pointerId,
      gesture: createPlacementGesture(placement, { x: event.clientX, y: event.clientY }),
    };
  };

  const handlePlacementResizePointerDown = (event, placement, corner) => {
    if (spaceHeldRef.current || !arrangeEnabled || settlingRef.current || !unmodifiedPrimaryPointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedPlacementId(placement.id);
    setAlignmentGuides([]);
    gestureRef.current = {
      kind: 'resize',
      captureTarget: event.currentTarget,
      pointerId: event.pointerId,
      gesture: createPlacementResizeGesture(
        placement,
        corner,
        { x: event.clientX, y: event.clientY },
        projectedArtboard,
      ),
    };
  };

  const handlePointerMove = (event) => {
    if (!gestureRef.current || settlingRef.current) return;
    if (gestureRef.current.kind === 'framing') {
      const next = updateArtboardFramingGesture(
        gestureRef.current.gesture,
        { x: event.clientX, y: event.clientY },
        framingBounds,
        configRef.current.deadZone,
      );
      gestureRef.current = { ...gestureRef.current, gesture: next };
      if (next.activated) {
        setFramingDragging(true);
        setFramingPreview(next.previewOffset);
      }
      return;
    }
    if (gestureRef.current.kind === 'crop') {
      const next = updateCropFocusGesture(
        gestureRef.current.gesture,
        { x: event.clientX, y: event.clientY },
        configRef.current.deadZone,
      );
      gestureRef.current = { ...gestureRef.current, gesture: next };
      if (next.activated) {
        setCropDragging(true);
        setCropPreview({ placementId: next.placementId, crop: next.previewCrop });
      }
      return;
    }
    if (gestureRef.current.kind === 'resize') {
      const next = updatePlacementResizeGesture(
        gestureRef.current.gesture,
        { x: event.clientX, y: event.clientY },
        projectedArtboard,
        configRef.current.deadZone,
        configRef.current.minimumArtworkPixels,
        {
          smartGuides,
          gridSnap,
          bypass: event.altKey,
          geometry: renderPreview.geometry,
          otherPlacements: centerPlacements,
          guideThreshold: configRef.current.guideThreshold,
          guideReleaseThreshold: configRef.current.guideReleaseThreshold,
        },
      );
      gestureRef.current = { ...gestureRef.current, gesture: next };
      if (next.activated) {
        setPlacementResizing(true);
        setPlacementPreview({ placementId: next.placementId, bounds: next.previewBounds });
        setAlignmentGuides(next.guides);
      }
      return;
    }
    if (gestureRef.current.kind === 'placement') {
      const next = updatePlacementGesture(
        gestureRef.current.gesture,
        { x: event.clientX, y: event.clientY },
        projectedArtboard,
        configRef.current.deadZone,
        {
          smartGuides,
          gridSnap,
          bypass: event.altKey,
          geometry: renderPreview.geometry,
          otherPlacements: centerPlacements,
          guideThreshold: configRef.current.guideThreshold,
          guideReleaseThreshold: configRef.current.guideReleaseThreshold,
        },
      );
      gestureRef.current = { ...gestureRef.current, gesture: next };
      if (next.activated) {
        setPlacementDragging(true);
        setPlacementPreview({ placementId: next.placementId, bounds: next.previewBounds });
        setAlignmentGuides(next.guides);
      }
      return;
    }

    const previousActivated = gestureRef.current.gesture.activated;
    const next = updatePointerGesture(
      gestureRef.current.gesture,
      { x: event.clientX, y: event.clientY },
      activeRef.current,
      configRef.current,
    );
    gestureRef.current = { ...gestureRef.current, gesture: next };
    if (next.activated && !previousActivated) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setGestureActive(true);
    }
    setDragOffset(next.offset);
  };

  const handlePointerUp = (event) => {
    if (!gestureRef.current) return;
    const captureTarget = gestureRef.current.captureTarget || event.currentTarget;
    finishGesture(false);
    if (captureTarget.hasPointerCapture?.(event.pointerId)) {
      captureTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (settlingRef.current || gestureRef.current || performance.now() < wheelBlockedUntilRef.current) return;
    wheelAccumulatorRef.current = addWheelDelta(wheelAccumulatorRef.current, {
      x: event.deltaX,
      y: event.deltaY,
    });
    window.clearTimeout(wheelResetTimerRef.current);
    wheelResetTimerRef.current = window.setTimeout(() => {
      wheelAccumulatorRef.current = { x: 0, y: 0 };
    }, configRef.current.wheelCooldown);
    const destination = resolveWheelDestination(
      wheelAccumulatorRef.current,
      activeRef.current,
      configRef.current,
    );
    if (!destination) return;
    wheelAccumulatorRef.current = { x: 0, y: 0 };
    wheelBlockedUntilRef.current = performance.now() + configRef.current.wheelCooldown;
    settle(destination, { x: 0, y: 0 });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && gestureRef.current && !settlingRef.current) {
      event.preventDefault();
      finishGesture(true);
      return;
    }
    if (settlingRef.current || gestureRef.current) return;
    const direction = keyboardDirection(event.key);
    const focusedPlacementId = event.target.closest?.('[data-placement-id]')?.dataset.placementId
      || event.target.closest?.('[data-crop-placement-id]')?.dataset.cropPlacementId;
    if (arrangeEnabled && direction && cropEditPlacementId === selectedPlacementId
      && focusedPlacementId === selectedPlacementId && selectedPlacement?.crop
      && selectedMedia && selectedMaskRectangle) {
      event.preventDefault();
      const distance = event.shiftKey ? 0.05 : 0.01;
      const crop = nudgeCropFocus(
        selectedPlacement.crop,
        selectedMedia,
        selectedMaskRectangle,
        { x: direction.x * distance, y: direction.y * distance },
      );
      setPlacementCrops((current) => ({ ...current, [selectedPlacement.id]: crop }));
      return;
    }
    if (arrangeEnabled && direction && focusedPlacementId === selectedPlacementId) {
      const placement = centerPlacements.find(({ id }) => id === selectedPlacementId);
      if (!placement) return;
      event.preventDefault();
      const distance = event.shiftKey ? 10 : 1;
      const bounds = nudgePlacementByPixels(
        placement,
        { x: direction.x * distance, y: direction.y * distance },
        projectedArtboard,
      );
      setPlacementBounds((current) => ({ ...current, [placement.id]: bounds }));
      return;
    }
    if (event.key === 'Escape' && cropEditPlacementId) {
      event.preventDefault();
      setCropEditPlacementId(null);
      return;
    }
    if (event.key === 'Escape' && selectedPlacementId) {
      event.preventDefault();
      setSelectedPlacementId(null);
      viewportRef.current?.focus({ preventScroll: true });
      return;
    }
    const destination = event.key === 'Home'
      ? entryLatticeCoordinate()
      : direction && latticeDestination(activeRef.current, direction);
    if (!destination) return;
    event.preventDefault();
    settle(destination, { x: 0, y: 0 });
  };

  const stageX = -((active.x + 1) * dimensions.width) + dragOffset.x;
  const stageY = -((active.y + 1) * dimensions.height) + dragOffset.y;
  const snapDuration = reducedMotion ? 0 : config.snapDuration;

  const handlePlacementFocus = (placementId) => {
    if (cropEditPlacementId && cropEditPlacementId !== placementId) setCropEditPlacementId(null);
    setSelectedPlacementId(placementId);
  };

  const normalizedBoundsFromRectangle = (rectangle) => ({
    x: (rectangle.left - projectedArtboard.left) / projectedArtboard.width,
    y: (rectangle.top - projectedArtboard.top) / projectedArtboard.height,
    width: rectangle.width / projectedArtboard.width,
    height: rectangle.height / projectedArtboard.height,
  });

  const wrapContentBoundsInMat = (placement, contentBounds, mat) => {
    if (!mat.enabled) return contentBounds;
    const contentPlacement = { ...placement, ...contentBounds };
    return reframePlacementForMat(
      projectPlacementRectangle(
        contentPlacement,
        CANONICAL_LATTICE_ARTBOARD,
        dimensions,
        framing,
      ),
      projectedArtboard,
      DEFAULT_ARTWORK_MAT,
      mat,
    );
  };

  const applySquareCrop = () => {
    if (!selectedPlacement || !selectedMedia || !selectedMaskRectangle) return;
    const contentPlacement = {
      ...selectedPlacement,
      ...normalizedBoundsFromRectangle(selectedMaskRectangle),
    };
    const result = squareCropPlacement(contentPlacement, projectedArtboard);
    const bounds = wrapContentBoundsInMat(selectedPlacement, result.bounds, selectedMat);
    setPlacementBounds((current) => ({ ...current, [selectedPlacement.id]: bounds }));
    setPlacementCrops((current) => ({ ...current, [selectedPlacement.id]: result.crop }));
    setCropEditPlacementId(selectedPlacement.id);
    setPlacementPreview(null);
    setCropPreview(null);
  };

  const removeSelectedCrop = () => {
    if (!selectedPlacement?.crop || !selectedMedia || !selectedMaskRectangle) return;
    const contentPlacement = {
      ...selectedPlacement,
      ...normalizedBoundsFromRectangle(selectedMaskRectangle),
    };
    const nativeBounds = restoreNativePlacement(contentPlacement, selectedMedia, projectedArtboard);
    const bounds = wrapContentBoundsInMat(selectedPlacement, nativeBounds, selectedMat);
    setPlacementBounds((current) => ({ ...current, [selectedPlacement.id]: bounds }));
    setPlacementCrops((current) => ({ ...current, [selectedPlacement.id]: null }));
    setCropEditPlacementId(null);
    setCropPreview(null);
  };

  const updateSelectedCropZoom = (zoom) => {
    if (!selectedPlacement?.crop || !selectedMedia || !selectedMaskRectangle) return;
    const crop = setCropZoom(selectedPlacement.crop, selectedMedia, selectedMaskRectangle, zoom);
    setPlacementCrops((current) => ({ ...current, [selectedPlacement.id]: crop }));
  };

  const applySelectedMat = (nextValue, presetId = CUSTOM_MAT_PRESET_ID) => {
    if (!selectedPlacement) return;
    const nextMat = normalizeArtworkMat(nextValue);
    const placementRectangle = projectPlacementRectangle(
      selectedPlacement,
      CANONICAL_LATTICE_ARTBOARD,
      dimensions,
      framing,
    );
    const bounds = reframePlacementForMat(
      placementRectangle,
      projectedArtboard,
      selectedMat,
      nextMat,
    );
    setPlacementBounds((current) => ({ ...current, [selectedPlacement.id]: bounds }));
    setArtworkMats((current) => ({ ...current, [selectedPlacement.id]: nextMat }));
    setMatPresetIds((current) => ({ ...current, [selectedPlacement.id]: presetId }));
    setPlacementPreview(null);
    setAlignmentGuides([]);
  };

  const updateSelectedMatInset = (edge, amount) => {
    if (!selectedPlacement || !Number.isFinite(amount)) return;
    applySelectedMat({
      ...selectedMat,
      inset: { ...selectedMat.inset, [edge]: amount },
    });
  };

  const replaceSelectedArtwork = (stableAssetId) => {
    if (!selectedPlacement || selectedPlacement.stableAssetId === stableAssetId) return;
    setPlacementDefinitions((current) => replacePlacementAsset(current, selectedPlacement.id, stableAssetId));
    setPlacementCrops((current) => ({ ...current, [selectedPlacement.id]: null }));
    setCropPreview(null);
    setCropEditPlacementId(null);
    setAlignmentGuides([]);
  };

  const moveSelectedArtworkLayer = (direction) => {
    if (!selectedPlacement) return;
    setPlacementDefinitions((current) => movePlacementLayer(current, selectedPlacement.id, direction));
    setAlignmentGuides([]);
  };

  const removeSelectedArtwork = () => {
    if (!selectedPlacement) return;
    const placementId = selectedPlacement.id;
    setPlacementDefinitions((current) => removePlacement(current, placementId));
    setPlacementBounds((current) => withoutRecordKey(current, placementId));
    setPlacementCrops((current) => withoutRecordKey(current, placementId));
    setArtworkMats((current) => withoutRecordKey(current, placementId));
    setArtworkBackings((current) => withoutRecordKey(current, placementId));
    setMatPresetIds((current) => withoutRecordKey(current, placementId));
    setPlacementPreview(null);
    setCropPreview(null);
    setCropEditPlacementId(null);
    setAlignmentGuides([]);
    setSelectedPlacementId(null);
    viewportRef.current?.focus({ preventScroll: true });
  };

  return (
    <main className="lattice-engine-shell">
      <section
        ref={viewportRef}
        className={`lattice-engine-viewport${gestureActive ? ' is-dragging' : ''}${arrangeEnabled ? ' is-arranging' : ''}${placementDragging ? ' is-placement-dragging' : ''}${placementResizing ? ' is-placement-resizing' : ''}${cropDragging ? ' is-crop-dragging' : ''}${spaceHeld ? ' is-framing-ready' : ''}${framingDragging ? ' is-framing' : ''}`}
        tabIndex={0}
        aria-label="Lattice navigation engine prototype"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => finishGesture(true)}
        onLostPointerCapture={() => finishGesture(true)}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      >
        <LatticeGridPlane
          artboard={CANONICAL_LATTICE_ARTBOARD}
          className={`lattice-engine-stage${snapping ? ' is-snapping' : ''}`}
          geometry={renderPreview.geometry}
          framing={framing}
          gridVisible={gridVisible}
          stageOrigin={{ x: dimensions.width, y: dimensions.height }}
          style={{
            width: dimensions.width * 3,
            height: dimensions.height * 3,
            transform: `translate3d(${stageX}px, ${stageY}px, 0)`,
            '--lattice-snap-duration': `${snapDuration}ms`,
            '--lattice-cell-width': `${dimensions.width}px`,
            '--lattice-cell-height': `${dimensions.height}px`,
          }}
          surfaceId={renderPreview.surfaceId}
          viewport={dimensions}
        >
          {LATTICE_COORDINATES.map((coordinate) => {
            const isActive = coordinate.x === active.x && coordinate.y === active.y;
            const isAuthoredTable = coordinate.x === 0 && coordinate.y === 0;
            const table = {
              id: latticeTableId(coordinate),
              coordinate,
              title: isAuthoredTable ? renderPreview.title : '',
              subtitle: isAuthoredTable ? renderPreview.subtitle : '',
              labelVisible: isAuthoredTable ? renderPreview.labelVisible : true,
              labelAnchor: isAuthoredTable ? renderPreview.labelAnchor : 'top-left',
              labelOffset: isAuthoredTable ? renderPreview.labelOffset : { column: 0, row: 0 },
              visibility: TABLE_VISIBILITY.PUBLIC,
              placements: isAuthoredTable
                ? centerPlacements
                : [],
            };
            return (
              <LatticeTableRenderer
                active={isActive}
                alignmentGuides={isActive && isAuthoredTable ? alignmentGuides : []}
                arrangeEnabled={arrangeEnabled && isActive && isAuthoredTable}
                artboard={CANONICAL_LATTICE_ARTBOARD}
                artworkBackingsByPlacementId={artworkBackings}
                artworkMatsByPlacementId={artworkMats}
                assetsByStableId={FIXTURE_MEDIA}
                cropEditingPlacementId={isActive ? cropEditPlacementId : null}
                geometry={renderPreview.geometry}
                framing={framing}
                hidden={!isActive}
                key={`${coordinate.x}:${coordinate.y}`}
                positionStyle={{
                  left: (coordinate.x + 1) * dimensions.width,
                  top: (coordinate.y + 1) * dimensions.height,
                  width: dimensions.width,
                  height: dimensions.height,
                }}
                onPlacementFocus={handlePlacementFocus}
                onPlacementPointerDown={handlePlacementPointerDown}
                onPlacementResizePointerDown={handlePlacementResizePointerDown}
                selectedPlacementId={isActive ? selectedPlacementId : null}
                table={table}
                viewport={dimensions}
              />
            );
          })}
        </LatticeGridPlane>
      </section>

      <aside className="lattice-engine-readout" data-lattice-chrome>
        <p>LATTICE AUTHORING / PHASE 4 / SLICE 2H</p>
        <p>ACTIVE {active.x}:{active.y} / {latticeTableFallbackTitle(active)}</p>
        <p>GRID {renderPreview.geometry.columns} × {renderPreview.geometry.rows} / {renderPreview.surfaceId.toUpperCase()}</p>
        <p>{snapping ? 'SETTLING' : framingDragging ? 'FRAMING' : cropDragging ? 'CROPPING' : placementResizing ? 'RESIZING' : placementDragging ? 'ARRANGING' : gestureActive ? 'DIRECT MANIPULATION' : spaceHeld ? 'FRAME READY' : cropEditPlacementId ? 'CROP EDIT' : arrangeEnabled ? 'ARRANGE READY' : 'READY'}</p>
      </aside>

      <details className="lattice-engine-controls" data-lattice-chrome>
        <summary>ENGINE / DEV</summary>
        <div className="lattice-engine-control-list">
          <fieldset>
            <legend>RENDER</legend>
            <label className="is-check"><span>Arrange</span><input type="checkbox" checked={arrangeEnabled} onChange={(event) => {
              setArrangeEnabled(event.target.checked);
              setSelectedPlacementId(null);
              setPlacementPreview(null);
              setAlignmentGuides([]);
              setCropEditPlacementId(null);
              setCropPreview(null);
            }} /></label>
            <label className="is-check"><span>Smart guides</span><input type="checkbox" checked={smartGuides} onChange={(event) => {
              setSmartGuides(event.target.checked);
              setAlignmentGuides([]);
            }} /></label>
            <label className="is-check"><span>Grid visible</span><input type="checkbox" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} /></label>
            <label className="is-check"><span>Grid snap</span><input type="checkbox" checked={gridSnap} onChange={(event) => {
              setGridSnap(event.target.checked);
              setAlignmentGuides([]);
            }} /></label>
            <label><span>Geometry</span><select value={LATTICE_GEOMETRY_PRESETS.find(({ geometry }) => geometry.columns === renderPreview.geometry.columns && geometry.rows === renderPreview.geometry.rows)?.id || 'custom'} onChange={(event) => {
              const preset = LATTICE_GEOMETRY_PRESETS.find(({ id }) => id === event.target.value);
              if (preset) setRenderPreview((current) => ({ ...current, geometry: { ...preset.geometry } }));
            }}>
              {LATTICE_GEOMETRY_PRESETS.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
              <option value="custom" disabled>CUSTOM</option>
            </select></label>
            <label><span>Surface</span><select value={renderPreview.surfaceId} onChange={(event) => setRenderPreview((current) => ({ ...current, surfaceId: event.target.value }))}>
              {LATTICE_SURFACES.map((surface) => <option value={surface.id} key={surface.id}>{surface.label}</option>)}
            </select></label>
            <label><span>Transparency</span><select value={renderPreview.transparencyMode} onChange={(event) => setRenderPreview((current) => ({ ...current, transparencyMode: event.target.value }))}>
              {Object.values(TRANSPARENCY_MODES).map((mode) => <option value={mode} key={mode}>{mode}</option>)}
            </select></label>
            <label><span>Mat preset</span><select disabled={!selectedPlacement} value={selectedPlacement ? matPresetIds[selectedPlacement.id] || ARTWORK_MAT_PRESET_IDS.NONE : ARTWORK_MAT_PRESET_IDS.NONE} onChange={(event) => {
              if (!selectedPlacement) return;
              applySelectedMat(resolveArtworkMatPreset(event.target.value), event.target.value);
            }}>
              <option value={ARTWORK_MAT_PRESET_IDS.NONE}>NONE</option>
              <option value={ARTWORK_MAT_PRESET_IDS.DOSSIER}>DOSSIER</option>
              <option value={ARTWORK_MAT_PRESET_IDS.CAPTION}>POLAROID / CAPTION</option>
              <option value={CUSTOM_MAT_PRESET_ID} disabled>CUSTOM</option>
            </select></label>
            <label className="is-check"><span>Mat enabled</span><input type="checkbox" disabled={!selectedPlacement} checked={Boolean(selectedPlacement && selectedMat.enabled)} onChange={(event) => applySelectedMat({ ...selectedMat, enabled: event.target.checked })} /></label>
            <label><span>Mat color</span><input type="color" disabled={!selectedPlacement || !selectedMat.enabled} value={selectedMat.color} onChange={(event) => {
              if (!selectedPlacement) return;
              const nextMat = normalizeArtworkMat({ ...selectedMat, color: event.target.value });
              setArtworkMats((current) => ({ ...current, [selectedPlacement.id]: nextMat }));
              setMatPresetIds((current) => ({ ...current, [selectedPlacement.id]: CUSTOM_MAT_PRESET_ID }));
            }} /></label>
            <label className="is-check"><span>Artwork background</span><input type="checkbox" disabled={!selectedPlacement} checked={Boolean(selectedPlacement && selectedBacking.enabled)} onChange={(event) => {
              if (!selectedPlacement) return;
              const nextBacking = normalizeArtworkBacking({ ...selectedBacking, enabled: event.target.checked });
              setArtworkBackings((current) => ({ ...current, [selectedPlacement.id]: nextBacking }));
            }} /></label>
            <label><span>Background color</span><input type="color" disabled={!selectedPlacement || !selectedBacking.enabled} value={selectedBacking.color} onChange={(event) => {
              if (!selectedPlacement) return;
              const nextBacking = normalizeArtworkBacking({ ...selectedBacking, color: event.target.value });
              setArtworkBackings((current) => ({ ...current, [selectedPlacement.id]: nextBacking }));
            }} /></label>
            {['top', 'right', 'bottom', 'left'].map((edge) => <label key={edge}><span>Mat {edge}</span><input type="number" min="0" max={ARTWORK_MAT_INSET_MAX} step="0.01" disabled={!selectedPlacement || !selectedMat.enabled} value={selectedMat.inset[edge]} onChange={(event) => updateSelectedMatInset(edge, Number(event.target.value))} /></label>)}
            <label><span>Replace with</span><select disabled={!selectedPlacement} value={selectedPlacement?.stableAssetId || ''} onChange={(event) => replaceSelectedArtwork(event.target.value)}>
              {!selectedPlacement && <option value="">SELECT ARTWORK</option>}
              {Object.entries(FIXTURE_MEDIA).map(([stableAssetId, media]) => <option value={stableAssetId} key={stableAssetId}>{media.accessibleLabel.replace(' rendering fixture', '').toUpperCase()}</option>)}
            </select></label>
            <button type="button" disabled={!selectedLayerAvailability.backward} onClick={() => moveSelectedArtworkLayer(PLACEMENT_LAYER_DIRECTIONS.BACKWARD)}>SEND BACKWARD</button>
            <button type="button" disabled={!selectedLayerAvailability.forward} onClick={() => moveSelectedArtworkLayer(PLACEMENT_LAYER_DIRECTIONS.FORWARD)}>BRING FORWARD</button>
            <button type="button" disabled={!selectedPlacement} onClick={removeSelectedArtwork}>REMOVE PLACEMENT</button>
            <button type="button" disabled={!selectedPlacement || Boolean(selectedPlacement.crop)} onClick={applySquareCrop}>SQUARE CROP</button>
            <button type="button" disabled={!selectedPlacement?.crop} onClick={() => setCropEditPlacementId((current) => current === selectedPlacementId ? null : selectedPlacementId)}>{cropEditPlacementId === selectedPlacementId ? 'DONE CROP' : 'EDIT CROP'}</button>
            <label><span>CROP ZOOM {selectedPlacement?.crop?.zoom?.toFixed(2) || '1.00'}×</span><input type="range" min="1" max="4" step="0.05" disabled={!selectedPlacement?.crop} value={selectedPlacement?.crop?.zoom || 1} onChange={(event) => updateSelectedCropZoom(Number(event.target.value))} /></label>
            <button type="button" disabled={!selectedPlacement?.crop} onClick={removeSelectedCrop}>REMOVE CROP</button>
            <label className="is-wide"><span>Title</span><input type="text" maxLength="80" placeholder="EMPTY / FALLBACK" value={renderPreview.title} onChange={(event) => setRenderPreview((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="is-wide"><span>Subtitle</span><input type="text" maxLength="120" placeholder="OPTIONAL" value={renderPreview.subtitle} onChange={(event) => setRenderPreview((current) => ({ ...current, subtitle: event.target.value }))} /></label>
            <label><span>Anchor</span><select value={renderPreview.labelAnchor} onChange={(event) => setRenderPreview((current) => ({ ...current, labelAnchor: event.target.value }))}>
              {TABLE_LABEL_ANCHORS.map((anchor) => <option value={anchor} key={anchor}>{anchor.toUpperCase()}</option>)}
            </select></label>
            <label><span>Offset X</span><input type="number" min="-2" max="2" step="1" value={renderPreview.labelOffset.column} onChange={(event) => {
              const column = Math.min(2, Math.max(-2, Number(event.target.value)));
              if (Number.isSafeInteger(column)) setRenderPreview((current) => ({ ...current, labelOffset: { ...current.labelOffset, column } }));
            }} /></label>
            <label><span>Offset Y</span><input type="number" min="-2" max="2" step="1" value={renderPreview.labelOffset.row} onChange={(event) => {
              const row = Math.min(2, Math.max(-2, Number(event.target.value)));
              if (Number.isSafeInteger(row)) setRenderPreview((current) => ({ ...current, labelOffset: { ...current.labelOffset, row } }));
            }} /></label>
            <label className="is-check"><span>Label visible</span><input type="checkbox" checked={renderPreview.labelVisible} onChange={(event) => setRenderPreview((current) => ({ ...current, labelVisible: event.target.checked }))} /></label>
            <button type="button" onClick={() => {
              setRenderPreview(createDefaultRenderPreview());
              setPlacementDefinitions(createDefaultPlacementDefinitions());
              setPlacementBounds(createDefaultPlacementBounds());
              setPlacementCrops(createDefaultPlacementCrops());
              setArtworkMats(createDefaultArtworkMats());
              setArtworkBackings(createDefaultArtworkBackings());
              setMatPresetIds(createDefaultMatPresetIds());
              setPlacementPreview(null);
              setCropPreview(null);
              setCropEditPlacementId(null);
              setAlignmentGuides([]);
              setSelectedPlacementId(null);
              setFramingOffset({ x: 0, y: 0 });
            }}>RESET RENDER</button>
          </fieldset>
          <fieldset>
            <legend>FEEL</legend>
            {CONTROL_FIELDS.map(([key, label, min, max, step]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={config[key]}
                  onChange={(event) => {
                    const nextValue = Math.min(max, Math.max(min, Number(event.target.value)));
                    setConfig((current) => ({ ...current, [key]: Number.isFinite(nextValue) ? nextValue : current[key] }));
                  }}
                />
              </label>
            ))}
            <button type="button" onClick={() => setConfig({ ...DEFAULT_LATTICE_INTERACTION_CONFIG })}>RESET FEEL</button>
          </fieldset>
        </div>
      </details>
    </main>
  );
}
