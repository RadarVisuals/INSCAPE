import { useEffect, useLayoutEffect, useState } from 'react';
import WorkspaceNavigation from './WorkspaceNavigation.jsx';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import './workbenchSidebar.css';

export default function OwnerSystemWorkflowSidebar({ hidden, onNavigationHost, ...actions }) {
  const { locked } = useWorkbenchCamera(), view = useWorkbenchView();
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 900px)').matches);
  const [navigationHost, setNavigationHost] = useState(null);
  const visible = !hidden && !locked;
  useEffect(() => {
    const media = matchMedia('(max-width: 900px)');
    const resize = () => setCompact(media.matches);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  useLayoutEffect(() => {
    onNavigationHost(visible && !compact ? navigationHost : null);
    return () => onNavigationHost(null);
  }, [visible, compact, navigationHost, onNavigationHost]);
  return <WorkspaceNavigation {...actions} hidden={!visible} className="workbench-sidebar" navigationHost={setNavigationHost}
    style={{ '--sidebar-bottom': `${Math.max(12, innerHeight - (view.toolViewportBottom ?? innerHeight - 48) + 8)}px` }} />;
}
