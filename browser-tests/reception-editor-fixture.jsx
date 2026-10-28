import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import ReceptionStoreEditor from '../src/reception/ReceptionStoreEditor.jsx';
import ProfileOverview from '../src/profileDocument/components/ProfileOverview.jsx';
import WorkbenchOverview from '../src/public/workbenchOverview/WorkbenchOverview.jsx';
import { workbenchOverviewModel } from '../src/public/workbenchOverview/workbenchOverviewModel.js';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReception } from '../src/profileDocument/domain/receptionPresentation.js';
import { splitReception } from '../src/reception/receptionLayout.js';
import { createArticle, textAppearance } from '../src/text/domain/article.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as sourceAssets } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import '../src/index.css';
const profileAddress = '0x' + '1'.repeat(40);
const assets = new URLSearchParams(location.search).has('image-choices') ? sourceAssets.map((asset, index) => index ? asset : { ...asset,
  imageGroups: [{ index: 0, originalImageUrl: asset.originalImageUrl },
    { index: 1, originalImageUrl: sourceAssets[1].originalImageUrl }] }) : sourceAssets;
const reviewProfile = { status: 'RESOLVED', normalizedAddress: profileAddress, name: 'Nomad', description: 'Illustrations and small worlds.', tags: ['ART'], links: [] };
let failing = false;
const testSession = new URLSearchParams(location.search).get('session') || 'default';
const prefix = 'reception-test:' + testSession + ':';
const storage = { getItem: key => localStorage.getItem(prefix + key),
  setItem: (key, value) => { if (failing) throw Error('Fixture storage full'); localStorage.setItem(prefix + key, value); },
  removeItem: key => localStorage.removeItem(prefix + key) };
const root = createSystemWorkflowDraftStore({ profileAddress, storage });
if (new URLSearchParams(location.search).has('sample') && !root.getSnapshot().reception) {
  let reception = createReception(), first = reception.regions[0].id;
  reception = splitReception(reception, first, 'x', 'region:right');
  reception = splitReception(reception, first, 'y', 'region:left-bottom');
  reception = splitReception(reception, 'region:left-bottom', 'x', 'region:links');
  const article = createArticle();
  article.title = 'Drawn to the unusual.';
  article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A collection of studies, imagined creatures and small worlds. Reception is a place to introduce the work and the person behind it.' }] }] };
  article.appearance = { ...textAppearance(article), fontSize: 22 };
  reception.texts = [{ id: 'text:intro', article, visibility: 'PUBLIC' }];
  reception.imageModules = [{ id: 'image:portrait', name: assets[1].name, visibility: 'PUBLIC', width: 800, height: 900,
    sides: [{ id: 'side:first', asset: createProfileDocumentV9AssetResolver(assets)(assets[1].id), crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }];
  reception.regions = reception.regions.map(r => ({ ...r, content: r.id === first ? 'text:intro' : r.id === 'region:right' ? 'image:portrait' : r.id === 'region:links' ? 'links' : 'details',
    padding: r.id === 'region:right' ? 0 : 32, surface: r.id === first ? '#101111' : null }));
  reception.branding.name = 'NOMAD';
  const draft = root.getDraft();
  draft.identityPresentation.alias = 'Human underneath';
  draft.identityPresentation.card = { version: 1, columns: 2, background: { type: 'plain', color: '#161818', speed: 1 }, fields: [
    { id: 'field:location', label: 'Location', type: 'text', value: 'Underneath' },
    { id: 'field:medium', label: 'Medium', type: 'text', value: 'Illustration / world building' }] };
  if (!root.commitCompletedOperation({ ...draft, reception }, { expectedGeneration: root.getGeneration() })) throw Error('Invalid sample');
}
window.receptionFixture = { root, fail: value => { failing = value; }, publish: () => buildProfileDocumentV9({ profileAddress, profileIdentity: reviewProfile, systemWorkflowDraft: root.getDraft(), assetRecords: assets }) };
function CanvasOverview({ onAbout }) {
  const generation = useSyncExternalStore(root.subscribe, root.getGeneration);
  const previews = useMemo(() => {
    const available = new Map(assets.map(asset => [asset.id, asset]));
    return root.listWorkbenches().map(item => { const entry = root.readWorkbench(item.id);
      return { ...entry, model: workbenchOverviewModel(entry.draft, available) }; });
  }, [generation]);
  const [selectedId, select] = useState(root.getWorkbenchId), [view, setView] = useState({ layout: 'grid', wrap: true });
  const [cardSize, setCardSize] = useState(2), selected = previews.find(item => item.id === selectedId) || previews[0];
  return <WorkbenchOverview items={previews} previews={previews} selected={selected} model={selected.model}
    profile={reviewProfile} onSelect={select} view={view} onViewChange={setView} cardSize={cardSize} onCardSize={setCardSize} onOpenReception={onAbout} />;
}
function Fixture() {
  const publicView = new URLSearchParams(location.search).has('public');
  const [surface, setSurface] = useState(publicView ? 'reception' : 'edit');
  if (surface === 'canvases') return <CanvasOverview onAbout={() => setSurface(publicView ? 'reception' : 'edit')} />;
  return surface === 'edit' ? <ReceptionStoreEditor rootStore={root} onClose={() => setSurface('reception')}
    onCanvases={() => setSurface('canvases')} reviewAssets={assets} reviewCategories={[]} reviewProfile={reviewProfile} storage={storage}/>
    : <ProfileOverview document={window.receptionFixture.publish()} onOpenCanvas={() => setSurface('canvases')} />;
}
createRoot(document.getElementById('root')).render(<Fixture />);
