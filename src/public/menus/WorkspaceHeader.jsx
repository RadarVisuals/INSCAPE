import { useEffect, useState } from 'react';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { interfaceTheme, useInterfaceTheme } from '../../interfaceTheme.js';
import IconSwitch from '../../ui/IconSwitch.jsx';
import RackMenu from './RackMenu.jsx';
import '../ownerSystemWorkflow/workflowTokens.css';
import '../ownerSystemWorkflow/workflowTactile.css';
import '../ownerSystemWorkflow/workflowFlat.css';
import './workspaceHeader.css';

export const profileTabs = ['Profile', 'Gallery', 'Writing', 'Exhibition'];

export function HeaderThemeButton() {
  const { mode, error } = useInterfaceTheme();
  return <><IconSwitch label="Dark mode" checked={mode === 'dark'} offIcon={Sun} onIcon={Moon}
    title={mode === 'dark' ? 'Switch to Light' : 'Switch to Dark'} onChange={dark => interfaceTheme.setMode(dark ? 'dark' : 'light')} />
    {error && <span className="workspace-header-error" role="alert">{error}</span>}</>;
}

export function StudioHeaderTools({ onStudio, studioMenu, children }) {
  return <div className="studio-header-tools">
    {studioMenu || (onStudio ? <button type="button" className="studio-header-label" onClick={onStudio}>Studio</button>
      : <span className="studio-header-label" aria-current="page">Studio</span>)}
    <HeaderThemeButton />
    {children}
  </div>;
}

export function DiscoverLink({ onDiscover, children, ...props }) {
  return <a {...props} href="?discover" onClick={event => {
    if (!onDiscover || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onDiscover(event.currentTarget);
  }}>{children}</a>;
}

export function WorkspaceBrand({ trigger, current, destinations, groups, onPanel, onSearch, blocked,
  onOpen, onError, onDiscover }) {
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => { setMenu(null); trigger.current?.focus({ preventScroll: true }); };
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [menu, trigger]);
  const logo = <svg className="workspace-wordmark" viewBox="0 0 480 154" aria-hidden="true">
    <use href="/assets/brand/inscape-wordmark-new.svg#inscape-wordmark" /></svg>;
  if (!destinations) return <DiscoverLink className="workspace-brand" aria-label="Inscape — Discover" onDiscover={onDiscover}>{logo}</DiscoverLink>;
  const open = focusLast => {
    onOpen?.();
    const rect = trigger.current.getBoundingClientRect();
    setMenu({ anchor: { x: rect.left, y: rect.bottom }, focusLast });
  };
  const sections = Object.fromEntries(Object.entries(groups || {}).map(([group, entries]) => [
    'group:' + group, entries.map(entry => ({ ...entry, id: group + ':' + entry.id })),
  ]));
  const commands = [
    ...(groups ? [{ id: 'search', label: 'Search commands...', disabled: !onSearch, run: onSearch }] : []),
    ...[...profileTabs, 'Studio', ...(destinations.Curation ? ['Curation'] : []), 'Discover'].map((label, index) => ({ id: 'destination:' + label, label,
      checkable: true, selected: label === current, disabled: !destinations[label] || blocked,
      section: index === 0 ? 'Workspace' : undefined, run: destinations[label] })),
    ...Object.keys(groups || {}).map((label, index) => ({ id: 'group:' + label, label, section: index === 0 ? 'Editor' : undefined })),
    ...Object.entries({ activity: 'Activity', settings: 'Settings', docs: 'Help & Docs', ...(groups && { backup: 'Backup' }) })
      .map(([id, label], index) => ({ id, label, section: index === 0 ? 'More' : undefined,
        disabled: !onPanel, run: source => onPanel(id, source) })),
  ];
  return <><button type="button" ref={trigger} className="workspace-brand" aria-label="Inscape menu" title="Inscape menu"
    aria-haspopup="menu" aria-expanded={Boolean(menu)} data-system-workflow-panel-trigger
    onClick={() => menu ? setMenu(null) : open(false)}
    onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(event.key === 'ArrowUp'); }
    }}>{logo}<ChevronDown size={12} aria-hidden="true" /></button>
    {menu && <RackMenu label="Inscape menu" className="workspace-command-menu system-workflow__token-scope" palette="editor"
      systemWorkflowOverlay viewportSubmenus {...menu} commands={commands} menuBarRef={trigger} returnFocus={trigger.current}
      onClose={() => setMenu(null)} getSubmenuCommands={groups ? id => sections[id] : undefined}
      onCommand={id => {
        const entry = [...commands, ...Object.values(sections).flat()].find(command => command.id === id);
        setMenu(null); trigger.current?.focus({ preventScroll: true });
        try { entry?.run?.(trigger.current); }
        catch (error) { if (onError) onError(error.message); else throw error; }
      }} />}</>;
}
