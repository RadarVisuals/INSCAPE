import { createElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Hand, Image, Layers, MousePointer2, Search, Square, Type, Zap } from 'lucide-react';
import './workflowTactile.css';
import './workflowFlat.css';
import './workbenchToolbar.css';

const EMPTY_COMMANDS = [];
const POPUP_LABELS = { commands: 'Search commands', pointer: 'Pointer tools', shapes: 'Shapes' };

function searchCommands(commands, words, parents = [], unavailable = null) {
  return commands.flatMap(command => {
    const ancestry = [...parents, command.label];
    const reason = unavailable || (command.disabled ? command.reason || 'Unavailable' : null);
    if (command.children?.length) return searchCommands(command.children, words, ancestry, reason);
    const terms = `${command.group || ''} ${ancestry.join(' ')}`.toLocaleLowerCase();
    return words.every(word => terms.includes(word))
      ? [{ ...command, ...(reason ? { disabled: true, reason } : {}), group: parents.join(' / ') || command.group }] : [];
  });
}

function CommandIcon({ icon }) {
  return isValidElement(icon) ? icon : icon ? createElement(icon, { 'aria-hidden': true }) : null;
}

// This view owns only its popup and keyboard focus. Workbench supplies current
// tool/selection state and commands; module actions retain their existing owners.
export default function WorkbenchToolbar({
  activeTool = 'select', onToolChange, onOpenCommandSearch, onOpenLibrary, libraryOpen = false,
  actions = EMPTY_COMMANDS, addCommands = EMPTY_COMMANDS, shapeCommands = EMPTY_COMMANDS, shapePreference,
  layers, hidden = false, searchRequest = null, searchScopeRef, searchEnabled = true,
}) {
  const rootRef = useRef(null), barRef = useRef(null), popupRef = useRef(null), searchRef = useRef(null);
  const triggerRef = useRef(null), requestRef = useRef(searchRequest);
  const [popup, setPopup] = useState(null), [path, setPath] = useState([]), [query, setQuery] = useState('');
  const popupId = useId();
  const [lastShape, setLastShape] = useState(() => shapePreference?.getSnapshot());
  const [lastPointer, setLastPointer] = useState('select');
  const activeShape = shapeCommands.find(item => item.id === activeTool);
  const activeShapeId = activeShape?.id;
  const shape = activeShape || shapeCommands.find(item => item.id === lastShape) || shapeCommands[0];
  const pointerCommands = [
    { id: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V' },
    { id: 'hand', label: 'Hand', icon: Hand, shortcut: 'H' },
  ].map(item => ({ ...item, selected: item.id === activeTool, onSelect: () => onToolChange?.(item.id) }));
  const pointer = pointerCommands.find(item => item.selected) || pointerCommands.find(item => item.id === lastPointer);
  const textTool = addCommands.find(item => item.id === 'text');
  useEffect(() => {
    if (activeShapeId) {
      setLastShape(activeShapeId);
      if (shapePreference && shapePreference.getSnapshot() !== activeShapeId) shapePreference.update(activeShapeId);
    }
    if (activeTool === 'select' || activeTool === 'hand') setLastPointer(activeTool);
  }, [activeTool, activeShapeId, shapePreference]);
  const roots = popup === 'pointer' ? pointerCommands : popup === 'shapes'
    ? shapeCommands.map(item => ({ ...item, selected: item.id === shape?.id }))
    : [
      ...addCommands.map(item => ({ ...item, group: 'Add' })),
      ...shapeCommands.filter(item => !addCommands.some(command => command.id === item.id)),
      ...(layers ? [{ id: 'layers', label: 'Layers', icon: Layers, group: 'Selection', disabled: !layers.enabled, selected: layers.open, reason: layers.reason, onSelect: layers.onToggle }] : []),
      ...actions,
    ];
  let commands = roots, title = POPUP_LABELS[popup], parentTitle = title;
  for (const id of path) {
    const parent = commands.find(command => command.id === id);
    if (!parent?.children) break;
    commands = parent.children;
    parentTitle = title;
    title = parent.label;
  }
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCommands = normalizedQuery ? searchCommands(roots, normalizedQuery.split(/\s+/)) : commands;

  const close = (restoreFocus = false) => {
    setPopup(null); setPath([]); setQuery('');
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };
  const open = useCallback((name, trigger) => {
    if (name === 'commands') onOpenCommandSearch?.();
    triggerRef.current = trigger;
    setPopup(name); setPath([]); setQuery('');
  }, [onOpenCommandSearch]);
  const toggle = (name, event) => popup === name ? close() : open(name, event.currentTarget);

  useLayoutEffect(() => {
    if (hidden) return;
    const bar = rootRef.current;
    if (!bar) return;
    // Popup clearance belongs to this toolbar. Writing inherited geometry on
    // the entire Workbench invalidates every article when its geometry changes.
    const previous = bar.style.getPropertyValue('--workbench-toolbar-clearance');
    const measure = () => {
      const rectangle = bar.getBoundingClientRect();
      const clearance = `${Math.ceil(rectangle.height)}px`;
      if (bar.style.getPropertyValue('--workbench-toolbar-clearance') !== clearance)
        bar.style.setProperty('--workbench-toolbar-clearance', clearance);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      if (previous) bar.style.setProperty('--workbench-toolbar-clearance', previous);
      else bar.style.removeProperty('--workbench-toolbar-clearance');
    };
  }, [hidden]);

  useEffect(() => {
    if (searchRequest === requestRef.current) return;
    requestRef.current = searchRequest;
    if (searchEnabled && searchRequest) open('commands', searchRequest.trigger);
  }, [searchRequest, searchEnabled, open]);
  useEffect(() => {
    if (hidden) { setPopup(current => current === 'commands' ? current : null); setPath([]); setQuery(''); }
  }, [hidden]);
  useEffect(() => {
    if (!searchEnabled) { setPopup(null); setPath([]); setQuery(''); }
  }, [searchEnabled]);
  useEffect(() => {
    if (!searchEnabled) return;
    const key = event => {
      const scope = searchScopeRef?.current || rootRef.current?.closest('main') || rootRef.current?.parentElement;
      if (!scope?.contains(event.target) || event.defaultPrevented || event.isComposing || event.altKey
        || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k'
        || event.target.closest('input,textarea,select,[contenteditable=true],[role=textbox],iframe,[data-immersive]')) return;
      event.preventDefault(); event.stopPropagation();
      open('commands', event.target);
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [searchEnabled, searchScopeRef, open]);
  useLayoutEffect(() => {
    if (!popup) return;
    if (popup === 'commands') searchRef.current?.focus({ preventScroll: true });
    else popupRef.current?.querySelector('[data-toolbar-command]:not(:disabled), [data-toolbar-back]')?.focus({ preventScroll: true });
  }, [popup, path]);

  useEffect(() => {
    if (!popup) return;
    const outside = event => {
      if (!rootRef.current?.contains(event.target)) { setPopup(null); setPath([]); setQuery(''); }
    };
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
  }, [popup]);

  const choose = command => {
    if (command.disabled) return;
    if (command.children?.length) { setPath(current => [...current, command.id]); return; }
    if (shapeCommands.some(item => item.id === command.id)) setLastShape(command.id);
    close(true);
    command.onSelect?.();
  };
  const navigatePopup = event => {
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowLeft' && path.length && event.target.tagName !== 'INPUT') {
      event.preventDefault(); event.stopPropagation(); setPath(current => current.slice(0, -1)); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (event.target.tagName === 'INPUT' && ['Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = [...popupRef.current.querySelectorAll('[data-toolbar-command]:not(:disabled), [data-toolbar-back]')];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : current < 0 ? event.key === 'ArrowUp' ? buttons.length - 1 : 0
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
    buttons[next]?.scrollIntoView({ block: 'nearest' });
  };
  const navigateToolbar = event => {
    if (!event.target.closest('button')) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = [...barRef.current.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus({ preventScroll: true });
  };
  const toolButton = (label, icon, action, props) => <button type="button"
    className="workbench-toolbar__button workflow-tactile-control workflow-tactile-control--quiet"
    aria-label={label} title={label} onClick={event => { close(); action?.(event.currentTarget); }} {...props}>
    <CommandIcon icon={icon} />
  </button>;
  const menuButton = (name, icon, label, props) => <button type="button"
    className={`workbench-toolbar__button workflow-tactile-control workflow-tactile-control--quiet${name === 'commands' ? '' : ' workbench-toolbar__arrow'}`}
    aria-label={label} title={label} aria-expanded={popup === name} aria-haspopup="dialog"
    aria-controls={popup === name ? popupId : undefined} onClick={event => toggle(name, event)} {...props}><CommandIcon icon={icon} /></button>;

  if (hidden && popup !== 'commands') return null;
  return <div ref={rootRef} className="workbench-toolbar" data-workbench-toolbar data-system-workflow-overlay
    data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor">
    {popup && <section ref={popupRef} id={popupId} className="workbench-toolbar__popup" data-popup={popup} role="dialog" aria-label={title} onKeyDown={navigatePopup}>
      {popup === 'commands' && <div className="workbench-toolbar__search">
        <Search aria-hidden="true" /><input ref={searchRef} aria-label="Search commands" placeholder="Search commands…" value={query}
          autoComplete="off" spellCheck={false} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { const command = visibleCommands.find(item => !item.disabled); if (command) { event.preventDefault(); choose(command); } } }} />
      </div>}
      <div className="workbench-toolbar__commands">
        {path.length > 0 && <button type="button" data-toolbar-back
          className="workbench-toolbar__back workflow-tactile-control workflow-tactile-control--quiet"
          aria-label={`Back to ${parentTitle}`} onClick={() => { setPath(current => current.slice(0, -1)); setQuery(''); }}>
          <ArrowLeft aria-hidden="true" /><span>{parentTitle}</span>
        </button>}
        {visibleCommands.map((command, index) => <div key={command.id}>
          {command.group && command.group !== visibleCommands[index - 1]?.group && <div className="workbench-toolbar__group">{command.group}</div>}
          <button type="button" data-toolbar-command className="workbench-toolbar__command workflow-tactile-control workflow-tactile-control--quiet" disabled={command.disabled}
            title={command.reason || undefined} aria-pressed={typeof command.selected === 'boolean' ? command.selected : undefined}
            onClick={() => choose(command)}>
            <span className="workbench-toolbar__command-icon"><CommandIcon icon={command.icon} /></span>
            <span className="workbench-toolbar__command-copy"><span>{command.label}</span>{command.disabled && command.reason && <small>{command.reason}</small>}</span>
            {command.selected && <Check aria-hidden="true" />}
            {command.children?.length ? <ChevronRight aria-hidden="true" /> : command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
          </button>
        </div>)}
        {!visibleCommands.length && <p className="workbench-toolbar__empty">{normalizedQuery ? 'No matching commands.' : 'No commands available.'}</p>}
      </div>
    </section>}
    <div hidden={hidden} ref={barRef} className="workbench-toolbar__bar" role="toolbar" aria-label="Creation tools" onKeyDown={navigateToolbar}>
      <div className="workbench-toolbar__split">
        {toolButton(`${pointer.label} tool`, pointer.icon, pointer.onSelect, { 'aria-pressed': pointer.selected, 'aria-keyshortcuts': pointer.shortcut })}
        {menuButton('pointer', ChevronDown, 'Pointer tools')}
      </div>
      <div className="workbench-toolbar__split">
        {toolButton(`${shape?.label || 'Rectangle'} tool`, shape?.icon || Square, shape?.onSelect,
          { disabled: !shape || shape.disabled, 'aria-pressed': Boolean(activeShape), 'aria-keyshortcuts': shape?.shortcut })}
        {menuButton('shapes', ChevronDown, 'Shapes')}
      </div>
      {toolButton('Text tool', Type, () => onToolChange?.('text'), { 'aria-keyshortcuts': 'T', 'aria-pressed': activeTool === 'text', disabled: textTool?.disabled })}
      {toolButton('Artwork library', Image, onOpenLibrary, { 'aria-pressed': libraryOpen })}
      <span className="workbench-toolbar__divider" aria-hidden="true" />
      {menuButton('commands', Zap, 'Actions', { 'aria-keyshortcuts': 'Control+k Meta+k', disabled: !searchEnabled })}
    </div>
  </div>;
}
