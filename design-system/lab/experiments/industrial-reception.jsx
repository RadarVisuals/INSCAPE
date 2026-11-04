import { useState } from 'react';
import OwnerSystemWorkflowRuntime from '../../../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import ReceptionOverview from '../../../src/reception/ReceptionOverview.jsx';
import { createSystemWorkflowDraftStore } from '../../../src/systemWorkflow/systemWorkflowDraftStore.js';
import { projectReception } from '../../../src/profileDocument/domain/receptionPresentation.js';
import { createReceptionEditorScope } from '../../../src/reception/receptionEditorScope.js';
import { saveWorkbenchLayout } from '../../../src/public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import receptionSample from '../samples/industrial-reception.json';

export const description = 'AFTER INDUSTRY — 1920 × 1080. Eight native Reception cells, four photographs and editable text. A separate local sample in the existing Editor.';
export const sources = ['src/reception/ReceptionDocumentCanvas.jsx', 'src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx'];
export const fullViewport = true;
export const edgeToEdge = true;
const profileAddress = '0x1111111111111111111111111111111111111111';
const prefix = 'inscape:design-lab:industrial-reception-v1:';
const storage = {
  getItem: key => localStorage.getItem(prefix + key),
  setItem: (key, value) => localStorage.setItem(prefix + key, value),
  removeItem: key => localStorage.removeItem(prefix + key),
};
export function resetSample() {
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
}
export default function IndustrialReception() {
  if (!new URLSearchParams(location.search).has('frame')) {
    const url = new URL(location.href); url.searchParams.set('frame', '1');
    return <iframe title="AFTER INDUSTRY — Reception" src={url.href} style={{ width: '100%', height: 'max(720px, calc(100dvh - 180px))', border: 0, display: 'block' }} />;
  }
  return <Sample />;
}
function Sample() {
  const [editing, setEditing] = useState(new URLSearchParams(location.search).get('view') === 'edit');
  const [store] = useState(() => {
    const next = createSystemWorkflowDraftStore({ profileAddress, storage });
    if (!next.getSnapshot().reception) {
      if (!next.commitCompletedOperation({ ...next.getDraft(), reception: structuredClone(receptionSample) }, { expectedGeneration: next.getGeneration() }))
        throw new Error('The industrial Reception sample could not be saved.');
      const scope = createReceptionEditorScope(next);
      try {
        const draft = scope.getDraft();
        if (!saveWorkbenchLayout(profileAddress, draft, draft.workbench,
          Object.fromEntries(draft.texts.map(text => [text.id, { mode: 'read' }])), storage, 'reception'))
          throw new Error('The sample reading view could not be saved.');
      } finally { scope.release(); }
    }
    return next;
  });
  return <div style={{ position: 'relative', height: '100dvh' }}>
    {editing ? <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={store} reviewStorage={storage}
      receptionEditorRequested onOpenReception={() => setEditing(false)} reviewAssets={[]} reviewCategories={[]}
      reviewProfile={{ status: 'RESOLVED', normalizedAddress: profileAddress, name: 'AFTER INDUSTRY', description: 'Industrial photography — editorial study', tags: [], links: [] }} />
      : <ReceptionOverview reception={projectReception(store.getSnapshot().reception)}
        model={{ profile: { displayName: 'AFTER INDUSTRY' }, officialProfile: { name: 'AFTER INDUSTRY' } }} onEdit={() => setEditing(true)} />}
  </div>;
}
