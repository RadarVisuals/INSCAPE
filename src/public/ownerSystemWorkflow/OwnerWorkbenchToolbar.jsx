import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Grid3X3, Image, Info, Layers, Redo2, Settings2, Square, Type, Undo2, User, AppWindow, Folder } from 'lucide-react';
import WorkbenchToolbar from './WorkbenchToolbar.jsx';
import { ContextActionBars } from './ContextToolbar.jsx';
import './workbenchCreation.css';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useSharedDisplayTools } from './SharedDisplayTools.jsx';
import { sameCreationCamera, workbenchCreationPlacement } from './workbenchCreationGeometry.js';
import { isWorkbenchBackground } from './useWorkbenchPan.js';
import { isShapeCommand, SHAPE_COMMAND_KINDS } from '../../shapes/shapes.js';

const ICONS = { 'workbench-index': Folder, 'mini-app': AppWindow, text: Type, image: Image, shape: Square, 'shape-grid': Grid3X3, keeper: Folder };
const LABELS = { 'workbench-index': 'Index', 'mini-app': 'Mini app', text: 'Text', image: 'Image', shape: 'Rectangle', keeper: 'Keeper dock',
  'shape-grid': 'Grid' };
const isCreationTool = tool => tool === 'text' || isShapeCommand(tool);
const EDITING = 'input,textarea,select,[contenteditable=true],[role=textbox],[role=slider],[role=dialog],[role=menu],iframe,[data-mini-app-id],[data-immersive]';
const OVERLAYS = '[data-workbench-toolbar],[data-system-workflow-overlay],[data-system-workflow-panel],[data-shared-display-tools],[data-shared-text-tools],[data-context-tools],.workbench-view-controls,[data-workbench-group-tools],[data-workbench-selection-tools]';
const CREATION_CONTROLS = `${EDITING},button,a,summary,[role=separator]`;

// Adapts Workbench commands to the toolbar. It does not own module content,
// camera state, tool windows, or a second command/persistence implementation.
export default function OwnerWorkbenchToolbar({ hostRef, placementTargets, commands, onCommand, onOpenLibrary, libraryOpen,
  preferences, onPreferencesChange, hidden, onHistory, history, historyBlocked, onNotice, artworkLayersOpen, onToggleArtworkLayers, onOpenSharedTool }) {
  const { bounds: areaBounds } = useWorkbenchArea();
  const view = useWorkbenchView(), camera = useWorkbenchCamera(), tools = useSharedDisplayTools();
  const [actionRequest, setActionRequest] = useState(0), [ghost, setGhost] = useState(null);
  const gesture = useRef(null), space = useRef(false), latest = useRef(null), suppressedPointer = useRef(null);
  latest.current = { view, camera, hidden, onCommand, onNotice, areaBounds };
  const cancel = useCallback(() => {
    const active = gesture.current;
    gesture.current = null;
    if (active?.host.hasPointerCapture(active.pointerId)) active.host.releasePointerCapture(active.pointerId);
    setGhost(null);
  }, []);
  const chooseTool = tool => { cancel(); view.setInteractionTool(tool); hostRef.current?.focus({ preventScroll: true }); };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || hidden) return;
    host.dataset.creationTool = view.interactionTool;
    return () => { delete host.dataset.creationTool; };
  }, [hostRef, hidden, view.interactionTool]);
  useEffect(() => { cancel(); }, [hidden, view.interactionTool, cancel]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || hidden) return;
    const key = event => {
      if (!host.contains(event.target) || event.target.closest(EDITING) || event.isComposing) return;
      // The camera's window capture listener may already prevent Space's
      // scrolling default. It still takes precedence over pending creation.
      if (event.code === 'Space' && !event.ctrlKey && !event.metaKey && !event.altKey) { space.current = true; cancel(); return; }
      if (event.defaultPrevented) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault(); event.stopPropagation(); cancel(); latest.current.view.setInteractionTool('select'); setActionRequest(value => value + 1); return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat) return;
      const tool = { v: 'select', h: 'hand', t: 'text', r: 'shape' }[event.key.toLowerCase()];
      if (tool || event.key === 'Escape' && latest.current.view.interactionTool !== 'select') {
        event.preventDefault(); event.stopPropagation(); cancel(); latest.current.view.setInteractionTool(tool || 'select');
      }
    };
    const up = event => { if (event.code === 'Space') space.current = false; };
    const blur = () => { space.current = false; cancel(); };
    const visibility = () => { if (document.hidden) blur(); };
    const down = event => {
      const current = latest.current, tool = current.view.interactionTool;
      if (gesture.current || !isCreationTool(tool) || current.hidden || current.camera.locked || space.current
        || host.hasAttribute('data-workbench-pan-ready') || event.button !== 0 || event.isPrimary === false
        || event.ctrlKey || event.metaKey || event.altKey || event.target.closest(`${OVERLAYS},${CREATION_CONTROLS}`)) return;
      const point = { x: event.clientX, y: event.clientY };
      // Never fall back from a rejected Display (locked, minimized, private,
      // etc.) to a standalone Text hidden underneath it.
      const background = isWorkbenchBackground(event.target, host);
      const insideDisplay = !background && event.target.closest('[data-display-instance]');
      const target = tool === 'text' && insideDisplay ? placementTargets.current?.targetAt(point) : null;
      if (insideDisplay ? !target?.createTextAt : !background) return;
      event.preventDefault(); event.stopPropagation();
      gesture.current = { tool, start: point, pointerId: event.pointerId, target, host, camera: current.camera.getCamera() };
      suppressedPointer.current = event.pointerId;
      host.setPointerCapture(event.pointerId);
      host.focus({ preventScroll: true });
    };
    const move = event => {
      const active = gesture.current;
      if (!active || active.pointerId !== event.pointerId) return;
      if (!(event.buttons & 1) || !sameCreationCamera(active.camera, latest.current.camera.getCamera())
        || active.target && !active.target.isCurrent()) { cancel(); return; }
      event.preventDefault(); event.stopPropagation();
      if (isShapeCommand(active.tool)) setGhost({ left: Math.min(active.start.x, event.clientX), top: Math.min(active.start.y, event.clientY),
        width: Math.abs(event.clientX - active.start.x), height: Math.abs(event.clientY - active.start.y) });
    };
    const finish = event => {
      const active = gesture.current;
      if (!active || active.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation(); cancel();
      const current = latest.current;
      if (current.hidden || current.camera.locked || active.tool !== current.view.interactionTool || !sameCreationCamera(active.camera, current.camera.getCamera())) return;
      const point = { x: event.clientX, y: event.clientY }, hit = document.elementFromPoint(point.x, point.y);
      const placed = workbenchCreationPlacement(active.start, point, active.camera, isShapeCommand(active.tool), current.areaBounds);
      if (!placed || !host.contains(hit) || hit?.closest(`${OVERLAYS},${CREATION_CONTROLS}`)) return;
      if (active.target) {
        const currentTarget = placementTargets.current?.targetAt(point);
        // React may replace the capability object without changing its scoped
        // Display/Grid. The originating capability still validates that scope.
        if (!active.target.isCurrent() || currentTarget?.id !== active.target.id || currentTarget?.node !== active.target.node) return;
        if (!active.target.createTextAt(point)) return;
      } else {
        if (active.tool === 'text' && !isWorkbenchBackground(hit, host)) return;
        current.onCommand(active.tool, { ...placed, workbench: current.view.getPresentation() });
      }
      current.view.setInteractionTool('select');
    };
    const pointerCancel = event => { if (gesture.current?.pointerId === event.pointerId) cancel(); };
    const clearClick = () => { suppressedPointer.current = null; };
    const click = event => {
      if (event.pointerId !== suppressedPointer.current) return;
      suppressedPointer.current = null;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    window.addEventListener('pointerdown', clearClick, true);
    host.addEventListener('pointerdown', down, true);
    host.addEventListener('lostpointercapture', pointerCancel);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', pointerCancel, true);
    window.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      host.removeEventListener('pointerdown', down, true);
      host.removeEventListener('lostpointercapture', pointerCancel);
      window.removeEventListener('pointerdown', clearClick, true);
      window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', pointerCancel, true); document.removeEventListener('keydown', key, true);
      window.removeEventListener('click', click, true); suppressedPointer.current = null;
      window.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility); space.current = false; cancel();
    };
  }, [hostRef, placementTargets, hidden, cancel]);

  const inspector = (id, reason) => ({ enabled: tools.isAvailable(id), open: tools.isAvailable(id) && Boolean(tools.state[id]), reason: tools.isAvailable(id) ? undefined : reason,
    onToggle: () => tools.command(id, undefined, document.activeElement) });
  const layers = onToggleArtworkLayers ? { enabled: true, open: artworkLayersOpen, onToggle: onToggleArtworkLayers }
    : inspector('layers', 'Select a Display to see its layers.');
  const info = inspector('metadata', 'Select an artwork to see its information.');
  const adapt = command => ({ ...command, label: LABELS[command.id] || command.label, icon: ICONS[command.id],
    reason: command.disabled ? 'Module limit reached.' : undefined,
    children: command.children?.map(adapt), onSelect: () => {
      if (isCreationTool(command.id)) chooseTool(command.id);
      else { chooseTool('select'); onCommand(command.id); }
    } });
  const addCommands = commands.map(adapt);
  const shapeCommands = addCommands.filter(command => isShapeCommand(command.id))
    .map(command => command.id === 'shape' ? { ...command, shortcut: 'R' } : command);
  const actions = [
    ...(onOpenSharedTool ? ['Transform', 'Color', 'Image', 'Shape', 'FX'].map(tab => ({ id: ['Image', 'Shape'].includes(tab) ? `${tab.toLowerCase()}-settings` : tab.toLowerCase(), label: ['Image', 'Shape'].includes(tab) ? `${tab} settings` : tab, icon: Settings2, group: 'Selection', onSelect: () => onOpenSharedTool(tab) })) : []),
    { id: 'layers', label: 'Layers', icon: Layers, group: 'Selection', disabled: !layers.enabled, reason: layers.reason, selected: layers.open, onSelect: layers.onToggle },
    { id: 'metadata', label: 'Artwork info', icon: Info, group: 'Selection', disabled: !info.enabled, reason: info.reason, selected: info.open, onSelect: info.onToggle },
    { id: 'appearance', label: 'Display appearance', icon: Settings2, group: 'Selection', disabled: !tools.isAvailable('appearance'), reason: 'Select a Display first.',
      onSelect: () => tools.command('appearance', undefined, document.activeElement) },
    ...['undo', 'redo'].map(id => ({ id, label: id === 'undo' ? 'Undo' : 'Redo', icon: id === 'undo' ? Undo2 : Redo2, group: 'Editing',
      shortcut: id === 'undo' ? 'Ctrl / ⌘ Z' : 'Ctrl / ⌘ ⇧ Z', disabled: Boolean(historyBlocked || !history[id]), reason: historyBlocked || `Nothing to ${id}.`, onSelect: () => onHistory(id) })),
    { id: 'grid', label: 'Workbench grid', icon: Grid3X3, group: 'View', selected: preferences.gridMode !== 'NONE',
      onSelect: () => onPreferencesChange({ gridMode: preferences.gridMode === 'NONE' ? 'DOTS' : 'NONE' }) },
    { id: 'identity', label: 'Identity', icon: User, group: 'Open', onSelect: () => onCommand('identity') },
    ...addCommands.map(command => ({ ...command, group: 'Add' })),
  ];
  const creating = isCreationTool(view.interactionTool);
  return <>
    <WorkbenchToolbar activeTool={view.interactionTool} onToolChange={chooseTool} actions={actions} addCommands={addCommands}
      shapeCommands={shapeCommands} layers={layers} info={info} before={<ContextActionBars />}
      onOpenLibrary={trigger => { chooseTool('select'); onOpenLibrary(trigger); }} libraryOpen={libraryOpen} hidden={hidden} actionRequest={actionRequest} />
    {!hidden && creating && <p className="workbench-creation-hint" role="status" data-system-workflow-overlay>
      {view.interactionTool === 'text' ? 'Click the Workbench or an unlocked Display to add Text.' : `Click or drag on the Workbench to draw a ${SHAPE_COMMAND_KINDS[view.interactionTool]}.`} <kbd>Esc</kbd> to cancel
    </p>}
    {!hidden && ghost && <div className="workbench-creation-ghost" style={ghost} aria-hidden="true" />}
  </>;
}
