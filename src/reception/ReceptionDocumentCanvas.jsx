import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { layerIds } from '../systemWorkflow/domain/artworkLayers.js';
import { TextContentPage } from '../text/SceneTextContent.jsx';
import { textAppearance, textOutputStyle, textWindowStyle } from '../text/domain/article.js';
import ShapeSurface from '../shapes/ShapeSurface.jsx';
import { ReceptionImage, ReceptionProfileContent } from './ReceptionCanvas.jsx';
import { receptionResponsiveLayout } from './receptionEditorDocument.js';
import { editorCellClip } from './editorCellGeometry.js';
import './receptionDocument.css';

const ReceptionLinkedContent = lazy(() => import('./ReceptionLinkedContent.jsx'));

// Read-only paint over the same native module records edited by the Editor.
// Layout is derived at the viewport width; no second saved composition exists.
export default function ReceptionDocumentCanvas({ reception, width, model, address, onOpenSource, selected, onSelect, onLayout }) {
  const host = useRef(null), [measured, setMeasured] = useState(0);
  useLayoutEffect(() => {
    const node = host.current;
    const measure = () => setMeasured(node.clientWidth);
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const viewportWidth = width || measured;
  const layout = useMemo(() => viewportWidth > 0 ? receptionResponsiveLayout(reception, viewportWidth) : null, [reception, viewportWidth]);
  useLayoutEffect(() => { if (layout) onLayout?.(layout); }, [layout, onLayout]);
  const order = layerIds(reception.artworkLayers);
  const owners = new Map(reception.cells.flatMap(cell => cell.members.map(id => [id, cell])));
  const record = id => reception.imageModules.find(item => item.id === id)
    || reception.texts.find(item => item.id === id) || reception.shapes.find(item => item.id === id);
  const paint = id => {
    const item = record(id);
    if (!item) return null;
    if (id.startsWith('shape:')) return <ShapeSurface record={item} />;
    if (id.startsWith('image:')) return <ReceptionImage record={item} />;
    const article = item.article, appearance = textAppearance(article), rect = layout.windows[id];
    return <>
      {appearance.edges?.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
      {appearance.frame && <span aria-hidden="true" className="module-surface-outline" style={{ boxShadow: `inset 0 0 0 1px ${appearance.color}` }} />}
      <div className="text-module-body" style={textOutputStyle(article, rect)}>
        <div className="text-scene-viewport"><TextContentPage article={article} /></div>
      </div>
    </>;
  };
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
  return <div className="reception-document-viewport" ref={host} style={width ? { width } : undefined}>
    <section className="reception-document-canvas" aria-label="Reception layout" data-mobile={layout?.mobile || undefined}
      style={{ width: layout?.width, height: layout?.height || 1 }}>
    {layout && order.map((id, zIndex) => {
      const rect = layout.windows[id];
      if (!rect) return null;
      const cell = layout.cells.find(item => item.id === id);
      if (!cell) {
        const owner = owners.get(id), parent = owner && layout.windows[owner.id];
        const text = id.startsWith('text:'), article = text && record(id)?.article;
        // Membership clips a native layer without changing its global paint order.
        return <div key={id} className={`reception-document-layer${text ? ' text-window' : ''}`} data-layer-id={id} data-cell-member={owner?.id}
          data-selected={selected === id || undefined} data-text={text || undefined}
          style={{ ...rect, ...(article ? { ...textWindowStyle(article), '--workbench-content-width': `${rect.width}px`,
            '--workbench-paint-width': `${rect.width}px`, '--workbench-paint-height': `${rect.height}px`, '--workbench-content-scale': 1 } : {}),
          zIndex, clipPath: parent ? editorCellClip(parent, rect, owner.radius || 0) : undefined }}
          {...(owner ? selectProps(owner.id, id) : {})}>{paint(id)}</div>;
      }
      const link = reception.links?.find(item => item.id === cell.content);
      return <section key={id} className="reception-document-cell" data-cell-id={id} data-selected={selected === id || undefined}
        style={{ ...rect, zIndex, borderRadius: cell.radius || 0 }} {...selectProps(id, id)}>
        <div className="reception-document-cell-surface">{paint(id)}</div>
        {cell.content && <div className="reception-document-cell-content" style={{ padding: cell.contentLayout?.padding ?? 24,
          alignItems: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[cell.contentLayout?.alignY || 'top'],
          justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[cell.contentLayout?.alignX || 'left'] }}>{link
          ? <Suspense fallback={<p role="status">Opening linked content…</p>}><ReceptionLinkedContent link={link} onOpen={onOpenSource} /></Suspense>
          : <ReceptionProfileContent kind={cell.content} model={model} address={address} />}</div>}
      </section>;
    })}
    </section>
  </div>;
}
