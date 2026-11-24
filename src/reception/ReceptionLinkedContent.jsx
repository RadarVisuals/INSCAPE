import { resolvePresentationSource } from '../presentation/presentationSources.js';
import { ReceptionImage } from './ReceptionCanvas.jsx';
import ArticleView from '../text/ArticleView.jsx';
import { useReceptionPresentation } from './ReceptionPresentation.jsx';
import '../text/text.css';
export default function ReceptionLinkedContent({ link, onOpen }) {
  const presentation = useReceptionPresentation();
  const result = resolvePresentationSource(presentation?.snapshot, link.source);
  if (result.status !== 'ready') return <p role="status">Linked content is unavailable.</p>;
  return <div className="reception-linked-content" data-linked-kind={result.kind}>
    {result.kind === 'image' ? <ReceptionImage record={result.record} />
        : <ArticleView article={result.article} containerOwned />}
    {link.destination && onOpen && <button type="button" className="reception-open-source workflow-tactile-control" onClick={event => onOpen(link.destination, event.currentTarget)}>Open canvas</button>}
  </div>;
}
