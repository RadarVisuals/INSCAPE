import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createArticle } from '../src/text/domain/article.js';
import ArticleView from '../src/text/ArticleView.jsx';
import { CompositionImage } from '../src/composition/CompositionImage.jsx';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createWorkbenchCollection, appendWorkbench } from '../src/systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../src/profileDocument/domain/canvasPublication.js';
import { publishedPresentationSnapshot, resolvePresentationSource } from '../src/presentation/presentationSources.js';
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
const article = title => ({ ...createArticle(title), content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This passage follows its source scene while the surrounding page stays in place.' }] }] } });
draft.texts = ['First passage', 'Second passage', 'Always here'].map((title, index) => ({
  id: 'text:study-' + index, visibility: 'PUBLIC', article: article(title),
}));
const resolveAsset = createProfileDocumentV9AssetResolver(assets);
draft.imageModules = [0, 1].map(index => ({ id: `image:study-${index}`, name: 'Scene artwork', visibility: 'PUBLIC', width: 400, height: 400,
  artwork: { id: `artwork:${index}`, asset: resolveAsset(assets[index].id), crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } } }));
draft.workbench = { ...createDefaultWorkbenchPresentation(), area: { left: 0, top: 0, width: 850, height: 700 },
  imageModules: draft.imageModules.map(image => ({ id: image.id, open: true, position: { left: 10, top: 180 } })),
  texts: [{ ...createTextPresentation('text:study-0'), window: { left: 450, top: 150, width: 350, height: 400 } },
    { ...createTextPresentation('text:study-2'), open: false }] };
let collection = createWorkbenchCollection(draft);
collection = appendWorkbench(collection, 'workbench:other', 'Second canvas', draft);
const document = buildCanvasPublication({ candidates: canvasPublicationCandidates({ record: collection, assetRecords: assets, profile: {} }),
  selectedIds: ['workbench:main', 'workbench:other'], includeShared: true });
const snapshot = publishedPresentationSnapshot(document);
const previews = snapshot.entries.map(entry => ({ ...entry, model: workbenchOverviewModel(entry.draft) }));
function Study({ entry }) {
  const [index, setIndex] = useState(0), [mounted, setMounted] = useState(true), [missing, setMissing] = useState(false);
  const source = moduleId => resolvePresentationSource(snapshot, { profileAddress, canvasId: entry.id, moduleId });
  const image = source(missing ? 'image:missing' : 'image:study-' + index);
  const text = source('text:study-' + index);
  return <section className="study-group" aria-label={entry.name}>
    <header><h2>{entry.name}</h2><span data-scene>{index}</span></header>
    <div className="study-controls">
      <button onClick={() => setIndex(0)}>First artwork</button><button onClick={() => setIndex(1)}>Second artwork</button>
      <button onClick={() => setMounted(!mounted)}>{mounted ? 'Unmount artwork' : 'Mount artwork'}</button>
      <button onClick={() => setMissing(!missing)}>{missing ? 'Restore source' : 'Remove source'}</button>
    </div>
    <div className="study-cells">
      {mounted && <div className="study-cell study-image" data-artwork={image.artwork?.id}>{image.status === 'ready'
        ? <CompositionImage record={image.record} /> : <p role="status">Source unavailable</p>}</div>}
      <div className="study-cell" data-linked-text><ArticleView article={text.article} containerOwned /></div>
      <div className="study-cell" data-static><ArticleView article={entry.draft.texts[2].article} containerOwned /></div>
    </div>
  </section>;
}
function App() {
  const [revision, setRevision] = useState(0), [opened, setOpened] = useState(null);
  const trigger = useRef(null);
  const close = () => { setOpened(null); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };
  return <main className="scene-boundary-study system-workflow__token-scope" data-workflow-material="tactile" data-workflow-finish="flat">
    <div inert={opened ? '' : undefined}><header><h1>Linked cells / boundary study</h1><p>Two independent canvases, with independent artwork selections.</p>
      <button onClick={() => setRevision(revision + 1)}>New presentation session</button></header>
      {snapshot.entries.map(entry => <Study key={entry.id + revision} entry={entry} />)}
      <h2>Canvases in the same page flow</h2>
      <CanvasGallerySection items={previews} cardSize={3} selectedId={opened?.entry.id} onOpen={(id, button) => {
        trigger.current = button; setOpened({ entry: previews.find(entry => entry.id === id), origin: button.closest('.workbench-overview-card') });
      }} />
    </div>
    {opened && <CanvasPresentation selected={opened.entry} model={opened.entry.model} origin={opened.origin} onClose={close} />}
  </main>;
}
createRoot(globalThis.document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
