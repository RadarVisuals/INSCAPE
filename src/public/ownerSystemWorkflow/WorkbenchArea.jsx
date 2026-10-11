import { useEffect, useLayoutEffect, useRef } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';

export default function WorkbenchArea({ hostRef }) {
  const node = useRef(null), repaint = useRef(null);
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
      ctx.setTransform(density, 0, 0, density, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.beginPath(); ctx.rect(0, 0, width, height);
      ctx.rect(offset.x, offset.y, 4000 * scale, 4000 * scale);
      ctx.fillStyle = '#242626'; ctx.fill('evenodd');
      ctx.strokeStyle = '#888b88'; ctx.lineWidth = 1 / density;
      ctx.strokeRect(offset.x, offset.y, 4000 * scale, 4000 * scale);
    };
    repaint.current = paint;
    const observer = new ResizeObserver(() => { width = host.clientWidth; height = host.clientHeight; paint(getCamera()); });
    observer.observe(host); paint(getCamera());
    const unsubscribe = subscribeCameraPaint(paint);
    return () => { observer.disconnect(); unsubscribe(); repaint.current = null; };
  }, [hostRef, getCamera, subscribeCameraPaint]);
  useLayoutEffect(() => { repaint.current?.(getCamera()); }, [getCamera, scale, offset]);
  return <canvas ref={node} data-workbench-area="4000" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}
