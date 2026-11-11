import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OwnerSystemWorkflowRuntime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { addShape } from '../src/shapes/shapeSession.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, fixtureAsset } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import '../src/index.css';

const profileAddress = '0x3333333333333333333333333333333333333333';
const query = new URLSearchParams(location.search);
const prefix = `native-reception:${query.get('session') || 'default'}:`;
let failing = false;
const storage = {
  getItem: key => localStorage.getItem(prefix + key),
  setItem: (key, value) => { if (failing) throw new Error('Fixture storage full'); localStorage.setItem(prefix + key, value); },
  removeItem: key => localStorage.removeItem(prefix + key),
};
const root = createSystemWorkflowDraftStore({ profileAddress, storage });
if (!root.getDraft().shapes?.length) addShape(root.getWorkbenchScope(), profileAddress, { position: { left: 50, top: 80 }, size: { width: 220, height: 160 } });
window.nativeReceptionFixture = { root, fail: value => { failing = value; } };
let gutterReader;
window.nativeReceptionFixture.showGutterReader = async (scale, phase) => {
  const { default: Canvas } = await import('../src/reception/ReceptionDocumentCanvas.jsx');
  let node = document.getElementById('gutter-reader');
  if (!node) { node = document.createElement('div'); node.id = 'gutter-reader'; document.body.append(node); gutterReader = createRoot(node); }
  Object.assign(node.style, { position:'fixed', left:`${400 + phase}px`, top:'250px', width:'1000px', height:'500px', zIndex:9999, background:'#171717' });
  const reception = structuredClone(root.getDraft().reception);
  reception.workbench.area.width = 1000 / scale;
  gutterReader.render(<Canvas reception={reception} width={1000} />);
};
const assets = [...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS];
if (query.has('logo')) {
  const source = 'https://raw.githubusercontent.com/npm/logos/master/npm%20logo/npm-logo-red.png';
  assets.push(fixtureAsset({ token: 8, name: 'NPM WORDMARK', source, width: 1560, height: 500 }));
}
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
