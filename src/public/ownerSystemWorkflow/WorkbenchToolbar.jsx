import { createElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Command, Hand, Image, Info, Layers, MousePointer2, Plus, Search, Shapes, Type, X } from 'lucide-react';
import './workflowTactile.css';
import './workbenchToolbar.css';

const EMPTY_COMMANDS = [];
const POPUP_LABELS = { actions: 'Actions', add: 'Add module', shapes: 'Shapes' };

function searchCommands(commands, query, parents = [], unavailable = null) {
  return commands.flatMap(command => {
    const ancestry = [...parents, command.label];
    const reason = unavailable || (command.disabled ? command.reason || 'Unavailable' : null);
    if (command.children?.length) return searchCommands(command.children, query, ancestry, reason);
    return `${ancestry.join(' ')} ${command.group || ''}`.toLocaleLowerCase().includes(query)
      ? [{ ...command, ...(reason ? { disabled: true, reason } : {}), group: parents.join(' / ') || command.group }] : [];
  });
}

function CommandIcon({ icon }) {
  return isValidElement(icon) ? icon : icon ? createElement(icon, { 'aria-hidden': true }) : null;
}

// This view owns only its popup and keyboard focus. Workbench supplies current
// tool/selection state and commands; module actions retain their existing owners.
export default function WorkbenchToolbar({
  activeTool = 'select', onToolChange, onOpenLibrary, libraryOpen = false,
  actions = EMPTY_COMMANDS, addCommands = EMPTY_COMMANDS, shapeCommands = EMPTY_COMMANDS,
  layers, info, hidden = false, actionRequest = 0,
}) {
  const rootRef = useRef(null), barRef = useRef(null), popupRef = useRef(null), searchRef = useRef(null);
  const triggerRef = useRef(null), actionsRef = useRef(null), requestRef = useRef(actionRequest);
  const [popup, setPopup] = useState(null), [path, setPath] = useState([]), [query, setQuery] = useState('');
  const popupId = useId();
  const roots = popup === 'add' ? addCommands : popup === 'shapes' ? shapeCommands : actions;
  let commands = roots, title = POPUP_LABELS[popup];
  for (const id of path) {
    const parent = commands.find(command => command.id === id);
    if (!parent?.children) break;
    commands = parent.children;
    title = parent.label;
  }
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCommands = normalizedQuery ? searchCommands(roots, normalizedQuery) : commands;

  const close = (restoreFocus = false) => {
    setPopup(null); setPath([]); setQuery('');
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };
  const open = (name, trigger) => {
    triggerRef.current = trigger;
    setPopup(name); setPath([]); setQuery('');
  };
  const toggle = (name, event) => popup === name ? close() : open(name, event.currentTarget);

  useLayoutEffect(() => {
    if (hidden) return;
    const host = rootRef.current?.closest('.system-workflow'), bar = barRef.current;
    if (!host || !bar) return;
    const previous = host.style.getPropertyValue('--workbench-toolbar-clearance');
    const measure = () => host.style.setProperty('--workbench-toolbar-clearance', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      if (previous) host.style.setProperty('--workbench-toolbar-clearance', previous);
      else host.style.removeProperty('--workbench-toolbar-clearance');
    };
  }, [hidden]);

  useEffect(() => {
    if (actionRequest === requestRef.current) return;
    requestRef.current = actionRequest;
    if (!hidden) open('actions', actionsRef.current);
  }, [actionRequest, hidden]);
  useEffect(() => { if (hidden) { setPopup(null); setPath([]); setQuery(''); } }, [hidden]);
  useLayoutEffect(() => {
    if (!popup || hidden) return;
    if (popup === 'actions') searchRef.current?.focus({ preventScroll: true });
    else popupRef.current?.querySelector('[data-toolbar-command]:not(:disabled), [data-toolbar-back]')?.focus({ preventScroll: true });
  }, [popup, path, hidden]);

  useEffect(() => {
    if (!popup || hidden) return;
    const outside = event => {
      if (!rootRef.current?.contains(event.target)) { setPopup(null); setPath([]); setQuery(''); }
    };
    // Capture Escape before the Workbench's selection/navigation handlers.
    const escape = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); event.stopPropagation();
      setPopup(null); setPath([]); setQuery('');
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [popup, hidden]);

  const choose = command => {
    if (command.disabled) return;
    if (command.children?.length) { setPath(current => [...current, command.id]); return; }
    close(true);
    command.onSelect?.();
  };
  const navigatePopup = event => {
    if (event.key === 'ArrowLeft' && path.length && event.target.tagName !== 'INPUT') {
      event.preventDefault(); event.stopPropagation(); setPath(current => current.slice(0, -1)); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (event.target.tagName === 'INPUT' && ['Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = [...popupRef.current.querySelectorAll('[data-toolbar-command]:not(:disabled)')];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : current < 0 ? event.key === 'ArrowUp' ? buttons.length - 1 : 0
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
    buttons[next]?.scrollIntoView({ block: 'nearest' });
  };
  const navigateToolbar = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = [...barRef.current.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
  };
  const menuButton = (name, Icon, label, extra = {}) => <button type="button"
    className="workbench-toolbar__button workflow-tactile-control" aria-label={POPUP_LABELS[name]} title={POPUP_LABELS[name]}
    aria-expanded={popup === name} aria-haspopup="dialog" aria-controls={popup === name ? popupId : undefined}
    onClick={event => toggle(name, event)} {...extra}>
    <Icon aria-hidden="true" /><span>{label}</span>{name === 'shapes' && <ChevronDown className="workbench-toolbar__chevron" aria-hidden="true" />}
  </button>;

  if (hidden) return null;
  return <div ref={rootRef} className="workbench-toolbar" data-workbench-toolbar data-system-workflow-overlay
    data-workflow-material="tactile">
    {popup && <section ref={popupRef} id={popupId} className="workbench-toolbar__popup" role="dialog" aria-label={title} onKeyDown={navigatePopup}>
      {popup === 'actions' ? <div className="workbench-toolbar__search">
        <Search aria-hidden="true" /><input ref={searchRef} aria-label="Search actions" placeholder="Search actions…" value={query}
          autoComplete="off" spellCheck={false} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { const command = visibleCommands.find(item => !item.disabled); if (command) { event.preventDefault(); choose(command); } } }} />
        <button type="button" className="workbench-toolbar__utility workflow-tactile-control" aria-label="Close Actions" title="Close Actions" onClick={() => close(true)}><X aria-hidden="true" /></button>
      </div> : <header className="workbench-toolbar__popup-header">
        {path.length > 0 && <button type="button" className="workbench-toolbar__utility workflow-tactile-control" data-toolbar-back aria-label="Back to module types" onClick={() => setPath(current => current.slice(0, -1))}><ArrowLeft aria-hidden="true" /></button>}
        <strong>{title}</strong><button type="button" className="workbench-toolbar__utility workflow-tactile-control" aria-label={`Close ${POPUP_LABELS[popup]}`} onClick={() => close(true)}><X aria-hidden="true" /></button>
      </header>}
      <div className="workbench-toolbar__commands">
        {visibleCommands.map((command, index) => <div key={command.id}>
          {command.group && command.group !== visibleCommands[index - 1]?.group && <div className="workbench-toolbar__group">{command.group}</div>}
          <button type="button" data-toolbar-command className="workbench-toolbar__command workflow-tactile-control workflow-tactile-control--quiet" disabled={command.disabled}
            title={command.reason || undefined} aria-pressed={typeof command.selected === 'boolean' ? command.selected : undefined}
            onClick={() => choose(command)}>
            <span className="workbench-toolbar__command-icon"><CommandIcon icon={command.icon} /></span>
            <span className="workbench-toolbar__command-copy"><span>{command.label}</span>{command.disabled && command.reason && <small>{command.reason}</small>}</span>
            {command.children?.length ? <ChevronRight aria-hidden="true" /> : command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
          </button>
        </div>)}
        {!visibleCommands.length && <p className="workbench-toolbar__empty">{normalizedQuery ? 'No matching actions.' : 'No commands available.'}</p>}
      </div>
    </section>}
    <div ref={barRef} className="workbench-toolbar__bar" role="toolbar" aria-label="Creation tools" onKeyDown={navigateToolbar}>
      {[['select', 'Select', 'V', MousePointer2], ['hand', 'Hand', 'H', Hand], ['text', 'Text', 'T', Type]].map(([id, label, key, Icon]) =>
        <button key={id} type="button" className={`workbench-toolbar__button workbench-toolbar__button--${id} workflow-tactile-control`} aria-label={`${label} tool`} aria-keyshortcuts={key}
          title={id === 'hand' ? 'Hand · H — Drag to explore with momentum. Click artwork to focus its module; module positions stay fixed.' : `${label} · ${key}`} aria-pressed={activeTool === id} onClick={() => { close(); onToolChange?.(id); }}>
          <Icon aria-hidden="true" /><span>{label}</span>
        </button>)}
      {menuButton('shapes', Shapes, 'Shapes', { 'data-active': activeTool === 'shape' || undefined })}
      <button type="button" className="workbench-toolbar__button workflow-tactile-control" aria-label="Artwork library" title="Artwork library" aria-pressed={libraryOpen}
        onClick={() => { close(); onOpenLibrary?.(); }}><Image aria-hidden="true" /><span>Artwork</span></button>
      <span className="workbench-toolbar__separator" aria-hidden="true" />
      {[['Layers', Layers, layers], ['Artwork info', Info, info]].map(([label, Icon, inspector]) =>
        <button key={label} type="button" className="workbench-toolbar__button workflow-tactile-control" aria-label={label} title={inspector?.reason || label}
          disabled={!inspector?.enabled} aria-pressed={Boolean(inspector?.open)}
          onClick={() => { close(); inspector?.onToggle?.(); }}><Icon aria-hidden="true" /><span>{label === 'Artwork info' ? 'Info' : label}</span></button>)}
      <span className="workbench-toolbar__separator" aria-hidden="true" />
      {menuButton('actions', Command, 'Actions', { ref: actionsRef, title: 'Actions · Ctrl / ⌘ K', 'aria-keyshortcuts': 'Control+k Meta+k' })}
      {menuButton('add', Plus, 'Add')}
    </div>
  </div>;
}
