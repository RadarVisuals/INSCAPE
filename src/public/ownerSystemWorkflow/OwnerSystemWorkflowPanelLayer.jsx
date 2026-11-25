import { cloneElement, lazy, Suspense } from 'react';
import { X } from 'lucide-react';
import OwnerSystemWorkflowManual from './OwnerSystemWorkflowManual.jsx';
import OwnerSystemWorkflowProfile from './OwnerSystemWorkflowProfile.jsx';
import OwnerSystemWorkflowSettings from './OwnerSystemWorkflowSettings.jsx';

const OwnerSystemWorkflowActivity = lazy(() => import('./OwnerSystemWorkflowActivity.jsx'));

function PanelPresence({ children, id, panels }) {
  const state = panels.presence[id];
  return <div aria-hidden={!state.present || undefined} className="system-workflow__panel-presence" data-panel-phase={state.phase} data-system-workflow-panel={id}
    onTransitionEnd={(event) => { if (event.propertyName === 'opacity') panels.completePanelTransition(id); }}>{children}</div>;
}

export default function OwnerSystemWorkflowPanelLayer({ activity,
  profileAddress, onClose, onDisconnect, onOpenIdentity, onOpenProfile, panels, profileIdentity, profileModel,
  workbenchPreferences, onWorkbenchPreferencesChange, backupControls, canvasGuides = true }) {
  const show = (id) => panels.presence[id];
  return <>
    {show('docs').present && <PanelPresence id="docs" panels={panels}><OwnerSystemWorkflowManual onClose={onClose} /></PanelPresence>}
    {show('profile').present && <PanelPresence id="profile" panels={panels}><div className="system-workflow__profile-layer"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <OwnerSystemWorkflowProfile identity={profileIdentity} model={profileModel} onClose={onClose} onOpenIdentity={onOpenIdentity}
        onOpenProfile={onOpenProfile ? () => { panels.closePanel({ returnFocus: false }); onOpenProfile(); } : undefined}
        onDisconnect={onDisconnect} phase={show('profile').phase} /></div></PanelPresence>}
    {show('activity').present && <PanelPresence id="activity" panels={panels}>
      <Suspense fallback={null}><OwnerSystemWorkflowActivity activity={activity} onClose={onClose}
        phase={show('activity').phase} /></Suspense></PanelPresence>}
    {show('backup').present && <PanelPresence id="backup" panels={panels}>
      <aside role="dialog" aria-label="Backup" data-workflow-material="tactile" data-workflow-finish="flat"
        className="workbench-tool-panel system-workflow__settings system-workflow__motion-panel"
        inert={show('backup').phase === 'closing' ? '' : undefined}>
        <header className="workbench-tool-panel-header"><h2>Backup</h2><button type="button" className="workbench-tool-panel-close" aria-label="Close Backup" onClick={onClose}><X /></button></header>
        <div className="system-workflow__settings-body">{backupControls && cloneElement(backupControls, { disabled: show('backup').phase === 'closing' })}</div>
      </aside>
    </PanelPresence>}
    {show('settings').present && <PanelPresence id="settings" panels={panels}>
      <OwnerSystemWorkflowSettings profileAddress={profileAddress} canvasGuides={canvasGuides}
        onClose={onClose} onWorkbenchPreferencesChange={onWorkbenchPreferencesChange}
        phase={show('settings').phase} workbenchPreferences={workbenchPreferences} /></PanelPresence>}
  </>;
}
