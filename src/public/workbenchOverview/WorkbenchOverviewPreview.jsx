import { useLayoutEffect, useRef, useState } from 'react';
import WorkbenchMiniature from '../ownerSystemWorkflow/WorkbenchMiniature.jsx';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import { useArticleFlow } from '../../text/TextFrame.jsx';
import TextViewport from '../../text/TextViewport.jsx';
import ArticleView from '../../text/ArticleView.jsx';
import { textWindowStyle, textOutputStyle } from '../../text/domain/article.js';
import '../ownerSystemWorkflow/navigator.css';
import '../../text/text.css';
import { fitCanvasRegion } from './fitCanvasRegion.js';
import { projectCroppedMediaRectangle } from '../../lattice/rendering/latticeCrop.js';
import { workbenchPaintGeometry } from '../ownerSystemWorkflow/workbenchPaintGeometry.js';

function projectFrame(frame, area, scale) {
  return { left: (frame.left - area.left) * scale, top: (frame.top - area.top) * scale,
    width: frame.width * scale, height: frame.height * scale };
}

function contentFrame(frame, area, scale) {
  return { ...projectFrame(frame, area, scale), width: frame.width, height: frame.height,
    transform: `scale(${scale})` };
}

function TextPreview({ item, scale, area }) {
  const { article, frames } = item.source;
  const windows = [{ id: item.id, window: item.frame }, ...frames];
  const flow = useArticleFlow(article, windows.map(frame => frame.id));
  return windows.map(({ id, window: frame }, index) => <div key={id} className="navigator-object" style={contentFrame(frame, area, scale)}>
    <div className="text-module-body" style={{ ...textWindowStyle(article), ...textOutputStyle(article, frame),
      '--workbench-content-scale': 1, '--workbench-content-width': `${frame.width}px`, '--workbench-paint-width': `${frame.width}px`, '--workbench-paint-height': `${frame.height}px` }}>
      <TextViewport article={article} mode="read" flow={frames.length ? flow : undefined} flowIndex={index}>
        {!frames.length && <ArticleView article={article} />}
      </TextViewport>
    </div>
  </div>);
}

export default function WorkbenchOverviewPreview({ model, surfaceId, name, region = model.area, highlights = [], presenting = false, thumbnail = false, crop = null, viewport = null }) {
  const host = useRef(null), [measured, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const measure = () => { const { width, height } = host.current.getBoundingClientRect(); setSize({ width, height }); };
    const observer = new ResizeObserver(measure);
    observer.observe(host.current); addEventListener('resize', measure);
    return () => { observer.disconnect(); removeEventListener('resize', measure); };
  }, []);
  const size = viewport || measured;
  const { area, items } = model;
  const covered = thumbnail && size.width > 0 && size.height > 0
    ? projectCroppedMediaRectangle({ left: 0, top: 0, ...size }, area, crop || { x: .5, y: .5, zoom: 1 }) : null;
  const { scale, left, top } = covered ? { ...covered, scale: covered.width / area.width }
    : fitCanvasRegion(area, region, size, presenting ? 0 : 16);
  // Paint one fitted surface in physical pixels. Image clips share the editor's
  // rounded-edge policy inside it; scaling separate clipped world-size images
  // produces antialiased seams, especially at fractional display densities.
  const density = globalThis.devicePixelRatio || 1, paintScale = scale * density;
  return <div className="workbench-overview-preview" ref={host} role="img" aria-label={`${presenting ? 'Canvas' : 'Preview'} of ${name}`} data-presenting={presenting || undefined}>
    <div className="workbench-overview-canvas" data-world-width={area.width} aria-hidden="true" inert="" style={{ width: area.width * paintScale, height: area.height * paintScale,
      transform: `matrix(${1 / density},0,0,${1 / density},${left},${top})`, background: latticeSurfaceColor(surfaceId) }}>
        {scale > 0 && items.map(item => {
          const frame = projectFrame(item.frame, area, paintScale);
          return item.source.kind === 'text' ? <TextPreview key={item.id} item={item} scale={paintScale} area={area} />
          : item.source.kind === 'interactive' ? <div key={item.id} className="workbench-overview-interactive" style={contentFrame(item.frame, area, paintScale)}>
            <span>{item.source.name}</span><small>Interactive artwork</small></div>
          : <WorkbenchMiniature key={item.id} item={{ ...item, scale: paintScale, frame }}
            paint={item.source.kind === 'image' ? workbenchPaintGeometry(frame) : undefined} />;
        })}
        {scale > 0 && highlights.map((frame, index) => <div key={index} className="canvas-presentation-highlight" style={{ ...projectFrame(frame, area, paintScale), outlineWidth: 2 * density }} />)}
    </div>
    {!items.length && !thumbnail && <p className="workbench-overview-empty">Nothing on the canvas yet.<br /><span>Open this Workbench to begin.</span></p>}
  </div>;
}
