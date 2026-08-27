import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const inspector = readFileSync(new URL('./LatticeProductionPresentationInspector.jsx', import.meta.url), 'utf8');
const movement = readFileSync(new URL('./LatticeProductionMovementLayer.jsx', import.meta.url), 'utf8');
const systemInspector = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowSelectionInspector.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeProductionPresentationInspector.css', import.meta.url), 'utf8');

test('right-click and keyboard placement menu open only the canonical LATTICE presentation inspector', () => {
  assert.match(movement, /\{ id: 'presentation', label: 'Frame & mat…' \}/);
  assert.match(movement, /event\.key === 'ContextMenu'/);
  assert.match(movement, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(movement, /<LatticeProductionPresentationInspector/);
  assert.match(movement, /setContextMenu\(null\);[\s\S]*setPresentationInspector/);
  assert.match(movement, /cropSession \|\| gestureRef\.current \|\| presentationInspector/);
  assert.doesNotMatch(`${movement}\n${inspector}`, /ModuleGridShell|ArtworkInspector|LatticeEnginePrototype|LatticeEngineDevControls|prototype fixtures/);
});

test('portal inspector restores pointer interaction inside the inert owner chrome boundary', () => {
  assert.match(styles, /\.lattice-production-presentation-inspector\s*\{[^}]*pointer-events:\s*auto;/s);
});

test('inspector uses canonical constants, mat resolver, and local preview state without per-field persistence', () => {
  assert.match(inspector, /LATTICE_PRODUCTION_FRAME_IDS\.map/);
  assert.match(inspector, /LATTICE_PRODUCTION_TRANSPARENCY_MODES\.map/);
  assert.match(inspector, /Object\.values\(ARTWORK_MAT_PRESET_IDS\)/);
  assert.match(inspector, /resolveArtworkMatPreset/);
  assert.match(inspector, /ARTWORK_MAT_INSET_MAX/);
  assert.match(inspector, /normalizeLatticeProductionPresentation/);
  assert.match(inspector, /const \[value, setValue\] = useState\(initial\)/);
  assert.match(movement, /kind: 'presentation'/);
  assert.match(systemInspector, /session\.setPlacementPresentation\(\{ gridId: grid\.id, placementId: placement\.id/u);
  assert.doesNotMatch(inspector, /localStorage|commitCompletedOperation|commitPresentation/);
});

test('Apply commits once while Cancel, Escape, close, and outside dismissal only clear preview and restore exact focus', () => {
  assert.equal((movement.match(/onCommitPresentation\?\.\(/g) || []).length, 1);
  assert.match(inspector, /if \(onApply\?\.\(normalized\) === false\) return/);
  assert.match(inspector, /onPreview\?\.\(null\);[\s\S]*onCancel\?\.\(\)/);
  assert.match(inspector, /event\.key !== 'Escape'/);
  assert.match(inspector, /window\.addEventListener\('pointerdown', outside, true\)/);
  assert.match(inspector, /Close Frame and mat inspector/);
  assert.match(inspector, /returnFocus\?\.isConnected && returnFocus\.focus\(\{ preventScroll: true \}\)/);
  assert.match(inspector, />CANCEL<\/button><button disabled=\{Boolean\(error\)\} onClick=\{apply\}/);
});

test('inspector is viewport bounded, narrow-width recoverable, theme-token based, and reduced-motion safe', () => {
  assert.match(inspector, /Math\.max\(8, Math\.min\(anchor\?\.x/);
  assert.match(inspector, /Math\.max\(8, Math\.min\(anchor\?\.y/);
  assert.match(styles, /max-height:\s*calc\(100dvh - 16px\)/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /width:\s*calc\(100vw - 16px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /var\(--lattice-menu-panel\)/);
  assert.match(styles, /var\(--lattice-menu-ink\)/);
  assert.match(styles, /border-radius:\s*0/);
});
