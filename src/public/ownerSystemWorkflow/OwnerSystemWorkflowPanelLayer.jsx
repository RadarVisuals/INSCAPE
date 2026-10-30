import { lazy, Suspense, useRef } from 'react';
import PublicEntryPortal from '../../startveil/PublicEntryPortal.jsx';
import OwnerSystemWorkflowLibraryWorkspace from './OwnerSystemWorkflowLibraryWorkspace.jsx';
import OwnerSystemWorkflowManual from './OwnerSystemWorkflowManual.jsx';
import OwnerSystemWorkflowProfile from './OwnerSystemWorkflowProfile.jsx';
import OwnerSystemWorkflowSettings from './OwnerSystemWorkflowSettings.jsx';
import SystemWorkflowGridSwitcher from './SystemWorkflowGridSwitcher.jsx';

const OwnerSystemWorkflowActivity = lazy(() => import('./OwnerSystemWorkflowActivity.jsx'));

function PanelPresence({ children, id, panels, retained = false }) {
  const state = panels.presence[id];
  return <div aria-hidden={!state.present || undefined} className="system-workflow__panel-presence" data-panel-phase={state.phase} data-system-workflow-panel={id}
    hidden={retained && !state.present} inert={retained && !state.present ? '' : undefined}
    onTransitionEnd={(event) => { if (event.propertyName === 'opacity') panels.completePanelTransition(id); }}>{children}</div>;
}

export default function OwnerSystemWorkflowPanelLayer({ libraryPreferences, navigationHost, workbenchImageTargetRef, moduleAssetTargetRef, placementTargetRef, shortcutTargetRef, workspaceRef, activity, authoringLocked = false, categoryCommands, connectedProfile, controller, libraryData,
  profileAddress, onMenuSurfaceChange, menuSurface, onChangeGrid, onClose, onConnect, onDisconnect, onOpenIdentity, onOpenReception, onEditReception, onEnterMyWorld, onVisitProfile, panels, profileIdentity, profileModel,
  resolveAssetDimensions, workbenchPreferences, onWorkbenchPreferencesChange, backupControls }) {
  const show = (id) => panels.presence[id];
  const libraryMounted = useRef(false);
  if (show('library').present) libraryMounted.current = true;
  return <>
    {show('grids').present && <PanelPresence id="grids" panels={panels}>
      <SystemWorkflowGridSwitcher controller={controller} onClose={onClose} onSelectGrid={onChangeGrid} />
    </PanelPresence>}
    {show('docs').present && <PanelPresence id="docs" panels={panels}><OwnerSystemWorkflowManual onClose={onClose} /></PanelPresence>}
    {libraryMounted.current && <PanelPresence id="library" panels={panels} retained>
      <OwnerSystemWorkflowLibraryWorkspace preferenceStore={libraryPreferences} navigationHost={navigationHost} workbenchImageTargetRef={workbenchImageTargetRef} moduleAssetTargetRef={moduleAssetTargetRef} placementTargetRef={placementTargetRef} shortcutTargetRef={shortcutTargetRef} workspaceRef={workspaceRef}
        placementScope={`${profileAddress}:${controller?.moduleId || ''}:${controller?.selectedGridId || ''}`}
        authoringLocked={authoringLocked} categoryCommands={categoryCommands} data={libraryData}
        menuSurface={menuSurface} onClose={() => panels.closePanel({ panelId: 'library' })} phase={show('library').phase}
        resolveAssetDimensions={resolveAssetDimensions} /></PanelPresence>}
    {show('profile').present && <PanelPresence id="profile" panels={panels}><div className="system-workflow__profile-layer"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <OwnerSystemWorkflowProfile identity={profileIdentity} model={profileModel} onClose={onClose} onOpenIdentity={onOpenIdentity}
        onOpenReception={onOpenReception ? () => { panels.closePanel({ returnFocus: false }); onOpenReception(); } : undefined}
        onEditReception={onEditReception ? () => { panels.closePanel({ returnFocus: false }); onEditReception(); } : undefined}
        onDisconnect={onDisconnect} phase={show('profile').phase} /></div></PanelPresence>}
    {show('activity').present && <PanelPresence id="activity" panels={panels}>
      <Suspense fallback={null}><OwnerSystemWorkflowActivity activity={activity} onClose={onClose}
        phase={show('activity').phase} /></Suspense></PanelPresence>}
    {show('discover').present && <PanelPresence id="discover" panels={panels}>
      <PublicEntryPortal connectedProfile={connectedProfile || profileIdentity} embedded initialMode="explore" onClose={onClose} menuSurface={menuSurface}
        onConnect={onConnect} onDisconnect={onDisconnect}
        onEnterMyWorld={() => { onClose(); onEnterMyWorld?.(); }}
        onVisitProfile={(address) => { panels.closePanel({ returnFocus: false }); onVisitProfile?.(address); }} /></PanelPresence>}
    {show('settings').present && <PanelPresence id="settings" panels={panels}>
      <OwnerSystemWorkflowSettings profileAddress={profileAddress} onMenuSurfaceChange={onMenuSurfaceChange} menuSurface={menuSurface}
        onClose={onClose} onWorkbenchPreferencesChange={onWorkbenchPreferencesChange}
        phase={show('settings').phase} workbenchPreferences={workbenchPreferences} backupControls={backupControls} /></PanelPresence>}
  </>;
}
