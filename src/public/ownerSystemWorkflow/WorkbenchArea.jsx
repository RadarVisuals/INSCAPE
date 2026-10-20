import { useEffect, useLayoutEffect, useRef } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';

export default function WorkbenchArea({ hostRef }) {
  const { area, showOutside } = useWorkbenchArea();
  const outside = useRef(showOutside); outside.current = showOutside;
  const currentArea = useRef(area); currentArea.current = area;
  const node = useRef(null), shade = useRef(null), repaint = useRef(null);
  const { getCamera, subscribeCameraPaint, scale, offset } = useWorkbenchCamera();
  useEffect(() => {
    const canvas = node.current, host = hostRef.current;
    if (!canvas || !host) return;
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
      ctx.fillStyle = '#242626'; ctx.fill('evenodd');
      ctx.strokeStyle = '#888b88'; ctx.lineWidth = 1 / density;
      ctx.strokeRect(left, top, currentArea.current.width * scale, currentArea.current.height * scale);
      const ghost = shade.current;
      if (ghost) {
        if (!outside.current) { ghost.width = ghost.height = 0; return; }
        if (ghost.width !== w) ghost.width = w;
        if (ghost.height !== h) ghost.height = h;
        const dim = ghost.getContext('2d');
        dim.setTransform(density, 0, 0, density, 0, 0); dim.clearRect(0, 0, width, height);
        dim.beginPath(); dim.rect(0, 0, width, height);
        dim.rect(left, top, currentArea.current.width * scale, currentArea.current.height * scale);
        dim.fillStyle = 'rgba(36,38,38,.65)'; dim.fill('evenodd');
      }
    };
    repaint.current = paint;
    const observer = new ResizeObserver(() => { width = host.clientWidth; height = host.clientHeight; paint(getCamera()); });
    observer.observe(host); paint(getCamera());
    const unsubscribe = subscribeCameraPaint(paint);
    return () => { observer.disconnect(); unsubscribe(); repaint.current = null; };
  }, [hostRef, getCamera, subscribeCameraPaint]);
  useLayoutEffect(() => { repaint.current?.(getCamera()); }, [getCamera, scale, offset, area.left, area.top, area.width, area.height, showOutside]);
  const style = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' };
  return <><canvas ref={node} data-workbench-area={`${area.width}x${area.height}`} data-canvas-left={area.left} data-canvas-top={area.top} aria-hidden="true" style={{ ...style, zIndex: 0 }} />
    <canvas ref={shade} data-workbench-outside-shade aria-hidden="true" style={{ ...style, zIndex: 70, display: showOutside ? undefined : 'none' }} /></>;
}
