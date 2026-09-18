import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DisplayInstrumentWindow from './DisplayInstrumentWindow.jsx';
import { defaultSharedTools } from './sharedDisplayToolsState.js';
import './displayInstruments.css';
import RackMenu from '../menus/RackMenu.jsx';
import { Wrench } from 'lucide-react';

export const displayToolCommands = (readOnly = false) => [
  ...(!readOnly ? [{ id: 'tool-layers', label: 'LAYERS' }] : []),
  { id: 'tool-metadata', label: 'METADATA' },
];
export function SharedDisplayToolsLauncher({ menuSurface, readOnly = false, onOpen }) {
  const tools = useSharedDisplayTools();
  const [anchor, setAnchor] = useState(null);
  const trigger = useRef(null);
  return <><button aria-label="Tools" aria-haspopup="menu" aria-expanded={Boolean(anchor)}
    ref={trigger} title="Tools" type="button" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      setAnchor(anchor ? null : { x: rect.left, y: rect.top });
    }}><Wrench size={14} /><span>Tools</span></button>
    {anchor && createPortal(<RackMenu anchor={anchor} commands={displayToolCommands(readOnly)}
      label="Workbench tools" menuSurfaceId={menuSurface} returnFocus={trigger.current}
      onClose={() => setAnchor(null)} onCommand={id => {
        onOpen?.();
        tools.command(id.slice(5), true, trigger.current);
        setAnchor(null);
      }} systemWorkflowOverlay />, document.body)}</>;
}
const Context = createContext(null);
export const useSharedDisplayTools = () => useContext(Context);
export function SharedDisplayToolsProvider({ children, value, onChange, targetId, onTargetChange }) {
  const [local, setLocal] = useState(defaultSharedTools);
  const [localTarget, setLocalTarget] = useState('display:primary');
  const state = value || local, setState = onChange || setLocal;
  const target = targetId === undefined ? localTarget : targetId;
  const activate = onTargetChange || setLocalTarget;
  const triggers = useRef({});
  const [hosts, setHosts] = useState({});
  const [labels, setLabels] = useState({});
  const registerHost = useCallback((id, node) => setHosts(current => current[id] === node ? current : { ...current, [id]: node }), []);
  const label = useCallback((id, value) => setLabels(current => current[id] === value ? current : { ...current, [id]: value }), []);
  const command = useCallback((id, open, trigger, target) => {
    if (trigger) triggers.current[id] = trigger;
    if (target) activate(target);
    setState(current => ({ ...current, [id]: open === undefined ? !current[id] : open }));
  }, [activate, setState]);
  const context = useMemo(() => ({ state, setState, target, activate, hosts, registerHost, labels, label, command, triggers }),
    [state, setState, target, activate, hosts, registerHost, labels, label, command]);
  return <Context.Provider value={context}>{children}</Context.Provider>;
}
function ToolWindow({ id, menuSurface, fallbackFocus }) {
  const tools = useSharedDisplayTools();
  const host = useCallback(node => tools.registerHost(id, node), [id, tools.registerHost]);
  const layout = useCallback(value => tools.setState(current => JSON.stringify(current.windows[id]) === JSON.stringify(value) ? current : { ...current, windows: { ...current.windows, [id]: value } }), [id, tools.setState]);
  return <DisplayInstrumentWindow instrument={id} menuSurface={menuSurface} layout={tools.state.windows[id]} onLayoutChange={layout}
    title={tools.labels[id] || (id === 'layers' ? 'Select a Display' : 'Select an artwork')}
    onClose={() => { tools.command(id, false); requestAnimationFrame(() => { const trigger = tools.triggers.current[id]; (trigger?.isConnected ? trigger : fallbackFocus?.current)?.focus({ preventScroll: true }); }); }}>
    <div ref={host} data-shared-tool={id} />
    {!tools.labels[id] && <p role="status">{id === 'layers' ? 'Select a Display to see its layers.' : id === 'animation' ? 'Select an artwork in a Display to animate it.' : 'Select an artwork to read its information.'}</p>}
  </DisplayInstrumentWindow>;
}
export function SharedDisplayToolWindows({ menuSurface, readOnly = false, hidden = false, fallbackFocus }) {
  const tools = useSharedDisplayTools();
  return <div hidden={hidden} data-shared-display-tools>{['layers', 'metadata', 'animation'].filter(id => tools.state[id] && (!readOnly || id === 'metadata')).map(id => <ToolWindow key={id} id={id} menuSurface={menuSurface} fallbackFocus={fallbackFocus} />)}</div>;
}
export function SharedDisplayToolContent({ id, targetId, label, children, available = true }) {
  const tools = useSharedDisplayTools();
  const enabled = tools?.target === targetId && available && tools.state[id];
  const report = tools?.label;
  useLayoutEffect(() => {
    if (!enabled) return;
    report(id, label);
    return () => report(id, null);
  }, [enabled, report, id, label]);
  return enabled && tools.hosts[id] ? createPortal(children, tools.hosts[id]) : null;
}
