import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import MirrorSurface from './MirrorSurface.jsx';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { createProfileDocumentV9FocusViewModel } from '../profileDocument/components/profileDocumentV9FocusViewModel.js';
import { OwnerSystemWorkflowMetadataContent } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';
import { updateMirrorModule } from '../systemWorkflow/mirrorModuleSession.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './mirror.css';

function MirrorInstance({ record, store, profileAddress, registerTarget, suspended, index }) {
  const surface = useRef(null), live = useRef(true), latest = useRef(record);
  latest.current = record;
  const [presentation, setPresentation] = useState(record.presentation);
  const [error, setError] = useState(null);
  const save = useCallback(change => {
    if (!store || !live.current) return false;
    const result = updateMirrorModule(store, profileAddress, record.id, change);
    if (!result) setError('Changes could not be saved. Reload the profile before continuing.');
    else setError(null);
    return result;
  }, [store, profileAddress, record.id]);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const changeLayout = useCallback(window => {
    setPresentation(current => {
      if (JSON.stringify(window) === JSON.stringify(current.window)) return current;
      return { ...current, window };
    });
  }, []);
  // Store geometry only after it settles; render frames never write a draft.
  useEffect(() => {
    if (!store || JSON.stringify(presentation) === JSON.stringify(latest.current.presentation)) return undefined;
    const timer = setTimeout(() => save({ presentation }), 150);
    return () => clearTimeout(timer);
  }, [presentation, save, store]);
  useEffect(() => {
    if (!registerTarget || !presentation.open) return undefined;
    const target = {
      get node() { return surface.current?.node; }, label: 'Release to animate this artwork',
      async placeAsset(asset) {
        if (!live.current || !store || !surface.current) return false;
        try {
          const id = asset.stableAssetId || asset.id;
          const sourceRecord = asset.assetRecord || asset;
          const resolved = createProfileDocumentV9AssetResolver([{ ...sourceRecord, id }], { compactContentReference: false })(id, asset.selectedMedia);
          if (resolved.media.type !== 'image') throw new Error('Choose an image for the Mirror module.');
          return await surface.current.acceptAsset(resolved, resolvePublishedAssetUrl(resolved.media.url));
        } catch (e) { if (live.current) setError(e.message); return false; }
      },
    };
    registerTarget(record.id, target);
    return () => registerTarget(record.id, null);
  }, [registerTarget, record.id, presentation.open, store]);
  function open(value) {
    const next = { ...presentation, open: value };
    if (!store || save({ presentation: next })) setPresentation(next);
  }
  const settingsChange = useCallback(settings => save({ settings }), [save]);
  const assetAccepted = useCallback(asset => save({ asset }), [save]);
  const dossier = useMemo(() => record.asset ? createProfileDocumentV9FocusViewModel({ asset: record.asset })?.dossier : null, [record.asset]);
  return <div className="mirror-workbench" data-workbench-module="mirror" data-mirror-id={record.id}>
    {!presentation.open && <button className="mirror-workbench__reopen" style={{ left: 24 + index * 124 }} onClick={() => open(true)}>{record.name}</button>}
    {presentation.open && <WorkbenchWindow label="Mirror" title={record.name} width={presentation.window.width}
      initialX={presentation.window.left} initialY={presentation.window.top} initialHeight={presentation.window.height}
      onLayoutChange={changeLayout} controls={<button type="button" className="system-workflow__round-control" aria-label={`Close ${record.name}`} onClick={() => open(false)}><X /></button>}>
      <MirrorSurface ref={surface} settings={record.settings} source={record.asset ? resolvePublishedAssetUrl(record.asset.media.url) : null}
        suspended={suspended} onSettingsChange={store ? settingsChange : undefined} onAssetAccepted={assetAccepted} />
      {store && <label className="mirror-workbench__publication"><input type="checkbox" checked={record.visibility === 'PUBLIC'}
        onChange={e => save({ visibility: e.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>}
      {dossier && <details><summary>Artwork metadata</summary><OwnerSystemWorkflowMetadataContent dossier={dossier} /></details>}
      {error && <p role="alert">{error}</p>}
    </WorkbenchWindow>}
  </div>;
}
export default function MirrorWorkbench({ records, store, profileAddress, registerTarget, suspended }) {
  return records.map((record, index) => <MirrorInstance key={`${profileAddress}:${record.id}`} {...{ record, index, store, profileAddress, registerTarget, suspended }} />);
}
