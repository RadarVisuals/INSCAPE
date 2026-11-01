import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OwnerSystemWorkflowRuntime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { addShape } from '../src/shapes/shapeSession.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import '../src/index.css';

const profileAddress = '0x3333333333333333333333333333333333333333';
const prefix = `native-reception:${new URLSearchParams(location.search).get('session') || 'default'}:`;
let failing = false;
const storage = {
  getItem: key => localStorage.getItem(prefix + key),
  setItem: (key, value) => { if (failing) throw new Error('Fixture storage full'); localStorage.setItem(prefix + key, value); },
  removeItem: key => localStorage.removeItem(prefix + key),
};
const root = createSystemWorkflowDraftStore({ profileAddress, storage });
if (!root.getDraft().shapes?.length) addShape(root.getWorkbenchScope(), profileAddress, { position: { left: 50, top: 80 }, size: { width: 220, height: 160 } });
window.nativeReceptionFixture = { root, fail: value => { failing = value; } };
const assets = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS;
function Fixture() {
  const [editing, setEditing] = useState(true);
  return editing ? <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={root} reviewStorage={storage}
    receptionEditorRequested onOpenReception={() => setEditing(false)}
    reviewAssets={assets} reviewCategories={[]} reviewActivity={[]} reviewProfile={{ name: 'Native Reception' }} />
    : <button type="button" style={{ pointerEvents: 'auto' }} onClick={() => setEditing(true)}>Edit Reception</button>;
}
// Match the real application's pointer-transparent interface. The Editor must
// load its own base styles when opened directly, without visiting another route.
createRoot(document.getElementById('root')).render(<div className="application-root" data-application-mode="public">
  <div className="application-interface" data-visible><Fixture /></div>
</div>);
