import { useEffect, useLayoutEffect, useRef } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useInterfaceTheme } from '../../interfaceTheme.js';
import { useEditorCells } from '../../reception/EditorCellsContext.jsx';

const readPalette = (host, canvas) => ({ surface: getComputedStyle(host).backgroundColor,
  edge: getComputedStyle(canvas).color });

export default function WorkbenchArea({ hostRef }) {
  const { mode } = useInterfaceTheme();
  const { area, showOutside } = useWorkbenchArea();
  const showFrame = useEditorCells()?.store.getReception()?.showFrame !== false;
  const frameVisible = useRef(showFrame); frameVisible.current = showFrame;
  const outside = useRef(showOutside); outside.current = showOutside;
  const currentArea = useRef(area); currentArea.current = area;
  const node = useRef(null), shade = useRef(null), repaint = useRef(null);
  const palette = useRef(null);
  const { getCamera, subscribeCameraPaint, scale, offset } = useWorkbenchCamera();
  // Canvas pixels do not inherit CSS. Resolve the shared palette only when its
  // mode changes; camera frames reuse these colours without style measurements.
  useLayoutEffect(() => {
    if (!hostRef.current || !node.current) return;
    palette.current = readPalette(hostRef.current, node.current);
    repaint.current?.(getCamera());
  }, [hostRef, getCamera, mode]);
  useEffect(() => {
    const canvas = node.current, host = hostRef.current;
    if (!canvas || !host) return;
    palette.current = readPalette(host, canvas);
    let width = host.clientWidth, height = host.clientHeight;
    const paint = ({ scale, offset }) => {
      const density = globalThis.devicePixelRatio || 1;
      const w = Math.round(width * density), h = Math.round(height * density);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext('2d');
      const left = offset.x + currentArea.current.left * scale, top = offset.y + currentArea.current.top * scale;
      ctx.setTransform(density, 0, 0, density, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.beginPath(); ctx.rect(0, 0, width, height);
      ctx.rect(left, top, currentArea.current.width * scale, currentArea.current.height * scale);
      ctx.fillStyle = palette.current.surface; ctx.fill('evenodd');
      if (frameVisible.current) {
        ctx.strokeStyle = palette.current.edge; ctx.lineWidth = 1 / density;
        ctx.strokeRect(left, top, currentArea.current.width * scale, currentArea.current.height * scale);
      }
      const ghost = shade.current;
      if (ghost) {
        if (!outside.current) { ghost.width = ghost.height = 0; return; }
        if (ghost.width !== w) ghost.width = w;
        if (ghost.height !== h) ghost.height = h;
        const dim = ghost.getContext('2d');
        dim.setTransform(density, 0, 0, density, 0, 0); dim.clearRect(0, 0, width, height);
        dim.beginPath(); dim.rect(0, 0, width, height);
        dim.rect(left, top, currentArea.current.width * scale, currentArea.current.height * scale);
        dim.fillStyle = palette.current.surface; dim.globalAlpha = .65; dim.fill('evenodd');
      }
    };
    repaint.current = paint;
    const observer = new ResizeObserver(() => { width = host.clientWidth; height = host.clientHeight; paint(getCamera()); });
    observer.observe(host); paint(getCamera());
    const unsubscribe = subscribeCameraPaint(paint);
    return () => { observer.disconnect(); unsubscribe(); repaint.current = null; };
  }, [hostRef, getCamera, subscribeCameraPaint]);
  useLayoutEffect(() => { repaint.current?.(getCamera()); }, [getCamera, scale, offset, area.left, area.top, area.width, area.height, showOutside, showFrame]);
  const style = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', color: 'var(--color-border-strong)' };
  return <><canvas ref={node} data-workbench-area={`${area.width}x${area.height}`} data-show-frame={showFrame} data-canvas-left={area.left} data-canvas-top={area.top} aria-hidden="true" style={{ ...style, zIndex: 0 }} />
    <canvas ref={shade} data-workbench-outside-shade aria-hidden="true" style={{ ...style, zIndex: 70, display: showOutside ? undefined : 'none' }} /></>;
}
