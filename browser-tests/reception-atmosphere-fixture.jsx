import React, { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from '../src/reception/receptionEditorScope.js';
import { createReceptionEditorDocument, projectReceptionEditorDocument } from '../src/reception/receptionEditorDocument.js';
import { createReceptionExample } from '../design-system/lab/receptionExample.js';
import ReceptionOverview from '../src/reception/ReceptionOverview.jsx';
import ReceptionEditorPreview from '../src/reception/ReceptionEditorPreview.jsx';
import { interfaceTheme } from '../src/interfaceTheme.js';
import '../src/index.css';

const address = '0x3333333333333333333333333333333333333333', query = new URLSearchParams(location.search);
const prefix = `atmosphere:${query.get('session') || 'default'}:`;
let failing = false;
const storage = { getItem: key => localStorage.getItem(prefix + key), removeItem: key => localStorage.removeItem(prefix + key),
  setItem: (key, value) => { if (failing) throw Error('Fixture storage full'); localStorage.setItem(prefix + key, value); } };
const root = createSystemWorkflowDraftStore({ profileAddress: address, storage });
if (root.getDraft().reception?.version !== 3) {
  const draft = root.getDraft(), source = createReceptionExample();
  source.imageModules[0].artwork.crop = null; source.surface = '#111820'; source.height = 600;
  draft.reception = createReceptionEditorDocument(source, { width: query.has('small') ? 480 : query.has('compact') ? 960 : 1440 });
  root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() });
}
const store = createReceptionEditorScope(root);
const model = { address, profile: { displayName: 'nomad', avatarUrl: '/assets/actors/skull_reaper/full.webp' },
  officialProfile: { name: 'nomad', description: query.has('longBio') ? 'A long profile biography. '.repeat(200) : 'I wake in the dust, the wind stirring only the fabric draped around my absence.',
    tags: ['Artist', 'Non-fiction', 'Self Expression'], url: `https://universaleverything.io/${address}` },
  authoredProfile: {}, links: [{ id: 'x', label: 'VXCTXR on X', url: 'https://x.com/VXCTXRGRPHX' }], status: { metadata: 'RESOLVED' } };
window.atmosphereFixture = { root, store, fail: value => { failing = value; } };
interfaceTheme.setMode(query.get('theme') === 'light' ? 'light' : 'dark');
function Fixture() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [preview, setPreview] = useState(!query.has('public'));
  const reception = store.getReception();
  return <div className="system-workflow" style={{ position: 'fixed', inset: 0, pointerEvents: 'auto' }}>
    {preview ? <ReceptionEditorPreview key={state.profileAddress} reception={reception} model={model} store={store}
      workspaceDestinations={{ Reception: () => setPreview(false) }}
      history={store.getHistory()} onHistory={direction => store[direction]()} saveState="Saved locally" onClose={() => setPreview(false)} />
      : <ReceptionOverview reception={projectReceptionEditorDocument(reception)} model={model} address={address}
        onEdit={() => setPreview(true)} onOpenCanvas={() => {}} />}
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
