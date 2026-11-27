import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import RackMenu from './RackMenu.jsx';
import './workspaceSwitcher.css';

// Each surface supplies the destinations it can actually open.
export default function WorkspaceSwitcher({ current, label = current, destinations, disabled, onChoose }) {
  const trigger = useRef(null);
  const [menu, setMenu] = useState(null);
  const open = (focusLast = false) => {
    const bounds = trigger.current.getBoundingClientRect();
    setMenu({ anchor: { x: bounds.left, y: bounds.bottom + 4 }, focusLast });
  };
  useEffect(() => {
    if (!menu) return;
    const close = () => { setMenu(null); trigger.current?.focus({ preventScroll: true }); };
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [menu]);
  const choices = Object.entries(destinations).filter(([, action]) => action);
  return <div className="workspace-switcher">
    <button type="button" className="workspace-switcher-trigger" ref={trigger} title={`Switch workspace · ${label}`}
      aria-haspopup="menu" aria-expanded={Boolean(menu)} disabled={disabled}
      onClick={() => menu ? setMenu(null) : open()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          open(event.key === 'ArrowUp');
        }
      }}><span>{label}</span><ChevronDown size={16} aria-hidden="true" /></button>
    {menu && <RackMenu label="Workspace menu" palette="editor" anchor={menu.anchor} focusLast={menu.focusLast}
      systemWorkflowOverlay menuBarRef={trigger} returnFocus={trigger.current} onClose={() => setMenu(null)}
      commands={choices.map(([name]) => ({ id: name, label: name, checkable: true, selected: name === current }))}
      onCommand={name => {
        setMenu(null);
        trigger.current?.focus({ preventScroll: true });
        const navigate = () => destinations[name](trigger.current);
        if (onChoose) onChoose(navigate); else navigate();
      }} />}
  </div>;
}
