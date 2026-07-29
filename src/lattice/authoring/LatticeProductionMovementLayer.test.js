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
});

test('visible hit testing uses public placements, canonical layers, and deterministic keyboard order', () => {
  assert.match(source, /filter\(\(placement\) => placement\.visibility === 'PUBLIC'\)/);
  assert.match(source, /left\.navigationOrder - right\.navigationOrder \|\| left\.id\.localeCompare\(right\.id\)/);
  assert.match(source, /zIndex: placement\.layer/);
  assert.match(source, /aria-disabled=\{locked \|\| undefined\}/);
  assert.match(source, /Locked placement/);
  assert.match(styles, /pointer-events: none/);
  assert.match(styles, /\.lattice-production-movement-control[^}]*pointer-events: auto/su);
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
  assert.match(source, /Remove placement:/);
  assert.match(source, /data-lattice-placement-action="remove"/);
  assert.match(source, /onClick=\{\(\) => removePlacement\(placement\.id\)\}/);
  assert.doesNotMatch(source, /event\.key === ['"](?:Delete|Backspace)['"]/);
  assert.match(source, /placements\[index \+ 1\] \|\| placements\[index - 1\]/);
  assert.match(source, /onReturnFocus/);
});

test('composition chrome remains usable and clipped within every authored boundary', () => {
  for (const boundary of ['top', 'right', 'bottom', 'left']) {
    assert.match(source, new RegExp(`data-boundary-${boundary}=\\{boundaries\\.${boundary} \\|\\| undefined\\}`));
    assert.match(styles, new RegExp(`\\[data-boundary-${boundary}\\]`));
  }
  assert.match(source, /latticeProductionPlacementBoundaries\(acceptedPlacement\)/);
  assert.match(styles, /\.lattice-production-movement-layer[^}]*overflow:\s*hidden/su);
  assert.match(source, /latticeProductionTopBoundaryRemoveDock\(acceptedPlacement, field\.cellSize\)/);
  assert.match(source, /data-remove-dock=\{removeDock\.side \|\| undefined\}/);
  assert.match(styles, /\[data-boundary-top\]\[data-remove-dock="inside"\] \.lattice-production-remove-control[^}]*translate:\s*-50% 0/su);
  assert.match(styles, /\[data-remove-dock="right"\][^}]*left:\s*calc\(100% \+ 9px\)/su);
  assert.match(styles, /\[data-remove-dock="left"\][^}]*right:\s*calc\(100% \+ 9px\)/su);
  assert.match(styles, /\.lattice-production-remove-control[^}]*width:\s*min\(48px, var\(--lattice-remove-maximum-width, 100%\)\)/su);
  assert.match(styles, /\[data-boundary-left\][^}]*--lattice-handle-x:\s*0%/su);
  assert.match(styles, /\[data-boundary-right\][^}]*--lattice-handle-x:\s*0%/su);
  assert.match(styles, /\[data-boundary-top\][^}]*--lattice-handle-y:\s*0%/su);
  assert.match(styles, /\[data-boundary-bottom\][^}]*--lattice-handle-y:\s*0%/su);
});
