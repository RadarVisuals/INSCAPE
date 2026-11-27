import { resolvePresentationSource } from '../presentation/presentationSources.js';
import { CompositionImage } from './CompositionImage.jsx';
import ArticleView from '../text/ArticleView.jsx';
import { useCompositionPresentation } from './CompositionPresentation.jsx';
import '../text/text.css';
export default function CompositionLinkedContent({ link, onOpen }) {
  const presentation = useCompositionPresentation();
  const result = resolvePresentationSource(presentation?.snapshot, link.source);
  if (result.status !== 'ready') return <p role="status">Linked content is unavailable.</p>;
  return <div className="composition-linked-content" data-linked-kind={result.kind}>
    {result.kind === 'image' ? <CompositionImage record={result.record} />
        : <ArticleView article={result.article} containerOwned />}
    {link.destination && onOpen && <button type="button" className="composition-open-source workflow-tactile-control" onClick={event => onOpen(link.destination, event.currentTarget)}>Open canvas</button>}
  </div>;
}
