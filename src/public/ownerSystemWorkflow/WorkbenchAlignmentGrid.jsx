import { useLayoutEffect, useRef } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchView } from './WorkbenchView.jsx';
import { WORKBENCH_GRID_STEP } from './workbenchGrid.js';
import { projectWorkbenchBounds } from './workbenchSpace.js';
import { workbenchPaintGeometry } from './workbenchPaintGeometry.js';

export default function WorkbenchAlignmentGrid({ color, mode }) {
  const { offset, subscribeCameraPaint } = useWorkbenchCamera();
  const { scale } = useWorkbenchView();
  return <WorkbenchGridPattern color={color} mode={mode} offset={offset} scale={scale} subscribeCameraPaint={subscribeCameraPaint} />;
}

export function WorkbenchGridPattern({ color, mode, offset, scale, subscribeCameraPaint }) {
  const node = useRef(null);
  const current = useRef(null), repaint = useRef(null);
  current.current = { mode, offset, scale };
  const visible = mode !== 'NONE';
  useLayoutEffect(() => {
    const canvas = node.current;
    if (!canvas) return;
    const row = document.createElement('canvas');
    // Camera movement never resizes this viewport-sized canvas. Read its size
    // at mount/resize only, rather than forcing layout on every camera commit.
    let { width, height } = canvas.getBoundingClientRect();
    const paint = () => {
      const { mode, offset, scale } = current.current;
      const density = globalThis.devicePixelRatio || 1;
      const w = Math.round(width * density), h = Math.round(height * density);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, w, h);
      if (!w || !h) return;
      const bounds = projectWorkbenchBounds(scale, offset);
      const spacing = WORKBENCH_GRID_STEP * scale;
      const lowX = Math.max(0, bounds.left), highX = Math.min(width, bounds.right);
      const lowY = Math.max(0, bounds.top), highY = Math.min(height, bounds.bottom);
      if (lowX > highX || lowY > highY) return;
      const coordinates = (origin, low, high) => {
        const values = [];
        for (let index = Math.ceil((low - origin) / spacing); index <= Math.floor((high - origin) / spacing); index += 1) {
          values.push(workbenchPaintGeometry({ left: origin + index * spacing, top: 0, width: 0, height: 0 }, density).left);
        }
        return values;
      };
      const xs = coordinates(offset.x, lowX, highX), ys = coordinates(offset.y, lowY, highY);
      const ink = getComputedStyle(canvas).color;
      context.save();
      context.beginPath(); context.rect(lowX * density, lowY * density, (highX - lowX) * density, (highY - lowY) * density); context.clip();
      if (mode === 'DOTS') {
        // Rasterize each column once, then copy that small bitmap per row.
        // No SVG instance tree or per-dot rendering across the whole viewport.
        const radius = Math.ceil(density);
        row.width = w; row.height = radius * 2;
        const dots = row.getContext('2d');
        dots.fillStyle = ink; dots.beginPath();
        for (const x of xs) { dots.moveTo(x + density, radius); dots.arc(x, radius, density, 0, Math.PI * 2); }
        dots.fill();
        for (const y of ys) context.drawImage(row, 0, y - radius);
      } else {
        context.strokeStyle = ink; context.lineWidth = 1; context.beginPath();
        for (const x of xs) { context.moveTo(x, lowY * density); context.lineTo(x, highY * density); }
        for (const y of ys) { context.moveTo(lowX * density, y); context.lineTo(highX * density, y); }
        context.stroke();
      }
      context.restore();
    };
    repaint.current = paint;
    const observer = new ResizeObserver(entries => {
      const size = entries[0].contentRect;
      if (width === size.width && height === size.height) return;
      width = size.width; height = size.height; paint();
    });
    observer.observe(canvas);
    return () => { observer.disconnect(); repaint.current = null; };
  }, [visible]);
  useLayoutEffect(() => { repaint.current?.(); }, [color, mode, offset, scale]);
  useLayoutEffect(() => subscribeCameraPaint?.(camera => {
    current.current = { ...current.current, ...camera }; repaint.current?.();
  }), [subscribeCameraPaint]);
  if (mode === 'NONE') return null;
  return <canvas ref={node} aria-hidden="true" className="lattice-pixel-grid" data-guide-spacing={WORKBENCH_GRID_STEP * scale}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, display: 'block', pointerEvents: 'none', color: color || 'var(--study-grid)' }} />;
}
