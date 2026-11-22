import { useEffect, useLayoutEffect, useRef } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { useInterfaceTheme } from '../../interfaceTheme.js';
import { useEditorCells } from '../../reception/EditorCellsContext.jsx';
import './workbenchArea.css';

const readPalette = (host, canvas) => ({ surface: getComputedStyle(host).backgroundColor,
  edge: getComputedStyle(canvas).color });

export default function WorkbenchArea({ hostRef, canvasColor }) {
  const { mode, palette: paletteId } = useInterfaceTheme();
  const { area, showOutside } = useWorkbenchArea();
  const cells = useEditorCells(), reception = cells?.store.getReception();
  const appearance = { ...reception, ...cells?.paintedAppearance };
  const showFrame = reception?.showFrame !== false;
  const colors = useRef(null); colors.current = reception ? appearance : null;
  const customFill = useRef(canvasColor); customFill.current = canvasColor;
  const frameVisible = useRef(showFrame); frameVisible.current = showFrame;
  const outside = useRef(showOutside); outside.current = showOutside;
  const currentArea = useRef(area); currentArea.current = area;
  const node = useRef(null), shade = useRef(null), outline = useRef(null), repaint = useRef(null);
  const palette = useRef(null);
  const { getCamera, subscribeCameraPaint, scale, offset } = useWorkbenchCamera();
  // Canvas pixels do not inherit CSS. Resolve the shared palette only when its
  // preferences change; camera frames reuse these colours without style measurements.
  useLayoutEffect(() => {
    if (!hostRef.current || !node.current) return;
    palette.current = readPalette(hostRef.current, node.current);
    repaint.current?.(getCamera());
  }, [hostRef, getCamera, mode, paletteId]);
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
      const frameWidth = currentArea.current.width * scale, frameHeight = currentArea.current.height * scale;
      const radius = Math.min((colors.current?.frameRadius || 0) * scale, frameWidth / 2, frameHeight / 2);
      const framePath = context => context.roundRect(left, top, frameWidth, frameHeight, radius);
      ctx.setTransform(density, 0, 0, density, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.beginPath(); ctx.rect(0, 0, width, height);
      framePath(ctx);
      ctx.fillStyle = colors.current?.backgroundColor || palette.current.surface; ctx.fill('evenodd');
      if (customFill.current) {
        ctx.fillStyle = customFill.current;
        ctx.beginPath(); framePath(ctx); ctx.fill();
      } else if (colors.current) {
        ctx.fillStyle = colors.current.backgroundColor || palette.current.surface;
        ctx.beginPath(); framePath(ctx); ctx.fill();
        ctx.globalAlpha = colors.current.surfaceOpacity ?? 1;
        ctx.fillStyle = colors.current.surface || palette.current.surface;
        ctx.beginPath(); framePath(ctx); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (frameVisible.current && !colors.current) {
        ctx.strokeStyle = palette.current.edge; ctx.lineWidth = 1 / density;
        ctx.strokeRect(left, top, currentArea.current.width * scale, currentArea.current.height * scale);
      }
      if (outline.current) Object.assign(outline.current.style, {
        display: colors.current && frameVisible.current ? 'block' : 'none',
        left: `${left}px`, top: `${top}px`, width: `${frameWidth}px`, height: `${frameHeight}px`,
        borderRadius: `${radius}px`, borderColor: colors.current?.frameColor || palette.current.edge,
      });
      const ghost = shade.current;
      if (ghost) {
        if (!outside.current && !colors.current) { ghost.width = ghost.height = 0; return; }
        if (ghost.width !== w) ghost.width = w;
        if (ghost.height !== h) ghost.height = h;
        const dim = ghost.getContext('2d');
        dim.setTransform(density, 0, 0, density, 0, 0); dim.clearRect(0, 0, width, height);
        dim.fillStyle = colors.current?.backgroundColor || palette.current.surface;
        if (outside.current) {
          dim.beginPath(); dim.rect(0, 0, width, height); framePath(dim);
          dim.globalAlpha = .65; dim.fill('evenodd');
        }
        dim.globalAlpha = 1;
        if (colors.current) {
          // Mask only the rounded corners; artwork outside the editing area
          // keeps its existing editor visibility and interaction.
          if (radius) {
            dim.beginPath(); dim.rect(left, top, frameWidth, frameHeight); framePath(dim); dim.fill('evenodd');
          }
        }
      }
    };
    repaint.current = paint;
    const observer = new ResizeObserver(() => { width = host.clientWidth; height = host.clientHeight; paint(getCamera()); });
    observer.observe(host); paint(getCamera());
    const unsubscribe = subscribeCameraPaint(paint);
    return () => { observer.disconnect(); unsubscribe(); repaint.current = null; };
  }, [hostRef, getCamera, subscribeCameraPaint]);
  useLayoutEffect(() => { repaint.current?.(getCamera()); }, [getCamera, canvasColor, scale, offset, area.left, area.top, area.width, area.height, showOutside, showFrame, appearance.surface, appearance.surfaceOpacity, appearance.frameColor, appearance.backgroundColor, appearance.frameRadius]);
  const style = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', color: 'var(--color-border-strong)' };
  return <><canvas ref={node} data-workbench-area={`${area.width}x${area.height}`} data-show-frame={showFrame} data-canvas-left={area.left} data-canvas-top={area.top} aria-hidden="true" style={{ ...style, zIndex: 0 }} />
    <canvas ref={shade} data-workbench-outside-shade aria-hidden="true" style={{ ...style, zIndex: 70, display: reception || showOutside ? undefined : 'none' }} />
    <div ref={outline} className="workbench-area-frame" aria-hidden="true" /></>;
}
