import { Children, cloneElement, lazy, Suspense, useMemo, useState } from 'react';
import { SceneNavigationScope, useSceneNavigation } from '../text/SceneNavigation.jsx';
import { useTextScene, SceneTextViewport, TextContentPage } from '../text/SceneTextContent.jsx';
import { resolvePresentationSource, resolveSceneBinding } from '../presentation/presentationSources.js';
import { publicDisplayModules } from '../profileDocument/components/profileOverviewModel.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { SharedDisplayToolsProvider } from '../public/ownerSystemWorkflow/SharedDisplayTools.jsx';
import { ReceptionImage } from './ReceptionCanvas.jsx';
import ArticleView from '../text/ArticleView.jsx';
import { useReceptionPresentation } from './ReceptionPresentation.jsx';
import { displayContent } from '../systemWorkflow/domain/displayModules.js';
import '../text/text.css';
const PublishedDisplayModule = lazy(() => import('../profileDocument/components/PublishedDisplayModule.jsx'));

function DisplayFrame({ children, navigation, playing, onTogglePlayback, playbackAvailable, renderInspection, renderCues, moduleAppearance }) {
  const [scene, setScene] = useState(null), [controls, setControls] = useState(null);
  return <article className="reception-display" style={{ background: moduleAppearance?.backgroundColor || undefined }}>
    <div className="reception-display-scene" ref={setScene}>{children}</div>
    {scene && renderCues?.(scene)}
    <div className="reception-display-controls" ref={setControls}>{navigation && cloneElement(navigation, {}, Children.map(navigation.props.children, child =>
      child?.type === 'button' ? cloneElement(child, { className: 'workflow-tactile-control' }) : child))}
      {playbackAvailable && <button className="workflow-tactile-control" type="button" onClick={onTogglePlayback}>{playing ? 'Pause Grids' : 'Play Grids'}</button>}
    </div>
    {scene && controls && renderInspection?.(scene, controls, scene)}
  </article>;
}
function LinkedText({ result }) {
  const state = useTextScene(result.record);
  return <SceneTextViewport record={result.record} state={state}><TextContentPage article={state.article} paginated={state.paginated} resetKey={state.gridId} /></SceneTextViewport>;
}
function Display({ result, reference }) {
  const { snapshot, assets, assetStatus } = useReceptionPresentation();
  const projected = useMemo(() => {
    try {
      const draft = result.entry.draft;
      const resolve = createProfileDocumentV9AssetResolver(assets);
      // This is a renderer input, never a publication or a saved copy. Private
      // owner scenes remain visible locally; public snapshots contain only public data.
      const grids = values => values.filter(grid => grid.id !== 'grid:world-cover').map(grid => ({ ...grid,
        placements: grid.placements.map(item => item.kind === 'text' || item.asset ? item : { ...item, asset: resolve(item.stableAssetId, item.selectedMedia) }) }));
      if (snapshot.kind === 'published') return publicDisplayModules(draft).find(item => item.id === reference.moduleId)?.document;
      const content = displayContent(draft, reference.moduleId);
      const display = reference.moduleId === 'display:primary' ? draft.workbench?.display : draft.workbench?.displays?.find(item => item.id === reference.moduleId);
      return { ...content, profile: { address: snapshot.profileAddress }, documentId: snapshot.revision, revision: 1,
        appearance: { ...content.appearance, menuSurfaceId: draft.appearance.menuSurfaceId }, grids: grids(content.grids), workbench: { display } };
    } catch { return null; }
  }, [result.entry.draft, reference.moduleId, assets, snapshot]);
  return projected ? <Suspense fallback={<p role="status">Opening Display…</p>}><SharedDisplayToolsProvider>
    <PublishedDisplayModule document={projected} instanceId={reference.moduleId} Frame={DisplayFrame}
      entryTarget={reference.gridId ? { moduleId: reference.moduleId, gridId: reference.gridId } : undefined} />
  </SharedDisplayToolsProvider></Suspense> : <p role="status">{assetStatus === 'loading' ? 'Loading Display artwork…' : 'Display artwork is unavailable. Reload its source in Workbench.'}</p>;
}
function LinkedSource({ link, onOpen }) {
  const { snapshot } = useReceptionPresentation(), scenes = useSceneNavigation();
  const reference = link.kind === 'scene' ? link.controller : link.source;
  const session = { scope: { profileAddress: snapshot.profileAddress, canvasId: reference.canvasId, revision: snapshot.revision }, scenes };
  const result = link.kind === 'scene' ? resolveSceneBinding(snapshot, link, session) : resolvePresentationSource(snapshot, reference, session);
  if (result.status !== 'ready') return <p role="status">Linked content is unavailable.</p>;
  return <div className="reception-linked-content" data-linked-kind={result.kind} data-linked-side={result.side?.id}>
    {result.kind === 'display' ? <Display result={result} reference={reference} />
      : result.kind === 'image' ? <ReceptionImage record={{ ...result.record, sides: [result.side] }} />
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
