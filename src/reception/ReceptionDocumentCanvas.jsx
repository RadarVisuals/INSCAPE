import { useCellSwipe, wrapSlide } from './useCellSwipe.js';
import { slideCount, slideIndex, slideKey, slideOf, swipeOffset } from './cellSlides.js';
import { receptionFluidText } from './receptionFluidText.js';
import { lazy, memo, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { layerIds } from '../systemWorkflow/domain/artworkLayers.js';
import { TextContentPage } from '../text/SceneTextContent.jsx';
import { textAppearance, textOutputStyle, textWindowStyle } from '../text/domain/article.js';
import ShapeSurface from '../shapes/ShapeSurface.jsx';
import ReceptionCellGrain from './ReceptionCellGrain.jsx';
import { receptionPaintLayout } from './receptionPaintLayout.js';
import { ReceptionImage, ReceptionProfileContent } from './ReceptionCanvas.jsx';
import { receptionModuleWindow, receptionResponsiveLayout, visibleReceptionInnerLines } from './receptionEditorDocument.js';
import { editorCellClip, receptionMemberAnchor } from './editorCellGeometry.js';
import ReceptionInnerLines from './ReceptionInnerLines.jsx';
import ReceptionTextPreview from './ReceptionTextPreview.jsx';
import ReceptionTextReader from './ReceptionTextReader.jsx';
import './receptionDocument.css';

const ReceptionLinkedContent = lazy(() => import('./ReceptionLinkedContent.jsx'));

const LayerContent = memo(function LayerContent({ id, item, cell, background, rect, reception, reportOverflow }) {
  if (!item) return null;
  if (id.startsWith('shape:')) return <ShapeSurface record={item} hideGrain={Boolean(background && cell.grainOverContent !== false)} continuousFill={Boolean(background && reception.bento?.gap > 0)} radius={background ? cell.radius : undefined}
    hideOutline={Boolean(background && visibleReceptionInnerLines(reception.innerLines))} />;
  if (id.startsWith('image:')) {
    const anchor = receptionMemberAnchor(cell, [id]);
    return <ReceptionImage record={item} alignment={anchor?.members.length === 1 ? anchor : undefined} />;
  }
  const article = cell ? receptionFluidText(item.article, rect.width, receptionModuleWindow(reception, id).width) : item.article;
  const appearance = textAppearance(article);
  const transform = item.article.appearance?.transform;
  const excerpt = cell && !transform?.quarterTurns && !transform?.mirrorX && !transform?.mirrorY;
  return <>
    {appearance.edges?.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
    {appearance.frame && <span aria-hidden="true" className="module-surface-outline" style={{ boxShadow: `inset 0 0 0 1px ${appearance.color}` }} />}
    {excerpt ? <ReceptionTextPreview article={article} id={id} singleLine={cell.singleLine} onOverflow={reportOverflow}
      clipBounds={cell.clipContent === false ? undefined : { left: cell.window.left - rect.left, top: cell.window.top - rect.top,
        right: cell.window.left + cell.window.width - rect.left, bottom: cell.window.top + cell.window.height - rect.top }} />
    : <div className="text-module-body" style={textOutputStyle(article, rect)}>
      <div className="text-scene-viewport"><TextContentPage article={article} defaultOverflow="clip" /></div>
    </div>}
  </>;
});

// Read-only paint over the same native module records edited by the Editor.
// Layout is derived at the viewport width; no second saved composition exists.
export default function ReceptionDocumentCanvas({ reception, width, model, address, onOpenSource, selected, onSelect, onLayout }) {
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
  const { positions, range, events: swipeEvents } = useCellSwipe(reception, canvas);
  const [reading, setReading] = useState(null);
  const [readouts, setReadouts] = useState({ owner: null, items: {} });
  // Render measurements belong to this document and are refreshed on size/font
  // changes. They affect this preview only, never authored rectangles or text.
  const reportOverflow = useCallback((id, measurement) => setReadouts(previous => {
    const items = previous.owner === reception ? previous.items : {}, old = items[id];
    if (old?.overflow === measurement.overflow) return previous;
    return { owner: reception, items: { ...items, [id]: measurement } };
  }), [reception]);
  const textReadouts = readouts.owner === reception ? readouts.items : {};
  const projected = useMemo(() => viewportWidth > 0 ? receptionResponsiveLayout(reception, viewportWidth) : null, [reception, viewportWidth]);
  useLayoutEffect(measureOrigin, [projected, measureOrigin]);
  const layout = useMemo(() => receptionPaintLayout(projected, globalThis.devicePixelRatio || 1, origin), [projected, origin]);
  useLayoutEffect(() => { if (projected) onLayout?.(projected); }, [projected, onLayout]);
  const innerLines = visibleReceptionInnerLines(reception.innerLines);
  const order = useMemo(() => layerIds(reception.artworkLayers), [reception.artworkLayers]);
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
  const records = useMemo(() => new Map([...reception.imageModules, ...reception.texts, ...reception.shapes]
    .map(item => [item.id, item])), [reception]);
  const record = id => records.get(id);
  const selectProps = (cellId, id) => !onSelect ? {} : {
    tabIndex: 0, role: 'group', 'aria-label': record(id)?.name || record(id)?.article?.title || 'Layer',
    onClick: event => {
      if (event.target.closest('a,button,input,textarea')) return;
      event.stopPropagation(); onSelect(cellId, id);
    },
    onKeyDown: event => {
      if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); onSelect(cellId, id);
      }
    },
  };
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
    return <div key={id} className={`reception-document-layer${text ? ' text-window' : ''}`} data-layer-id={id} data-cell-member={cell?.id} inert={inactive ? '' : undefined}
      data-selected={selected === id || undefined} {...selectProps(cell?.id, id)} data-text={text || undefined}
      style={{ ...(article ? textWindowStyle(article) : {}), ...local, zIndex: layerOrder.get(id),
        ...(slide != null && { '--layer-slide': slide }),
        '--workbench-content-width': `${rect.width}px`, '--workbench-paint-width': `${rect.width}px`, '--workbench-paint-height': `${rect.height}px`, '--workbench-content-scale': 1,
        clipPath: parent && !inside && (slide != null || cell.clipContent !== false) ? editorCellClip(parent, rect, corner) : undefined }}><LayerContent id={id} item={record(id)} cell={cell} rect={rect} reception={reception} reportOverflow={reportOverflow} /></div>;
  };
  return <div className="reception-document-viewport" ref={host} style={width ? { width } : undefined}>
    <section ref={canvas} className="reception-document-canvas" aria-label="Reception layout" data-mobile={layout?.mobile || undefined}
      data-show-frame={reception.showFrame !== false || undefined}
      style={{ width: layout?.width, height: layout?.height || 1, borderRadius: (reception.frameRadius || 0) * (layout?.scale || 1), '--reception-frame-fill': reception.surface || undefined, '--reception-frame-fill-opacity': `${(reception.surfaceOpacity ?? 1) * 100}%`, '--reception-frame-line': reception.frameColor || undefined, '--reception-frame-line-opacity': `${(reception.frameOpacity ?? 1) * 100}%` }}>
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
        const link = reception.links?.find(item => item.id === cell.content);
        return <div key={cell.id} className="reception-cell-group" data-cell-group={cell.id} data-swipe-key={cell.slides ? slideKey(cell) : undefined} data-swiping={moving || undefined} data-vertical-swipe={cell.slides && slideY !== 0 || undefined}
            style={moving ? { ...frame, '--slide-x': slideX * frame.width + 'px', '--slide-y': slideY * frame.height + 'px', '--slide-count': slideCount(cell), borderRadius: cell.radius || 0 } : frame}
            {...(cell.slides && { ...swipeEvents(cell), tabIndex: 0, role: 'group', 'aria-label': record(cell.id)?.name || 'Cell', 'data-slide': active + 1 })}>
            <section className="reception-document-cell" data-cell-id={cell.id} data-selected={selected === cell.id || undefined} {...selectProps(cell.id, cell.id)}
              style={{ left: 0, top: 0, width: '100%', height: '100%', zIndex: layerOrder.get(cell.id) ?? -1, borderRadius: cell.radius || 0 }}>
              <div className="reception-document-cell-surface" style={surfaceStyle}><LayerContent id={cell.id} item={record(cell.id)} cell={cell} background reception={reception} /></div>
              {visible(0) && cell.content && <div inert={active !== 0 ? '' : undefined} className="reception-document-cell-content" style={{ padding: cell.contentLayout?.padding ?? 24,
                alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[cell.contentLayout?.alignY || 'top'],
                justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[cell.contentLayout?.alignX || 'left'] }}>{link
                ? <Suspense fallback={<p role="status">Opening linked content.</p>}><ReceptionLinkedContent link={link} onOpen={onOpenSource} /></Suspense>
                : <ReceptionProfileContent kind={cell.content} model={model} address={address} />}</div>}
            </section>
            {ids.map(id => renderLayer(id, cell, moving ? slides.get(id) : null, slides.get(id) !== active))}
            {cell.slides && <>
              <span aria-hidden="true" className="reception-swipe-glow" data-advance={cell.swipeDirection || 'left'}
                style={{ zIndex: order.length + 3, borderRadius: cell.radius || 0 }} />
              <span className="reception-slide-status" aria-live="polite">Slide {active + 1} of {slideCount(cell)}</span>
            </>}
            <ReceptionCellGrain cell={cell} grain={record(cell.id)?.grain} scale={layout.scale}
              style={{ zIndex: order.length + 2 }} />
            {!moving && overflowing && !cell.singleLine && <button type="button" className="reception-read-text" aria-label="Read full text" title="Read full text"
              style={{ zIndex: order.length + 3, color: textAppearance(record(overflowing).article).color }}
              onClick={event => { event.stopPropagation(); setReading({ owner: reception, cell, ids, source: event.currentTarget }); }}>
              <span className="reception-read-dots" aria-hidden="true"><span /><span /><span /></span>
            </button>}
          </div>;
      })}
      {layout && freeLayers.map(id => renderLayer(id))}
      {layout && <ReceptionInnerLines frames={layout.cells.map(cell => cell.window)} gap={layout.gap}
        appearance={innerLines && { ...innerLines, width: innerLines.width * layout.scale }}
        bounds={{ left: 0, top: 0, width: layout.width, height: layout.height }} style={{ zIndex: order.length }} />}
      {reading?.owner === reception && <ReceptionTextReader articles={order.filter(id => reading.ids.includes(id) && id.startsWith('text:')).map(id => record(id).article)} trigger={reading.source}
        cell={reading.cell} surface={record(reading.cell.id)} onClose={() => setReading(null)} />}
    </section>
  </div>;
}
