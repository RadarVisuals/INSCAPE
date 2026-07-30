import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./LatticeProductionMovementLayer.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeProductionMovementLayer.css', import.meta.url), 'utf8');

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

test('selected public unlocked placements expose one ordered icon-only contextual toolbar without shortcuts', () => {
  assert.match(source, /latticeProductionLayerOperationAvailability/);
  assert.match(source, /latticeProductionLayerTopologySnapshot\(acceptedTable\)/);
  const layerActions = source.slice(source.indexOf('const LAYER_ACTIONS'), source.indexOf('function PlacementActionIcon'));
  ["OPERATIONS.BACK, accessible: 'Send placement to back'", "OPERATIONS.BACKWARD, accessible: 'Move placement backward'",
    "OPERATIONS.FORWARD, accessible: 'Move placement forward'", "OPERATIONS.FRONT, accessible: 'Bring placement to front'"]
    .reduce((offset, value) => {
      const next = layerActions.indexOf(value, offset);
      assert.ok(next >= offset, `${value} must retain layer-action order`);
      return next + value.length;
    }, 0);
  assert.ok(source.indexOf('aria-label="Crop placement"') < source.indexOf('{LAYER_ACTIONS.map'));
  assert.ok(source.indexOf('{LAYER_ACTIONS.map') < source.indexOf('aria-label="Remove placement"'));
  assert.match(source, /Crop, Trash2/);
  assert.match(source, /ChevronDown, ChevronUp, ChevronsDown, ChevronsUp/);
  assert.match(source, /role="toolbar"/);
  assert.match(source, /aria-disabled=\{!layerAvailability\[action\.id\]\}/);
  assert.match(source, /data-lattice-placement-action="layer"/);
  assert.match(source, /restoreFocus\(controlKey\(placementId, `layer-/);
  assert.doesNotMatch(source, /event\.key\s*===\s*['"](?:PageUp|PageDown|Home|End|\[|\])['"]/u);
  assert.doesNotMatch(source, />\s*(?:CROP|BACK|BACKWARD|FORWARD|FRONT|REMOVE)\s*<\/button>/u);
  assert.match(styles, /\.lattice-production-placement-toolbar[^}]*pointer-events:\s*auto/su);
  assert.match(styles, /min-width:\s*28px/u);
  assert.match(styles, /\.lattice-production-placement-toolbar svg[^}]*width:\s*16px[^}]*height:\s*16px/su);
  assert.match(styles, /button\[aria-disabled="true"\]/u);
});

test('custom tooltips appear on hover and keyboard focus and stay aligned to the unified toolbar', () => {
  assert.match(source, /role="tooltip"/);
  assert.match(source, /aria-describedby=/);
  assert.doesNotMatch(source, /title=/u);
  assert.match(styles, /button:hover \.lattice-production-placement-tooltip/);
  assert.match(styles, /button:focus-visible \.lattice-production-placement-tooltip[^}]*opacity:\s*1[^}]*visibility:\s*visible/su);
  assert.match(styles, /width:\s*600%/u);
  assert.match(styles, /button:not\(\[aria-disabled="true"\]\):hover svg[^}]*drop-shadow/su);
  assert.match(styles, /button:focus-visible svg[^}]*drop-shadow/su);
  assert.doesNotMatch(styles, /\.lattice-production-placement-toolbar\s*\{[^}]*(?:border|background):/su);
  assert.doesNotMatch(styles, /\.lattice-production-placement-tooltip\s*\{[^}]*(?:border|background):/su);
});

test('one shared contextual-toolbar dock keeps every action and resize handle non-overlapping and table-local', () => {
  assert.match(source, /latticeProductionPlacementToolbarDock\(acceptedPlacement, field\.cellSize\)/);
  assert.match(source, /data-placement-toolbar-dock=\{placementToolbarDock\.vertical\}/);
  assert.match(source, /style=\{\{ left: placementToolbarDock\.left, width: placementToolbarDock\.width \}\}/);
  assert.match(styles, /\[data-placement-toolbar-dock="below"\][^}]*top:\s*calc\(100% \+ 10px\)/su);
  assert.match(styles, /\[data-placement-toolbar-dock="above"\][^}]*bottom:\s*calc\(100% \+ 10px\)/su);
  assert.match(styles, /\[data-placement-toolbar-dock="inside-top"\][^}]*top:\s*10px/su);
  assert.match(styles, /\[data-placement-toolbar-dock="inside-bottom"\][^}]*bottom:\s*10px/su);
  assert.doesNotMatch(styles, /lattice-production-(?:crop-control|remove-control|layer-toolbar)/u);
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

test('selected unlocked placements expose four accessible resize handles and explicit-button-only removal', () => {
  assert.match(source, /LATTICE_PRODUCTION_RESIZE_CORNERS\.map/);
  assert.match(source, /Resize placement from/);
  assert.match(source, /aria-label="Remove placement"/);
  assert.match(source, /data-lattice-placement-action="remove"/);
  assert.match(source, /onClick=\{\(\) => removePlacement\(placement\.id\)\}/);
  assert.doesNotMatch(source, /event\.key === ['"](?:Delete|Backspace)['"]/);
  assert.match(source, /placements\[index \+ 1\] \|\| placements\[index - 1\]/);
  assert.match(source, /onReturnFocus/);
});

test('explicit crop mode owns pan and zoom with accessible DONE, CANCEL, and NATIVE FIT controls', () => {
  assert.match(source, /Crop placement:/);
  assert.match(source, /data-lattice-placement-action="crop"/);
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
  assert.match(source, /restoreFocus\(controlKey\(session\.placementId, 'crop'\)\)/);
  assert.doesNotMatch(source, /event\.key === ['"](?:Delete|Backspace)['"]/);
});

test('active crop suppresses other composition owners while retaining pointer capture and preview-only cancellation', () => {
  assert.match(source, /disabled=\{Boolean\(cropSession\)\}/);
  assert.match(source, /selected && !locked && !cropSession/);
  assert.match(source, /lattice-production-placement-toolbar/);
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
