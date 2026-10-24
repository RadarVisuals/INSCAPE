import { useEffect, useLayoutEffect, useState } from 'react';
import WorkspaceNavigation from './WorkspaceNavigation.jsx';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import './workbenchSidebar.css';

export default function OwnerSystemWorkflowSidebar({ session, hostRef, hidden, onNavigationHost, ...actions }) {
  const { locked } = useWorkbenchCamera(), view = useWorkbenchView();
  const { setNavigationInset, setNavigationTop } = view;
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 900px)').matches);
  const [menuOnly, setMenuOnly] = useState(() => matchMedia('(max-width: 600px) and (max-height: 640px)').matches);
  const [collapsed, setCollapsed] = useState(() => session.current ?? matchMedia('(max-width: 900px), (max-height: 600px)').matches);
  const [navigationHost, setNavigationHost] = useState(null);
  const visible = !hidden && !locked;
  const changeCollapsed = value => { session.current = value; setCollapsed(value); };
  useEffect(() => {
    const media = matchMedia('(max-width: 900px)');
    const resize = () => { setMenuOnly(matchMedia('(max-width: 600px) and (max-height: 640px)').matches); setCompact(media.matches); setCollapsed(media.matches ? true : session.current ?? false); };
    media.addEventListener('change', resize); window.addEventListener('resize', resize);
    return () => { media.removeEventListener('change', resize); window.removeEventListener('resize', resize); };
  }, [session]);
  useLayoutEffect(() => {
    // Only the expanded desktop sidebar hosts the existing Library tree.
    // Collapsed/narrow layouts return it to Library, keeping categories reachable.
    onNavigationHost(visible && !collapsed && !compact ? navigationHost : null);
    return () => onNavigationHost(null);
  }, [visible, collapsed, compact, navigationHost, onNavigationHost]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const inset = visible && !compact ? (collapsed ? 52 : 208) + 24 : 0;
    setNavigationInset(inset);
    setNavigationTop(visible && compact ? (menuOnly ? 68 : 136) : 0);
    host.style.setProperty('--workspace-navigation-inset', `${inset}px`);
    host.style.setProperty('--workspace-navigation-top', `${visible && compact ? (menuOnly ? 68 : 136) : 8}px`);
    host.dataset.sidebarCollapsed = String(collapsed);
    host.dataset.sidebarMenu = String(menuOnly);
    return () => { setNavigationInset(0); setNavigationTop(0); host.style.removeProperty('--workspace-navigation-inset'); host.style.removeProperty('--workspace-navigation-top'); delete host.dataset.sidebarCollapsed; delete host.dataset.sidebarMenu; };
  }, [visible, compact, menuOnly, collapsed, hostRef, setNavigationInset, setNavigationTop]);
  const triggerFor = trigger => menuOnly ? hostRef.current?.querySelector('.workspace-navigation-collapse') || trigger : trigger;
  const open = action => event => { if (compact) changeCollapsed(true); action?.({ currentTarget: triggerFor(event.currentTarget) }); };
  return <WorkspaceNavigation {...actions} hidden={!visible} className="workbench-sidebar" collapsed={collapsed}
    onCollapse={() => changeCollapsed(!collapsed)} navigationHost={setNavigationHost}
    onWorkbench={open(actions.onWorkbench)} onLibrary={open(actions.onLibrary)}
    onPreview={open(actions.onPreview)} onPublish={open(actions.onPublish)}
    onOpen={(id, trigger) => { if (compact) changeCollapsed(true); actions.onOpen(id, triggerFor(trigger)); }}
    style={{ '--sidebar-bottom': `${Math.max(12, innerHeight - (view.toolViewportBottom ?? innerHeight - 48) + 8)}px` }} />;
}
