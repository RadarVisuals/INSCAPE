import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import ProfileEditingBoundary from '../src/systemWorkflow/ProfileEditingBoundary.jsx';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createSystemWorkflowAuthoringSession } from '../src/systemWorkflow/systemWorkflowAuthoringSession.js';
import { addKeeperDock } from '../src/keeper/keeperSession.js';
import { addTextModule, saveTextModule } from '../src/text/textSession.js';
import { addShape } from '../src/shapes/shapeSession.js';
import { resolveImageLibrarySide } from '../src/imageModule/imageLibrarySide.js';
import { addImageModule, saveImageModule } from '../src/imageModule/imageModuleSession.js';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

async function mountFixture() {
  // Isolated, disposable scene. No user draft or preference is read or written.
  const params = new URLSearchParams(location.search), sample = params.get('sample');
  const values = new Map();
  const storage = params.has('persistent') ? localStorage : { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const profileAddress = '0x9999999999999999999999999999999999999999';
  const seeded = storage.getItem(systemWorkflowDraftKey(profileAddress)) !== null;
  const assets = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => sample === 'navigator' ? asset : ({ ...asset, imageUrl: asset.src, thumbnailUrl: asset.src, originalImageUrl: asset.src }));
  const store = createSystemWorkflowDraftStore({ profileAddress, storage });
  const session = createSystemWorkflowAuthoringSession({ store });
  if (!seeded) {
  if (params.has('theme')) session.setAppearance({ expectedAppearance: session.getState().draft.appearance, appearance: { menuSurfaceId: params.get('theme') === 'mist' ? 'mist' : 'carbon' } });
  for (let index = 0; index < (sample === 'layers' ? 24 : 1); index++) {
    session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: assets[index % assets.length].id,
      destination: { column: 2 + index % 6 * 4, row: 2 + Math.floor(index / 6) * 3, columnSpan: 5, rowSpan: 5 } });
  }
  if (sample === 'keeper') addKeeperDock(store, profileAddress, { position: { left: 24, top: 24 } });
  if (sample === 'shape') addShape(store, profileAddress, { position: { left: 100, top: 100 } });
  if (sample === 'image') addImageModule(store, profileAddress);
  if (sample === 'actions') {
    addShape(store, profileAddress, { position: { left: 100, top: 100 } });
    addImageModule(store, profileAddress, {
      side: await resolveImageLibrarySide(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[6]), size: { width: 360, height: 240 }, position: { left: 520, top: 100 },
    });
  }
  if (sample === 'navigator') {
    addKeeperDock(store, profileAddress);
    addShape(store, profileAddress, { position: { left: 200, top: 600 } });
    addImageModule(store, profileAddress, { side: await resolveImageLibrarySide(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[6]), size: { width: 420, height: 280 }, position: { left: 520, top: 600 } });
    const image = store.getDraft().imageModules.at(-1);
    saveImageModule(store, profileAddress, image, { ...image, sides: [...image.sides, await resolveImageLibrarySide(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[5])] });
    const id = addTextModule(store, profileAddress, { position: { left: 80, top: 900 } });
    const text = store.getDraft().texts.find(item => item.id === id);
    saveTextModule(store, profileAddress, text, { ...text, article: { ...text.article, title: 'Navigator study', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A live miniature of this composition.' }] }] } } });
  }
  }
  // Test-only read access to the disposable draft. All edits use the real UI.
  window.readToolChromeDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft();
  // Activity exercises the real signal hook and read-marker persistence. Only the
  // external refresh is held locally so loading/failure states are deterministic.
  if (sample === 'activity') {
    const { resetSignalStoreForTests, useSignalStore } = await import('../src/signals/state/useSignalStore.js');
    const { createFixtureSignal, SIGNAL_TYPES } = await import('../src/signals/domain/keeperSignal.js');
    const { signalStorageKey, saveSignalDocument } = await import('../src/signals/storage/signalStorage.js');
    const signalStorage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => {
      if (window.blockSignalSave) throw Error('Injected quota error'); localStorage.setItem(key, value);
    } };
    resetSignalStoreForTests(profileAddress, signalStorage);
    if (!localStorage.getItem(signalStorageKey(profileAddress))) {
      const types = [SIGNAL_TYPES.ASSET_RECEIVED, SIGNAL_TYPES.LYX_RECEIVED, SIGNAL_TYPES.PROFILE_FOLLOWED];
      const titles = ['Artwork received', 'LYX received', 'Profile followed'];
      const history = Array.from({ length: 18 }, (_, index) => ({ ...createFixtureSignal({
        sourceReference: `activity-review-${index}`, timestamp: 1792742400000 - index * 3600000,
        type: types[index % 3], title: `${titles[index % 3]} ${index + 1}`,
        assetReference: { name: index === 0 ? 'A layered study with a deliberately long source title for the narrow screen' : `Study ${index + 1}` },
      }, profileAddress), read: index % 2 !== 0 }));
      saveSignalDocument(signalStorage, { ...useSignalStore.getState().document, initialized: true, history });
      resetSignalStoreForTests(profileAddress, signalStorage);
    }
    window.activityRefreshRequests = 0;
    useSignalStore.setState({ status: 'ready', synchronize: async () => {
      window.activityRefreshRequests++; useSignalStore.setState({ status: 'loading', error: null, partialError: null });
    } });
  }
  if (params.has('navigation-tools')) {
    const { openWorkbenchIndex, editWorkbenchIndex } = await import('../src/systemWorkflow/workbenchIndexSession.js');
    openWorkbenchIndex(store, profileAddress);
    const index = store.getSnapshot().workbenchIndex;
    editWorkbenchIndex(store, profileAddress, index, { ...index, pinned: true });
  }
  const content = <Runtime profileAddress={profileAddress} reviewStorage={storage} reviewAssets={assets}
    reviewCategories={[]} reviewActivity={sample === 'activity' ? undefined : []} reviewProfile={{ name: 'Companion tool review' }} />;
  const root = createRoot(document.getElementById('root'));
  window.leaveToolChromeEditor = () => root.render(<p>Editor closed</p>);
  root.render(params.has('persistent')
    ? <ProfileEditingBoundary profileAddress={profileAddress}>{content}</ProfileEditingBoundary> : content);
}

mountFixture();
