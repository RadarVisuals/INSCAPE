// Diagnostic-only fixture. No production changes and no real profile data.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import Boundary from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { addImageModule } from '../src/imageModule/imageModuleSession.js';
import { resolveImageLibrarySide } from '../src/imageModule/imageLibrarySide.js';
import { addTextModule } from '../src/text/textSession.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/profileDocument/components/publishedProfileStatus.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

const params = new URLSearchParams(location.search);
const scene = params.get('scene') || 'images';
const direct = params.get('direct') === '1';
const profile = '0x' + (scene === 'images' ? params.has('narrow') ? '9026102105' : '9026102101' : direct ? '9026102102' : '9026102103').repeat(4);
const key = systemWorkflowDraftKey(profile);
const assets = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS;
// The Image tests inject a storage wrapper. Text-transfer uses the real
// localStorage object: preserve that difference to reproduce editor authority.
const storage = scene === 'images' ? {
  getItem: name => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
} : localStorage;
if (!localStorage.getItem(key)) {
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  if (scene === 'images') {
    const workbench = createDefaultWorkbenchPresentation(); workbench.display.open = false;
    const square = { ...assets[0], selectedMedia: { url: assets[0].originalImageUrl.replace('actors/abyssal_eye/full.webp', 'PFP/PFP.webp'), width: 2000, height: 2000 } };
    addImageModule(store, profile, { side: await resolveImageLibrarySide(square),
      size: { width: 720, height: 240 }, position: { left: 8, top: 160 }, workbench });
    addImageModule(store, profile, { side: await resolveImageLibrarySide(assets[1]),
      size: { width: 320, height: 300 }, position: { left: params.has('narrow') ? 32 : 900, top: params.has('narrow') ? 470 : 160 } });
  } else addTextModule(store, profile);
}
function Diagnostics() {
  const [value, setValue] = useState('');
  useEffect(() => {
    const update = () => {
      const draft = JSON.parse(localStorage.getItem(key));
      setValue(JSON.stringify({ scene, direct, profile, images: draft.imageModules,
        texts: draft.texts, workbench: draft.workbench }, null, 2));
    };
    update(); const timer = setInterval(update, 500); return () => clearInterval(timer);
  }, []);
  return <details style={{ position: 'fixed', left: 8, bottom: 52, zIndex: 1000, maxWidth: 440, background: '#fff', color: '#111' }}>
    <summary>Isolated review diagnostics</summary><pre aria-label="Saved review draft" style={{ maxHeight: 160, overflow: 'auto', fontSize: 10 }}>{value}</pre>
  </details>;
}
const App = direct ? Runtime : Boundary;
createRoot(document.getElementById('root')).render(<><App profileAddress={profile} reviewStorage={storage} reviewAssets={assets}
  reviewCategories={[]} reviewActivity={[]} reviewProfile={{ name: 'Eight failures review' }} /><Diagnostics /></>);
