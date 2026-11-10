import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import DisplayInstrumentWindow from './DisplayInstrumentWindow.jsx';
import { defaultSharedTools } from './sharedDisplayToolsState.js';
import { getRegisteredDisplayTool, registerDisplayTool, unregisterDisplayTool } from './sharedDisplayToolRegistry.js';
import './displayInstruments.css';
import RackMenu from '../menus/RackMenu.jsx';
import { Wrench } from 'lucide-react';

export const displayToolCommands = (readOnly = false) => [
  ...(!readOnly ? [{ id: 'tool-layers', label: 'LAYERS' }] : []),
  { id: 'tool-metadata', label: 'METADATA' },
];
export function SharedDisplayToolsLauncher({ readOnly = false, onOpen }) {
  const tools = useSharedDisplayTools();
  const [anchor, setAnchor] = useState(null);
  const trigger = useRef(null);
  return <><button aria-label="Tools" aria-haspopup="menu" aria-expanded={Boolean(anchor)}
    ref={trigger} title="Tools" type="button" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      setAnchor(anchor ? null : { x: rect.left, y: rect.top });
    }}><Wrench size={14} /><span>Tools</span></button>
    {anchor && createPortal(<RackMenu anchor={anchor} commands={displayToolCommands(readOnly)}
      label="Workbench tools"  returnFocus={trigger.current}
      onClose={() => setAnchor(null)} onCommand={id => {
        onOpen?.();
        tools.command(id.slice(5), true, trigger.current);
        setAnchor(null);
      }} systemWorkflowOverlay />, document.body)}</>;
}
const Context = createContext(null);
export const useSharedDisplayTools = () => useContext(Context);
const noSubscription = () => () => {};
const closedMetadata = () => false;
export function SharedDisplayToolsProvider({ children, value, onChange, targetId, onTargetChange, metadataDock }) {
  const [local, setLocal] = useState(defaultSharedTools);
  const [localTarget, setLocalTarget] = useState('display:primary');
  const [hosts, setHosts] = useState({});
  const metadataOpen = useSyncExternalStore(metadataDock?.subscribe || noSubscription, metadataDock?.infoVisible || closedMetadata);
  // The owner Info section registers its host only while expanded. Inspector
  // availability alone must not activate Display metadata picking or resolution.
  // Visitor hosts retain their independent window preference.
  const state = useMemo(() => metadataDock ? { ...(value || local), metadata: metadataOpen && Boolean(hosts.metadata) } : value || local,
    [value, local, metadataDock, metadataOpen, hosts.metadata]);
  const setState = onChange || setLocal;
  const target = targetId === undefined ? localTarget : targetId;
  const activate = onTargetChange || setLocalTarget;
  const triggers = useRef({});
  const [registrations, setRegistrations] = useState(() => new Map());
  const registerHost = useCallback((id, node) => setHosts(current => current[id] === node ? current : { ...current, [id]: node }), []);
  const registerTool = useCallback(tool => {
    const registration = Symbol('display-tool');
    setRegistrations(current => registerDisplayTool(current, tool, registration));
    return () => setRegistrations(current => unregisterDisplayTool(current, tool.id, tool.targetId, registration));
  }, []);
  const getTool = useCallback((id, targetId = target) => getRegisteredDisplayTool(registrations, id, targetId), [registrations, target]);
  const isAvailable = useCallback((id, targetId) => Boolean(getTool(id, targetId)?.available), [getTool]);
  const command = useCallback((id, open, trigger, target) => {
    if (trigger) triggers.current[id] = trigger;
    if (target) activate(target);
    if (id === 'metadata' && metadataDock) {
      const expand = open ?? !state.metadata;
      metadataDock.change({ type: expand ? 'open' : 'collapse-section', tab: 'Inspector', section: 'Info' });
      return;
    }
    setState(current => ({ ...current, [id]: open === undefined ? !current[id] : open }));
  }, [activate, setState, metadataDock, state.metadata]);
  const context = useMemo(() => ({ state, setState, target, activate, hosts, registerHost, registerTool, getTool, isAvailable, command, triggers,
    dockedMetadata: Boolean(metadataDock) }),
    [state, setState, target, activate, hosts, registerHost, registerTool, getTool, isAvailable, command, metadataDock]);
  return <Context.Provider value={context}>{children}</Context.Provider>;
}
function ToolWindow({ id, fallbackFocus }) {
  const tools = useSharedDisplayTools();
  const { registerHost, setState } = tools;
  const host = useCallback(node => registerHost(id, node), [id, registerHost]);
  const layout = useCallback(value => setState(current => JSON.stringify(current.windows[id]) === JSON.stringify(value) ? current : { ...current, windows: { ...current.windows, [id]: value } }), [id, setState]);
  return <DisplayInstrumentWindow instrument={id}  layout={tools.state.windows[id]} onLayoutChange={layout}
    title={tools.getTool(id)?.label}
    onClose={() => {
      const focused = document.activeElement;
      const trigger = tools.triggers.current[id];
      const target = trigger?.isConnected ? trigger : fallbackFocus?.current;
      tools.command(id, false);
      requestAnimationFrame(() => {
        // Closing must not steal a newer keyboard/pointer focus choice.
        if (document.activeElement !== document.body && document.activeElement !== focused) return;
        if (target?.isConnected) target.focus({ preventScroll: true });
      });
    }}>
    <div ref={host} data-shared-tool={id} />
  </DisplayInstrumentWindow>;
}
export function SharedDisplayToolWindows({ readOnly = false, hidden = false, fallbackFocus }) {
  const tools = useSharedDisplayTools();
  return <div hidden={hidden} data-shared-display-tools>{['layers', 'metadata', 'appearance'].filter(id => !(id === 'metadata' && tools.dockedMetadata) && tools.state[id] && tools.isAvailable(id) && (!readOnly || id === 'metadata')).map(id => <ToolWindow key={id} id={id}  fallbackFocus={fallbackFocus} />)}</div>;
}
export function MetadataDockContent() {
  const tools = useSharedDisplayTools();
  const { registerHost } = tools;
  const host = useCallback(node => registerHost('metadata', node), [registerHost]);
  const available = tools.isAvailable('metadata');
  return <div>
    {!available && <p className="workbench-tools-empty">Select one artwork with source information.</p>}
    <div ref={host} data-shared-tool="metadata" hidden={!available} />
  </div>;
}
export function SharedDisplayToolContent({ id, targetId, label, children, available = true }) {
  const tools = useSharedDisplayTools();
  const enabled = tools?.target === targetId && available && tools.state[id];
  const register = tools?.registerTool;
  useLayoutEffect(() => {
    if (!register) return;
    return register({ id, targetId, label, available });
  }, [register, id, targetId, label, available]);
  return enabled && tools.hosts[id] ? createPortal(children, tools.hosts[id]) : null;
}
