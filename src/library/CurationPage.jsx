import { saveMissingSnapshots } from './curatedSnapshots.js';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ToolPanel from '../ui/ToolPanel.jsx';
import LibraryWorkspace from '../public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx';
import { WorkspaceBrand } from '../public/menus/WorkspaceHeader.jsx';
import useProfileLibrary from './useProfileLibrary.js';
import { ArrowLeft } from 'lucide-react';
import { useLibraryStore } from './state/useLibraryStore.js';
import { createOwnerLatticeCategoryCommands } from '../public/useOwnerLatticeBrowser.js';
import { parseCanonicalAssetId } from '../profileDocument/domain/assetReference.js';
import { changeCuratedAssets, curatedAssetIds, curatedImages, curatedDisplayAssets } from './curationStore.js';
import '../public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import './curation.css';

function LibraryPane({ role, boundsRef, active, onActivate, data, commands }) {
  const title = role === 'source' ? 'Universal Profile Library' : 'Inscape Library';
  const [frame, setFrame] = useState(() => {
    const stacked = innerWidth < 720;
    if (stacked) {
      const height = Math.floor((innerHeight - 90) / 2);
      return { width: innerWidth - 24, height, left: 12, top: role === 'source' ? 10 : height + 22 };
    }
    const gap = 20;
    const total = Math.min(innerWidth - 40, Math.max(780, Math.round(innerWidth * 0.62)));
    const sourceWidth = Math.round((total - gap) * 0.45);
    const height = Math.round((innerHeight - 44) * 0.68);
    const left = Math.round((innerWidth - total) / 2);
    return { width: role === 'source' ? sourceWidth : total - gap - sourceWidth, height,
      left: role === 'source' ? left : left + sourceWidth + gap, top: Math.round((innerHeight - 44 - height) / 2) };
  });
  return <ToolPanel title={title} label={title} frame={frame} onFrameChange={setFrame} boundsRef={boundsRef}
    minimumWidth={230} minimumHeight={160} active={active} onActivate={onActivate} chrome="flat"
    className="curation-library" data-curation-pane={role} data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor">
    {renderHeader => <>{renderHeader()}<LibraryWorkspace embedded previewRecords={null} resizable={false} phase="open" label={title + ' assets'}
      preferences={{ hideLabels: true, assetSize: 88, ...(role === 'destination' && { sort: 'curated' }) }} data={data} categoryCommands={commands} /></>}
  </ToolPanel>;
}

export default function CurationPage({ profileAddress, destinations, onBack }) {
  const bounds = useRef(null), trigger = useRef(null);
  const [active, setActive] = useState('source');
  useLayoutEffect(() => { useLibraryStore.getState().setProfileAddress(profileAddress); }, [profileAddress]);
  const workspace = useLibraryStore(state => state.workspace?.profileAddress === profileAddress.toLowerCase() ? state.workspace : null);
  const ids = useMemo(() => workspace ? curatedAssetIds(workspace) : [], [workspace]);
  const images = useMemo(() => new Map(ids.map(id => [id, curatedImages(workspace, id)])), [workspace, ids]);
  const persistenceError = useLibraryStore(state => state.profileAddress === profileAddress.toLowerCase() ? state.persistenceError : null);
  const missing = useMemo(() => ids.filter(id => !Object.hasOwn(workspace?.curatedSnapshots || {}, id) && parseCanonicalAssetId(id)), [ids, workspace]);
  const library = useProfileLibrary({ profileAddress, libraryOpen: true, referencedAssetIds: missing });
  const records = useMemo(() => new Map(library.canonicalRecords.map(record => [record.id, record])), [library.canonicalRecords]);
  useEffect(() => {
    const state = useLibraryStore.getState();
    if (!missing.length || state.workspace !== workspace || state.persistenceError) return;
    const next = saveMissingSnapshots(workspace, missing, records);
    if (next !== workspace) state.replaceWorkspace(next);
  }, [missing, records, workspace]);
  const commands = useMemo(() => {
    const base = createOwnerLatticeCategoryCommands(profileAddress);
    return { ...base,
      setCategoryAssets: (folder, items, value) => base.setCategoryAssets(folder, items, value, ids),
      setCategoryImage: (folder, id, url, value) => base.setCategoryImage(folder, id, url, value, ids),
    };
  }, [profileAddress, ids]);
  const change = (action, items, target, url, urls) => {
    const state = useLibraryStore.getState();
    if (!workspace || state.workspace.profileAddress !== workspace.profileAddress) return false;
    const next = changeCuratedAssets(state.workspace, action, items, target, url, urls);
    if (action !== 'add' || next === state.workspace) return state.replaceWorkspace(next);
    const captured = saveMissingSnapshots(next, items, records);
    if (!items.every(id => Object.hasOwn(captured.curatedSnapshots || {}, id))) return false;
    return state.replaceWorkspace(captured);
  };
  const source = { ...library.libraryData, categories: [], categoryOrganization: { rootCategoryIds: [], sections: [] },
    curationRole: 'source', curatedImages: images, onCurationAction: (items, folder, url) => change('add', items, folder, url) };
  const assets = useMemo(() => workspace ? curatedDisplayAssets(workspace, ids) : [], [workspace, ids]);
  const destination = { ownerContext: profileAddress, favorites: workspace?.favorites || [],
    assets, categories: workspace?.folders || [], categoryOrganization: workspace?.categoryOrganization,
    status: workspace ? 'ready' : 'loading', persistenceError,
    curationRole: 'destination', curatedCount: ids.length,
    curatedImages: images, onCurationAction: (items, folder, url, urls) => change('remove', items, null, url, urls), onReorder: (items, before) => change('reorder', items, before) };
  const links = Object.fromEntries(Object.entries(destinations).filter(([, action]) => action)
    .map(([name, action]) => [name, name === 'Curation' ? () => {} : action]));
  return <div className="curation-page system-workflow__token-scope">
    <header className="workspace-header"><WorkspaceBrand current="Curation" destinations={links} trigger={trigger} />
      <button className="curation-back" aria-label="Back" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={14} />Curation</button></header>
    <main ref={bounds} className="curation-panels">
      <LibraryPane role="source" boundsRef={bounds} data={source} active={active === 'source'} onActivate={() => setActive('source')} />
      <LibraryPane role="destination" boundsRef={bounds} data={destination} commands={commands} active={active === 'destination'} onActivate={() => setActive('destination')} />
    </main>
  </div>;
}
