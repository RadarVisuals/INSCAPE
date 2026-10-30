import React from 'react';
import { createRoot } from 'react-dom/client';
import Boundary from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createWorkbenchCollection, appendWorkbench, assertValidWorkbenchCollection } from '../src/systemWorkflow/domain/workbenchCollection.js';
import { createDefaultWorkbenchPresentation, createTextPresentation, createMiniAppPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { createArticle } from '../src/text/domain/article.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { saveWorkbenchPreferences } from '../src/public/ownerSystemWorkflow/workbenchPreferences.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/profileDocument/components/publishedProfileStatus.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

const params = new URLSearchParams(location.search);
const size = params.get('size') || 'filled', animated = params.get('animated') === '1';
const svgMode = params.get('svgMode') || (animated ? 'raf' : 'static');
const htmlAnimated = params.has('htmlAnimated') ? params.get('htmlAnimated') === '1' : animated;
const svgQuery = new URLSearchParams({ mode: svgMode, fps: params.get('svgFps') || '0', legacy: params.get('legacy') || '0' });
const count = Number(params.get('count') || 2), profile = '0x' + '1'.repeat(40);
const key = systemWorkflowDraftKey(profile);
const mediaOrigin = 'https://workbench-perf.invalid';
const sources = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset,
  imageUrl: mediaOrigin + asset.src, originalImageUrl: mediaOrigin + asset.src,
  thumbnailUrl: mediaOrigin + asset.src, src: mediaOrigin + asset.src, previewSrc: mediaOrigin + asset.src }));
const layered = { ...sources[0], id: '42:0x' + '8'.repeat(40) + ':0x08', stableAssetId: '42:0x' + '8'.repeat(40) + ':0x08',
  contractAddress: '0x' + '8'.repeat(40), tokenId: '0x08', name: 'Layered motion study', mediaFileType: 'image/svg+xml',
  src: mediaOrigin + '/__perf-layered.svg?' + svgQuery,
  previewSrc: mediaOrigin + '/__perf-layered.svg?' + svgQuery,
  imageUrl: mediaOrigin + '/__perf-layered.svg?' + svgQuery,
  originalImageUrl: mediaOrigin + '/__perf-layered.svg?' + svgQuery,
  thumbnailUrl: mediaOrigin + '/__perf-layered.svg?' + svgQuery, imageWidth: 2048, imageHeight: 2048 };
// Keep the live Keeper identical in every case, including the flattened WebP trial.
const keeperSource = { ...layered, id: layered.id.replace('0x08', '0x09'), stableAssetId: layered.id.replace('0x08', '0x09'), tokenId: '0x09',
  ...Object.fromEntries(['src', 'previewSrc', 'imageUrl', 'originalImageUrl', 'thumbnailUrl'].map(key =>
    [key, mediaOrigin + '/__perf-layered.svg?mode=static'])) };
const nomads = params.get('nomad') === '1' ? Array.from({ length: 4 }, (_, i) => {
  const tokenId = '0x' + (16 + i).toString(16), id = layered.id.replace('0x08', tokenId);
  const query = new URLSearchParams({ fps: params.get('svgFps') || '0',
    active: String(Number(i < Number(params.get('nomadActive') || 0))), oversample: params.get('oversample') || '1.5',
    variant: params.get('nomadVariant') || 'full' });
  return { ...layered, id, stableAssetId: id, tokenId, name: 'Nomad ' + (i + 1), imageWidth: 720, imageHeight: 800,
    ...Object.fromEntries(['src', 'previewSrc', 'imageUrl', 'originalImageUrl', 'thumbnailUrl'].map(key =>
      [key, mediaOrigin + '/__perf-nomad.svg?' + query])) };
}) : [];
const assets = [...sources, layered, keeperSource, ...nomads], resolve = createProfileDocumentV9AssetResolver(assets);
const draft = createEmptySystemWorkflowDraft(profile); draft.grids = [];
draft.appearance.menuSurfaceId = 'carbon';
draft.workbench = { ...createDefaultWorkbenchPresentation(), area: { width: 4200, height: 3200 } };
draft.workbench.display.open = false;
const numbers = size === 'small' ? { images: 4, texts: 2, shapes: 4, apps: 0, paragraphs: 3 }
  : { images: 16, texts: 12, shapes: 24, apps: 2, paragraphs: 12 };
draft.imageModules = Array.from({ length: numbers.images }, (_, i) => ({
  id: 'image:perf-' + i, name: 'Artwork ' + (i + 1), width: 400, height: 400, visibility: 'PRIVATE',
  sides: [{ id: 'side:perf-' + i, asset: resolve(i % 4 === 0 ? (nomads[i / 4]?.id || layered.id) : sources[i % sources.length].id),
    crop: i % 3 === 0 ? { x: .45, y: .55, zoom: 1.2 } : null,
    transform: { quarterTurns: 0, mirrorX: i % 5 === 0, mirrorY: false } }],
}));
draft.workbench.imageModules = draft.imageModules.map((item, i) => ({ id: item.id, open: true,
  position: { left: 450 + (i % 4) * 460, top: 130 + Math.floor(i / 4) * 560 } }));
draft.texts = Array.from({ length: numbers.texts }, (_, i) => {
  const article = createArticle('Field notes ' + (i + 1));
  article.content.content = Array.from({ length: numbers.paragraphs }, (_, p) => ({
    type: 'paragraph', attrs: { textAlign: null, spaceBefore: null, spaceAfter: null, lineHeight: null },
    content: [{ type: 'text', text: 'Study ' + (i + 1) + ', paragraph ' + (p + 1) + '. ' +
      'The drawings, words and moving figures form independent parts of this composition. '.repeat(8) }],
  }));
  return { id: 'text:perf-' + i, article, visibility: 'PRIVATE' };
});
draft.workbench.texts = draft.texts.map((item, i) => ({ ...createTextPresentation(item.id),
  window: { left: i === 0 ? 40 : 2440 + (i % 3) * 520, top: i === 0 ? 130 : 130 + Math.floor(i / 3) * 620,
    width: 360, height: 450 } }));
draft.shapes = Array.from({ length: numbers.shapes }, (_, i) => ({ id: 'shape:perf-' + i, name: 'Panel ' + (i + 1),
  color: ['#caa080', '#48656b', '#815c72'][i % 3], opacity: .5, visibility: 'PRIVATE' }));
draft.workbench.shapes = draft.shapes.map((item, i) => ({ id: item.id, open: true,
  window: { left: 30 + (i % 6) * 620, top: 100 + Math.floor(i / 6) * 690, width: 550, height: 540 } }));
draft.miniApps = Array.from({ length: numbers.apps }, (_, i) => ({ id: 'miniapp:perf-' + i, name: 'Motion panel ' + (i + 1),
  url: 'https://workbench-perf.invalid/panel.html?animated=' + Number(htmlAnimated), surface: 'artwork', visibility: 'PRIVATE' }));
draft.workbench.miniApps = draft.miniApps.map((item, i) => ({ ...createMiniAppPresentation(item.id),
  window: { left: 480 + i * 500, top: 2450, width: 400, height: 300 } }));
draft.keeperDocks = [{ id: 'keeper:perf', name: 'Shared Keeper', asset: resolve(keeperSource.id), faces: 'right',
  movement: 'swim', size: 192, visibility: 'PRIVATE' }];
const empty = createEmptySystemWorkflowDraft(profile); empty.grids = [];
empty.workbench = { ...createDefaultWorkbenchPresentation(), area: { width: 2000, height: 1600 } };
empty.workbench.display.open = false;
if (!localStorage.getItem(key)) {
  let collection = createWorkbenchCollection(draft); collection.workbenches[0].name = 'Filled study';
  for (let i = 1; i < count; i++) collection = appendWorkbench(collection, 'workbench:perf-' + i,
    i === 1 ? 'Quiet study' : 'Saved study ' + i, i === 1 ? empty : draft);
  collection.activeId = 'workbench:main';
  localStorage.setItem(key, JSON.stringify(assertValidWorkbenchCollection(collection)));
  saveWorkbenchPreferences(profile, { surfaceId: 'graphite', gridMode: 'NONE' }, localStorage);
}
const probe = window.workbenchPerf = { size, animated, count, numbers, writes: [], inputPaint: [], initialBytes: localStorage.getItem(key).length,
  record: () => JSON.parse(localStorage.getItem(key)), draft: () => createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(),
  store: () => createSystemWorkflowDraftStore({ profileAddress: profile, storage }), stop: () => root.unmount(),
  resetSamples: () => { probe.writes = []; probe.inputPaint = []; } };
const storage = {
  getItem: name => localStorage.getItem(name), removeItem: name => localStorage.removeItem(name),
  setItem(name, value) {
    const start = performance.now(); localStorage.setItem(name, value);
    if (name === key) probe.writes.push({ ms: performance.now() - start, bytes: value.length });
  },
};
document.addEventListener('input', event => {
  if (!event.target.closest('.tiptap')) return;
  const start = performance.now();
  requestAnimationFrame(() => probe.inputPaint.push(performance.now() - start));
}, true);
const root = createRoot(document.getElementById('root'));
root.render(<Boundary profileAddress={profile} reviewStorage={storage} reviewAssets={assets} reviewCategories={[]}
  reviewActivity={[]} reviewProfile={{ name: 'Filled Workbench performance study' }} />);
