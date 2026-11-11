import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OwnerSystemWorkflowRuntime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from '../src/reception/receptionEditorScope.js';
import { addShape, editShape } from '../src/shapes/shapeSession.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import '../src/index.css';

const profileAddress = '0x3333333333333333333333333333333333333333';
const prefix = `reception-recovery:${new URLSearchParams(location.search).get('session') || 'default'}:`;
let failing = false;
const storage = { getItem: key => localStorage.getItem(prefix + key),
  setItem: (key, value) => { if (failing) throw Error('Fixture storage full'); localStorage.setItem(prefix + key, value); },
  removeItem: key => localStorage.removeItem(prefix + key) };
const memory = new Map(), source = createSystemWorkflowDraftStore({ profileAddress,
  storage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) } });
const publishedScope = createReceptionEditorScope(source);
for (const [index, color] of ['#cc2222', '#000000'].entries()) {
  const id = addShape(publishedScope, profileAddress, { position: { left: index * 480, top: 0 }, size: { width: 460, height: 500 } });
  editShape(publishedScope, profileAddress, publishedScope.getSnapshot().shapes.find(item => item.id === id),
    { name: index ? 'Published black' : 'Published red', color, opacity: 1, visibility: 'PUBLIC' });
  publishedScope.turnShapeIntoCell(id);
}
const document = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: source.getDraft(), assetRecords: [] });
publishedScope.release();
const root = createSystemWorkflowDraftStore({ profileAddress, storage });
if (!root.getDraft().reception) {
  const scope = createReceptionEditorScope(root);
  const id = addShape(scope, profileAddress, { position: { left: 100, top: 100 }, size: { width: 800, height: 500 } });
  editShape(scope, profileAddress, scope.getSnapshot().shapes.find(item => item.id === id), { name: 'Local study' });
  scope.turnShapeIntoCell(id);
  scope.release();
}
window.receptionRecoveryFixture = { root, document, fail: value => { failing = value; } };
function Fixture() {
  const [status, setStatus] = useState('RESOLVED');
  window.receptionRecoveryFixture.setStatus = setStatus;
  return <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={root} reviewStorage={storage}
    publishedResolution={{ status, document }} receptionEditorRequested reviewAssets={[]}
    reviewCategories={[]} reviewActivity={[]} reviewProfile={{ name: 'Recovery verification' }} />;
}
createRoot(globalThis.document.getElementById('root')).render(<div className="application-root" data-application-mode="public">
  <div className="application-interface" data-visible><Fixture /></div>
</div>);
