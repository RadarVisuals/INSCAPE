import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { TRANSPARENCY_MODES } from '../domain/latticeProfile.js';
import {
  projectTableMediaPlacements,
  resolvedTransparencyMode,
} from './latticePlacement.js';

const ASSET_A = '42:0x1111111111111111111111111111111111111111:0x01';
const ASSET_B = '42:0x2222222222222222222222222222222222222222:0x02';
const media = {
  [ASSET_A]: { src: '/fixture-a.webp', width: 400, height: 200 },
  [ASSET_B]: { src: '/fixture-b.webp', width: 100, height: 200 },
};
const placement = (overrides) => ({
  id: 'placement-a', stableAssetId: ASSET_A,
  column: 0, row: 0, columnSpan: 4, rowSpan: 4,
  navigationOrder: 0, layer: 0,
  transparencyMode: TRANSPARENCY_MODES.AUTO,
  ...overrides,
});
const table = (id, coordinate, placements) => ({ id, coordinate, placements });

test('each render projection contains only placements owned by its authored table', () => {
  const first = table('table-05', { x: 0, y: 0 }, [placement({})]);
  const second = table('table-06', { x: 1, y: 0 }, [placement({
    id: 'placement-b', stableAssetId: ASSET_B,
  })]);
  const input = { assetsByStableId: media, geometry: { columns: 8, rows: 8 }, viewport: { width: 800, height: 800 } };
  assert.deepEqual(projectTableMediaPlacements({ ...input, table: first }).map(({ placement: item, tableId }) => [item.id, tableId]), [
    ['placement-a', 'table-05'],
  ]);
  assert.deepEqual(projectTableMediaPlacements({ ...input, table: second }).map(({ placement: item, tableId }) => [item.id, tableId]), [
    ['placement-b', 'table-06'],
  ]);
});

test('AUTO and PRESERVE_ALPHA resolve to the exact same deterministic presentation mode', () => {
  assert.equal(resolvedTransparencyMode(TRANSPARENCY_MODES.AUTO), TRANSPARENCY_MODES.PRESERVE_ALPHA);
  assert.equal(resolvedTransparencyMode(TRANSPARENCY_MODES.PRESERVE_ALPHA), TRANSPARENCY_MODES.PRESERVE_ALPHA);
  assert.equal(resolvedTransparencyMode(TRANSPARENCY_MODES.OPAQUE), TRANSPARENCY_MODES.OPAQUE);
});

test('navigationOrder alone controls DOM projection order while layer remains independent', () => {
  const placements = [
    placement({ id: 'later', navigationOrder: 2, layer: 0 }),
    placement({ id: 'earlier', stableAssetId: ASSET_B, navigationOrder: 0, layer: 9 }),
  ];
  const input = {
    assetsByStableId: media,
    geometry: { columns: 8, rows: 8 },
    table: table('table-05', { x: 0, y: 0 }, placements),
    viewport: { width: 800, height: 800 },
  };
  const before = projectTableMediaPlacements(input);
  assert.deepEqual(before.map(({ placement: item }) => item.id), ['earlier', 'later']);
  assert.deepEqual(before.map(({ placement: item }) => item.layer), [9, 0]);
  placements[0].layer = 20;
  placements[1].layer = 1;
  const after = projectTableMediaPlacements(input);
  assert.deepEqual(after.map(({ placement: item }) => item.id), ['earlier', 'later']);
  assert.deepEqual(after.map(({ placement: item }) => item.layer), [1, 20]);
});

test('OPAQUE background is bounded by the fitted native-media rectangle, never the cell footprint', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./latticePlacementRenderer.css', import.meta.url), 'utf8');
  const [entry] = projectTableMediaPlacements({
    assetsByStableId: media,
    geometry: { columns: 8, rows: 8 },
    table: table('table-05', { x: 0, y: 0 }, [placement({ transparencyMode: TRANSPARENCY_MODES.OPAQUE })]),
    viewport: { width: 800, height: 800 },
  });
  assert.deepEqual(entry.mediaRectangle, { left: 0, top: 100, width: 400, height: 200 });
  assert.match(source, /left: mediaRectangle\.left/);
  assert.match(source, /width: mediaRectangle\.width/);
  assert.match(styles, /\.lattice-placement-media\.is-opaque\s*\{[^}]*background:/s);
  assert.doesNotMatch(styles, /\.lattice-placement-layer\s*\{[^}]*background:/s);
});

test('isolated Phase 2 placement rendering has no resolution, authoring, persistence, or production dependencies', () => {
  const source = readFileSync(new URL('./LatticePlacementRenderer.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /canvas|getImageData|crossOrigin|mime|fetch|ipfs|useWalletStore|localStorage|sessionStorage|indexedDB|onPointer|onClick/iu);
});
