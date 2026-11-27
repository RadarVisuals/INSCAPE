import ProfileOverview from '../src/profileDocument/components/ProfileOverview.jsx';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createCompositionEditorScope } from '../src/composition/compositionEditorScope.js';
import { COMPOSITION_LAYOUT_DEFAULTS } from '../src/composition/compositionLayoutGenerator.js';
import { compositionModuleWindow } from '../src/composition/compositionEditorDocument.js';
import { addImageModule } from '../src/imageModule/imageModuleSession.js';
import { addTextModule } from '../src/text/textSession.js';
import { createCompositionExample } from '../design-system/lab/compositionExample.js';
import WorkspaceBoundary from '../src/workspace/WorkspaceBoundary.jsx';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OwnerSystemWorkflowRuntime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { addShape } from '../src/shapes/shapeSession.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, fixtureAsset } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import '../src/index.css';

const profileAddress = '0x3333333333333333333333333333333333333333';
const query = new URLSearchParams(location.search);
const prefix = `native-composition:${query.get('session') || 'default'}:`;
let failing = false;
const storage = {
  getItem: key => localStorage.getItem(prefix + key),
  setItem: (key, value) => { if (failing) throw new Error('Fixture storage full'); localStorage.setItem(prefix + key, value); },
  removeItem: key => localStorage.removeItem(prefix + key),
};
const root = createSystemWorkflowDraftStore({ profileAddress, storage });
if (root.listWorkbenches().length === 1) {
  addShape(root.getWorkbenchScope(), profileAddress, { position: { left: 50, top: 80 }, size: { width: 220, height: 160 } });
  root.createWorkbench('Cell study', { layout: 'canvas', generateId: () => 'cell-study' });
}
if (query.has('tiling') && !root.getDraft()?.cells.length) {
  const scope = createCompositionEditorScope(root);
  scope.generateCellLayout({ ...COMPOSITION_LAYOUT_DEFAULTS, columns: 1, rows: 1 }, 42, scope.getGeneration());
  const left = scope.getCells()[0].id;
  // Fixed three-cell fixture: independent of the available editing commands.
  const partition = root.getDraft(), value = partition;
  const ids = [left, 'shape:tiling-top', 'shape:tiling-bottom'];
  const frames = [{ left: 24, top: 24, width: 684, height: 852 },
    { left: 732, top: 24, width: 684, height: 414 }, { left: 732, top: 462, width: 684, height: 414 }];
  value.shapes = ids.map(id => ({ ...value.shapes[0], id }));
  value.cells = ids.map(id => ({ ...structuredClone(value.cells[0]), id, members: [] }));
  value.workbench.shapes = ids.map((id, index) => ({ ...value.workbench.shapes[0], id, window: frames[index] }));
  value.artworkLayers = ids;
  if (!root.commitCompletedOperation(partition, { expectedGeneration: root.getGeneration() })) throw Error('Could not seed tiling layout.');
  const inCell = id => ({ ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(id, candidate, options) });
  const frame = compositionModuleWindow(scope.getComposition(), left);
  const artwork = createCompositionExample().imageModules[0].artwork;
  artwork.asset.media = { ...artwork.asset.media, url: 'https://raw.githubusercontent.com/RadarVisuals/INSCAPE/226945490a3598b99ddb654f0b15c230348f866e/public/assets/actors/skull_reaper/full.webp', width: 2000, height: 2000 };
  artwork.crop = null;
  addImageModule(inCell(left), profileAddress, { cellId: left, artwork,
    position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  for (const id of ['shape:tiling-top', 'shape:tiling-bottom']) {
    const window = compositionModuleWindow(scope.getComposition(), id);
    addTextModule(inCell(id), profileAddress, { cellId: id, window }, { visibility: 'PUBLIC', appearance: { compact: true, background: null, color: '#ffffff' } });
  }
  const seeded = root.getDraft();
  for (const [index, text] of seeded.texts.entries()) {
    const cell = seeded.cells.find(cell => cell.members.includes(text.id));
    const frame = seeded.workbench.shapes.find(item => item.id === cell.id).window;
    delete cell.fitText;
    seeded.workbench.texts.find(item => item.id === text.id).window = { left: frame.left + 30, top: frame.top + frame.height - 140, width: frame.width - 60, height: 110 };
    if (query.has('positioning')) seeded.workbench.texts.find(item => item.id === text.id).window = { left: frame.left + 30, top: frame.top + frame.height - 230, width: frame.width - 60, height: 200 };
    if (query.has('automaticPadding')) { text.article.appearance.compact = false; text.article.appearance.scale = 1.25; }
    text.article.title = '';
    if (query.has('fluidText')) text.article.appearance.fontSize = index ? 28 : 16;
    text.article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: index === 0
      ? "People think I'm the grim reaper but little do they know he only shows up when the work is already done."
      : 'Resize one cell; neighbours move aside without shrinking. Empty space stays where you leave it.' }] }] };
  }
  if (query.has('fluidText')) seeded.texts[0].article.content.content[0].content[0].marks = [{ type: 'textStyle', attrs: { fontSize: 28 } }];
  if (query.has('longText')) seeded.texts[0].article.content.content[0].content[0].text = seeded.texts[0].article.content.content[0].content[0].text.repeat(16);
  seeded.shapes.find(item => item.id === left).name = 'Artwork';
  seeded.shapes.find(item => item.id === 'shape:tiling-top').name = 'Upper text';
  seeded.shapes.find(item => item.id === 'shape:tiling-bottom').name = 'Lower text';
  root.commitCompletedOperation(seeded, { expectedGeneration: root.getGeneration() });
  scope.release();
}
if (query.has('textAxes') && !root.getDraft()?.cells.length) {
  const scope = createCompositionEditorScope(root);
  scope.generateCellLayout({ ...COMPOSITION_LAYOUT_DEFAULTS, columns: 2, rows: 1 }, 42, scope.getGeneration());
  const cellId = scope.getCells()[1].id;
  const inCell = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cellId, candidate, options) };
  const id = addTextModule(inCell, profileAddress, { window: { left: 794, top: 190, width: 560, height: 520 } },
    { visibility: 'PUBLIC', appearance: { compact: true, background: null, color: '#ffffff', fontSize: 28 } });
  const draft = root.getDraft(), value = draft;
  value.cells.forEach((cell, index) => {
    value.workbench.shapes.find(item => item.id === cell.id).window = { left: 24 + index * 708, top: 24, width: 684, height: 852 };
    value.shapes.find(item => item.id === cell.id).name = index ? 'Text cell' : 'Empty cell';
  });
  value.workbench.texts.find(item => item.id === id).window = { left: 794, top: 190, width: 560, height: 520 };
  if (!query.has('freeText')) value.cells[1].memberAnchors = [{ members: [id], alignX: 'center', alignY: 'center', paddingX: 24, paddingY: 24 }];
  const article = value.texts.find(item => item.id === id).article;
  article.title = '';
  article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text',
    text: 'A horizontal resize should only change the available width. These words belong in this cell and should keep their vertical position. '.repeat(9) }] }] };
  if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Could not seed Text axes.');
  scope.release();
}
window.nativeCompositionFixture = { root, fail: value => { failing = value; } };
let gutterReader;
window.nativeCompositionFixture.showGutterReader = async (scale, phase) => {
  const { default: Canvas } = await import('../src/composition/CompositionDocumentCanvas.jsx');
  let node = document.getElementById('gutter-reader');
  if (!node) { node = document.createElement('div'); node.id = 'gutter-reader'; document.body.append(node); gutterReader = createRoot(node); }
  Object.assign(node.style, { position:'fixed', left:`${400 + phase}px`, top:'250px', width:'1000px', height:'500px', zIndex:9999, background:'#171717' });
  const composition = structuredClone(root.getDraft());
  composition.workbench.area.width = 1000 / scale;
  composition.workbench.area.height = 600 / scale;
  // Keep each visible cell wider than the reading threshold. This fixture
  // isolates fractional gutter paint from the separately tested responsive reflow.
  const gap = composition.bento.gap;
  composition.cells.forEach((cell, index) => {
    composition.workbench.shapes.find(item => item.id === cell.id).window = {
      left: index * (400 / scale + gap), top: 0, width: 400 / scale, height: 200 / scale,
    };
  });
  gutterReader.render(<Canvas composition={composition} width={1000} />);
};
const assets = [...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS];
if (query.has('logo')) {
  const source = 'https://raw.githubusercontent.com/npm/logos/master/npm%20logo/npm-logo-red.png';
  assets.push(fixtureAsset({ token: 8, name: 'NPM WORDMARK', source, width: 1560, height: 500 }));
}
function Fixture() {
  const [editing, setEditing] = useState(true);
  return editing ? <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={root} reviewStorage={storage}
    onOpenProfile={() => setEditing(false)}
    reviewAssets={assets} reviewCategories={[]} reviewActivity={[]} reviewProfile={{ name: 'Native Composition' }} />
    : <ProfileOverview document={buildProfileDocumentV9({ profileAddress, assetRecords: assets,
      profileIdentity: { name: 'Native Composition' }, systemWorkflowDraft: root.getDraft() })} account={{ address: profileAddress }} ownerDestinations={{ Studio: () => setEditing(true) }} onReturnToWorkbench={() => setEditing(true)} />;
}
// Match the real application's pointer-transparent interface. The Editor must
// load its own base styles when opened directly, without visiting another route.
createRoot(document.getElementById('root')).render(<div className="application-root" data-application-mode="public">
  <div className="application-interface" data-visible><WorkspaceBoundary profile={profileAddress}><Fixture /></WorkspaceBoundary></div>
</div>);
