import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clampMenuPosition } from './contextMenuModel.js';

const PANEL_WIDTH = 224;
const ROW_HEIGHT = 43;
const SYSTEM_WORKFLOW_PANEL_WIDTH = 196;
const SYSTEM_WORKFLOW_ROW_HEIGHT = 38;

export default function DesktopMenu({ anchor, commands, label, menuSurfaceId = null, onCommand, onClose, returnFocus, className = '', panelClassName = '', getSubmenuCommands, onPreviewCommand, systemWorkflowOverlay = false }) {
  const ref = useRef(null);
  const hoverTimerRef = useRef(0);
  const [position, setPosition] = useState(anchor);
  const [openPath, setOpenPath] = useState([]);
  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPosition(clampMenuPosition(anchor, rect, { width: window.innerWidth, height: window.innerHeight }));
    ref.current?.querySelector('button')?.focus();
  }, [anchor]);
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') { event.preventDefault(); onPreviewCommand?.(null); onClose(); returnFocus?.focus?.(); } };
    const outside = (event) => { if (!ref.current?.contains(event.target)) onClose(); };
    window.addEventListener('keydown', close); window.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', outside, true); window.clearTimeout(hoverTimerRef.current); };
  }, [onClose, onPreviewCommand, returnFocus]);
  const onKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); const buttons = [...ref.current.querySelectorAll('button:not(:disabled)')];
    const offset = event.key === 'ArrowDown' ? 1 : -1; const index = buttons.indexOf(document.activeElement);
    buttons[(index + offset + buttons.length) % buttons.length]?.focus();
  };
  const submenuFor = (command) => getSubmenuCommands?.(command.id)?.filter((entry) => !['menu-root', 'menu-appearance'].includes(entry.id)) || [];
  const openSubmenu = (depth, command, immediate = false) => {
    const submenu = submenuFor(command);
    window.clearTimeout(hoverTimerRef.current);
    if (!submenu.length) {
      setOpenPath((current) => current.slice(0, depth));
      onPreviewCommand?.(command.id);
      return;
    }
    const apply = () => { onPreviewCommand?.(null); setOpenPath((current) => [...current.slice(0, depth), command.id]); };
    if (immediate) apply();
    else hoverTimerRef.current = window.setTimeout(apply, 110);
  };
  const renderPanel = (panelCommands, depth = 0, panelViewportTop = position.y) => {
    const openId = openPath[depth];
    const openIndex = panelCommands.findIndex((command) => command.id === openId);
    const openCommand = openIndex >= 0 ? panelCommands[openIndex] : null;
    const submenu = openCommand ? submenuFor(openCommand) : [];
    const panelWidth = systemWorkflowOverlay ? SYSTEM_WORKFLOW_PANEL_WIDTH : PANEL_WIDTH;
    const rowHeight = systemWorkflowOverlay ? SYSTEM_WORKFLOW_ROW_HEIGHT : ROW_HEIGHT;
    const opensLeft = position.x + panelWidth * (depth + 2) > window.innerWidth - 8;
    const desiredChildTop = panelViewportTop + openIndex * rowHeight;
    const childHeight = submenu.length * rowHeight + 2;
    const childViewportTop = Math.max(8, Math.min(desiredChildTop, window.innerHeight - childHeight - 8));
    const childTop = childViewportTop - panelViewportTop - 1;
    return <>
      {panelCommands.map((command) => {
        const hasSubmenu = submenuFor(command).length > 0;
        const legacySelected = command.label.startsWith('✓ ');
        const selected = command.selected || legacySelected;
        const mixed = command.mixed === true;
        const displayLabel = (legacySelected ? command.label.slice(2) : command.label).replace(/\s*>$/, '');
        return <button key={command.id} type="button" role={command.checkable ? 'menuitemcheckbox' : 'menuitem'} disabled={command.disabled} data-submenu={hasSubmenu || undefined} data-selected={selected || undefined} data-mixed={mixed || undefined} aria-checked={command.checkable ? mixed ? 'mixed' : selected : undefined} aria-haspopup={hasSubmenu ? 'menu' : undefined} aria-expanded={hasSubmenu ? openId === command.id : undefined}
          onPointerEnter={() => openSubmenu(depth, command)} onFocus={() => { if (depth > 0) openSubmenu(depth, command, true); }}
          onClick={() => { if (hasSubmenu) { openSubmenu(depth, command, true); return; } onPreviewCommand?.(null); onCommand(command.id); }}><i aria-hidden="true" /><span>{displayLabel}</span><b aria-hidden="true">{hasSubmenu ? '›' : mixed ? '−' : selected ? '·' : ''}</b></button>;
      })}
      {submenu.length > 0 && <div className={`desktop-menu desktop-menu--flyout${panelClassName ? ` ${panelClassName}` : ''}`}
        data-system-workflow-overlay={systemWorkflowOverlay || undefined} role="menu" aria-label={`${openCommand.label} options`}
        style={{ position: 'absolute', top: childTop, left: opensLeft ? 'auto' : `calc(100% + 4px)`, right: opensLeft ? `calc(100% + 4px)` : 'auto' }}>
        {renderPanel(submenu, depth + 1, childViewportTop)}
      </div>}
    </>;
  };
  return <div ref={ref} className={`desktop-menu${getSubmenuCommands ? ' desktop-menu--cascade' : ''}${className ? ` ${className}` : ''}`}
    data-lattice-menu-surface={menuSurfaceId || undefined} data-menu-surface={menuSurfaceId || undefined}
    data-system-workflow-overlay={systemWorkflowOverlay || undefined}
    role="menu" aria-label={label} style={{ left: position.x, top: position.y }} onKeyDown={onKeyDown} onPointerLeave={() => { window.clearTimeout(hoverTimerRef.current); setOpenPath([]); onPreviewCommand?.(null); }}>
    {renderPanel(commands)}
  </div>;
}
