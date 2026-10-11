import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { resolveLibraryImageAsset } from '../src/library/resolveLibraryImageAsset.js';
import { parseKeeperRig } from '../src/keeper/keeperRig.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

// The production owner runtime with disposable in-memory storage. No access to
// the owner's real draft, account connection, uploads or contract state.
const variant = new URLSearchParams(location.search).get('variant') === 'small' ? 'small' : 'big';
const profile = OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
const storage = createOwnerSystemWorkflowReviewStorage(), key = systemWorkflowDraftKey(profile);
const url = `${location.origin}/browser-tests/fixtures/keeper-snake-${variant}.svg`;
const source = await (await fetch(url)).text();
document.getElementById('root').textContent = 'Preparing local preview transport…';
const transport = await navigator.serviceWorker.register('/browser-tests/keeper-snake-worker.js', { scope: '/browser-tests/' });
document.getElementById('root').textContent = 'Activating local preview transport…';
const worker = transport.installing || transport.waiting || transport.active;
if (worker?.state !== 'activated') await new Promise(resolve => worker.addEventListener('statechange', () => {
  if (worker.state === 'activated') resolve();
}));
document.getElementById('root').textContent = 'Connecting local preview transport…';
if (!navigator.serviceWorker.controller) await new Promise(resolve => {
  // Some embedded browsers only attach a worker on the next navigation.
  const timer = setTimeout(() => location.reload(), 250);
  navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once: true });
});
// Keep this page's active worker until it closes, but do not register it for
// future visits or the owner's root Workbench.
await transport.unregister();
const fixtureUrl = `https://keeper-snake.inscape.test/${variant}.svg`;
const doc = text => new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
let checks = 0;
const expect = (value, message) => { if (!value) throw new Error(message); checks++; };
const rig = parseKeeperRig(doc(source));
expect(rig.kind === 'snake' && rig.parts.length === (variant === 'big' ? 20 : 40), 'snake parts');
for (const mutate of [
  svg => svg.querySelector('#segment-1').id = 'segment-49',
  svg => svg.querySelector('#eye').remove(),
  svg => svg.querySelector('#body').setAttribute('transform', 'translate(1 1)'),
  svg => svg.querySelector('image').setAttribute('href', 'https://example.invalid/eye.webp'),
  svg => svg.querySelector('image').setAttribute('width', '9999'),
  svg => svg.querySelector('#keeper').setAttribute('data-keeper-rig', 'unknown'),
  svg => svg.querySelector('#segment-1').id = 'segment-2',
]) {
  const svg = doc(source); mutate(svg);
  let rejected = false; try { parseKeeperRig(svg); } catch { rejected = true; }
  expect(rejected, 'invalid rig rejected');
}
const asset = await resolveLibraryImageAsset({ ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], name: `${variant} snake`,
  title: `${variant} snake`, selectedMedia: { url: fixtureUrl, width: 2048, height: 2048 } });
const draft = JSON.parse(storage.getItem(key));
draft.keeperDocks = [{ id: 'keeper:snake-preview', name: `${variant === 'big' ? 'Broad' : 'Fine'} snake`, asset,
  faces: 'right', movement: 'swim', size: 384, visibility: 'PRIVATE' }];
draft.workbench = createDefaultWorkbenchPresentation();
draft.workbench.display.open = false;
draft.workbench.keeperDocks = [{ id: 'keeper:snake-preview', position: { left: 520, top: 240 } }];
storage.setItem(key, JSON.stringify(draft));

async function inputChecks(event) {
  const button = event.currentTarget, output = button.nextElementSibling;
  button.disabled = true;
  output.textContent = 'Checking controls…';
  try {
    const original = storage.getItem(key);
    const host = document.querySelector('.system-workflow__workbench');
    const position = () => {
      const m = new DOMMatrix(getComputedStyle(document.querySelector('.keeper-roamer')).transform);
      return { x: m.m41, y: m.m42 };
    };
    const send = (target, type, x, y, button = 0, buttons = 0) => target.dispatchEvent(new PointerEvent(type,
      { clientX: x, clientY: y, button, buttons, pointerId: 73, pointerType: 'mouse', bubbles: true, cancelable: true }));
    const until = async predicate => {
      for (let i = 0; i < 120; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
      throw new Error('Motion did not reach its target.');
    };
    const near = (x, y) => Math.hypot(position().x - x, position().y - y) < 9;
    const left = Math.max(260, innerWidth * .3), right = Math.min(innerWidth - 250, innerWidth * .7);
    const y = Math.max(270, Math.min(innerHeight - 285, innerHeight * .55));
    send(host, 'pointerdown', right, y, 0, 1); send(host, 'pointerup', right, y);
    await until(() => near(right, y)); expect(true, 'left click destination');
    send(host, 'pointerdown', left, y, 2, 2);
    await until(() => near(left, y)); expect(true, 'right hold begins');
    send(document.querySelector('.keeper-dock'), 'pointermove', right, y + 25, 2, 2);
    await until(() => near(right, y + 25)); expect(true, 'right hold crosses controls');
    send(window, 'pointerup', right, y + 25, 2, 0);
    send(host, 'pointermove', left, y, 0, 0);
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(near(right, y + 25), 'release stops cursor following');
    const eye = document.querySelector('[data-keeper-part="eye"]');
    expect(new DOMMatrix(getComputedStyle(eye).transform).b === 0, 'eye stays upright');
    expect(storage.getItem(key) === original, 'motion never writes the draft');
    output.textContent = `${checks} checks passed: import, click, right hold, release, eye, draft.`;
  } catch (error) { output.textContent = `FAILED: ${error.message}`; }
  finally { button.disabled = false; }
}

createRoot(document.getElementById('root')).render(<>
  <Runtime profileAddress={profile} reviewStorage={storage} reviewAssets={[]} reviewCategories={[]}
    reviewActivity={[]} reviewDiscovery={[]} reviewProfile={{ name: 'Snake preview' }} />
  <aside style={{ position: 'fixed', left: 20, right: 20, maxWidth: 560, boxSizing: 'border-box', top: 12, zIndex: 60, color: 'var(--workflow-ink, #ddd)',
    font: '12px/1.6 "Inscape Sora", sans-serif', background: 'var(--workflow-panel, #222)', padding: 8 }}>
    Snake preview · separate temporary Workbench · {variant === 'big' ? '18 broad segments' : '38 fine ribs'}<br />
    <a href="?variant=big">Broad snake</a> · <a href="?variant=small">Fine snake</a><br />
    Release from the dock, then click empty space or hold right mouse to steer.<br />
    <button onClick={inputChecks}>Check input after releasing</button> <output>{checks} import checks passed.</output>
  </aside>
</>);
