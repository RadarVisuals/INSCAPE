import { useEffect, useLayoutEffect, useState } from 'react';
import WorkspaceNavigation from './WorkspaceNavigation.jsx';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import './workbenchSidebar.css';

export default function OwnerSystemWorkflowSidebar({ hostRef, hidden, onNavigationHost, ...actions }) {
  const { locked } = useWorkbenchCamera(), view = useWorkbenchView();
  const { setNavigationInset, setNavigationTop } = view;
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
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const inset = visible && !compact ? 232 : 0;
    setNavigationInset(inset); setNavigationTop(40);
    host.style.setProperty('--workspace-navigation-inset', `${inset}px`);
    host.style.setProperty('--workspace-navigation-top', '40px');
    return () => { setNavigationInset(0); setNavigationTop(0); host.style.removeProperty('--workspace-navigation-inset'); host.style.removeProperty('--workspace-navigation-top'); };
  }, [visible, compact, hostRef, setNavigationInset, setNavigationTop]);
  return <WorkspaceNavigation {...actions} hidden={!visible} className="workbench-sidebar" navigationHost={setNavigationHost}
    style={{ '--sidebar-bottom': `${Math.max(12, innerHeight - (view.toolViewportBottom ?? innerHeight - 48) + 8)}px` }} />;
}
