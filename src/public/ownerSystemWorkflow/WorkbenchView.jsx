import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { ArrowLeft, Scan, Hand } from 'lucide-react';
import './workflowTactile.css';
import './workflowFlat.css';
import useWorkbenchObjectPicker from './useWorkbenchObjectPicker.jsx';
import WorkbenchArea from './WorkbenchArea.jsx';
import { WorkbenchAreaProvider } from './WorkbenchAreaContext.jsx';
import {
  WorkbenchView,
  WorkbenchActions,
  useWorkbenchView,
  workbenchModuleTransform,
} from './WorkbenchViewContext.js';
export {
  useWorkbenchView,
  useWorkbenchActions,
  workbenchModuleTransform,
  useWorkbenchViewRegistration,
} from './WorkbenchViewContext.js';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { identityWorkbenchTransform, workbenchSelectionBounds } from './workbenchViewScale.js';
import { WorkbenchCameraProvider, useWorkbenchCameraScale } from './WorkbenchCamera.jsx';
import './workbenchView.css';
import {
  artworkLayers,
  artworkModuleId,
  artworkWindowIds,
  layerIds,
} from '../../systemWorkflow/domain/artworkLayers.js';
const WorkbenchCanvasControls = lazy(() => import('./WorkbenchCanvasControls.jsx'));
const WorkbenchGroups = lazy(() => import('./WorkbenchGroups.jsx'));
import { createWorkbenchMiniatures } from './workbenchMiniatures.js';
import useWorkbenchSelection from './useWorkbenchSelection.js';
import { createWorkbenchGestures } from './workbenchGestures.js';
import { createWorkbenchMoveOperation } from './workbenchMoveOperation.js';
import { createWorkbenchResizeOperation } from './workbenchResizeOperation.js';
const WorkbenchNavigator = lazy(() => import('./WorkbenchNavigator.jsx'));
const WorkbenchIndex = lazy(() => import('./WorkbenchIndex.jsx'));
const PublishedWorkbenchGroups = lazy(() => import('./PublishedWorkbenchGroups.jsx'));
import { useWorkbenchMovementSnap } from './WorkbenchPlacement.jsx';
import useWorkbenchNavigation from './useWorkbenchNavigation.js';
import { projectWorkbenchBounds } from './workbenchSpace.js';
import { marqueeContains } from './workbenchGrid.js';
import { workbenchPaintGeometry } from './workbenchPaintGeometry.js';
const GridSeamProbe = import.meta.env.DEV ? lazy(() => import('./GridSeamProbe.jsx')) : null;

// Session-only view transforms, never module content or publication geometry.
export function WorkbenchViewProvider(props) {
  return (
    <WorkbenchCameraProvider>
      <WorkbenchAreaProvider store={props.store} groupContent={props.groupContent}>
        {props.selectionState ? (
          <WorkbenchViewStateProvider {...props} />
        ) : (
          <LocalWorkbenchSelection {...props} />
        )}
      </WorkbenchAreaProvider>
    </WorkbenchCameraProvider>
  );
}

// Standalone/Visitor hosts have one local selection owner. Owner Runtime passes
// its existing owner explicitly; it never mounts this local alternative.
function LocalWorkbenchSelection(props) {
  const content = useSyncExternalStore(
    props.store?.subscribe || emptySubscribe,
    props.store?.getSnapshot || (() => props.groupContent)
  );
  const selectionState = useWorkbenchSelection(content, { readContent: props.store?.getSnapshot });
  return <WorkbenchViewStateProvider {...props} content={content} selectionState={selectionState} />;
}

function WorkbenchViewStateProvider({
  children,
  store,
  profileAddress,
  presentation,
  groupContent,
  content,
  selectionState,
  navigatorPosition,
}) {
  const localNavigatorPosition = useRef(null);
  const [miniatures] = useState(createWorkbenchMiniatures);
  const utilityWindows = useRef(new Map());
  const [utilitySettings, setUtilitySettings] = useState(() => new Set());
  // Editors need scale for projection, but panning must not render them again.
  const { scale, setScale } = useWorkbenchCameraScale();
  const [transforms, setTransforms] = useState({});
  const [presentationTransforms, setPresentationTransforms] = useState({});
  const [hiddenModuleIds, setHiddenModuleIds] = useState([]);
  const {
    selection,
    setSelection,
    selectArtwork,
    focusModule,
    arriveAt,
    selectionMode,
    moduleSelectionBounds,
    editingBlockId,
    enterBlock,
    leaveBlock,
    selectLayers,
    clearSelection,
    captureSelection,
    restoreSelection,
  } = selectionState;
  const [editorHiddenIds, setEditorHiddenIds] = useState([]);
  const layers = useMemo(() => artworkLayers(content), [content]);
  const artworkOpeners = useRef(new Map());
  const registerArtworkOpener = useCallback((id, action) => {
    artworkOpeners.current.set(id, action);
    return () => {
      if (artworkOpeners.current.get(id) === action) artworkOpeners.current.delete(id);
    };
  }, []);
  const openArtwork = useCallback(id => artworkOpeners.current.get(id)?.current?.(), []);
  const [interactionTool, setInteractionTool] = useState('select');
  const [navigationInset, setNavigationInset] = useState(0);
  const [navigationTop, setNavigationTop] = useState(0);
  const [toolViewportBottom, setToolViewportBottom] = useState(null);
  const entries = useRef(new Map());
  const frames = useRef(new Map());
  const resizeTargets = useRef(new Map());
  const toolSources = useRef(new Map()),
    toolRevision = useRef(0),
    toolListeners = useRef(new Set());
  // A color preview updates its tool without forcing canvas geometry reads.
  const toolsChanged = useCallback(() => {
    toolRevision.current += 1;
    toolListeners.current.forEach(listener => listener());
  }, []);
  const subscribeTools = useCallback(listener => {
    toolListeners.current.add(listener);
    return () => toolListeners.current.delete(listener);
  }, []);
  const toolsSnapshot = useCallback(() => toolRevision.current, []);
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;
  const getPresentation = useCallback(() => presentationRef.current, []);
  const selectedRef = useRef(selection);
  selectedRef.current = selection;
  const getSelection = useCallback(() => selectedRef.current.filter(id => entries.current.has(id)), []);
  // Content that only needs commands must not subscribe to camera geometry.
  const focusModulesRef = useRef(null);
  const inspections = useRef(new Map());
  const registerInspection = useCallback((id, action) => {
    inspections.current.set(id, action);
    return () => {
      if (inspections.current.get(id) === action) inspections.current.delete(id);
    };
  }, []);
  const actions = useMemo(
    () => ({
      getPresentation,
      setSelection,
      selectArtwork,
      getSelection,
      registerInspection,
      registerArtworkOpener,
      openArtwork,
      focusModules: ids => focusModulesRef.current?.(ids) ?? false,
    }),
    [
      getPresentation,
      getSelection,
      setSelection,
      selectArtwork,
      registerInspection,
      registerArtworkOpener,
      openArtwork,
    ]
  );
  const revision = useRef(0),
    listeners = useRef(new Set());
  const resizeObserver = useRef(null);
  // One observer delivers one geometry notification for all resized modules.
  // Individual observers caused a synchronous overlay commit per module on
  // every camera frame, followed by another layout read and bounds update.
  const changed = useCallback(() => {
    revision.current += 1;
    listeners.current.forEach(listener => listener());
  }, []);
  const subscribe = useCallback(listener => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);
  const snapshot = useCallback(() => revision.current, []);
  const register = useCallback(
    (id, node) => {
      const previous = entries.current.get(id);
      if (previous) resizeObserver.current?.unobserve(previous);
      if (node) entries.current.set(id, node);
      else entries.current.delete(id);
      if (node) {
        resizeObserver.current ??= new ResizeObserver(changed);
        resizeObserver.current.observe(node);
      }
      changed();
    },
    [changed]
  );
  useLayoutEffect(
    () => () => {
      resizeObserver.current?.disconnect();
      resizeObserver.current = null;
    },
    []
  );
  const value = useMemo(
    () => ({
      navigationTop,
      setNavigationTop,
      navigationInset,
      setNavigationInset,
      utilitySettings,
      setUtilitySettings,
      miniatures,
      utilityWindows: utilityWindows.current,
      navigatorPosition: navigatorPosition || localNavigatorPosition,
      scale,
      setScale,
      transforms,
      setTransforms,
      presentationTransforms,
      setPresentationTransforms,
      hiddenModuleIds,
      setHiddenModuleIds,
      selection,
      setSelection,
      interactionTool,
      setInteractionTool,
      toolViewportBottom,
      setToolViewportBottom,
      focusModulesRef,
      inspections: inspections.current,
      entries: entries.current,
      frames: frames.current,
      resizeTargets: resizeTargets.current,
      toolSources: toolSources.current,
      toolsChanged,
      subscribeTools,
      toolsSnapshot,
      store,
      profileAddress,
      groupContent,
      getPresentation,
      subscribe,
      snapshot,
      register,
      changed,
    }),
    [
      navigationTop,
      navigationInset,
      scale,
      setScale,
      transforms,
      presentationTransforms,
      hiddenModuleIds,
      selection,
      setSelection,
      interactionTool,
      toolViewportBottom,
      store,
      profileAddress,
      groupContent,
      getPresentation,
      subscribe,
      snapshot,
      register,
      changed,
      toolsChanged,
      subscribeTools,
      toolsSnapshot,
      miniatures,
      navigatorPosition,
      utilitySettings,
    ]
  );
  const artworkView = useMemo(
    () => ({
      ...value,
      content,
      layers,
      editorHiddenIds,
      setEditorHiddenIds,
      editingBlockId,
      enterBlock,
      leaveBlock,
      selectLayers,
      clearSelection,
      captureSelection,
      restoreSelection,
      openArtwork,
      selectArtwork,
      focusModule,
      arriveAt,
      selectionMode,
      moduleSelectionBounds,
    }),
    [
      value,
      content,
      layers,
      editorHiddenIds,
      editingBlockId,
      enterBlock,
      leaveBlock,
      selectLayers,
      clearSelection,
      captureSelection,
      restoreSelection,
      openArtwork,
      selectArtwork,
      focusModule,
      arriveAt,
      selectionMode,
      moduleSelectionBounds,
    ]
  );
  return (
    <WorkbenchView.Provider value={artworkView}>
      <WorkbenchActions.Provider value={actions}>{children}</WorkbenchActions.Provider>
    </WorkbenchView.Provider>
  );
}
const emptySubscribe = () => () => {};

export function WorkbenchViewControls({
  hostRef,
  disabled = false,
  dockVisible = true,
  creationToolbarVisible = true,
  historyBlocked = null,
  showHandTool = true,
  entryTarget = null,
}) {
  const { editingBounds: areaBounds, area, showOutside, setShowOutside } = useWorkbenchArea();
  const view = useWorkbenchView();
  const snapMovement = useWorkbenchMovementSnap();
  const { scale, transforms, setTransforms, selection = [], setSelection, entries } = view;
  const revision = useSyncExternalStore(view.subscribe, view.snapshot);
  const latest = useRef(view);
  latest.current = view;
  const groupDrop = useRef(null),
    groupScene = useRef(null);
  const [moveError, setMoveError] = useState('');
  const controlsRef = useRef(null),
    inspectionTarget = useRef(null);
  const [marquee, setMarquee] = useState(null),
    [bounds, setBounds] = useState(null);
  const selected = selection.filter(
    id =>
      entries.has(id) &&
      !entries
        .get(id)
        .matches('[data-workbench-group-hidden], [data-workbench-canvas-hidden], [data-editor-hidden]')
  );
  // The camera rail gets its own projection. Native tools and geometry keep
  // the same IDs; their selected input is not filtered.
  const focusSelected = view.selectionMode === 'activation' ? [] : selected;
  const currentSnap = useRef(snapMovement);
  currentSnap.current = snapMovement;
  const [gestures] = useState(() =>
    createWorkbenchGestures({
      getHost: () => hostRef.current,
      restoreTransforms: values => latest.current.setTransforms(values),
      replaceSelection: ids => latest.current.setSelection(ids),
      restoreSelection: state => latest.current.restoreSelection(state),
      previewMarquee: setMarquee,
      finishSnap: () => currentSnap.current.finish(),
      cancelDrop: () => groupDrop.current?.cancel(),
    })
  );
  const cancelGesture = gestures.cancel,
    isEditing = gestures.isActive;
  const releaseAbandonedGesture = gestures.releaseAbandoned;
  useEffect(
    () =>
      view.store?.guardWorkbenchTransition?.(() =>
        gestures.isActive() ? 'Finish or cancel the canvas gesture before switching Workbenches.' : null
      ),
    [view.store, gestures]
  );
  const captureContext = useCallback(
    () => ({
      selection: latest.current.captureSelection(),
      group: groupScene.current?.capture(),
      focusId: document.activeElement?.closest('[data-workbench-view-id]')?.dataset.workbenchViewId,
    }),
    []
  );
  const restoreContext = useCallback(
    context => {
      groupScene.current?.restore(context?.group);
      const current = latest.current;
      const selection = context?.selection;
      const ids = (selection?.ids || []).filter(id => current.entries.has(id));
      current.restoreSelection(selection ? { ...selection, ids } : null);
      const focusId = ids[0] || context?.focusId;
      inspectionTarget.current = ids.length <= 1 ? focusId || null : null;
      const node = current.entries.get(focusId);
      const target = node?.matches('[data-workbench-selectable]')
        ? node
        : node?.querySelector('[data-workbench-selectable]');
      (target || hostRef.current)?.focus({ preventScroll: true });
    },
    [hostRef]
  );
  const navigation = useWorkbenchNavigation({
    hostRef,
    controlsRef,
    disabled,
    dockVisible,
    creationToolbarVisible,
    interactionTool: view.interactionTool,
    setInteractionTool: view.setInteractionTool,
    onControlsTopChange: view.setToolViewportBottom,
    isEditing,
    cancelEditing: cancelGesture,
    releaseAbandonedGesture,
    captureContext,
    restoreContext,
    returnTargets: context => groupScene.current?.returnTargets(context?.group),
    resetPresentation: () => groupScene.current?.restore(null),
    entries,
  });
  const { locked, focusDestination } = navigation;
  const objectPicker = useWorkbenchObjectPicker({
    hostRef,
    view,
    disabled,
    locked,
    isBusy: () => gestures.isActive() || navigation.isPanning(),
  });
  const focusModules = useCallback(
    (moduleIds, toggle = false) => {
      const ids = [...new Set(moduleIds)].filter(id => {
        const node = latest.current.entries.get(id);
        return node && !node.hasAttribute('data-workbench-group-hidden');
      });
      const nodes = ids.map(id => latest.current.entries.get(id));
      if (!ids.length) return false;
      if (
        latest.current.store &&
        !showOutside &&
        ids.some(id => {
          const frame = latest.current.frames.get(id)?.current;
          return (
            frame &&
            (frame.left < area.left ||
              frame.top < area.top ||
              frame.left + frame.width > area.left + area.width ||
              frame.top + frame.height > area.top + area.height)
          );
        })
      )
        setShowOutside(true);
      const accepted = focusDestination({
        key: JSON.stringify([...ids].sort()),
        toggle,
        getBounds: () => {
          const current = latest.current;
          if (ids.some((id, index) => current.entries.get(id) !== nodes[index] || !nodes[index].isConnected))
            return null;
          const rectangles = ids.map(id => {
            const transform =
              current.presentationTransforms[id] || current.transforms[id] || identityWorkbenchTransform;
            const frame = transform.frame || current.frames.get(id)?.current;
            return (
              frame && {
                left: frame.left * transform.scale + transform.x,
                top: frame.top * transform.scale + transform.y,
                width: frame.width * transform.scale,
                height: frame.height * transform.scale,
              }
            );
          });
          return rectangles.every(Boolean) ? workbenchSelectionBounds(rectangles) : null;
        },
        onArrive: () => {
          // Release selection while retaining the single module tool target.
          latest.current.arriveAt(ids.length === 1 ? ids[0] : null);
        },
      });
      if (accepted) inspectionTarget.current = ids.length === 1 ? ids[0] : null;
      return accepted;
    },
    [focusDestination, area.left, area.top, area.width, area.height, showOutside, setShowOutside]
  );
  const focusSelection = () =>
    latest.current.selectionMode !== 'activation' && focusModules(latest.current.selection);
  useLayoutEffect(() => {
    // Modules request navigation through stable actions; the mounted camera owns it.
    view.focusModulesRef.current = focusModules;
    return () => {
      if (view.focusModulesRef.current === focusModules) view.focusModulesRef.current = null;
    };
  }, [view.focusModulesRef, focusModules]);
  useEffect(() => () => cancelGesture(false), [cancelGesture]);
  useLayoutEffect(() => {
    if (disabled || locked) cancelGesture();
  }, [disabled, locked, cancelGesture]);
  useLayoutEffect(() => {
    if (navigation.moving) return;
    // Registration can change between render and this layout effect (including
    // module replacement); stale selections must not dereference removed nodes.
    const next = workbenchSelectionBounds(
      selected.flatMap(id => {
        const node = entries.get(id);
        return node?.isConnected ? [node.getBoundingClientRect()] : [];
      })
    );
    setBounds(current => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, [scale, transforms, selection, view.editorHiddenIds, revision, navigation.offset, navigation.moving]);
  // During camera travel the authored rectangles are stable and already known.
  // Project them directly instead of forcing layout and a second React commit.
  const travellingBounds =
    navigation.moving &&
    workbenchSelectionBounds(
      selected.flatMap(id => {
        const transform = workbenchModuleTransform(view, id);
        const frame = transform.frame || view.frames.get(id)?.current;
        if (!frame) return [];
        const density = globalThis.devicePixelRatio || 1;
        const rectangle = workbenchPaintGeometry(
          {
            left: frame.left * transform.scale + transform.x + navigation.offset.x,
            top: frame.top * transform.scale + transform.y + navigation.offset.y,
            width: frame.width * transform.scale,
            height: frame.height * transform.scale,
          },
          density
        );
        return [Object.fromEntries(Object.entries(rectangle).map(([key, value]) => [key, value / density]))];
      })
    );
  const currentAreaBounds = useRef(areaBounds);
  currentAreaBounds.current = areaBounds;
  const workspaceBounds = () => {
    const camera = navigation.getCamera();
    return projectWorkbenchBounds(camera.scale, camera.offset, currentAreaBounds.current);
  };
  const operationOrigin = current => ({
    kind: current.store ? 'owner' : 'visitor',
    ...(current.store
      ? {
          store: current.store,
          profileAddress: current.profileAddress,
          getPresentation: current.getPresentation,
        }
      : {}),
    isCurrent: () => latest.current.store === current.store && latest.current.entries === current.entries,
  });
  const moveOperation = (current, ids) =>
    createWorkbenchMoveOperation({
      origin: operationOrigin(current),
      selection: {
        ids,
        selectedIds: current.selection,
        content: current.content,
        layers: current.layers || [],
      },
      registry: current,
      geometry: {
        scale: current.scale,
        rectangle: snapMovement.rectangle,
        snap: snapMovement,
        bounds: workspaceBounds,
      },
      transforms: current.transforms,
      setTransforms,
      reportError: setMoveError,
    });
  const beginMove = (event, ids = selection) => {
    if (event.button !== 0 || gestures.isActive()) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.target.matches?.('.workbench-selection')) event.target.focus({ preventScroll: true });
    else hostRef.current?.focus({ preventScroll: true });
    const operation = moveOperation(latest.current, ids);
    if (!operation) return;
    snapMovement.begin(event, operation.nodes);
    gestures.beginMove(event, {
      ...operation,
      previewDrop: pointer => groupDrop.current?.preview(pointer),
      commitDrop: pointer => groupDrop.current?.commit(pointer, operation.ids),
    });
  };
  const moveByKey = (event, current, ids, step) => {
    const operation = moveOperation(current, ids);
    if (!operation) return;
    snapMovement.begin(event, operation.nodes);
    operation.preview(
      {
        x: event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0,
        y: event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0,
      },
      event.altKey
    );
    if (!operation.commit()) setTransforms(operation.beforeTransforms);
  };
  const resizeOperation = (current, ids, corner) =>
    createWorkbenchResizeOperation({
      origin: operationOrigin(current),
      ids,
      corner,
      registry: current,
      geometry: {
        scale: current.scale,
        cameraOffset: navigation.getCamera().offset,
        moduleScale: id => workbenchModuleTransform(current, id).scale,
        rectangle: snapMovement.rectangle,
        snapResize: snapMovement.resize,
        bounds: workspaceBounds,
        areaBounds: () => currentAreaBounds.current,
      },
      transforms: current.transforms,
      setTransforms,
    });
  const beginResize = (event, corner) => {
    if (event.button !== 0 || !bounds || gestures.isActive()) return;
    const operation = resizeOperation(latest.current, [...selected], corner);
    if (!operation) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    snapMovement.begin(event, operation.nodes);
    gestures.beginResize(event, operation);
  };
  const resizeByKey = (event, corner) => {
    if (
      gestures.isActive() ||
      navigation.isPanning() ||
      !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const current = latest.current;
    const operation = resizeOperation(
      current,
      current.selection.filter(id => current.entries.has(id)),
      corner
    );
    if (!operation) return;
    snapMovement.begin(event, operation.nodes);
    if (operation.previewByKey(event.key, event.shiftKey, event.altKey) && !operation.commit())
      setTransforms(operation.beforeTransforms);
  };
  const interactionActions = useRef(null);
  interactionActions.current = { navigation, moveByKey, beginMove, pick: objectPicker.pick };
  useEffect(() => {
    const host = hostRef.current;
    if (!host || disabled) return;
    const key = event => {
      const { navigation, moveByKey } = interactionActions.current;
      if (
        event.target.closest?.(
          '[data-workbench-group-tools], [data-workbench-selection-tools], [data-workbench-layers]'
        )
      )
        return;
      const presentedId = event.target.closest?.('[data-workbench-view-id]')?.dataset.workbenchViewId;
      if (
        latest.current.presentationTransforms[presentedId] &&
        ((event.shiftKey && event.key === 'Enter') ||
          (event.key.startsWith('Arrow') && event.target.matches('[data-workbench-selectable]')))
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const header = event.target.closest?.('header[data-workbench-selectable]');
      const selectable = event.target.closest?.('[data-workbench-selectable]');
      if (locked) {
        // Inspection locks editing, while titles retain menu and focus access.
        const accessKey =
          ['Tab', 'Escape', 'ContextMenu'].includes(event.key) || (event.shiftKey && event.key === 'F10');
        if (selectable === event.target && !accessKey) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.shiftKey && event.key === 'Enter' && selectable === event.target) {
        const id = selectable.closest('[data-workbench-view-id]')?.dataset.workbenchViewId;
        if (!entries.has(id)) return;
        event.preventDefault();
        event.stopPropagation();
        // The first explicit selection keeps the artwork activated by focus.
        // Later presses toggle membership without focus replacing the group.
        const activated = latest.current.moduleSelectionBounds;
        setSelection(values =>
          values.includes(id) ? (activated ? values : values.filter(value => value !== id)) : [...values, id]
        );
        return;
      }
      const editable = event.target.closest?.(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
      );
      if (
        event.key === 'Enter' &&
        !editable &&
        !event.defaultPrevented &&
        !event.shiftKey &&
        !gestures.isActive()
      ) {
        const current = latest.current,
          ids =
            current.selectionMode === 'activation'
              ? []
              : current.selection.map(id => artworkModuleId(current.content, id));
        const block = current.layers?.find(
          layer => typeof layer !== 'string' && layer.children.every(id => ids.includes(id))
        );
        if (block && !current.editingBlockId) {
          event.preventDefault();
          event.stopPropagation();
          current.enterBlock(block.id);
          return;
        }
      }
      const shortcut = event.key.toLowerCase();
      if (
        (shortcut === 'f' || (shortcut === 'i' && !event.shiftKey)) &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.isComposing &&
        !editable &&
        !event.defaultPrevented &&
        !event.target.closest?.('[data-immersive], [role="dialog"], [role="menu"]')
      ) {
        if (event.repeat) {
          event.preventDefault();
          return;
        }
        if (gestures.isActive() || navigation.isPanning() || navigation.hasCapturedPointer()) return;
        const current = latest.current;
        const selected =
          current.selectionMode === 'activation' ||
          (shortcut === 'f' && current.moduleSelectionBounds && event.target === host && navigation.canGoBack)
            ? []
            : current.selection.filter(id => current.entries.has(id));
        const target = event.target.closest?.('[data-workbench-inspection-target]')?.dataset
          .workbenchInspectionTarget;
        let accepted;
        if (shortcut === 'f') {
          // Arrival activation yields to native focus; F also retains the host Back route.
          const focused = target || presentedId;
          const ids = selected.length ? selected : current.entries.has(focused) ? [focused] : [];
          accepted = ids.length ? focusModules(ids, true) : navigation.goBack();
        } else {
          // A retained arrival target must not override another native I target.
          if (selected.length > 1) return;
          const id = selected[0] || target || presentedId || inspectionTarget.current;
          const node = current.entries.get(id);
          accepted =
            node &&
            !node.hasAttribute('data-workbench-group-hidden') &&
            current.inspections.get(id)?.current?.(event.target);
        }
        if (accepted) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      const headerId = header?.closest('[data-workbench-view-id]')?.dataset.workbenchViewId;
      const current = latest.current,
        transform = headerId && workbenchModuleTransform(current, headerId);
      if (
        header === event.target &&
        entries.has(headerId) &&
        (transform.scale !== 1 || transform.x || transform.y) &&
        ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)
      ) {
        event.preventDefault();
        event.stopPropagation();
        moveByKey(event, current, [headerId], event.shiftKey ? 24 : 8);
        return;
      }
      if (
        event.key === 'Escape' &&
        (gestures.isActive() ||
          (!editable &&
            latest.current.selection.length &&
            !latest.current.editingBlockId &&
            (!latest.current.moduleSelectionBounds || !navigation.canGoBack)))
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (gestures.isActive()) cancelGesture();
        else {
          setSelection([]);
          host.focus({ preventScroll: true });
        }
        return;
      }
    };
    // Let module React handlers consume Escape before using it for Back. The
    // capture handler above still owns selection and active editing gestures.
    const backKey = event => {
      const { navigation } = interactionActions.current;
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        !host.contains(event.target) ||
        event.target.closest?.(
          'input, textarea, select, [contenteditable="true"], [data-workbench-selection-tools]'
        )
      )
        return;
      const current = latest.current;
      if (current.editingBlockId) {
        current.leaveBlock();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (navigation.goBack()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const pointer = event => {
      const { beginMove, pick } = interactionActions.current;
      if (
        locked ||
        latest.current.interactionTool !== 'select' ||
        event.target.closest?.(
          '[data-workbench-selection-tools], [data-workbench-toolbar], [data-workbench-layers], [data-context-tools], [data-shared-text-tools], [data-shared-display-tools]'
        )
      )
        return;
      if (event.button === 0 && gestures.ownsPointer(event.pointerId)) cancelGesture();
      if (event.button !== 0 || gestures.isActive() || event.target.closest?.('[data-immersive]')) return;
      if (pick(event)) return;
      // Resolve Shift-click through the selection overlay to the module's own
      // selectable surface: a window header or Image's artwork surface.
      const target =
        event.shiftKey && event.target.matches?.('.workbench-selection')
          ? latest.current.selection
              .map(id => entries.get(id)?.querySelector('[data-workbench-selectable]'))
              .find(header => {
                if (!header) return false;
                const rect = header.getBoundingClientRect();
                return (
                  event.clientX >= rect.left &&
                  event.clientX <= rect.right &&
                  event.clientY >= rect.top &&
                  event.clientY <= rect.bottom
                );
              }) || event.target
          : event.target;
      const module = target.closest?.('[data-workbench-view-id]');
      // Host controls (including a Display's failure notice) keep their current
      // target. Only an artwork or the canvas background changes selection.
      const background =
        event.target === host ||
        event.target.matches?.('.system-workflow__workbench, .system-workflow__display-instance');
      if (!module && !background) return;
      if (module && latest.current.presentationTransforms[module.dataset.workbenchViewId]) return;
      const current = latest.current,
        moduleId = module && artworkModuleId(current.content, module.dataset.workbenchViewId);
      const block =
        current.store &&
        current.layers?.find(layer => typeof layer !== 'string' && layer.children.includes(moduleId));
      if (
        block &&
        current.editingBlockId !== block.id &&
        !target.closest(
          'input,textarea,[contenteditable="true"],[role="separator"],button:not([data-workbench-selectable])'
        )
      ) {
        const ids = artworkWindowIds(current.content, block.children);
        setSelection(event.shiftKey ? values => [...new Set([...values, ...ids])] : ids);
        beginMove(event, ids);
        return;
      }
      if (
        module &&
        event.shiftKey &&
        target.closest('[data-workbench-selectable]') &&
        !target.closest('[role="separator"], button:not([data-workbench-selectable]), a')
      ) {
        const id = module.dataset.workbenchViewId;
        if (!entries.has(id)) return;
        event.preventDefault();
        event.stopPropagation();
        setSelection(values =>
          values.includes(id) ? values.filter(value => value !== id) : [...values, id]
        );
        return;
      }
      if (
        !event.target.closest?.(
          '.workbench-selection, .workbench-view-controls, [data-workbench-group-tools], [data-workbench-toolbar]'
        ) &&
        !event.shiftKey
      )
        setSelection([]);
      if (
        module &&
        current.store &&
        (layerIds(current.layers || []).includes(moduleId) || moduleId?.startsWith('display:')) &&
        !event.shiftKey
      )
        current.selectArtwork(module.dataset.workbenchViewId);
      else if (
        module &&
        target.closest('[data-workbench-select-on-pointer]') &&
        entries.has(module.dataset.workbenchViewId)
      )
        setSelection([module.dataset.workbenchViewId]);
      if (
        module &&
        target.closest('header[data-workbench-selectable]') &&
        !target.closest('button, a') &&
        entries.has(module.dataset.workbenchViewId)
      ) {
        const id = module.dataset.workbenchViewId,
          transform = workbenchModuleTransform(latest.current, id);
        if (transform.scale !== 1 || transform.x || transform.y) {
          beginMove(event, [id]);
          return;
        }
      }
      if (!background) return;
      event.preventDefault();
      host.focus({ preventScroll: true });
      gestures.beginMarquee(event, {
        beforeSelection: latest.current.captureSelection(),
        previousSelection:
          event.shiftKey && latest.current.selectionMode !== 'activation' ? latest.current.selection : [],
        hits: rectangle =>
          [...entries]
            .filter(([, node]) => {
              if (
                node.matches('[data-workbench-group-hidden], [data-workbench-canvas-hidden]') ||
                latest.current.presentationTransforms[node.dataset.workbenchViewId]
              )
                return false;
              return marqueeContains(rectangle, node.getBoundingClientRect());
            })
            .map(([id]) => id),
      });
    };
    const activateInspection = event => {
      const node = event.target.closest?.('[data-workbench-view-id], [data-workbench-inspection-target]');
      if (node) {
        const id = node.dataset.workbenchInspectionTarget || node.dataset.workbenchViewId;
        inspectionTarget.current = id;
        const current = latest.current;
        // Ordinary keyboard entry activates artwork. Once Shift/marquee has
        // started an explicit selection, focus may visit its next candidate.
        if (
          event.type === 'focusin' &&
          current.store &&
          current.entries.has(id) &&
          layerIds(current.layers || []).includes(artworkModuleId(current.content, id))
        )
          current.focusModule(id);
      } else if (event.type === 'pointerdown' && event.target === host) inspectionTarget.current = null;
    };
    host.addEventListener('pointerdown', activateInspection, true);
    host.addEventListener('focusin', activateInspection);
    host.addEventListener('keydown', key, true);
    globalThis.addEventListener('keydown', backKey);
    host.addEventListener('pointerdown', pointer, true);
    return () => {
      host.removeEventListener('pointerdown', activateInspection, true);
      host.removeEventListener('focusin', activateInspection);
      host.removeEventListener('keydown', key, true);
      globalThis.removeEventListener('keydown', backKey);
      host.removeEventListener('pointerdown', pointer, true);
    };
  }, [hostRef, disabled, locked, cancelGesture, gestures, setSelection, entries, focusModules]);
  if (disabled) return null;
  return (
    <>
      <WorkbenchArea hostRef={hostRef} />
      {objectPicker.element}
      {moveError && (
        <p className="workbench-move-error" role="alert" onClick={() => setMoveError('')}>
          {moveError}
        </p>
      )}
      {marquee && <div className="workbench-marquee" style={marquee} />}
      {!locked &&
        view.interactionTool === 'select' &&
        bounds &&
        selected.length > 0 &&
        !view.moduleSelectionBounds && (
          <div
            className="workbench-selection"
            style={travellingBounds || bounds}
            role="group"
            tabIndex={0}
            aria-label={`${selected.length} selected Workbench modules`}
            aria-description="Drag to move the selection. Arrow keys move it; Shift moves further. Escape clears selection."
            onDoubleClick={event => {
              if (
                !view.layers.some(
                  layer =>
                    typeof layer !== 'string' &&
                    artworkWindowIds(view.content, layer.children).every(id => selection.includes(id))
                )
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              focusModules(selected);
            }}
            onPointerDown={event => {
              if (event.target === event.currentTarget) beginMove(event);
            }}
            onKeyDown={event => {
              if (
                event.target !== event.currentTarget ||
                gestures.isActive() ||
                !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              const step =
                (event.altKey ? 1 : snapMovement.step(selected.map(id => entries.get(id)))) *
                (event.shiftKey ? 10 : 1);
              moveByKey(event, latest.current, selected, step);
            }}
          >
            {['nw', 'ne', 'sw', 'se'].map(corner => (
              <button
                key={corner}
                className={`workbench-selection__handle is-${corner}`}
                type="button"
                aria-label={`Scale selected modules from ${corner}`}
                onPointerDown={event => beginResize(event, corner)}
                onKeyDown={event => resizeByKey(event, corner)}
              />
            ))}
          </div>
        )}
      <Suspense fallback={null}>
        <WorkbenchNavigator hostRef={hostRef} navigation={navigation} />
      </Suspense>
      <div
        ref={controlsRef}
        className="workbench-view-controls"
        data-workflow-material="tactile"
        data-workflow-finish="flat"
        style={{
          '--view-controls-top': view.toolViewportBottom == null ? undefined : `${view.toolViewportBottom}px`,
        }}
        role="group"
        aria-label="Workbench zoom"
      >
        {showHandTool && (
          <button
            className="workflow-tactile-control workbench-view-controls__hand"
            type="button"
            disabled={locked}
            aria-pressed={navigation.hand}
            aria-label="Hand tool"
            title="Drag to explore with momentum. Double-click Image artwork to focus its module; module positions stay fixed."
            onClick={navigation.toggleHand}
          >
            <Hand />
          </button>
        )}
        <button
          className="workflow-tactile-control"
          type="button"
          disabled={locked || !navigation.canGoBack}
          aria-label="Back to previous Workbench view"
          title="Return to the view before focusing (F, or Escape after clearing selection)"
          onClick={navigation.goBack}
        >
          <ArrowLeft />
        </button>
        <button
          className="workflow-tactile-control"
          type="button"
          disabled={locked || !focusSelected.length}
          aria-label="Focus selected Workbench modules"
          aria-keyshortcuts="F"
          title="Center the selected modules (F); press F again to return"
          onClick={focusSelection}
        >
          <Scan />
        </button>
        {focusSelected.length > 0 && (
          <span className="workbench-view-controls__selection-count">{focusSelected.length} selected</span>
        )}
        {view.store && (
          <Suspense fallback={null}>
            <WorkbenchCanvasControls
              hostRef={hostRef}
              navigation={navigation}
              historyBlocked={historyBlocked}
            />
          </Suspense>
        )}
        {view.store && (
          <Suspense fallback={null}>
            <WorkbenchGroups
              view={view}
              hostRef={hostRef}
              locked={locked}
              dropRef={groupDrop}
              historyBlocked={historyBlocked}
              navigation={navigation}
              sceneRef={groupScene}
              disabled={disabled}
            />
          </Suspense>
        )}
        {!view.store && view.groupContent?.workbenchGroups?.length > 0 && (
          <Suspense fallback={null}>
            <PublishedWorkbenchGroups
              view={view}
              content={view.groupContent}
              hostRef={hostRef}
              navigation={navigation}
              sceneRef={groupScene}
              disabled={disabled}
              locked={locked}
            />
          </Suspense>
        )}
        {(view.store?.getSnapshot().workbenchIndex || view.groupContent?.workbenchIndex) && (
          <Suspense fallback={null}>
            <WorkbenchIndex
              hostRef={hostRef}
              navigation={navigation}
              sceneRef={groupScene}
              entryTarget={entryTarget}
            />
          </Suspense>
        )}
        {GridSeamProbe && (
          <Suspense fallback={null}>
            <GridSeamProbe hostRef={hostRef} scale={scale} offset={navigation.offset} />
          </Suspense>
        )}
      </div>
    </>
  );
}
