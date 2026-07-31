import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clampMenuPosition } from './contextMenuModel.js';

const PANEL_WIDTH = 224;
const ROW_HEIGHT = 27;

export default function DesktopMenu({ anchor, commands, label, onCommand, onClose, returnFocus, className = '', panelClassName = '', getSubmenuCommands, onPreviewCommand }) {
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
    const opensLeft = position.x + PANEL_WIDTH * (depth + 2) > window.innerWidth - 8;
    const desiredChildTop = panelViewportTop + 4 + openIndex * ROW_HEIGHT;
    const childHeight = submenu.length * ROW_HEIGHT + 8;
    const childViewportTop = Math.max(8, Math.min(desiredChildTop, window.innerHeight - childHeight - 8));
    const childTop = childViewportTop - panelViewportTop;
    return <>
      {panelCommands.map((command) => {
        const hasSubmenu = submenuFor(command).length > 0;
        const selected = command.label.startsWith('✓ ');
        const displayLabel = (selected ? command.label.slice(2) : command.label).replace(/\s*>$/, '');
        return <button key={command.id} type="button" role="menuitem" disabled={command.disabled} data-submenu={hasSubmenu || undefined} data-selected={selected || undefined} aria-haspopup={hasSubmenu ? 'menu' : undefined} aria-expanded={hasSubmenu ? openId === command.id : undefined}
          onPointerEnter={() => openSubmenu(depth, command)} onFocus={() => openSubmenu(depth, command, true)}
          onClick={() => { if (hasSubmenu) { openSubmenu(depth, command, true); return; } onPreviewCommand?.(null); onCommand(command.id); }}><i aria-hidden="true" /><span>{displayLabel}</span><b aria-hidden="true">{hasSubmenu ? '›' : selected ? '·' : ''}</b></button>;
      })}
      {submenu.length > 0 && <div className={`desktop-menu desktop-menu--flyout${panelClassName ? ` ${panelClassName}` : ''}`} role="menu" aria-label={`${openCommand.label} options`} style={{ position: 'absolute', top: childTop, left: opensLeft ? 'auto' : `calc(100% + 4px)`, right: opensLeft ? `calc(100% + 4px)` : 'auto' }}>
        {renderPanel(submenu, depth + 1, childViewportTop)}
      </div>}
    </>;
  };
  return <div ref={ref} className={`desktop-menu${getSubmenuCommands ? ' desktop-menu--cascade' : ''}${className ? ` ${className}` : ''}`} role="menu" aria-label={label} style={{ left: position.x, top: position.y }} onKeyDown={onKeyDown} onPointerLeave={() => { window.clearTimeout(hoverTimerRef.current); onPreviewCommand?.(null); }}>
    {renderPanel(commands)}
  </div>;
}
