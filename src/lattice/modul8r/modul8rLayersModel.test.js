import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { projectModul8rTableUsage } from './modul8rLayersModel.js';

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');

test('all-table usage preserves row-major table identity and exact placement counts', () => {
  const tables = Array.from({ length: 9 }, (_, index) => ({
    coordinate: { x: index % 3 - 1, y: Math.floor(index / 3) - 1 },
    id: `table-${String(index + 1).padStart(2, '0')}`,
    placements: Array.from({ length: index % 4 }, (__, placement) => ({ id: `p-${index}-${placement}` })),
    title: index === 4 ? 'CENTER' : '',
  }));
  const usage = projectModul8rTableUsage(tables, 'table-05');
  assert.deepEqual(usage.map(({ id }) => id), tables.map(({ id }) => id));
  assert.deepEqual(usage.map(({ count }) => count), [0, 1, 2, 3, 0, 1, 2, 3, 0]);
  assert.equal(usage[4].active, true);
  assert.equal(usage[4].label, 'CENTER');
  assert.equal(usage.filter(({ active }) => active).length, 1);
});

test('Task 6 Layers delegates selection and reorder to canonical owner callbacks and keeps usage read-only', async () => {
  const [adapter, integration, owner, canonical] = await Promise.all([
    read('./Modul8rLayersAdapter.jsx'), read('./Modul8rOwnerLibraryDevelopment.jsx'),
    read('../../public/OwnerLatticeShell.jsx'), read('../rendering/LatticeLayersModule.jsx'),
  ]);
  assert.match(adapter, /<LatticeLayersModule[\s\S]*onReorder=\{onReorder\}[\s\S]*onSelectionChange=\{onSelectionChange\}/);
  assert.match(adapter, /aria-label="All table usage"[\s\S]*onNavigateTable/);
  assert.doesNotMatch(adapter, /draggable|onDrop|moveLatticeLayerEntries/);
  assert.match(integration, /onLayerReorder[\s\S]*onLayerSelectionChange[\s\S]*onNavigateTable/);
  assert.match(owner, /onLayerReorder=\{reorderLayers\}/);
  assert.match(owner, /onLayerSelectionChange=\{selectPlacement\}/);
  assert.match(owner, /onNavigateTable=\{\(tableId\)[\s\S]*navigateDirectly\(table\.coordinate\)/);
  assert.match(owner, /authoring\.reorderPublicPlacements/);
  assert.match(canonical, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(canonical, /range: event\.shiftKey/);
  assert.match(canonical, /text\/x-inscape-layers/);
  assert.match(canonical, /event\.altKey[\s\S]*ArrowUp[\s\S]*ArrowDown/);
});

test('canonical layer rows preserve placement thumbnails, lock state, atomic multi-move, and controlled failure behavior', async () => {
  const [owner, canonical, model] = await Promise.all([
    read('../../public/OwnerLatticeShell.jsx'), read('../rendering/LatticeLayersModule.jsx'),
    read('../rendering/latticeLayersModel.js'),
  ]);
  assert.match(owner, /id: placement\.id[\s\S]*locked: placement\.locked[\s\S]*previewSrc: media\?\.status === 'ready'/);
  assert.match(canonical, /orderingBlocked = reorderDisabled \|\| layers\.some\(\(\{ locked \}\) => locked\)/);
  assert.match(canonical, /selected\.has\(layer\.id\) && selected\.size > 1 \? \[\.\.\.selected\]/);
  assert.match(canonical, /if \(next\) onReorder\?\.\(next\.map/);
  assert.doesNotMatch(canonical, /useState|setLayers/);
  assert.match(model, /remaining\.splice[\s\S]*\.\.\.sources/);
});
