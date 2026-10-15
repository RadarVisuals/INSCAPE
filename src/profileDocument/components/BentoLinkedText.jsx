import { useLayoutEffect, useRef, useState } from 'react';
import { SceneTextViewport, TextContentPage, useTextScene } from '../../text/SceneTextContent.jsx';
import { textSurfaceStyle, textOutputStyle } from '../../text/domain/article.js';
import '../../text/text.css';

export default function BentoLinkedText({ record }) {
  const state = useTextScene(record), node = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(node.current); return () => observer.disconnect();
  }, []);
  return <section ref={node} className="bento-linked-text" data-text-id={record.id} aria-label={record.article.title || 'Linked Text'}
    style={{ ...textSurfaceStyle(state.article), '--workbench-paint-width': size.width + 'px', '--workbench-paint-height': size.height + 'px' }}>
    <div className="text-module-body" style={textOutputStyle(state.article, size)}>
      {state.unavailable && <p className="text-status" role="status">The linked Display is unavailable in this publication.</p>}
      <SceneTextViewport record={record} state={state}>
        <TextContentPage article={state.article} paginated={state.paginated} resetKey={state.sectionRead || state.paginated ? state.gridId : null} />
      </SceneTextViewport>
    </div>
  </section>;
}
