import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import LatticeProductionTableRenderer from '../src/lattice/rendering/LatticeProductionTableRenderer.jsx';
import { createEmptyLatticeProductionDraft } from '../src/lattice/domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../src/lattice/domain/latticeProductionAdapter.js';
import './lattice-production-table-fixture.css';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const stableId = (tokenId) => `42:${CONTRACT}:${tokenId}`;
const mediaUrl = (name) => `https://published-images.invalid/phase-3-${name}.svg`;
const assets = Object.freeze([
  { id: stableId('0x01'), chainId: 42, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8', name: 'Transparent landscape', description: '', collectionName: null, imageUrl: mediaUrl('transparent'), imageWidth: 1600, imageHeight: 900, mediaType: 'image', creators: [], attributes: [] },
  { id: stableId('0x02'), chainId: 42, contractAddress: CONTRACT, tokenId: '0x02', standard: 'LSP8', name: 'Cropped portrait', description: '', collectionName: null, imageUrl: mediaUrl('portrait'), imageWidth: 900, imageHeight: 1600, mediaType: 'image', creators: [], attributes: [] },
  { id: stableId('0x03'), chainId: 42, contractAddress: CONTRACT, tokenId: '0x03', standard: 'LSP8', name: 'Authored backing', description: '', collectionName: null, imageUrl: mediaUrl('square'), imageWidth: 1200, imageHeight: 1200, mediaType: 'image', creators: [], attributes: [] },
  { id: stableId('0x04'), chainId: 42, contractAddress: CONTRACT, tokenId: '0x04', standard: 'LSP8', name: 'Opaque fallback', description: '', collectionName: null, imageUrl: mediaUrl('opaque'), imageWidth: 1400, imageHeight: 800, mediaType: 'image', creators: [], attributes: [] },
  { id: stableId('0x05'), chainId: 42, contractAddress: CONTRACT, tokenId: '0x05', standard: 'LSP8', name: 'Delayed automatic alpha', description: '', collectionName: null, imageUrl: mediaUrl('loading'), imageWidth: 1000, imageHeight: 1000, mediaType: 'image', creators: [], attributes: [] },
  { id: stableId('0x06'), chainId: 42, contractAddress: CONTRACT, tokenId: '0x06', standard: 'LSP8', name: 'Failed media', description: '', collectionName: null, imageUrl: mediaUrl('failed'), imageWidth: 800, imageHeight: 600, mediaType: 'image', creators: [], attributes: [] },
  { id: stableId('0x07'), chainId: 42, contractAddress: CONTRACT, tokenId: '0x07', standard: 'LSP8', name: 'Unsupported media', description: '', collectionName: null, imageUrl: mediaUrl('unsupported'), imageWidth: null, imageHeight: null, mediaType: 'unknown', creators: [], attributes: [] },
]);
const defaultMat = () => ({ enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } });
const placement = (id, tokenId, geometry, presentation) => ({
  id, stableAssetId: stableId(tokenId), ...geometry,
  layer: presentation.layer, navigationOrder: presentation.navigationOrder,
  crop: presentation.crop, frameId: presentation.frameId, mat: presentation.mat,
  backing: presentation.backing, transparencyMode: presentation.transparencyMode,
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

function createCanonicalPublicLattice() {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.appearance.surfaceId = 'carbon';
  const table = draft.tables[4];
  table.title = 'Canonical center';
  table.subtitle = '32 × 18 / same public value';
  table.labelAnchor = 'top-right';
  table.labelOffset = { column: -1, row: 1 };
  table.placements = [
    placement('phase3-transparent', '0x01', { column: 1, row: 2, columnSpan: 8, rowSpan: 5 }, {
      layer: 1, navigationOrder: 0, crop: null, frameId: 'NONE', mat: defaultMat(),
      backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'PRESERVE_ALPHA',
    }),
    placement('phase3-crop', '0x02', { column: 11, row: 1, columnSpan: 6, rowSpan: 10 }, {
      layer: 7, navigationOrder: 1, crop: { x: 0.5, y: 0.42, zoom: 1.25 }, frameId: 'DOSSIER',
      mat: { enabled: true, color: '#d8d4ca', inset: { top: 0.06, right: 0.04, bottom: 0.08, left: 0.04 } },
      backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
    }),
    placement('phase3-backed', '0x03', { column: 19, row: 2, columnSpan: 6, rowSpan: 6 }, {
      layer: 4, navigationOrder: 2, crop: null, frameId: 'CAPTION',
      mat: { enabled: true, color: '#090a0a', inset: { top: 0.04, right: 0.04, bottom: 0.16, left: 0.04 } },
      backing: { enabled: true, color: '#c9c6bd' }, transparencyMode: 'OPAQUE',
    }),
    placement('phase3-opaque-fallback', '0x04', { column: 26, row: 2, columnSpan: 5, rowSpan: 4 }, {
      layer: 2, navigationOrder: 3, crop: null, frameId: 'NONE', mat: defaultMat(),
      backing: { enabled: false, color: '#090a0a' }, transparencyMode: 'OPAQUE',
    }),
    placement('phase3-auto-loading', '0x05', { column: 2, row: 10, columnSpan: 7, rowSpan: 5 }, {
      layer: 6, navigationOrder: 4, crop: null, frameId: 'NONE', mat: defaultMat(),
      backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
    }),
    placement('phase3-failed', '0x06', { column: 11, row: 13, columnSpan: 5, rowSpan: 4 }, {
      layer: 3, navigationOrder: 5, crop: null, frameId: 'NONE', mat: defaultMat(),
      backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'PRESERVE_ALPHA',
    }),
    placement('phase3-unsupported', '0x07', { column: 19, row: 11, columnSpan: 5, rowSpan: 4 }, {
      layer: 5, navigationOrder: 6, crop: null, frameId: 'NONE', mat: defaultMat(),
      backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
    }),
  ];
  return projectLatticeProductionPublication(draft, assets, { lastPublished: '2026-07-29T12:00:00.000Z' });
}

const lattice = createCanonicalPublicLattice();
const fingerprint = JSON.stringify(lattice);

function RenderSurface() {
  useEffect(() => {
    window.__latticePhase3 = { fingerprint, lattice, tableId: 'table-05' };
  }, []);
  return <LatticeProductionTableRenderer lattice={lattice} tableId="table-05" />;
}

function ComparisonFixture() {
  useEffect(() => {
    window.__latticePhase3 = { fingerprint, lattice, tableId: 'table-05' };
  }, []);
  return <main className="phase3-comparison" data-phase3-comparison>
    <header><span>PHASE 3 / BROWSER TEST ONLY</span><h1>Same validated public table</h1></header>
    <section><h2>DIRECT SURFACE / 960 × 540</h2><div className="phase3-direct-surface"><RenderSurface /></div></section>
    <section><h2>IFRAME / 640 × 360</h2><iframe title="Phase 3 wide iframe" src="/browser-tests/lattice-production-table-fixture.html?embed=wide" /></section>
    <section><h2>IFRAME / 390 × 600</h2><iframe className="is-tall" title="Phase 3 tall iframe" src="/browser-tests/lattice-production-table-fixture.html?embed=tall" /></section>
  </main>;
}

const embedded = new URLSearchParams(location.search).has('embed');
if (embedded) document.body.classList.add('phase3-embed');
ReactDOM.createRoot(document.getElementById('root')).render(embedded ? <RenderSurface /> : <ComparisonFixture />);
