import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import ArticleView from './ArticleView.jsx';
import { TextFrameOverflow, useTextFrame, useLinkedFrameLayout } from './TextFrame.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { useWorkbenchView, workbenchModuleTransform } from '../public/ownerSystemWorkflow/WorkbenchView.jsx';
import { textAppearance, textOutputStyle, textWindowStyle } from './domain/article.js';
import { Plus, Pencil, Settings, X } from '../public/InscapeIcons.jsx';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';

const ContinuationEditor = lazy(() => import('./ArticleEditor.jsx').then(module => ({ default: module.ContinuationEditor })));

export function TextFrameLinks({ ids }) {
  const view = useWorkbenchView(), { offset } = useWorkbenchCamera();
  const revision = useSyncExternalStore(view.subscribe, view.snapshot);
  const [lines, setLines] = useState([]), key = ids.join('|');
  useLayoutEffect(() => {
    const rectangles = ids.map(id => view.entries.get(id)?.getBoundingClientRect());
    const next = rectangles.slice(1).flatMap((right, index) => {
      const left = rectangles[index];
      return left && right ? [{ x1: left.right, y1: left.top + left.height / 2, x2: right.left, y2: right.top + right.height / 2 }] : [];
    });
    setLines(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
  }, [key, revision, view.scale, view.transforms, offset.x, offset.y]);
  return <svg className="text-flow-links" aria-label="Linked text frame reading order" role="img">
    {lines.map((line, index) => <g key={index}><line {...line} /><rect x={line.x1 - 2} y={line.y1 - 2} width="4" height="4" /><rect x={line.x2 - 2} y={line.y2 - 2} width="4" height="4" /></g>)}
  </svg>;
}

export function LinkedTextContent({ article, flow, index = 0, mode, showOverflow, children }) {
  const root = useRef(null);
  const { range, remainder, visible, height, onMeasure } = useLinkedFrameLayout(article, flow, index);
  useTextFrame(root, article, 'read', { force: true, onMeasure });
  return <div ref={root} className="text-linked-content" data-text-frame data-text-flow-frame={index + 1} style={{ '--text-frame-height': height }}>
    <div className="text-flow-measure" aria-hidden="true" inert=""><ArticleView article={article} flow={remainder} /></div>
    <div className="text-flow-visible" style={{ visibility: range.from === undefined ? 'hidden' : undefined }}>
      {mode === 'write' ? children : <ArticleView article={article} flow={visible} />}
    </div>
    {showOverflow && index === flow.ranges.length - 1 && range.to < flow.total && <TextFrameOverflow />}
  </div>;
}

export default function LinkedTextWindow({ frame, index, article, flow, ownerId, active, store, resizeTarget, onLayout, onRemove, onAdd, onEdit, onTools, windowSnap, mode, flowEditor, registerTarget, acceptImage }) {
  const view = workbenchModuleTransform(useWorkbenchView(), frame.id), paintScale = view.scale * (globalThis.devicePixelRatio || 1);
  const [committed, setCommitted] = useState(null);
  const surface = useRef(null);
  useEffect(() => {
    if (!store || !registerTarget || mode !== 'write') return;
    registerTarget(frame.id, { get node() { return surface.current; }, label: 'Insert artwork into article', placeAsset: acceptImage });
    return () => registerTarget(frame.id, null);
  }, [frame.id, store, registerTarget, mode, acceptImage]);
  const layout = useCallback(window => onLayout(frame.id, window), [frame.id, onLayout]);
  const apply = useCallback(window => { setCommitted(window); layout(window); }, [layout]);
  const target = useMemo(() => ({ ...resizeTarget, parentTextId: ownerId, applyFrame: apply }), [resizeTarget, ownerId, apply]);
  const appearance = textAppearance(article), title = article.title || 'Untitled article';
  return <WorkbenchWindow label={`Text frame ${index + 1}`} title={title} titleContent={<span className="text-window-grip">Text · {index + 1}/{flow.ranges.length}</span>}
    chrome="bevel" externalControls minimumWidth={180} minimumHeight={100} resizableWidth viewId={frame.id} active={active} snapToGrid={Boolean(store) && windowSnap}
    placementModule={Boolean(store)} className="text-window text-window--read text-continuation-window" surfaceStyle={textWindowStyle(article, paintScale)}
    background={<><span aria-hidden="true" className="text-window-bounds" />{appearance.edges?.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
      {appearance.frame && <span aria-hidden="true" className="module-surface-outline" style={{ boxShadow: `inset 0 0 0 ${paintScale}px ${article.appearance ? appearance.color : 'var(--workflow-border)'}` }} />}</>}
    width={frame.window.width} initialHeight={frame.window.height} initialX={frame.window.left} initialY={frame.window.top}
    onLayoutChange={layout} resizeTarget={target} committedFrame={committed} moveFromContent={mode === 'read'}
    controls={store && <><button className="text-window-control" aria-label={`Write in frame ${index + 1}`} title="Write" onClick={onEdit}><Pencil /></button>
      <button className="text-window-control" aria-label={`Text tools for frame ${index + 1}`} title="Text tools" onClick={onTools}><Settings /></button>
      <button className="text-window-control" aria-label={`Add linked frame after ${index + 1}`} title="Add linked frame" disabled={flow.ranges.length >= 8} onClick={() => onAdd(frame.id)}><Plus /></button>
      <button className="text-window-control" aria-label={`Remove frame ${index + 1}, keep text`} title="Remove frame; keep text" onClick={() => onRemove(frame.id)}><X /></button></>}>
    <div ref={surface} className="text-module-body" style={textOutputStyle(article, view.frame || frame.window)}><div className="text-scene-viewport">
      <LinkedTextContent {...{ article, flow, index, mode }} showOverflow={Boolean(store)}>
        {flowEditor && <Suspense fallback={<p role="status">Opening editor…</p>}><ContinuationEditor controller={flowEditor} article={article} range={flow.ranges[index]} index={index} /></Suspense>}
      </LinkedTextContent>
    </div></div>
  </WorkbenchWindow>;
}
