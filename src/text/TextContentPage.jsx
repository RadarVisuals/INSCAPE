import ArticleView from './ArticleView.jsx';
import TextViewport from './TextViewport.jsx';
import PagedArticle from './PagedArticle.jsx';

// Keep the editor slot mounted while Read/Write changes visibility. A shared
// reading projection must not throw away the author's editor/undo session.
export function TextContentPage({ article, paginated, resetKey = null, mode = 'read', flow, defaultOverflow = 'scroll', excerpt, children }) {
  return <div className="text-content-viewport">
    <div className="text-authoring-viewport" hidden={mode === 'read' && paginated}>
      <TextViewport article={article} flow={flow} resetKey={resetKey} defaultOverflow={defaultOverflow} excerpt={excerpt}
        automaticPadding={!article.appearance?.padding && !article.appearance?.compact} mode={mode}>
        {children}
        {mode === 'read' && !paginated && !flow && <ArticleView article={article} />}
      </TextViewport>
    </div>
    {mode === 'read' && paginated && <PagedArticle key={resetKey || 'article'} article={article} />}
  </div>;
}
