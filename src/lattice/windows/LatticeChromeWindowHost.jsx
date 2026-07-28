import LatticeChromeWindow from './LatticeChromeWindow.jsx';
import LatticeRailWindowContent from './LatticeRailWindowContent.jsx';
import LatticeToolbarWindowContent from './LatticeToolbarWindowContent.jsx';
import { LATTICE_CHROME_REGIONS } from './useLatticeChromeWindows.js';
import useLatticeChromePresence from './useLatticeChromePresence.js';
import './latticeChromeWindowContent.css';

const RAIL_WINDOWS = Object.freeze({
  categories: { footer: 'PUBLIC PRESENTATION', title: 'CATEGORIES' },
  creations: { footer: 'AUTHORED WORK / FIXTURE', title: 'CREATIONS' },
  activity: { footer: 'SIGNAL ADAPTER / UNRESOLVED', title: 'ACTIVITY' },
  discover: { footer: 'PUBLIC DIRECTORY / UNRESOLVED', position: 'center', title: 'DISCOVER' },
});
const TOOLBAR_WINDOWS = Object.freeze({
  theme: { footer: 'PUBLIC APPEARANCE / SESSION', title: 'THEME' },
  publish: { footer: 'NO EXTERNAL EFFECTS', title: 'PUBLISH' },
  settings: { footer: 'PREFERENCES / UNRESOLVED', title: 'SETTINGS' },
  interface: { footer: 'PRIVATE EDITOR / SESSION', title: 'INTERFACE' },
});

export default function LatticeChromeWindowHost({ commands, controller, data, railCollapsed = false }) {
  const railPresence = useLatticeChromePresence(controller.railId);
  const toolbarPresence = useLatticeChromePresence(TOOLBAR_WINDOWS[controller.toolbarId] ? controller.toolbarId : null);
  const railWindow = RAIL_WINDOWS[railPresence.renderedValue];
  const toolbarWindow = TOOLBAR_WINDOWS[toolbarPresence.renderedValue];
  return <>
    {railWindow && <LatticeChromeWindow {...railWindow} animateContent={railPresence.contentMotion} contentKey={railPresence.renderedValue} onMotionComplete={railPresence.completeAnimation} onRequestClose={(reason) => reason === 'escape' ? controller.closeDeepest() : controller.closeRegion(LATTICE_CHROME_REGIONS.RAIL)} phase={railPresence.phase} position={railWindow.position || 'rail'} railCollapsed={railCollapsed}><LatticeRailWindowContent data={data.rail} windowId={railPresence.renderedValue} /></LatticeChromeWindow>}
    {toolbarWindow && <LatticeChromeWindow {...toolbarWindow} animateContent={toolbarPresence.contentMotion} contentKey={toolbarPresence.renderedValue} onMotionComplete={toolbarPresence.completeAnimation} onRequestClose={(reason) => reason === 'escape' ? controller.closeDeepest() : controller.closeRegion(LATTICE_CHROME_REGIONS.TOOLBAR)} phase={toolbarPresence.phase} position="toolbar"><LatticeToolbarWindowContent commands={commands.toolbar} data={data.toolbar} windowId={toolbarPresence.renderedValue} /></LatticeChromeWindow>}
  </>;
}
