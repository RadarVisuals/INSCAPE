import { useEffect, useState } from 'react';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { interfaceTheme, useInterfaceTheme } from '../../interfaceTheme.js';
import IconSwitch from '../../ui/IconSwitch.jsx';
import RackMenu from './RackMenu.jsx';
import '../ownerSystemWorkflow/workflowTokens.css';
import '../ownerSystemWorkflow/workflowTactile.css';
import '../ownerSystemWorkflow/workflowFlat.css';
import './workspaceHeader.css';

export const profileTabs = ['Profile', 'Gallery', 'Writing'];

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

export function WorkspaceBrand({ trigger, current, destinations, groups, editorActions = [], onPanel, onSearch, blocked,
  onOpen, onError }) {
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => { setMenu(null); trigger.current?.focus({ preventScroll: true }); };
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [menu, trigger]);
  const logo = <svg className="workspace-wordmark" viewBox="0 0 480 154" aria-hidden="true">
    <use href="/assets/brand/inscape-wordmark-new.svg#inscape-wordmark" /></svg>;
  if (!destinations) return <a className="workspace-brand" href="/" aria-label="Inscape home">{logo}</a>;
  const open = focusLast => {
    onOpen?.();
    const rect = trigger.current.getBoundingClientRect();
    setMenu({ anchor: { x: rect.left, y: rect.bottom }, focusLast });
  };
  const sections = {};
  function registerGroup(id, entries) {
    sections[id] = entries.map(({ children, ...entry }) => {
      const childId = id + ':' + entry.id;
      if (children?.length) registerGroup(childId, children);
      return { ...entry, id: childId };
    });
  }
  for (const [label, entries] of Object.entries(groups || {})) registerGroup(label, entries);
  const commands = [
    ...(groups ? [{ id: 'search', label: 'Search commands...', disabled: !onSearch, run: onSearch }] : []),
    ...[...profileTabs, 'Studio', ...(destinations.Curation ? ['Curation'] : [])].map((label, index) => ({ id: 'destination:' + label, label,
      checkable: true, selected: label === current, disabled: !destinations[label] || blocked,
      section: index === 0 ? 'Workspace' : undefined, run: destinations[label] })),
    ...Object.keys(groups || {}).map((label, index) => ({ id: label, label, section: index === 0 ? 'Editor' : undefined })),
    ...editorActions,
    ...Object.entries({ activity: 'Activity', settings: 'Settings', ...(groups && { backup: 'Backup' }) })
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
