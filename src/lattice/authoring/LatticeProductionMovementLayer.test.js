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
  assert.match(source, /data-movement-placement-id=\{placement\.id\}/);
  assert.doesNotMatch(source, /data-placement-id=\{placement\.id\}/);
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
  assert.match(source, /event\.key === 'Escape'/);
});
