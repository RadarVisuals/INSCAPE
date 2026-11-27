import ReferenceWorkspaceNavigation from './referenceWorkspaceNavigation.jsx';
import './navigationPreview.css';

export default function NavigationPreview({ collapsed, onCollapse, libraryOpen, onLibrary, onWorkbench, navigationHost }) {
  return <ReferenceWorkspaceNavigation reference collapsed={collapsed} onCollapse={onCollapse} onWorkbench={onWorkbench}
    onLibrary={onLibrary} openPanels={libraryOpen ? ['library'] : []} navigationHost={navigationHost} />;
}
