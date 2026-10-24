import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import Visitor from '../src/profileDocument/components/ProfileDocumentV9Visitor.jsx';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { addShape, editShape } from '../src/shapes/shapeSession.js';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

// Isolated review storage. No real profile, artwork, wallet or publication.
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
const profileAddress = '0x8888888888888888888888888888888888888888';
const store = createSystemWorkflowDraftStore({ profileAddress, storage });
const base = addShape(store, profileAddress, { position: { left: 100, top: 180 }, size: { width: 740, height: 420 } });
editShape(store, profileAddress, store.getDraft().shapes.find(item => item.id === base), { name: 'Colour ground', color: '#30363e', grain: .12 });
const object = addShape(store, profileAddress, { position: { left: 544, top: 240 }, size: { width: 100, height: 100 } });
editShape(store, profileAddress, store.getDraft().shapes.find(item => item.id === object), { name: 'Move me', color: '#b98b62' });
addShape(store, profileAddress, { kind: 'grid', position: { left: 500, top: 180 }, size: { width: 340, height: 420 } });
const seed = store.getDraft(); seed.shapes = [seed.shapes[0], seed.shapes[1], seed.shapes[2]]; seed.workbench.display.open = false; seed.workbench.identity.open = false;
store.commitCompletedOperation(seed, { expectedGeneration: store.getGeneration(), historyLabel: 'Prepare pattern review' });

function Review() {
  const [visitor, setVisitor] = useState(false), [revision, setRevision] = useState(0);
  const draft = createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft();
  return <>
    {visitor ? <Visitor key={revision} document={buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: draft, assetRecords: [] })} />
      : <Runtime key={revision} profileAddress={profileAddress} reviewStorage={storage} reviewAssets={[]}
        reviewCategories={[]} reviewActivity={[]} reviewProfile={{ name: 'Shape patterns review' }} />}
    <div style={{ position: 'fixed', zIndex: 200, top: 8, right: 8, display: 'flex', gap: 8 }}>
      <button onClick={() => setVisitor(value => !value)}>{visitor ? 'Review owner' : 'Review visitor'}</button>
      <button onClick={() => setRevision(value => value + 1)}>Reopen saved review</button>
      <button onClick={() => document.querySelector('main.system-workflow')?.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, ctrlKey: true, deltaY: 120, clientX: 640, clientY: 350,
      }))}>Review zoom out</button>
    </div>
  </>;
}
createRoot(document.getElementById('root')).render(<Review />);
