import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { addTextModule } from '../src/text/textSession.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { editorPreferencesKey } from '../src/public/ownerSystemWorkflow/editorPreferencesStore.js';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

const profileAddress = `0x${'1'.repeat(40)}`;
const storage = { getItem: k => localStorage.getItem(k), setItem: (k, v) => {
  if (window.failDraft && k.startsWith('inscape.system-workflow-draft') || window.failLayout && k.startsWith('inscape:workbench:layout')) throw Error('full');
  localStorage.setItem(k, v);
} };
const store = createSystemWorkflowDraftStore({ profileAddress, storage });
if (store.getRecordState().status === 'absent') {
  addTextModule(store, profileAddress);
  const draft = store.getDraft(); draft.texts[0].article.title = 'Arrival';
  draft.texts[0].article.content.content = [{ type: 'paragraph', content: [{ type: 'text', text: 'Remember this arrangement.' }] }];
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.area = { left: 0, top: 0, width: 1440, height: 1000 };
  draft.workbench.texts = [{ ...createTextPresentation(draft.texts[0].id), window: { left: 40, top: 100, width: 300, height: 430 } }];
  store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
}
window.readRawDraft = () => JSON.parse(storage.getItem(systemWorkflowDraftKey(profileAddress)));
window.readDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft();
window.readLayout = () => JSON.parse(localStorage.getItem(`inscape:workbench:layout:v1:${profileAddress}`));
window.readPreferences = () => JSON.parse(localStorage.getItem(editorPreferencesKey(profileAddress)))?.value;
createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: storage, reviewAssets: [], reviewCategories: [], reviewActivity: [], reviewProfile: { name: 'Reload review' } }));
