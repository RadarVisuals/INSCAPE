import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { WorkbenchWindow } from './DisplayInstrumentWindow.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { artworkModuleId, layerIds } from '../../systemWorkflow/domain/artworkLayers.js';
import { NavigatorHome, NavigatorMap, NavigatorZoom } from './NavigatorContent.jsx';
import WorkbenchMiniature from './WorkbenchMiniature.jsx';
import { navigatorBounds, navigatorCentre, navigatorFrame, navigatorViewport } from './workbenchNavigatorGeometry.js';
import useWorkbenchUtilityWindow from './useWorkbenchUtilityWindow.js';

export default function WorkbenchNavigator({ hostRef, navigation }) {
  const view = useWorkbenchView(), { area, showOutside } = useWorkbenchArea();
  const camera = useWorkbenchCamera();
  const revision = useSyncExternalStore(view.subscribe, view.snapshot);
  const mediaRevision = useSyncExternalStore(view.miniatures.subscribe, view.miniatures.snapshot);
  const scene = useRef(null), map = useRef(null), zoom = useRef(null), root = useRef(null), mapping = useRef(null), dragging = useRef(false);
  const current = useRef(null);
  const utility = useWorkbenchUtilityWindow(view.content?.keeperDocks?.length ? 1 : 0, view.navigatorPosition.current,
    position => { view.navigatorPosition.current = position; });
  const items = useMemo(() => {
    const order = layerIds(view.layers || []), hidden = new Set(view.editorHiddenIds);
    return [...view.frames].flatMap(([id, ref]) => {
      const node = view.entries.get(id), moduleId = artworkModuleId(view.content, id);
      const app = view.content?.miniApps?.find(item => item.id === id);
      if ((!node?.closest('.workbench-canvas-content') && !app) || !node || node.hasAttribute('data-workbench-group-hidden') || hidden.has(moduleId)) return [];
      const transform = view.presentationTransforms?.[id] || view.transforms[id] || { scale: 1, x: 0, y: 0 };
      const base = transform.frame || ref.current;
      if (!base) return [];
      const frame = { left: base.left * transform.scale + transform.x, top: base.top * transform.scale + transform.y,
        width: base.width * transform.scale, height: base.height * transform.scale };
      return [{ id, frame, scale: transform.scale, source: view.miniatures.sources.get(id)?.current, name: app?.name || node.getAttribute('aria-label'), order: order.indexOf(moduleId) }];
    }).sort((a, b) => a.order - b.order);
  }, [revision, mediaRevision, view.layers, view.editorHiddenIds, view.transforms, view.presentationTransforms, view.content, view.frames, view.entries, view.miniatures]);
  current.current = { navigation, area, showOutside, items };
  const paint = useCallback(camera => {
    const { navigation, area, showOutside, items } = current.current;
    const viewport = navigation.navigationViewport(), element = map.current?.node();
    if (!viewport || !element?.clientWidth || !element.clientHeight) return;
    const visible = navigatorViewport(camera, viewport);
    if (!dragging.current || !mapping.current) mapping.current = navigatorBounds([area, visible, ...(showOutside ? items.map(item => item.frame) : [])], { width: element.clientWidth, height: element.clientHeight });
    const bounds = mapping.current;
    if (!bounds) return;
    if (scene.current) scene.current.style.transform = `scale(${bounds.scale}) translate(${-bounds.left}px, ${-bounds.top}px)`;
    map.current.paint(navigatorFrame(visible, bounds)); zoom.current?.paint(camera.scale * 100);
  }, []);
  useLayoutEffect(() => {
    paint(camera.getCamera());
    const unsubscribe = camera.subscribeCameraPaint(paint), observer = new ResizeObserver(() => { map.current?.cancel(); paint(camera.getCamera()); });
    if (map.current?.node()) observer.observe(map.current.node());
    if (hostRef.current) observer.observe(hostRef.current);
    return () => { observer.disconnect(); unsubscribe(); };
  }, [paint, camera.getCamera, camera.subscribeCameraPaint, hostRef]);
  useLayoutEffect(() => { paint(camera.getCamera()); });
  useLayoutEffect(() => {
    const node = root.current?.closest('.workbench-navigator');
    if (node) view.utilityWindows.set('navigator', node);
    return () => view.utilityWindows.delete('navigator');
  }, [view.utilityWindows]);
  useLayoutEffect(() => view.store?.guardWorkbenchTransition?.(() => dragging.current ? 'Finish or cancel Navigator movement before switching Workbenches.' : null), [view.store]);
  const begin = () => {
    paint(camera.getCamera());
    if (!mapping.current || !navigation.beginNavigator()) return false;
    dragging.current = true; return true;
  };
  const end = cancelled => { navigation.endNavigator(cancelled); dragging.current = false; paint(camera.getCamera()); };
  const readView = () => navigatorFrame(navigatorViewport(camera.getCamera(), navigation.navigationViewport()), mapping.current).view;
  return createPortal(<div data-workbench-navigator data-workbench-selection-tools>
    <WorkbenchWindow label="Navigator" title="Navigator" titleContent={<strong>Navigator</strong>} chrome="flat" className="workbench-navigator workbench-tool-window"
      width={utility.frame.width} minimumWidth={utility.frame.width} initialHeight={utility.frame.height} minimumHeight={utility.frame.height}
      initialX={utility.frame.left} initialY={utility.frame.top} committedFrame={utility.frame} onLayoutCommit={utility.commit} resizable={false}
      surfaceStyle={{ '--navigator-height': `${utility.frame.height}px` }}
      controls={<NavigatorHome disabled={navigation.locked} onClick={navigation.navigatorHome} />}>
      <div ref={root}>
        <NavigatorMap ref={map} disabled={navigation.locked} view={{ x: 50, y: 50 }} frameSize={{ width: 45, height: 45 }} readView={readView}
          onBegin={begin} onEnd={end} onViewChange={point => { if (mapping.current) navigation.moveNavigator(navigatorCentre(point, mapping.current)); }}>
          <div ref={scene} className="navigator-scene">
            <div className="navigator-canvas" style={area} />
            <div style={showOutside ? undefined : { position: 'absolute', left: area.left, top: area.top, width: area.width, height: area.height, overflow: 'hidden' }}>
              <div style={showOutside ? undefined : { position: 'absolute', left: -area.left, top: -area.top }}>
                {items.map(item => <WorkbenchMiniature key={item.id} item={item} />)}
              </div>
            </div>
          </div>
        </NavigatorMap>
        <NavigatorZoom ref={zoom} disabled={navigation.locked} zoom={camera.getCamera().scale * 100} onChange={navigation.navigatorZoom} />
      </div>
    </WorkbenchWindow>
  </div>, hostRef.current || document.body);
}
