import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CompositionDocumentCanvas from '../src/composition/CompositionDocumentCanvas.jsx';
import { compositionPerformanceDocument } from './fixtures/composition-performance.js';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import '../src/index.css';
import '../src/imageModule/imageModule.css';
import '../src/text/text.css';
import '../src/public/ownerSystemWorkflow/workflowTokens.css';

const query = new URLSearchParams(location.search), kind = query.get('case') || 'raster-14';
const composition = compositionPerformanceDocument(kind, location.origin);
const address = '0x4444444444444444444444444444444444444444';
// The benchmark's unique loopback origin and isolated browser context own these
// draft bytes. No browser profile or user draft is opened/copied by this fixture.
const storage = {
  getItem: key => localStorage.getItem(`performance:${key}`),
  setItem: (key, value) => localStorage.setItem(`performance:${key}`, value),
  removeItem: key => localStorage.removeItem(`performance:${key}`),
};
let store, Runtime;
async function prepareEditor() {
  if (!Runtime) Runtime = (await import('../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
  if (!store) {
    store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
    if (!store.commitCompletedOperation({ ...store.getDraft(), composition: structuredClone(composition) },
      { expectedGeneration: store.getGeneration(), historyLabel: 'Seed isolated performance workload' })) throw Error('Performance seed rejected');
  }
}
function Fixture() {
  const [mode, setMode] = useState('reader');
  window.compositionPerf = {
    kind, count: composition.cells.length,
    snapshot: () => structuredClone(store?.getDraft().composition || composition),
    async mount(next) {
      if (!['none', 'reader', 'editor'].includes(next)) throw Error('Invalid fixture mode');
      if (next === 'editor') await prepareEditor();
      setMode(next);
    },
  };
  useEffect(() => { document.documentElement.dataset.perfMode = mode; }, [mode]);
  if (mode === 'none') return null;
  if (mode === 'editor') return <div className="application-root" data-application-mode="public"><div className="application-interface" data-visible>
    <Runtime profileAddress={address} rootStore={store} reviewStorage={storage}
      reviewAssets={[]} reviewCategories={[]} reviewActivity={[]} reviewProfile={{ name: 'Isolated performance fixture' }} />
  </div></div>;
  return <main className="system-workflow__token-scope" style={{ minHeight: '100vh', background: '#171717' }}>
    <CompositionDocumentCanvas composition={composition} width={1440} />
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
