import { useState } from 'react';
import { createPortal } from 'react-dom';
import RackMenu from '../menus/RackMenu.jsx';
import { removeWorkbenchModule } from '../../systemWorkflow/removeWorkbenchModule.js';

export default function useModuleShortcutMenu({ store, profileAddress, kind, record }) {
  const [menu, setMenu] = useState(null), [error, setError] = useState('');
  const open = event => {
    if (!store) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    setMenu({ x: event.clientX || bounds.left, y: event.clientY || bounds.bottom,
      expected: record, profile: profileAddress,
      returnFocus: event.currentTarget.closest('.system-workflow')?.querySelector('[aria-label="Profile"]'),
      surface: event.currentTarget.closest('[data-menu-surface]')?.dataset.menuSurface });
  };
  return { onContextMenu: open,
    onKeyDown: event => { if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') open(event); },
    content: <>{menu && createPortal(<RackMenu anchor={menu} commands={[{ id: 'delete', label: 'DELETE' }]}
      label="Module shortcut commands" menuSurfaceId={menu.surface} onClose={() => setMenu(null)} systemWorkflowOverlay
      onCommand={() => {
        try {
          if (!removeWorkbenchModule(store, menu.profile, kind, menu.expected)) setError('Could not delete this module. Reopen its menu and try again.');
          else requestAnimationFrame(() => menu.returnFocus?.focus());
        } catch { setError('Could not delete this module. Your saved work is unchanged.'); }
        setMenu(null);
      }} />, document.body)}
      {error && <button className="system-workflow__notice" role="alert" onClick={() => setError('')}>{error}</button>}</> };
}
