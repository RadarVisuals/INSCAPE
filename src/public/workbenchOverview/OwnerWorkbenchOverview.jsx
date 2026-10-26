import { useMemo, useState, useSyncExternalStore } from 'react';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
import { workbenchSaveError } from '../ownerSystemWorkflow/namedWorkbenchActions.js';
import { overviewAssetIds, workbenchOverviewModel } from './workbenchOverviewModel.js';
import WorkbenchOverview from './WorkbenchOverview.jsx';
import { useProfileIdentity } from '../../profileIdentity/index.js';

export default function OwnerWorkbenchOverview({ store, preferences, reviewAssets, reviewProfile, view, onViewChange, onOpen, onOpenReception }) {
  const generation = useSyncExternalStore(store.subscribe, store.getGeneration);
  const { galleryCardSize } = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
  const preferenceError = useSyncExternalStore(preferences.subscribe, preferences.getError);
  const [selectedId, setSelectedId] = useState(store.getWorkbenchId);
  const previewId = view.layout === 'grid' ? null : selectedId;
  // The external store keeps its identity; its generation invalidates this snapshot.
  const { entries } = useMemo(() => ({ generation,
    entries: previewId ? [store.readWorkbench(previewId)] : store.listWorkbenches().map(item => store.readWorkbench(item.id)),
  }), [store, generation, previewId]);
  const selected = entries.find(item => item.id === selectedId);
  const fixtureProfile = import.meta.env.DEV ? reviewProfile : null;
  const identity = useProfileIdentity(selected.draft.profileAddress, { sourceMode: fixtureProfile ? 'FIXTURE' : 'LIVE' });
  const referencedIds = useMemo(() => [...new Set(entries.flatMap(item => overviewAssetIds(item.draft)))], [entries]);
  const browser = useOwnerLatticeBrowser(selected.draft.profileAddress, false, referencedIds);
  const assets = useMemo(() => new Map([...(browser.data.assets || []), ...(browser.records || []), ...(import.meta.env.DEV ? reviewAssets || [] : [])]
    .map(asset => [asset.stableAssetId || asset.id, asset])), [browser.data.assets, browser.records, reviewAssets]);
  const previews = useMemo(() => entries.map(item => ({ ...item, model: workbenchOverviewModel(item.draft, assets) })), [entries, assets]);
  const model = previews.find(item => item.id === selectedId).model;
  const edit = id => { if (!store.switchWorkbench(id)) throw workbenchSaveError(store); onOpen(); };
  return <WorkbenchOverview items={store.listWorkbenches()} selected={selected} model={model} previews={previews} view={view} onViewChange={onViewChange} onSelect={setSelectedId}
    cardSize={galleryCardSize} onCardSize={value => preferences.update(current => ({ ...current, galleryCardSize: value }))}
    preferenceError={preferenceError} onRetryPreferences={preferences.retry}
    onReorder={ids => { if (!store.reorderWorkbenches(ids)) throw workbenchSaveError(store); }}
    profile={fixtureProfile || identity} onEdit={edit} onOpenReception={onOpenReception}
    onCreate={name => { const id = store.createWorkbench(name); if (!id) throw workbenchSaveError(store); setSelectedId(id); }}
    onSave={details => { if (!store.updateWorkbenchDetails(selectedId, details)) throw workbenchSaveError(store); }} />;
}
