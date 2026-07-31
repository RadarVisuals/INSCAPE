import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./LatticeProductionMovementLayer.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeProductionMovementLayer.css', import.meta.url), 'utf8');
const rackStyles = readFileSync(new URL('../../public/menus/rackMenu.css', import.meta.url), 'utf8');

test('owner movement controls derive every rectangle from the accepted Phase 3 projection path', () => {
  assert.match(source, /createLatticeProductionTableRenderModel/);
  assert.match(source, /projectLatticeProductionViewport/);
  assert.match(source, /projectLatticeProductionPlacement/);
  assert.match(source, /ResizeObserver/);
  assert.match(source, /event\.clientX - bounds\.left/);
  assert.match(source, /event\.clientY - bounds\.top/);
  assert.doesNotMatch(source, /clientWidth\s*\/\s*32|clientHeight\s*\/\s*18|getBoundingClientRect\(\).*\/\s*32/su);
});

test('pointer ownership is captured at placement-originated pointer down and never delegated to navigation', () => {
  assert.match(source, /event\.currentTarget\.setPointerCapture\(event\.pointerId\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /onLostPointerCapture=\{cancelGesture\}/);
  assert.match(source, /event\.target\.closest\?\.\('\[data-lattice-placement-control\]'\)/);
  assert.match(source, /data-placement-id=\{placement\.id\}/);
  assert.match(source, /data-resize-corner=\{corner\}/);
  assert.match(source, /<span>\{locked \? 'LOCKED' : 'MOVE'\}<\/span>/);
  assert.match(source, /emptyActivationBlockedUntilRef\.current = performance\.now\(\) \+ 250/);
  assert.match(source, /performance\.now\(\) < emptyActivationBlockedUntilRef\.current/);
});

test('visible hit testing uses public placements, canonical layers, and deterministic keyboard order', () => {
  assert.match(source, /filter\(\(placement\) => placement\.visibility === 'PUBLIC'\)/);
  assert.match(source, /left\.navigationOrder - right\.navigationOrder \|\| left\.id\.localeCompare\(right\.id\)/);
  assert.match(source, /createLatticeProductionLayerRanks/);
  assert.match(source, /zIndex: layerRanks\.get\(placement\.id\)/);
  assert.match(source, /aria-disabled=\{locked \|\| Boolean\(cropSession\) \|\| undefined\}/);
  assert.match(source, /Locked placement/);
  assert.match(styles, /pointer-events: none/);
  assert.match(styles, /\.lattice-production-movement-control[^}]*pointer-events: auto/su);
});

test('public unlocked placements expose one ordered production context menu without layer shortcuts', () => {
  assert.match(source, /latticeProductionLayerOperationAvailability/);
  assert.match(source, /latticeProductionLayerTopologySnapshot\(acceptedTable\)/);
  const layerActions = source.slice(source.indexOf('const LAYER_ACTIONS'), source.indexOf('function viewportOf'));
  ["OPERATIONS.BACK, label: 'Layer / Send to back'", "OPERATIONS.BACKWARD, label: 'Layer / Move backward'",
    "OPERATIONS.FORWARD, label: 'Layer / Move forward'", "OPERATIONS.FRONT, label: 'Layer / Bring to front'"]
    .reduce((offset, value) => {
      const next = layerActions.indexOf(value, offset);
      assert.ok(next >= offset, `${value} must retain layer-action order`);
      return next + value.length;
    }, 0);
  assert.match(source, /onContextMenu=\{\(event\) => openPlacementContextMenu/);
  assert.match(source, /event\.key === 'ContextMenu'/);
  assert.match(source, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(source, /createPortal/);
  assert.match(source, /<RackMenu/);
  assert.match(source, /disabled: !availability\[action\.id\]/);
  assert.match(source, /command\.startsWith\('layer:'\)/);
  assert.match(source, /restoreFocus\(controlKey\(placementId\)\)/);
  assert.doesNotMatch(source, /event\.key\s*===\s*['"](?:PageUp|PageDown|Home|End|\[|\])['"]/u);
  assert.doesNotMatch(source, /role="toolbar"/u);
  assert.match(source, /className="lattice-production-placement-context-menu"/);
  assert.match(rackStyles, /position:\s*fixed/);
  assert.match(rackStyles, /pointer-events:\s*auto/);
  assert.match(rackStyles, /width:\s*min\(238px, calc\(100vw - 16px\)\)/);
  assert.match(rackStyles, /grid-template-columns:\s*12px minmax\(0, 1fr\) 10px/);
  assert.match(rackStyles, /box-shadow:\s*inset 3px 0 var\(--rack-menu-ink\)/);
  assert.match(rackStyles, /width:\s*3px;[^}]*height:\s*3px;/s);
  assert.match(rackStyles, /var\(--lattice-menu-panel,/);
  assert.match(rackStyles, /var\(--lattice-menu-ink,/);
  assert.doesNotMatch(rackStyles, /color-destructive/);
  assert.doesNotMatch(rackStyles, /height:\s*0/);
});

test('context menu remains viewport anchored outside the transformed stage and restores placement focus', () => {
  assert.match(source, /event\.clientX/);
  assert.match(source, /control\?\.getBoundingClientRect/);
  assert.match(source, /document\.querySelector\('\.owner-lattice-shell'\) \|\| document\.body/);
  assert.match(source, /returnFocus=\{contextMenu\.returnFocus\}/);
  assert.doesNotMatch(source, /latticeProductionPlacementToolbarDock/);
  assert.doesNotMatch(styles, /lattice-production-placement-toolbar/u);
});

test('keyboard movement is one-cell, non-repeating, bounded, and isolated from table navigation', () => {
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /if \(event\.repeat\) return/);
  assert.match(source, /nudgeLatticeProductionPlacementGeometry/);
  assert.match(source, /nudgeLatticeProductionResizeGeometry/);
  assert.match(source, /event\.key === 'Escape'/);
});

test('multi-selection moves and resizes as one bounded atomic group while crop remains primary-only', () => {
  assert.match(source, /selectedPlacementSet\.has\(placementId\) && selectedPlacementSet\.size > 1/);
  assert.match(source, /createLatticeProductionGroupMovementRequest/);
  assert.match(source, /clampLatticeProductionGroupDelta/);
  assert.match(source, /kind: 'group-move'/);
  assert.match(source, /onCommitMoveGroup\?\.\(groupRequest\)/);
  assert.match(source, /if \(corner \|\| !selectedPlacementSet\.has\(placementId\)\) setSelectedPlacementId/);
  assert.match(source, /createLatticeProductionGroupResizeGesture/);
  assert.match(source, /kind: 'group-resize'/);
  assert.match(source, /onCommitResizeGroup\?\.\(/);
  assert.match(source, /Resize selected placements from/);
  assert.match(styles, /\.lattice-production-group-resize-control[^}]*pointer-events:\s*none/su);
});

test('empty ARRANGE canvas owns marquee selection without stealing placement, crop, or Space-pan gestures', () => {
  assert.match(source, /event\.target === event\.currentTarget && event\.button === 0 && !event\.altKey/);
  assert.match(source, /kind: 'marquee'/);
  assert.match(source, /MARQUEE_ACTIVATION_DISTANCE/);
  assert.match(source, /latticeMarqueeRectangle/);
  assert.match(source, /latticeMarqueeIntersects/);
  assert.match(source, /LATTICE_MARQUEE_SELECTION_MODES\.TOGGLE/);
  assert.match(source, /LATTICE_MARQUEE_SELECTION_MODES\.ADD/);
  assert.match(source, /onSelectedPlacementsChange\?\.\(/);
  assert.match(source, /marqueeSession\?\.activated/);
  assert.match(source, /const primary = selected && selectedPlacementId === placement\.id/);
  assert.match(styles, /\.lattice-production-selection-marquee[^}]*pointer-events:\s*none/su);
});

test('selected unlocked placements expose four accessible resize handles and context-command-only removal', () => {
  assert.match(source, /LATTICE_PRODUCTION_RESIZE_CORNERS\.map/);
  assert.match(source, /Resize placement from/);
  assert.match(source, /\{ id: 'remove', label: 'Remove' \}/);
  assert.match(source, /command === 'remove'/);
  assert.doesNotMatch(source, /event\.key === ['"](?:Delete|Backspace)['"]/);
  assert.match(source, /placements\.find\(\(placement\) => !removalIds\.includes\(placement\.id\)\)/);
  assert.match(source, /onReturnFocus/);
  assert.match(source, /onCommitRemoveGroup\?\.\(/);
  assert.match(source, /selectedPlacementSet\.has\(placementId\) && selectedPlacementSet\.size > 1/);
});

test('explicit crop mode owns pan and zoom with accessible DONE, CANCEL, and NATIVE FIT controls', () => {
  assert.match(source, /Crop placement:/);
  assert.match(source, /\{ id: 'crop', label: 'Crop' \}/);
  assert.match(source, /data-lattice-crop-surface/);
  assert.match(source, /aria-describedby=\{`lattice-crop-instructions-/);
  assert.match(source, /type="range"/);
  assert.match(source, /event\.target\.closest\?\.\('input\[type="range"\]'\)/);
  assert.match(source, /LATTICE_PRODUCTION_CROP_MIN_ZOOM/);
  assert.match(source, /LATTICE_PRODUCTION_CROP_MAX_ZOOM/);
  assert.match(source, />NATIVE FIT<\/button>/);
  assert.match(source, />CANCEL<\/button>/);
  assert.match(source, />DONE<\/button>/);
  assert.match(source, /if \(cropSession\) exitCrop\(\)/);
  assert.match(source, /event\.shiftKey \? 0\.05 : 0\.01/);
  assert.match(source, /onCropModeChange\?\.\(true\)/);
  assert.match(source, /onCropModeChange\?\.\(false\)/);
  assert.match(source, /restoreFocus\(controlKey\(session\.placementId\)\)/);
  assert.doesNotMatch(source, /event\.key === ['"](?:Delete|Backspace)['"]/);
});

test('active crop suppresses other composition owners while retaining pointer capture and preview-only cancellation', () => {
  assert.match(source, /disabled=\{Boolean\(cropSession\)\}/);
  assert.match(source, /primary && selectedPlacementSet\.size === 1 && !locked && !cropSession/);
  assert.match(source, /groupResizeRectangle && !cropSession/);
  assert.match(source, /setContextMenu\(null\)/);
  assert.match(source, /kind: 'crop'/);
  assert.match(source, /createLatticeProductionCropPanGesture/);
  assert.match(source, /updateLatticeProductionCropPanGesture/);
  assert.match(source, /onPreviewOperation\?\.\(null\)/);
  assert.match(source, /releaseCapture\(active\.pointerId\)/);
  assert.match(styles, /\.lattice-production-crop-surface[^}]*touch-action:\s*none/su);
});

test('composition chrome remains usable and clipped within every authored boundary', () => {
  for (const boundary of ['top', 'right', 'bottom', 'left']) {
    assert.match(source, new RegExp(`data-boundary-${boundary}=\\{boundaries\\.${boundary} \\|\\| undefined\\}`));
    assert.match(styles, new RegExp(`\\[data-boundary-${boundary}\\]`));
  }
  assert.match(source, /latticeProductionPlacementBoundaries\(acceptedPlacement\)/);
  assert.match(styles, /\.lattice-production-movement-layer[^}]*overflow:\s*hidden/su);
  assert.doesNotMatch(source, /latticeProductionTopBoundaryRemoveDock|data-remove-dock/);
  assert.match(styles, /\[data-boundary-left\][^}]*--lattice-handle-x:\s*0%/su);
  assert.match(styles, /\[data-boundary-right\][^}]*--lattice-handle-x:\s*0%/su);
  assert.match(styles, /\[data-boundary-top\][^}]*--lattice-handle-y:\s*0%/su);
  assert.match(styles, /\[data-boundary-bottom\][^}]*--lattice-handle-y:\s*0%/su);
});
