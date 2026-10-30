import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SceneNavigationProvider, useSceneController, useSceneNavigation } from '../src/text/SceneNavigation.jsx';
import { useTextScene, SceneTextViewport, TextContentPage } from '../src/text/SceneTextContent.jsx';
import PublishedDisplayModule from '../src/profileDocument/components/PublishedDisplayModule.jsx';
import { SharedDisplayToolsProvider } from '../src/public/ownerSystemWorkflow/SharedDisplayTools.jsx';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createArticle } from '../src/text/domain/article.js';
import ArticleView from '../src/text/ArticleView.jsx';
import { ReceptionImage } from '../src/reception/ReceptionCanvas.jsx';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createWorkbenchCollection, appendWorkbench } from '../src/systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../src/profileDocument/domain/canvasPublication.js';
import { publishedPresentationSnapshot, resolveSceneBinding } from '../src/presentation/presentationSources.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import CanvasGallerySection from '../src/public/workbenchOverview/CanvasGallerySection.jsx';
import CanvasPresentation from '../src/public/workbenchOverview/CanvasPresentation.jsx';
import { workbenchOverviewModel } from '../src/public/workbenchOverview/workbenchOverviewModel.js';
import '../src/index.css';
import '../src/public/ownerSystemWorkflow/workflowTactile.css';
import '../src/public/ownerSystemWorkflow/workflowFlat.css';
import '../src/text/text.css';
import './scene-boundaries.css';

// Dev-only study. No application route, canonical storage, wallet or upload.
const profileAddress = '0x' + '1'.repeat(40), draft = createEmptySystemWorkflowDraft(profileAddress, { generateId: () => 'one' });
const first = draft.grids[0].id;
draft.grids[0].title = 'First scene';
draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:two', title: 'Second scene' });
const article = title => ({ ...createArticle(title), content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This passage follows its source scene while the surrounding page stays in place.' }] }] } });
draft.texts = [{ id: 'text:story', visibility: 'PUBLIC', article: article('First passage'), sceneLink: { displayId: 'display:primary', gridId: first,
  passages: [{ gridId: 'grid:two', article: article('Second passage') }] } }, { id: 'text:static', visibility: 'PUBLIC', article: article('Always here') }];
const resolveAsset = createProfileDocumentV9AssetResolver(assets);
draft.imageModules = [{ id: 'image:study', name: 'Scene artwork', visibility: 'PUBLIC', width: 400, height: 400,
  sides: [0, 1].map(index => ({ id: `side:${index}`, asset: resolveAsset(assets[index].id), crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } })) }];
draft.workbench = { ...createDefaultWorkbenchPresentation(), area: { left: 0, top: 0, width: 850, height: 700 },
  imageModules: [{ id: 'image:study', open: true, position: { left: 10, top: 180 } }],
  texts: [{ ...createTextPresentation('text:story'), window: { left: 450, top: 150, width: 350, height: 400 } },
    { ...createTextPresentation('text:static'), open: false }] };
draft.workbench.display.open = false;
let collection = createWorkbenchCollection(draft);
collection = appendWorkbench(collection, 'workbench:other', 'Second canvas', draft);
const document = buildCanvasPublication({ candidates: canvasPublicationCandidates({ record: collection, assetRecords: assets, profile: {} }),
  selectedIds: ['workbench:main', 'workbench:other'], includeShared: true });
const snapshot = publishedPresentationSnapshot(document);
const previews = snapshot.entries.map(entry => ({ ...entry, model: workbenchOverviewModel(entry.draft) }));
const Frame = ({ children, navigation }) => <><div className="study-display-stage">{children}</div>{navigation}</>;
function Group({ entry, revision }) {
  const scope = { profileAddress, canvasId: entry.id, revision: `${snapshot.revision}:${revision}` };
  return <SceneNavigationProvider scope={scope} content={entry.draft}><Study entry={entry} /></SceneNavigationProvider>;
}
function Study({ entry }) {
  const [mounted, setMounted] = useState(true), [open, setOpen] = useState(true), [missing, setMissing] = useState(false);
  const control = useSceneController('display:primary'), scenes = useSceneNavigation();
  const state = useTextScene(entry.draft.texts[0]);
  const binding = { controller: { profileAddress, canvasId: entry.id, moduleId: 'display:primary' }, sources: Object.fromEntries(
    [first, 'grid:two'].map((id, index) => [id, { profileAddress, canvasId: entry.id, moduleId: missing ? 'image:missing' : 'image:study', sideId: `side:${index}` }])) };
  const image = resolveSceneBinding(snapshot, binding, { scope: { profileAddress, canvasId: entry.id, revision: snapshot.revision }, scenes });
  return <section className="study-group" aria-label={entry.name}>
    <header><h2>{entry.name}</h2><span data-scene>{scenes['display:primary']?.gridId}</span></header>
    <div className="study-controls">
      <button onClick={() => control.next('previous')}>Previous scene</button><button onClick={() => control.next()}>Next scene</button>
      <button onClick={() => setMounted(!mounted)}>{mounted ? 'Unmount Display' : 'Mount Display'}</button>
      <button onClick={() => setOpen(!open)}>{open ? 'Hide Display' : 'Show Display'}</button>
      <button onClick={() => setMissing(!missing)}>{missing ? 'Restore source' : 'Remove source'}</button>
    </div>
    {mounted && <SharedDisplayToolsProvider><PublishedDisplayModule document={entry.draft} Frame={Frame} open={open} reducedMotion /></SharedDisplayToolsProvider>}
    <div className="study-cells">
      <div className="study-cell study-image" data-side={image.side?.id}>{image.status === 'ready'
        ? <ReceptionImage record={{ ...image.record, sides: [image.side] }} /> : <p role="status">Source unavailable</p>}</div>
      <div className="study-cell" data-linked-text><SceneTextViewport record={entry.draft.texts[0]} state={state}>
        <TextContentPage article={state.article} resetKey={state.gridId} /></SceneTextViewport></div>
      <div className="study-cell" data-static><ArticleView article={entry.draft.texts[1].article} containerOwned /></div>
    </div>
  </section>;
}
function App() {
  const [revision, setRevision] = useState(0), [opened, setOpened] = useState(null);
  const trigger = useRef(null);
  const close = () => { setOpened(null); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };
  return <main className="scene-boundary-study system-workflow__token-scope" data-workflow-material="tactile" data-workflow-finish="flat" data-menu-surface="carbon">
    <div inert={opened ? '' : undefined}><header><h1>Linked cells / boundary study</h1><p>Two independent canvases, each with one scene controller and shared image and text renderers.</p>
      <button onClick={() => setRevision(revision + 1)}>New presentation session</button></header>
      {snapshot.entries.map(entry => <Group key={entry.id} entry={entry} revision={revision} />)}
      <h2>Canvases in the same page flow</h2>
      <CanvasGallerySection items={previews} cardSize={3} selectedId={opened?.entry.id} onOpen={(id, button) => {
        trigger.current = button; setOpened({ entry: previews.find(entry => entry.id === id), origin: button.closest('.workbench-overview-card') });
      }} />
    </div>
    {opened && <CanvasPresentation selected={opened.entry} model={opened.entry.model} origin={opened.origin} onClose={close} />}
  </main>;
}
createRoot(globalThis.document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
