import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createOwnerWorldLayoutDocument } from './ownerWorldProjection.js';

const object = {
  id: 'canvas:artwork:private-one',
  kind: 'framed-artwork',
  stableAssetId: '42:0x2222222222222222222222222222222222222222:0x01',
  visitorVisible: false,
  placement: { column: -2, row: 3 },
  span: { columns: 4, rows: 5 },
  presentationOrder: 2,
  presentation: { fit: 'contain', frame: 'thin', mat: 'dark', background: 'dark' }
};

test('owner world layout includes private authored objects without mutating the public draft', () => {
  const document = { profile: { address: '0x1111111111111111111111111111111111111111' }, canvasObjects: [] };
  const result = createOwnerWorldLayoutDocument(document, [object], [{ id: object.stableAssetId, name: 'Private study' }]);
  assert.deepEqual(document.canvasObjects, []);
  assert.equal(result.canvasObjects.length, 1);
  assert.equal(result.canvasObjects[0].asset.cachedName, 'Private study');
  assert.deepEqual(result.canvasObjects[0].placement, object.placement);
  assert.equal(result.canvasObjects[0].order, object.presentationOrder);
  assert.equal('visitorVisible' in result.canvasObjects[0], false);
});

test('owner artwork tools stay outside the published visitor component', () => {
  const owner = readFileSync(new URL('./OwnerHomeWorld.jsx', import.meta.url), 'utf8');
  const published = readFileSync(new URL('../profileDocument/components/PublishedHomeWorld.jsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
  assert.match(owner, /editable/);
  assert.match(owner, /onOpenObjectContextMenu/);
  assert.match(owner, /interactionProps/);
  assert.match(shell, /<OwnerHomeWorld/);
  assert.match(shell, /ownerAuthoringEnabled && !ownerWorkspaceOpen && libraryStatus === 'idle'/);
  assert.match(shell, /create-framed-artwork/);
  assert.doesNotMatch(published, /OwnerHomeWorld|ownerCanvas|editable=|onOpenObjectContextMenu/);
});

test('owner artwork overlays block rack hit testing and framed artwork exposes direct corner resizing', () => {
  const css = readFileSync(new URL('./ownerDirectManipulation.css', import.meta.url), 'utf8');
  const artworkCss = readFileSync(new URL('./ownerDirectManipulation.css', import.meta.url), 'utf8');
  const framed = readFileSync(new URL('./FramedArtwork.jsx', import.meta.url), 'utf8');
  assert.match(css, /\.owner-rack-home :is\(\.artwork-dialog-backdrop,\.artwork-inspector,\.canvas-artwork-preview\)[^{]*\{[^}]*pointer-events:\s*auto/);
  assert.match(framed, /'north-west', 'north-east', 'south-west', 'south-east'/);
  assert.match(artworkCss, /data-corner="north-west"/);
  assert.match(artworkCss, /data-corner="south-east"/);
});

test('direct owner interactions preserve normal rack clicks and movable artwork tools', () => {
  const identityRack = readFileSync(new URL('../profileDocument/components/PublishedIdentityRack.jsx', import.meta.url), 'utf8');
  const inspector = readFileSync(new URL('./ArtworkInspector.jsx', import.meta.url), 'utf8');
  assert.match(identityRack, /Math\.hypot\([^)]*\) < 6/);
  assert.match(identityRack, /start\.bar\.setPointerCapture/);
  assert.doesNotMatch(identityRack, /event\.preventDefault\(\); event\.currentTarget\.setPointerCapture/);
  assert.match(inspector, /onPointerDown=\{beginDrag\}/);
  assert.match(inspector, /clampMenuPosition/);
  assert.doesNotMatch(inspector, /Bring Forward|Send Backward/);
});
