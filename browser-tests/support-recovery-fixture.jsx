import React from 'react';
import Portal from '../src/startveil/PublicEntryPortal.jsx';
import Settings from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowSettings.jsx';
import Activity from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowActivity.jsx';
import { resetSignalStoreForTests, useSignalStore } from '../src/signals/state/useSignalStore.js';
import { DEFAULT_WORKBENCH_PREFERENCES } from '../src/public/ownerSystemWorkflow/workbenchPreferences.js';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

export function renderDiscovery(root) {
  const profiles = Array.from({ length: 25 }, (_, i) => ({ address: `0x${(i + 1).toString(16).padStart(40, '0')}`, name: `World ${String(i + 1).padStart(2, '0')}` }));
  const snapshot = { status: 'RESOLVED', document: null, busy: false };
  const resolutionStore = { get: () => snapshot, subscribe: () => () => {}, resolve: async () => snapshot };
  root.render(<Portal initialMode="explore" discoveryRepository={{ list: async () => profiles }} resolutionStore={resolutionStore} />);
}
export function renderSettings(root) {
  const profile = '0x1111111111111111111111111111111111111111';
  window.blockSignalSave = false;
  resetSignalStoreForTests(profile, { getItem: key => localStorage.getItem(key), setItem: (key, value) => {
    if (window.blockSignalSave) throw Error('Injected quota error'); localStorage.setItem(key, value);
  } });
  window.signalState = () => useSignalStore.getState();
  root.render(<main className="system-workflow" data-menu-surface="mist">
    <Settings appearance={{ menuSurfaceId: 'mist' }} controller={{ draft: { profileAddress: profile }, setAppearance() {} }}
      menuSurface="mist" phase="open" workbenchPreferences={DEFAULT_WORKBENCH_PREFERENCES} onClose={() => {}} onWorkbenchPreferencesChange={() => {}} />
  </main>);
}
export function renderActivity(root) {
  const activity = { entries: [{ id: 'received', label: 'Received artwork', detail: 'Test asset', type: 'ASSETS', date: 'Today', time: '12:00', unread: true }],
    status: 'partial', partialError: 'Some source metadata is unavailable.', unreadCount: 1, markRead() {}, refresh() {}, retry() {} };
  root.render(<main className="system-workflow" data-menu-surface="mist"><Activity activity={activity} phase="open" onClose={() => {}} /></main>);
}
