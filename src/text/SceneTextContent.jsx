import { useRef } from 'react';
import { useSceneNavigation, useSceneProgress } from './SceneNavigation.jsx';
import { passageArticle } from './scenePassages.js';
import ArticleView from './ArticleView.jsx';
import TextViewport from './TextViewport.jsx';
import PagedArticle from './PagedArticle.jsx';

export function useTextScene(record, mode = 'read') {
  const scenes = useSceneNavigation();
  const scene = record.sceneLink ? scenes[record.sceneLink.displayId] : null;
  const sectionLink = record.sceneLink?.mode === 'sections', sectionRead = sectionLink && mode === 'read';
  const gridId = scene?.gridId || record.sceneLink?.gridId;
  return { scene, sectionLink, sectionRead, gridId,
    paginated: !sectionLink && record.pagination === 'pages',
    article: sectionLink && mode === 'write' ? record.article : passageArticle(record, gridId, scene?.gridOrder),
    unavailable: Boolean(record.sceneLink && !scene),
    swiping: Boolean(scene?.targetGridId) && (!sectionLink || sectionRead) };
}

// Keep the editor slot mounted while Read/Write changes visibility. A shared
// reading projection must not throw away the author's editor/undo session.
export function TextContentPage({ article, paginated, resetKey = null, mode = 'read', flow, showOverflow = false, children }) {
  return <>
    <div className="text-authoring-viewport" hidden={mode === 'read' && paginated}>
      <TextViewport article={article} flow={flow} showOverflow={showOverflow} resetKey={resetKey}
        automaticPadding={!article.appearance?.padding && !article.appearance?.compact} mode={mode}>
        {children}
        {mode === 'read' && !paginated && !flow && <ArticleView article={article} />}
      </TextViewport>
    </div>
    {mode === 'read' && paginated && <PagedArticle key={resetKey || 'article'} article={article} />}
  </>;
}

export function SceneTextViewport({ record, state, open = true, mode = 'read', children }) {
  const track = useRef(null);
  const { scene, sectionLink, sectionRead, unavailable, swiping } = state;
  useSceneProgress(sectionLink && mode === 'write' ? null : scene, track, open);
  return <div className="text-scene-viewport" style={unavailable && (!sectionLink || sectionRead) ? { visibility: 'hidden' } : undefined}
    data-settling={swiping && scene?.settling || undefined} data-text-grid-id={state.gridId}>
    <div className="text-scene-track" ref={track}>
      <div className="text-scene-page">{children}</div>
      {swiping && <div className="text-scene-page text-scene-incoming" aria-hidden="true" inert="" style={{ left: scene.direction === 'next' ? '100%' : '-100%' }}>
        <TextContentPage article={passageArticle(record, scene.targetGridId, scene.gridOrder)} paginated={state.paginated} resetKey={scene.targetGridId} />
      </div>}
    </div>
  </div>;
}
