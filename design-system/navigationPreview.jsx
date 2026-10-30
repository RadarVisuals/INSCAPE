import WorkspaceNavigation from '../src/public/ownerSystemWorkflow/WorkspaceNavigation.jsx';
import './navigationPreview.css';

export default function NavigationPreview({ collapsed, onCollapse, libraryOpen, onLibrary, onWorkbench, onGrids, navigationHost }) {
  return <WorkspaceNavigation reference collapsed={collapsed} onCollapse={onCollapse} onWorkbench={onWorkbench}
    onLibrary={onLibrary} openPanels={libraryOpen ? ['library'] : []} navigationHost={navigationHost}
    onOpen={(id) => { if (id === 'grids') onGrids?.(); }} />;
}
