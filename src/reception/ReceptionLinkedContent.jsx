import { SceneNavigationScope, useSceneNavigation } from '../text/SceneNavigation.jsx';
import { useTextScene, SceneTextViewport, TextContentPage } from '../text/SceneTextContent.jsx';
import { resolvePresentationSource, resolveSceneBinding } from '../presentation/presentationSources.js';
import { ReceptionImage } from './ReceptionCanvas.jsx';
import ArticleView from '../text/ArticleView.jsx';
import { useReceptionPresentation } from './ReceptionPresentation.jsx';
import '../text/text.css';
function LinkedText({ result }) {
  const state = useTextScene(result.record);
  return <SceneTextViewport record={result.record} state={state}><TextContentPage article={state.article} paginated={state.paginated} resetKey={state.gridId} /></SceneTextViewport>;
}
function LinkedSource({ link, onOpen }) {
  const { snapshot } = useReceptionPresentation(), scenes = useSceneNavigation();
  const reference = link.kind === 'scene' ? link.controller : link.source;
  const session = { scope: { profileAddress: snapshot.profileAddress, canvasId: reference.canvasId, revision: snapshot.revision }, scenes };
  const result = link.kind === 'scene' ? resolveSceneBinding(snapshot, link, session) : resolvePresentationSource(snapshot, reference, session);
  if (result.status !== 'ready' || result.kind === 'display') return <p role="status">Linked content is unavailable.</p>;
  return <div className="reception-linked-content" data-linked-kind={result.kind}>
    {result.kind === 'image' ? <ReceptionImage record={result.record} />
        : link.kind === 'source' && result.record.sceneLink && !reference.gridId ? <LinkedText result={result} /> : <ArticleView article={result.article} containerOwned />}
    {link.destination && onOpen && <button type="button" className="reception-open-source workflow-tactile-control" onClick={event => onOpen(link.destination, event.currentTarget)}>Open canvas</button>}
  </div>;
}
export default function ReceptionLinkedContent({ link, onOpen }) {
  const presentation = useReceptionPresentation();
  const canvasId = (link.kind === 'scene' ? link.controller : link.source).canvasId;
  if (!presentation?.snapshot.entries.some(entry => entry.id === canvasId)) return <p role="status">Linked canvas is unavailable.</p>;
  return <SceneNavigationScope canvasId={canvasId}><LinkedSource link={link} onOpen={onOpen} /></SceneNavigationScope>;
}
