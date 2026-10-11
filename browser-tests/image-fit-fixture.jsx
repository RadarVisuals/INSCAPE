import React, { useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import ImageWorkbench from '../src/imageModule/ImageWorkbench.jsx';
import { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView } from '../src/public/ownerSystemWorkflow/WorkbenchView.jsx';
import { useWorkbenchCamera } from '../src/public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { WorkbenchPlacement } from '../src/public/ownerSystemWorkflow/WorkbenchPlacement.jsx';
import Grid from '../src/public/ownerSystemWorkflow/WorkbenchAlignmentGrid.jsx';
import { ContextToolbar, ContextToolbarProvider } from '../src/public/ownerSystemWorkflow/ContextToolbar.jsx';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9Asset } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

export function mount() {
  const profileAddress = `0x${'1'.repeat(40)}`, values = new Map();
  const api = { failSave: false };
  const store = createSystemWorkflowDraftStore({ profileAddress, storage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { if (api.failSave) throw Error('Storage full'); values.set(key, value); },
  } });
  const asset = buildProfileDocumentV9Asset(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id);
  const bitmap = document.createElement('canvas'); bitmap.width = 2560; bitmap.height = 1440;
  const ink = bitmap.getContext('2d'); ink.fillStyle = '#de7633'; ink.fillRect(0, 0, bitmap.width, bitmap.height);
  ink.fillStyle = '#24190f'; ink.fillRect(900, 500, 500, 300);
  api.source = bitmap.toDataURL();
  const draft = store.getDraft();
  draft.imageModules = ['one', 'two', 'three', 'four'].map((id, index) => ({
    id: `image:${id}`, name: `Image ${index + 1}`, width: index < 2 ? 984 : 978, height: 552, visibility: 'PUBLIC',
    sides: [{ id: `side:${id}`, asset: { ...asset, media: { ...asset.media, url: 'https://image.fit.test/source.png', width: 2560, height: 1440 } },
      crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: index % 2 === 1 } }],
  }));
  draft.workbench = { ...createDefaultWorkbenchPresentation(), imageModules: draft.imageModules.map((image, index) => ({
    id: image.id, open: true, position: { left: index < 2 ? 3576 : 4560, top: index % 2 ? 1944 : 1392 },
  })) };
  store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
  api.store = store;
  function Scene({ draft, owner }) {
    const hostRef = useRef(null), view = useWorkbenchView(), camera = useWorkbenchCamera();
    const [target, setTarget] = useState('image:one');
    const [preferences, setPreferences] = useState({ edge: true, grid: true });
    const [single, setSingle] = useState(false);
    Object.assign(api, { select: setTarget, single: setSingle, setPreferences, selection: view.setSelection,
      camera: (scale, offset) => { view.setScale(scale); camera.setOffset(offset); },
      frame: id => ({ ...view.frames.get(id)?.current }),
    });
    return <ContextToolbarProvider target={target}><WorkbenchPlacement hostRef={hostRef} enabled={preferences.edge && owner} gridEnabled={preferences.grid && owner} gap={0}>
      <main ref={hostRef} tabIndex={-1} className="system-workflow" data-surface="carbon" data-lattice-menu-surface data-menu-surface="carbon" style={{ position: 'fixed', inset: 0, background: '#383a3a' }}>
        <Grid mode="DOTS" color="#111313" /><WorkbenchViewControls hostRef={hostRef} />
        <ImageWorkbench records={single ? draft.imageModules.slice(0, 1) : draft.imageModules} presentations={draft.workbench.imageModules}
          store={owner ? store : null} profileAddress={profileAddress} onActivate={setTarget} />
        {owner && <ContextToolbar menuSurface="carbon" />}
      </main>
    </WorkbenchPlacement></ContextToolbarProvider>;
  }
  function App() {
    const draft = useSyncExternalStore(store.subscribe, store.getSnapshot), [owner, setOwner] = useState(true);
    api.owner = setOwner;
    return <WorkbenchViewProvider store={owner ? store : null} profileAddress={profileAddress} presentation={draft.workbench}>
      <Scene draft={draft} owner={owner} />
    </WorkbenchViewProvider>;
  }
  window.imageFitFixture = api;
  createRoot(document.getElementById('root')).render(<App />);
}
