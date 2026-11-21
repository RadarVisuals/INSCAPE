import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft } from 'lucide-react';
import { StudioHeaderTools, WorkspaceBrand } from '../menus/WorkspaceHeader.jsx';
import '../ownerSystemWorkflow/editorMenuBar.css';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
import { workbenchSaveError } from '../ownerSystemWorkflow/namedWorkbenchActions.js';
import { overviewAssetIds, workbenchOverviewModel } from './workbenchOverviewModel.js';
import WorkbenchOverview from './WorkbenchOverview.jsx';
import PublicWorkspaceHeader from '../../profileDocument/components/PublicWorkspaceHeader.jsx';
import CompositionSources from './CompositionSources.jsx';
import VisitorLightField from '../../profileDocument/components/VisitorLightField.jsx';
import '../../profileDocument/components/visitorProfile.css';

function StudioCollectionHeader({ ownerDestinations, onEdit, onPanel }) {
  const trigger = useRef(null);
  return <header className="workspace-header editor-menu-bar">
    <div className="editor-menu-start">
      <WorkspaceBrand current="Studio" destinations={ownerDestinations} trigger={trigger} onPanel={onPanel} />
      {ownerDestinations.Gallery && <button type="button" className="editor-return-link" aria-label="Back to Gallery" onClick={ownerDestinations.Gallery}>
        <ArrowLeft size={15} aria-hidden="true" />Gallery</button>}
      <span className="editor-workspace-context"><span className="editor-workspace-name">Works</span></span>
    </div>
    <div className="editor-header-actions"><StudioHeaderTools><button type="button" onClick={onEdit}>Edit</button></StudioHeaderTools></div>
  </header>;
}

export default function OwnerWorkbenchOverview({ store, preferences, reviewAssets, profileModel, account, view, onViewChange, onEdit, onOpenReception, onOpenGallery, onOpenWriting, onOpenDiscover, ownerDestinations, workspace }) {
  const generation = useSyncExternalStore(store.subscribe, store.getGeneration);
  const { galleryCardSize } = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
  const preferenceError = useSyncExternalStore(preferences.subscribe, preferences.getError);
  const [previewedId, setSelectedId] = useState(store.getWorkbenchId);
  const [navigationError, setNavigationError] = useState('');
  const items = store.listWorkbenches();
  const selectedId = items.some(item => item.id === previewedId) ? previewedId : store.getWorkbenchId();
  const selectedItem = store.readWorkbench(selectedId);
  const hasLinks = Boolean(selectedItem?.draft.composition?.links?.length);
  // Read the complete collection only when tiles or linked sources need it.
  const previewId = view.layout === 'grid' || hasLinks ? null : selectedId;
  const snapshot = useMemo(() => ({ kind: 'local', profileAddress: store.getProfileAddress(), generation,
    revision: String(generation), entries: previewId ? [store.readWorkbench(previewId)] : store.listWorkbenches().map(item => store.readWorkbench(item.id)),
  }), [store, generation, previewId]);
  const { entries } = snapshot;
  const selected = entries.find(item => item.id === selectedId);
  const referencedIds = useMemo(() => [...new Set(entries.flatMap(item => overviewAssetIds(item.draft)))], [entries]);
  const browser = useOwnerLatticeBrowser(selected.draft.profileAddress, false, referencedIds);
  const assets = useMemo(() => new Map([...(browser.data.assets || []), ...(browser.records || []), ...(import.meta.env.DEV ? reviewAssets || [] : [])]
    .map(asset => [asset.stableAssetId || asset.id, asset])), [browser.data.assets, browser.records, reviewAssets]);
  const previews = useMemo(() => entries.map(item => ({ ...item, model: workbenchOverviewModel(item.draft, assets) })), [entries, assets]);
  const model = previews.find(item => item.id === selectedId).model;
  const moving = workspace.entering || workspace.exiting;
  const openEditor = callback => () => {
    try { setNavigationError(''); callback(); }
    catch (failure) { setNavigationError(failure.message); }
  };
  return <div className="visitor-publication owner-works" data-section="compositions"
    data-workspace-entering={workspace.entering || undefined} data-workspace-exiting={workspace.exiting || undefined}
    inert={moving ? '' : undefined} aria-hidden={workspace.exiting || undefined}>
    <VisitorLightField paused={moving} />
    <PublicWorkspaceHeader component={StudioCollectionHeader} model={profileModel} account={account} current="Studio"
      onEdit={openEditor(() => onEdit(selectedId))} ownerDestinations={{ Profile: onOpenReception, Gallery: onOpenGallery,
        Writing: onOpenWriting, Discover: onOpenDiscover, ...ownerDestinations, Studio: openEditor(() => onEdit(selectedId)) }} />
    {navigationError && <p role="alert" className="visitor-notice">{navigationError}</p>}
    <CompositionSources snapshot={snapshot} assets={assets} profile={profileModel}><WorkbenchOverview collectionManager visitorHeader items={items} selected={selected} model={model} previews={previews} view={view} onViewChange={onViewChange} onSelect={setSelectedId}
      cardSize={galleryCardSize} onCardSize={value => preferences.update(current => ({ ...current, galleryCardSize: value }))}
      preferenceError={preferenceError} onRetryPreferences={preferences.retry}
      onDeleteDraft={id => { if (!store.deleteWorkbench(id, { fromManager: true })) throw workbenchSaveError(store); }}
      onRename={(id, name) => {
        const item = store.readWorkbench(id);
        if (!item || !store.updateWorkbenchDetails(id, { name, introduction: item.introduction || '' })) throw workbenchSaveError(store);
      }}
      onReorder={ids => { if (!store.reorderWorkbenches(ids)) throw workbenchSaveError(store); }}
      workspace={workspace}
      profile={{ name: profileModel?.officialProfile.name, avatarUrl: profileModel?.profile.avatarUrl }} onEdit={onEdit}
      onCreate={(name, layout) => {
        const id = store.createWorkbench(name, { layout });
        if (!id) throw workbenchSaveError(store);
        onEdit(id);
      }}
      onSave={details => { if (!store.updateWorkbenchDetails(selectedId, details)) throw workbenchSaveError(store); }} /></CompositionSources>
  </div>;
}
