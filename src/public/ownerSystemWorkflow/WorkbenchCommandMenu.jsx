import { useState } from 'react';
import RackMenu from '../menus/RackMenu.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { unprojectWorkbenchPosition } from './workbenchSpace.js';

// Preserve the invocation point, rather than the submenu click or the menu's
// viewport-clamped position. Workbench owns conversion from screen to world.
export default function WorkbenchCommandMenu({ anchor, onCommand, ...props }) {
  const view = useWorkbenchView(), { offset } = useWorkbenchCamera();
  const [position] = useState(() => unprojectWorkbenchPosition({ left: anchor.x, top: anchor.y }, view.scale, offset));
  return <RackMenu {...props} anchor={anchor} onCommand={id => onCommand(id, {
    position, workbench: view.getPresentation(),
  })} />;
}
