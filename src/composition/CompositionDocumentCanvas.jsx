import { useCellSwipe, wrapSlide } from './useCellSwipe.js';
import { slideCount, slideIndex, slideKey, slideOf, swipeOffset } from './cellSlides.js';
import { compositionFluidText } from './compositionFluidText.js';
import { lazy, memo, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { layerIds } from '../systemWorkflow/domain/artworkLayers.js';
import { TextContentPage } from '../text/TextContentPage.jsx';
import { textAppearance, textOutputStyle, textWindowStyle } from '../text/domain/article.js';
import ShapeSurface from '../shapes/ShapeSurface.jsx';
import CompositionCellGrain from './CompositionCellGrain.jsx';
import { compositionPaintLayout } from './compositionPaintLayout.js';
import { CompositionImage } from './CompositionImage.jsx';
import { compositionModuleWindow, compositionResponsiveLayout, visibleCompositionInnerLines } from './compositionEditorDocument.js';
import { editorCellClip, compositionMemberAnchor } from './editorCellGeometry.js';
import CompositionInnerLines from './CompositionInnerLines.jsx';
import CompositionTextPreview from './CompositionTextPreview.jsx';
import CompositionTextReader from './CompositionTextReader.jsx';
import './compositionDocument.css';

const CompositionLinkedContent = lazy(() => import('./CompositionLinkedContent.jsx'));

const LayerContent = memo(function LayerContent({ id, item, cell, background, rect, composition, reportOverflow }) {
  if (!item) return null;
  if (id.startsWith('shape:')) return <ShapeSurface record={item} hideGrain={Boolean(background && cell.grainOverContent !== false)} continuousFill={Boolean(background && composition.bento?.gap > 0)} radius={background ? cell.radius : undefined}
    hideOutline={Boolean(background && visibleCompositionInnerLines(composition.innerLines))} />;
  if (id.startsWith('image:')) {
    const anchor = compositionMemberAnchor(cell, [id]);
    return <CompositionImage record={item} alignment={anchor?.members.length === 1 ? anchor : undefined} />;
  }
  const article = cell ? compositionFluidText(item.article, rect.width, compositionModuleWindow(composition, id).width) : item.article;
  const appearance = textAppearance(article);
  const transform = item.article.appearance?.transform;
  const excerpt = cell && !transform?.quarterTurns && !transform?.mirrorX && !transform?.mirrorY;
  return <>
    {appearance.edges?.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
    {appearance.frame && <span aria-hidden="true" className="module-surface-outline" style={{ boxShadow: `inset 0 0 0 1px ${appearance.color}` }} />}
    {excerpt ? <CompositionTextPreview article={article} id={id} singleLine={cell.singleLine} onOverflow={reportOverflow}
      clipBounds={cell.clipContent === false ? undefined : { left: cell.window.left - rect.left, top: cell.window.top - rect.top,
        right: cell.window.left + cell.window.width - rect.left, bottom: cell.window.top + cell.window.height - rect.top }} />
    : <div className="text-module-body" style={textOutputStyle(article, rect)}>
      <TextContentPage article={article} defaultOverflow="clip" />
    </div>}
  </>;
});

// Read-only paint over the same native module records edited by the Editor.
// Layout is derived at the viewport width; no second saved composition exists.
export default function CompositionDocumentCanvas({ composition, width, onOpenSource }) {
  const host = useRef(null), [measured, setMeasured] = useState(0);
  const canvas = useRef(null), [origin, setOrigin] = useState({ left: 0, top: 0 });
  const measureOrigin = useCallback(() => {
    if (!canvas.current) return;
    const { left, top } = canvas.current.getBoundingClientRect();
    setOrigin(previous => previous.left === left && previous.top === top ? previous : { left, top });
  }, []);
  useLayoutEffect(() => {
    const node = host.current;
    const measure = () => {
      setMeasured(node.clientWidth);
      measureOrigin();
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(node); observer.observe(node.parentElement);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [measureOrigin]);
  // CSS can constrain a requested preview width to the available window.
  // Project into the actual host rather than the unconstrained slider value.
  const viewportWidth = measured;
  const { positions, range, events: swipeEvents } = useCellSwipe(composition, canvas);
  const [reading, setReading] = useState(null);
  const [readouts, setReadouts] = useState({ owner: null, items: {} });
  // Render measurements belong to this document and are refreshed on size/font
  // changes. They affect this preview only, never authored rectangles or text.
  const reportOverflow = useCallback((id, measurement) => setReadouts(previous => {
    const items = previous.owner === composition ? previous.items : {}, old = items[id];
    if (old?.overflow === measurement.overflow) return previous;
    return { owner: composition, items: { ...items, [id]: measurement } };
  }), [composition]);
  const textReadouts = readouts.owner === composition ? readouts.items : {};
  const projected = useMemo(() => viewportWidth > 0 ? compositionResponsiveLayout(composition, viewportWidth) : null, [composition, viewportWidth]);
  useLayoutEffect(measureOrigin, [projected, measureOrigin]);
  const layout = useMemo(() => compositionPaintLayout(projected, globalThis.devicePixelRatio || 1, origin), [projected, origin]);
  const innerLines = visibleCompositionInnerLines(composition.innerLines);
  const order = useMemo(() => layerIds(composition.artworkLayers), [composition.artworkLayers]);
  const layerOrder = useMemo(() => new Map(order.map((id, index) => [id, index])), [order]);
  const { membersByCell, freeLayers, slides } = useMemo(() => {
    const membersByCell = new Map(), slides = new Map(), placed = new Set();
    for (const cell of layout?.cells || []) {
      placed.add(cell.id);
      const members = cell.members.filter(id => layout.windows[id] && layerOrder.has(id))
        .sort((a, b) => layerOrder.get(a) - layerOrder.get(b));
      membersByCell.set(cell.id, members);
      for (const id of members) {
        placed.add(id);
        slides.set(id, slideOf(cell, id));
      }
    }
    return { membersByCell, slides, freeLayers: order.filter(id => !placed.has(id)) };
  }, [layout, order, layerOrder]);
  const records = useMemo(() => new Map([...composition.imageModules, ...composition.texts, ...composition.shapes]
    .map(item => [item.id, item])), [composition]);
  const record = id => records.get(id);
  const renderLayer = (id, cell, slide = null, inactive = false) => {
    const original = layout.windows[id];
    if (!original) return null;
    const parent = cell?.window, text = id.startsWith('text:');
    const article = text && record(id)?.article;
    const rect = original;
    const corner = cell?.radius || 0;
    // A fitted layer already owns its media viewport. Do not add a second CSS
    // clip when it lies wholly inside the cell, clear of its rounded corners.
    const inside = parent && rect.left >= parent.left + corner && rect.top >= parent.top + corner
      && rect.left + rect.width <= parent.left + parent.width - corner
      && rect.top + rect.height <= parent.top + parent.height - corner;
    const local = parent ? { ...rect, left: rect.left - parent.left, top: rect.top - parent.top } : rect;
    return <div key={id} className={`composition-document-layer${text ? ' text-window' : ''}`} data-layer-id={id} data-cell-member={cell?.id} inert={inactive ? '' : undefined}
      data-text={text || undefined}
      style={{ ...(article ? textWindowStyle(article) : {}), ...local, zIndex: layerOrder.get(id),
        ...(slide != null && { '--layer-slide': slide }),
        '--workbench-content-width': `${rect.width}px`, '--workbench-paint-width': `${rect.width}px`, '--workbench-paint-height': `${rect.height}px`, '--workbench-content-scale': 1,
        clipPath: parent && !inside && (slide != null || cell.clipContent !== false) ? editorCellClip(parent, rect, corner) : undefined }}><LayerContent id={id} item={record(id)} cell={cell} rect={rect} composition={composition} reportOverflow={reportOverflow} /></div>;
  };
  return <div className="composition-document-viewport" ref={host} style={width ? { width } : undefined}>
    <section ref={canvas} className="composition-document-canvas" aria-label="Composition layout" data-mobile={layout?.mobile || undefined}
      data-show-frame={composition.showFrame !== false || undefined}
      style={{ width: layout?.width, height: layout?.height || 1, borderRadius: (composition.frameRadius || 0) * (layout?.scale || 1), '--composition-frame-fill': composition.surface || undefined, '--composition-frame-fill-opacity': `${(composition.surfaceOpacity ?? 1) * 100}%`, '--composition-frame-line': composition.frameColor || undefined, '--composition-frame-line-opacity': `${(composition.frameOpacity ?? 1) * 100}%` }}>
      {layout && layout.cells.map(cell => {
        const moving = range?.key === slideKey(cell);
        const active = moving ? wrapSlide(range.nearest, slideCount(cell)) : slideIndex(cell, positions);
        const visible = index => {
          if (!moving) return index === active;
          const count = slideCount(cell), ahead = wrapSlide(index - active, count);
          return Math.min(ahead, count - ahead) <= 2;
        };
        const ids = membersByCell.get(cell.id).filter(id => visible(slides.get(id)));
        const overflowing = ids.find(id => textReadouts[id]?.overflow);
        const frame = cell.window;
        const [slideX, slideY] = swipeOffset(cell);
        // HTML positioning can round an SVG viewport's fractional origin. Keep
        // the fill's layout origin on a physical pixel and project its remaining
        // phase as a transform. The cell group and its independent layers stay
        // untransformed; zero-gap paint retains its existing shared-edge policy.
        const density = globalThis.devicePixelRatio || 1;
        const phase = position => position - Math.floor(position * density) / density;
        const x = layout.gap > 0 ? phase(origin.left + frame.left) : 0;
        const y = layout.gap > 0 ? phase(origin.top + frame.top) : 0;
        const surfaceStyle = x || y ? { left: -x, right: x, top: -y, bottom: y,
          transform: `translate(${x}px, ${y}px)` } : undefined;
        // Positions are already in CSS layout pixels. A camera matrix here
        // would add an unnecessary transformed ancestor to live SVG documents
        // and create a stacking context for otherwise independent cell layers.
        const link = composition.links?.find(item => item.id === cell.content);
        return <div key={cell.id} className="composition-cell-group" data-cell-group={cell.id} data-swipe-key={cell.slides ? slideKey(cell) : undefined} data-swiping={moving || undefined} data-vertical-swipe={cell.slides && slideY !== 0 || undefined}
            style={moving ? { ...frame, '--slide-x': slideX * frame.width + 'px', '--slide-y': slideY * frame.height + 'px', '--slide-count': slideCount(cell), borderRadius: cell.radius || 0 } : frame}
            {...(cell.slides && { ...swipeEvents(cell), tabIndex: 0, role: 'group', 'aria-label': record(cell.id)?.name || 'Cell', 'data-slide': active + 1 })}>
            <section className="composition-document-cell" data-cell-id={cell.id}
              style={{ left: 0, top: 0, width: '100%', height: '100%', zIndex: layerOrder.get(cell.id) ?? -1, borderRadius: cell.radius || 0 }}>
              <div className="composition-document-cell-surface" style={surfaceStyle}><LayerContent id={cell.id} item={record(cell.id)} cell={cell} background composition={composition} /></div>
              {visible(0) && link && <div inert={active !== 0 ? '' : undefined} className="composition-document-cell-content" style={{ padding: cell.contentLayout?.padding ?? 24,
                alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[cell.contentLayout?.alignY || 'top'],
                justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[cell.contentLayout?.alignX || 'left'] }}>
                <Suspense fallback={<p role="status">Opening linked content.</p>}><CompositionLinkedContent link={link} onOpen={onOpenSource} /></Suspense></div>}
            </section>
            {ids.map(id => renderLayer(id, cell, moving ? slides.get(id) : null, slides.get(id) !== active))}
            {cell.slides && <>
              <span aria-hidden="true" className="composition-swipe-glow" data-advance={cell.swipeDirection || 'left'}
                style={{ zIndex: order.length + 3, borderRadius: cell.radius || 0 }} />
              <span className="composition-slide-status" aria-live="polite">Slide {active + 1} of {slideCount(cell)}</span>
            </>}
            <CompositionCellGrain cell={cell} grain={record(cell.id)?.grain} scale={layout.scale}
              style={{ zIndex: order.length + 2 }} />
            {!moving && overflowing && !cell.singleLine && <button type="button" className="composition-read-text" aria-label="Read full text" title="Read full text"
              style={{ zIndex: order.length + 3, color: textAppearance(record(overflowing).article).color }}
              onClick={event => { event.stopPropagation(); setReading({ owner: composition, cell, ids, source: event.currentTarget }); }}>
              <span className="composition-read-dots" aria-hidden="true"><span /><span /><span /></span>
            </button>}
          </div>;
      })}
      {layout && freeLayers.map(id => renderLayer(id))}
      {layout && <CompositionInnerLines frames={layout.cells.map(cell => cell.window)} gap={layout.gap}
        appearance={innerLines && { ...innerLines, width: innerLines.width * layout.scale }}
        bounds={{ left: 0, top: 0, width: layout.width, height: layout.height }} style={{ zIndex: order.length }} />}
      {reading?.owner === composition && <CompositionTextReader articles={order.filter(id => reading.ids.includes(id) && id.startsWith('text:')).map(id => record(id).article)} trigger={reading.source}
        cell={reading.cell} surface={record(reading.cell.id)} onClose={() => setReading(null)} />}
    </section>
  </div>;
}
