import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OwnerSystemWorkflowRuntime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import ProfileOverview from '../src/profileDocument/components/ProfileOverview.jsx';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorDocument, withReceptionModuleWindow } from '../src/reception/receptionEditorDocument.js';
import { createArticle } from '../src/text/domain/article.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import '../src/index.css';

const profileAddress = '0x3333333333333333333333333333333333333333';
const prefix = `reception-layer-order:${new URLSearchParams(location.search).get('session') || 'default'}:`;
const storage = { getItem: key => localStorage.getItem(prefix + key), setItem: (key, value) => localStorage.setItem(prefix + key, value), removeItem: key => localStorage.removeItem(prefix + key) };
const root = createSystemWorkflowDraftStore({ profileAddress, storage });
const article = (title, text) => ({ ...createArticle(title), content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } });
if (!root.getDraft().reception?.shapes?.length) {
  let reception = createReceptionEditorDocument();
  const rectangle = (id, color, name) => ({ id: `shape:${id}`, name, color, opacity: 1, visibility: 'PUBLIC' });
  reception.shapes = [rectangle('cell', '#101111', 'Artwork cell'),
    { ...rectangle('grid', '#eeeeee', 'Free Grid'), kind: 'grid', grid: { spacing: 32, lineWidth: 1 } },
    rectangle('overlay', '#ffffff', 'White overlay'), rectangle('backdrop', '#3b1639', 'Text backdrop'), rectangle('source', '#101111', 'Linked source')];
  reception.imageModules = [{ id: 'image:art', name: 'Layered artwork', width: 600, height: 520, visibility: 'PUBLIC', sides: [{
    id: 'side:art', asset: createProfileDocumentV9AssetResolver(assets)(assets[0].id), crop: null,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  }] }];
  reception.texts = [{ id: 'text:nomad', article: article('NOMAD', 'Public layered text'), visibility: 'PUBLIC' },
    { id: 'text:private', article: article('Private note', 'Never published'), visibility: 'PRIVATE' }];
  const rotated = article('', 'Turned text');
  rotated.appearance = { ...rotated.appearance, background: '#412a58', padding: { top: 12, right: 16, bottom: 20, left: 24 },
    transform: { quarterTurns: 1, mirrorX: false, mirrorY: false } };
  reception.texts.push({ id: 'text:rotated', article: rotated, visibility: 'PUBLIC' });
  reception.cells = [{ id: 'shape:cell', members: ['image:art', 'text:nomad'], radius: 64, mobile: { columns: 2, height: 600 } },
    { id: 'shape:source', members: [], content: 'link:source', mobile: { columns: 2, height: 170 } }];
  reception.links = [{ id: 'link:source', kind: 'source', source: { profileAddress, canvasId: 'workbench:main', moduleId: 'text:source' }, destination: { profileAddress, canvasId: 'workbench:main' } }];
  reception.artworkLayers = ['shape:cell', 'shape:grid', 'image:art', 'shape:overlay', 'shape:backdrop', 'text:nomad', 'shape:source', 'text:private', 'text:rotated'];
  const windows = {
    'shape:cell': [160, 150, 1040, 600], 'shape:grid': [140, 130, 1080, 640], 'image:art': [140, 130, 600, 520],
    'shape:overlay': [440, 320, 120, 100], 'shape:backdrop': [780, 260, 350, 200], 'text:nomad': [780, 260, 350, 200],
    'shape:source': [780, 530, 350, 170], 'text:private': [1250, 150, 180, 200],
    'text:rotated': [1200, 550, 240, 140],
  };
  for (const [id, [left, top, width, height]] of Object.entries(windows)) reception = withReceptionModuleWindow(reception, id, { left, top, width, height });
  const current = root.getDraft();
  if (!root.commitCompletedOperation({ ...current, reception, texts: [{ id: 'text:source', article: article('Source story', 'The linked source remains clickable.'), visibility: 'PUBLIC' }],
    workbench: { ...(current.workbench || createDefaultWorkbenchPresentation()), texts: [{ id: 'text:source', open: true, window: { left: 100, top: 100, width: 500, height: 300 } }] } },
  { expectedGeneration: root.getGeneration(), recordHistory: false })) throw new Error('Could not seed the Reception layer fixture');
}
window.receptionLayerFixture = { root };
function Fixture() {
  const [editing, setEditing] = useState(true);
  return editing ? <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={root} reviewStorage={storage}
    receptionEditorRequested onOpenReception={() => setEditing(false)}
    reviewAssets={assets} reviewCategories={[]} reviewActivity={[]} reviewProfile={{ name: 'Layer parity' }} />
    : <ProfileOverview document={buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: root.getDraft(), assetRecords: assets })} />;
}
createRoot(document.getElementById('root')).render(<Fixture />);
