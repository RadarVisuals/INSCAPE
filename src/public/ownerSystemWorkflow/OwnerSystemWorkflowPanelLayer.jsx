import { lazy, Suspense, useRef } from 'react';
import PublicEntryPortal from '../../startveil/PublicEntryPortal.jsx';
import OwnerSystemWorkflowLibraryWorkspace from './OwnerSystemWorkflowLibraryWorkspace.jsx';
import OwnerSystemWorkflowManual from './OwnerSystemWorkflowManual.jsx';
import OwnerSystemWorkflowProfile from './OwnerSystemWorkflowProfile.jsx';
import OwnerSystemWorkflowSelectionInspector from './OwnerSystemWorkflowSelectionInspector.jsx';
import OwnerSystemWorkflowSettings from './OwnerSystemWorkflowSettings.jsx';
import SystemWorkflowGridSwitcher from './SystemWorkflowGridSwitcher.jsx';

const OwnerSystemWorkflowActivity = lazy(() => import('./OwnerSystemWorkflowActivity.jsx'));

function PanelPresence({ children, id, panels, retained = false }) {
  const state = panels.presence[id];
  return <div aria-hidden={!state.present || undefined} className="system-workflow__panel-presence" data-panel-phase={state.phase} data-system-workflow-panel
    hidden={retained && !state.present} inert={retained && !state.present ? '' : undefined}
    onTransitionEnd={(event) => { if (event.propertyName === 'opacity') panels.completePanelTransition(id); }}>{children}</div>;
}

export default function OwnerSystemWorkflowPanelLayer({ activity, assets, assetsById, categoryCommands, browser, connectedProfile, controller, crop, discoveryCommands, discoveryGroups, layout, libraryData,
  layersOpen, menuSurface, onChangeGrid, onClose, onConnect, onDisconnect, onDossierChange, onEnterMyWorld, onLayersOpenChange, onVisitProfile, panelOccupied, panels, profileIdentity, profileModel,
  resolveAssetDimensions, reviewDiscovery, workspaceSurfaceColor }) {
  const show = (id) => panels.presence[id];
  const libraryMounted = useRef(false);
  if (show('library').present) libraryMounted.current = true;
  return <>
    {!panelOccupied && layersOpen && <OwnerSystemWorkflowSelectionInspector assetsById={assetsById} controller={controller} crop={crop} layout={layout}
      onBeginCrop={crop.beginCrop} onMinimize={() => onLayersOpenChange(false)} />}
    {show('grids').present && <PanelPresence id="grids" panels={panels}><SystemWorkflowGridSwitcher controller={controller} data-layout={layout.mode} onSelectGrid={onChangeGrid} /></PanelPresence>}
    {show('docs').present && <PanelPresence id="docs" panels={panels}><OwnerSystemWorkflowManual onClose={onClose} /></PanelPresence>}
    {libraryMounted.current && <PanelPresence id="library" panels={panels} retained>
      <OwnerSystemWorkflowLibraryWorkspace categoryCommands={categoryCommands} controller={controller} data={libraryData}
        menuSurface={menuSurface} onClose={onClose} phase={show('library').phase}
        resolveAssetDimensions={resolveAssetDimensions} /></PanelPresence>}
    {show('profile').present && <PanelPresence id="profile" panels={panels}><div className="system-workflow__profile-layer"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <OwnerSystemWorkflowProfile identity={profileIdentity} layout={layout} menuSurface={menuSurface} model={profileModel}
        onClose={onClose} onDossierChange={onDossierChange} phase={show('profile').phase} workspaceSurfaceColor={workspaceSurfaceColor} /></div></PanelPresence>}
    {show('activity').present && <PanelPresence id="activity" panels={panels}>
      <Suspense fallback={null}><OwnerSystemWorkflowActivity activity={activity} onClose={onClose}
        phase={show('activity').phase} /></Suspense></PanelPresence>}
    {show('discover').present && <PanelPresence id="discover" panels={panels}>
      <PublicEntryPortal connectedProfile={connectedProfile || profileIdentity} embedded initialMode="explore" onClose={onClose}
        onConnect={onConnect} onDisconnect={onDisconnect}
        onEnterMyWorld={() => { onClose(); onEnterMyWorld?.(); }}
        onVisitProfile={(address) => { panels.closePanel({ returnFocus: false }); onVisitProfile?.(address); }} /></PanelPresence>}
    {show('settings').present && <PanelPresence id="settings" panels={panels}>
      <OwnerSystemWorkflowSettings appearance={controller.draft.appearance} controller={controller} menuSurface={menuSurface}
        onClose={onClose} phase={show('settings').phase} /></PanelPresence>}
  </>;
}
