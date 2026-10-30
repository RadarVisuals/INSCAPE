import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench } from '../src/systemWorkflow/domain/workbenchCollection.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReception } from '../src/profileDocument/domain/receptionPresentation.js';
import { placeReceptionLink } from '../src/reception/receptionSession.js';
import { splitReception } from '../src/reception/receptionLayout.js';
import { createArticle } from '../src/text/domain/article.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../src/profileDocument/domain/canvasPublication.js';
import { publishedPresentationSnapshot } from '../src/presentation/presentationSources.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { createWorkbenchIndex } from '../src/systemWorkflow/domain/workbenchIndex.js';
import ReceptionOverview from '../src/reception/ReceptionOverview.jsx';
import PublishedCanvasGallery from '../src/profileDocument/components/PublishedCanvasGallery.jsx';
import WorkbenchOverview from '../src/public/workbenchOverview/WorkbenchOverview.jsx';
import { workbenchOverviewModel } from '../src/public/workbenchOverview/workbenchOverviewModel.js';
import ReceptionStoreEditor from '../src/reception/ReceptionStoreEditor.jsx';
import '../src/index.css';

const profileAddress = '0x' + '1'.repeat(40), draft = createEmptySystemWorkflowDraft(profileAddress, { generateId: () => 'first' });
const article = (title, text) => ({ ...createArticle(title), content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } });
draft.grids[0].title = 'Night';
draft.appearance.guideMode = 'NONE';
draft.appearance.surfaceId = 'carbon';
draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:second', title: 'Dawn' });
draft.grids.forEach((grid, index) => { grid.placements = [{ id: `placement:${index}`, stableAssetId: assets[index].id,
  column: 4, row: 1, columnSpan: 24, rowSpan: 16, layer: 0, navigationOrder: 0, crop: null, visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }]; });
draft.texts = [{ id: 'text:story', article: article('Night', 'A quiet world, held in the dark.'), visibility: 'PUBLIC',
  sceneLink: { displayId: 'display:primary', gridId: 'grid:first', passages: [{ gridId: 'grid:second', article: article('Dawn', 'A new light changes the scene.') }] } }];
const resolve = createProfileDocumentV9AssetResolver(assets);
draft.imageModules = [{ id: 'image:study', name: 'Study', width: 400, height: 400, visibility: 'PUBLIC', sides: [0, 1].map(index => ({ id: `side:${index}`, asset: resolve(assets[index].id), crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } })) }];
draft.workbench = { ...createDefaultWorkbenchPresentation(), area: { left: 0, top: 0, width: 1200, height: 800 },
  imageModules: [{ id: 'image:study', open: true, position: { left: 700, top: 320 } }],
  texts: [{ ...createTextPresentation('text:story'), window: { left: 700, top: 30, width: 400, height: 280 } }] };
draft.workbench.display.window = { left: 0, top: 0, width: 640, height: 400 };
draft.workbenchIndex = { ...createWorkbenchIndex(), destinations: [{ id: 'workbench-view:detail', name: 'Artwork detail', view: { left: 700, top: 320, width: 400, height: 400 }, visibility: 'PUBLIC' }] };
let reception = createReception();
const first = reception.regions[0].id;
reception = splitReception(reception, first, 'x', 'region:right');
reception = splitReception(reception, first, 'y', 'region:lower-left');
reception = splitReception(reception, 'region:right', 'y', 'region:lower-right');
const ref = moduleId => ({ profileAddress, canvasId: 'workbench:main', moduleId });
reception = placeReceptionLink(reception, first, { id: 'link:display', kind: 'source', source: ref('display:primary'), destination: null });
reception = placeReceptionLink(reception, 'region:right', { id: 'link:story', kind: 'source', source: ref('text:story'), destination: null });
reception = placeReceptionLink(reception, 'region:lower-left', { id: 'link:image', kind: 'scene', controller: ref('display:primary'),
  sources: { 'grid:first': { ...ref('image:study'), sideId: 'side:0' }, 'grid:second': { ...ref('image:study'), sideId: 'side:1' } },
  destination: { profileAddress, canvasId: 'workbench:main', destinationId: 'workbench-view:detail' } });
reception.texts = [{ id: 'text:welcome', article: article('Small worlds.', 'Swipe the Display to move between scenes. Choose Canvases to explore the collection.'), visibility: 'PUBLIC' }];
reception.regions = reception.regions.map(region => ({ ...region, content: region.id === 'region:lower-right' ? 'text:welcome' : region.content,
  padding: [first, 'region:lower-left'].includes(region.id) ? 0 : 24 }));
reception.branding.name = 'Open studio';
draft.reception = reception;
let collection = appendWorkbench(createWorkbenchCollection(draft), 'workbench:other', 'Second canvas', draft);
collection.workbenches[0].name = 'Night / Dawn';
const prefix = 'reception-linked:' + (new URLSearchParams(location.search).get('session') || 'demo') + ':';
let writes = 0, fail = false;
const storage = { getItem: key => localStorage.getItem(prefix + key), setItem: (key, value) => { if (fail) throw Error('full'); writes++; localStorage.setItem(prefix + key, value); }, removeItem: key => localStorage.removeItem(prefix + key) };
if (!storage.getItem(systemWorkflowDraftKey(profileAddress))) storage.setItem(systemWorkflowDraftKey(profileAddress), JSON.stringify(collection));
const root = createSystemWorkflowDraftStore({ profileAddress, storage });
const reviewProfile = { status: 'RESOLVED', normalizedAddress: profileAddress, name: 'Open studio', description: 'Studies and small worlds.', tags: [], links: [] };
const model = { profile: { displayName: 'Open studio' }, officialProfile: { name: 'Open studio' }, links: [], card: { fields: [] } };
const assetMap = new Map(assets.map(asset => [asset.id, asset]));
const publish = () => buildCanvasPublication({ candidates: canvasPublicationCandidates({ record: JSON.parse(storage.getItem(systemWorkflowDraftKey(profileAddress))), assetRecords: assets, profile: reviewProfile }),
  selectedIds: root.listWorkbenches().map(item => item.id), includeShared: true });
globalThis.linkedFixture = { root, publish, writes: () => writes, fail: value => { fail = value; } };
function App() {
  const [surface, setSurface] = useState(new URLSearchParams(location.search).has('edit') ? 'edit' : 'reception');
  const publicView = new URLSearchParams(location.search).has('public');
  const [selectedId, select] = useState(root.getWorkbenchId), [view, setView] = useState({ layout: 'grid', wrap: true });
  const [cardSize, setCardSize] = useState(2);
  const generation = useSyncExternalStore(root.subscribe, root.getGeneration);
  const snapshot = useMemo(() => new URLSearchParams(location.search).has('public') ? publishedPresentationSnapshot(publish())
    : { kind: 'local', profileAddress, revision: `fixture:${generation}`, entries: root.listWorkbenches().map(item => root.readWorkbench(item.id)) }, [generation]);
  const previews = useMemo(() => snapshot.entries.map(entry => ({ ...entry, model: workbenchOverviewModel(entry.draft, assetMap) })), [snapshot]);
  const selected = previews.find(item => item.id === selectedId) || previews[0];
  if (surface === 'canvases') return publicView ? <PublishedCanvasGallery document={publish()} onAbout={() => setSurface('reception')} />
    : <WorkbenchOverview items={previews} previews={previews} selected={selected} model={selected.model} profile={reviewProfile}
      onSelect={select} view={view} onViewChange={setView} cardSize={cardSize} onCardSize={setCardSize} onOpenReception={() => setSurface('reception')} />;
  return surface === 'edit' ? <ReceptionStoreEditor rootStore={root} storage={storage} onClose={() => setSurface('reception')} onCanvases={() => setSurface('canvases')} reviewAssets={assets} reviewCategories={[]} reviewProfile={reviewProfile} />
    : <ReceptionOverview reception={root.getSnapshot().reception} model={model} address={profileAddress} menuSurface="carbon" snapshot={snapshot} assets={assetMap}
      onEdit={publicView ? undefined : () => setSurface('edit')} onOpenCanvas={() => setSurface('canvases')} />;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
