import { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import ArticleView from '../text/ArticleView.jsx';
import { textAppearance, textWindowStyle } from '../text/domain/article.js';
import ShapeSurface from '../shapes/ShapeSurface.jsx';
import CompositionCellGrain from './CompositionCellGrain.jsx';
import { useWorkbenchInspectionLock } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';

// A temporary reading projection of the selected article. The introduction,
// including its live artwork and scroll position, stays mounted underneath.
export default function CompositionTextReader({ articles, cell, surface, trigger, onClose }) {
  useWorkbenchInspectionLock();
  const dialog = useRef(null), scroll = useRef(null);
  const readable = articles.map(article => ({ ...article, appearance: { ...article.appearance, scale: 1, columns: 1,
    writingDirection: 'horizontal', transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } } }));
  useLayoutEffect(() => {
    const node = dialog.current;
    node.showModal(); scroll.current.focus({ preventScroll: true });
    return () => { node.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, [trigger]);
  return <dialog ref={dialog} className="composition-text-reader" aria-label="Full text" aria-modal="true"
    style={{ color: textAppearance(readable[0]).color, borderRadius: cell.radius || 0 }}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => event.stopPropagation()}
    onClick={event => { if (event.target === event.currentTarget) {
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose();
    } }}>
    {surface && <div className="composition-reader-surface" aria-hidden="true"><ShapeSurface record={surface} radius={cell.radius} hideGrain hideOutline /></div>}
    <div ref={scroll} className="composition-reader-scroll" tabIndex={0} role="region" aria-label="Article text">
      {readable.map((article, index) => <div key={index} style={textWindowStyle(article)}><ArticleView article={article} containerOwned /></div>)}
    </div>
    <CompositionCellGrain cell={cell} grain={surface?.grain} scale={1} />
    <button type="button" className="composition-reader-close" aria-label="Close reading view" onClick={onClose}><X size={20} /></button>
  </dialog>;
}
