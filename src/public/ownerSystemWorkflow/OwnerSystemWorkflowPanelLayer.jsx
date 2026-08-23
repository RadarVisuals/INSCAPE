import OwnerSystemWorkflowActivity from './OwnerSystemWorkflowActivity.jsx';
import OwnerSystemWorkflowDiscover from './OwnerSystemWorkflowDiscoverWorkspace.jsx';
import OwnerSystemWorkflowLibraryWorkspace from './OwnerSystemWorkflowLibraryWorkspace.jsx';
import OwnerSystemWorkflowManual from './OwnerSystemWorkflowManual.jsx';
import OwnerSystemWorkflowProfile from './OwnerSystemWorkflowProfile.jsx';
import OwnerSystemWorkflowSelectionInspector from './OwnerSystemWorkflowSelectionInspector.jsx';
import OwnerSystemWorkflowSettings from './OwnerSystemWorkflowSettings.jsx';
import SystemWorkflowGridSwitcher from './SystemWorkflowGridSwitcher.jsx';

function PanelPresence({ children, id, panels }) {
  const state = panels.presence[id];
  return <div className="system-workflow__panel-presence" data-panel-phase={state.phase} data-system-workflow-panel
    onTransitionEnd={(event) => { if (event.propertyName === 'opacity') panels.completePanelTransition(id); }}>{children}</div>;
}

export default function OwnerSystemWorkflowPanelLayer({ activity, assets, assetsById, categoryCommands, browser, controller, crop, discoveryCommands, discoveryGroups, layout, libraryData,
  layersOpen, menuSurface, onChangeGrid, onClose, onDossierChange, onLayersOpenChange, onVisitProfile, panelOccupied, panels, profileIdentity, profileModel,
  reviewDiscovery, workspaceSurfaceColor }) {
  const show = (id) => panels.presence[id];
  return <>
    {!panelOccupied && layersOpen && <OwnerSystemWorkflowSelectionInspector assetsById={assetsById} controller={controller} crop={crop} layout={layout}
      onBeginCrop={crop.beginCrop} onMinimize={() => onLayersOpenChange(false)} />}
    {show('grids').present && <PanelPresence id="grids" panels={panels}><SystemWorkflowGridSwitcher controller={controller} data-layout={layout.mode} onSelectGrid={onChangeGrid} /></PanelPresence>}
    {show('docs').present && <PanelPresence id="docs" panels={panels}><OwnerSystemWorkflowManual onClose={onClose} /></PanelPresence>}
    {show('library').present && <PanelPresence id="library" panels={panels}>
      <OwnerSystemWorkflowLibraryWorkspace categoryCommands={categoryCommands} controller={controller} data={libraryData}
        menuSurface={menuSurface} onClose={onClose} phase={show('library').phase} /></PanelPresence>}
    {show('profile').present && <PanelPresence id="profile" panels={panels}><div className="system-workflow__profile-layer">
      <OwnerSystemWorkflowProfile guideVisible={controller.draft.appearance.guideMode !== 'NONE'} identity={profileIdentity} layout={layout} menuSurface={menuSurface} model={profileModel}
        onDossierChange={onDossierChange} phase={show('profile').phase} workspaceSurfaceColor={workspaceSurfaceColor} /></div></PanelPresence>}
    {show('activity').present && <PanelPresence id="activity" panels={panels}>
      <OwnerSystemWorkflowActivity activity={activity} onClose={onClose} phase={show('activity').phase} /></PanelPresence>}
    {show('discover').present && <PanelPresence id="discover" panels={panels}>
      <OwnerSystemWorkflowDiscover assets={assets} fixture={reviewDiscovery} groupCommands={discoveryCommands} groups={discoveryGroups} menuSurface={menuSurface} onClose={onClose}
        onSelect={(entry) => { panels.closePanel({ returnFocus: false }); onVisitProfile?.(entry.address); }} phase={show('discover').phase} /></PanelPresence>}
    {show('settings').present && <PanelPresence id="settings" panels={panels}>
      <OwnerSystemWorkflowSettings appearance={controller.draft.appearance} controller={controller} menuSurface={menuSurface}
        onClose={onClose} phase={show('settings').phase} /></PanelPresence>}
  </>;
}
