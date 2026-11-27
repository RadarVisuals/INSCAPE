import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import Settings from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowSettings.jsx';
import Activity from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowActivity.jsx';
import { resetSignalStoreForTests, useSignalStore } from '../src/signals/state/useSignalStore.js';
import { DEFAULT_WORKBENCH_PREFERENCES } from '../src/public/ownerSystemWorkflow/workbenchPreferences.js';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

function renderSettings(root) {
  const profile = '0x1111111111111111111111111111111111111111';
  window.blockSignalSave = false;
  resetSignalStoreForTests(profile, { getItem: key => localStorage.getItem(key), setItem: (key, value) => {
    if (window.blockSignalSave) throw Error('Injected quota error'); localStorage.setItem(key, value);
  } });
  window.signalState = () => useSignalStore.getState();
  root.render(<main className="system-workflow">
    <Settings profileAddress={profile} phase="open" workbenchPreferences={DEFAULT_WORKBENCH_PREFERENCES} onClose={() => {}} onWorkbenchPreferencesChange={() => {}} />
  </main>);
}
function renderActivity(root) {
  const activity = { entries: [{ id: 'received', label: 'Received artwork', detail: 'Test asset', type: 'ASSETS', date: 'Today', time: '12:00', unread: true }],
    status: 'partial', partialError: 'Some source metadata is unavailable.', unreadCount: 1, markRead() {}, refresh() {}, retry() {} };
  root.render(<main className="system-workflow"><Activity activity={activity} phase="open" onClose={() => {}} /></main>);
}

const render = new URLSearchParams(location.search).has('activity') ? renderActivity : renderSettings;
render(createRoot(document.getElementById('root')));
