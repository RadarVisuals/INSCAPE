import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createReception, projectReception, RECEPTION_PROFILE_CONTENT } from '../profileDocument/domain/receptionPresentation.js';
import { useProfileIdentity } from '../profileIdentity/state/useProfileIdentity.js';
import { createProductionIdentityDossierViewModel } from '../public/identity/productionIdentityDossierViewModel.js';
import useProfileLibrary from '../library/useProfileLibrary.js';
import ProfileLibraryPicker from '../library/ProfileLibraryPicker.jsx';
import CommittedColourControls from '../colour/CommittedColourControls.jsx';
import { OwnerSystemWorkflowMetadataContent } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';
import { createProfileDocumentV9AssetDossier } from '../profileDocument/components/profileDocumentV9FocusViewModel.js';
import useTextRecovery from '../text/useTextRecovery.js';
import { TEXT_RECOVERY_MESSAGE } from '../text/textEditRecovery.js';
import WorkbenchBackupControls from '../systemWorkflow/WorkbenchBackupControls.jsx';
import ReceptionCanvas from './ReceptionCanvas.jsx';
import ReceptionNavigation from './ReceptionNavigation.jsx';
import { splitReception, resizeReception, receptionDividers, receptionMinimum, moveReception, canMergeReception, mergeReception, receptionPixelRect } from './receptionLayout.js';
import { saveReception, addReceptionText, assignReceptionContent, prepareReceptionImage } from './receptionSession.js';
import useReceptionGesture from './useReceptionGesture.js';
import '../public/ownerSystemWorkflow/workflowTactile.css';
import '../public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../public/ownerSystemWorkflow/workflowFlat.css';
import '../public/ownerSystemWorkflow/workbenchToolChrome.css';
import '../lattice/rendering/latticeMenuSurface.css';
const ReceptionTextEditor = lazy(() => import('./ReceptionTextEditor.jsx'));
const ReceptionProfileEditor = lazy(() => import('./ReceptionProfileEditor.jsx'));

function NumberControl({ label, value, min, max, step = 1, onCommit }) {
  return <label>{label}<input key={`${label}:${value}`} aria-label={label} type="number" min={min} max={max} step={step} defaultValue={value}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.value = String(value); event.currentTarget.blur(); }
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
    }} onBlur={event => {
      const next = event.currentTarget.valueAsNumber;
      if (event.currentTarget.value && event.currentTarget.validity.valid && next !== value) onCommit(next);
      else event.currentTarget.value = String(value);
    }} /></label>;
}
export default function ReceptionEditor({ store, rootStore, onClose, onCanvases = onClose, onDiscover, onReturn, reviewAssets, reviewCategories, reviewProfile, publishedDocument, storage }) {
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot), generation = store.getGeneration();
  const [blank] = useState(createReception), value = draft.reception || blank;
  const [selected, setSelected] = useState(value.regions[0].id), [preview, setPreview] = useState(null), [theme, setTheme] = useState(value.branding.theme);
  const [mode, setMode] = useState('desktop'), [editing, setEditing] = useState(true), [error, setError] = useState('');
  const [frameWidth, setFrameWidth] = useState(1000);
  const minimum = receptionMinimum(frameWidth, value.height, value.gutter);
  const [libraryOpen, setLibraryOpen] = useState(false), [toolsHost, setToolsHost] = useState(null), [operation, setOperation] = useState(null), [moveTarget, setMoveTarget] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false), pendingImage = useRef(null), editorHost = useRef(null);
  const identity = useProfileIdentity(store.getProfileAddress()), recoveries = useTextRecovery(store, store.getProfileAddress());
  const referencedAssetIds = useMemo(() => [...new Set([draft.identityPresentation.avatar.stableAssetId,
    ...value.imageModules.flatMap(image => image.sides.map(side => side.asset.id))].filter(Boolean))], [draft.identityPresentation.avatar, value.imageModules]);
  const library = useProfileLibrary({ profileAddress: store.getProfileAddress(), libraryOpen, reviewAssets, reviewCategories, referencedAssetIds });
  const model = useMemo(() => createProductionIdentityDossierViewModel({ identity: reviewProfile || identity,
    identityPresentation: draft.identityPresentation, assetRecords: library.canonicalRecords, cachedIdentity: publishedDocument?.profile.cachedIdentity }),
  [identity, reviewProfile, draft.identityPresentation, library.canonicalRecords, publishedDocument]);
  const shown = !editing ? projectReception(value) : preview?.generation === generation ? preview.value : value, region = value.regions.find(r => r.id === selected) || value.regions[0];
  const image = value.imageModules.find(i => i.id === region.content), text = value.texts.find(i => i.id === region.content), history = store.getHistory();
  const gesture = useReceptionGesture(generation);
  const cancelLibrary = () => { pendingImage.current?.cancel(); pendingImage.current = null; setLibraryOpen(false); };
  useEffect(() => () => { pendingImage.current?.cancel(); }, []);
  useEffect(() => { setOperation(null); setPreview(null); }, [generation]);
  const run = action => { if (recoveries.length) { setError(TEXT_RECOVERY_MESSAGE); return; } try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const save = (next, label) => saveReception(store, draft.reception, next, label);
  const guard = () => { if (recoveries.length) { setError(TEXT_RECOVERY_MESSAGE); return false; } return true; };
  const select = id => { if (id !== region.id && !guard()) return; gesture.cancel(); cancelLibrary(); setSelected(id); setOperation(null); setPreview(null); };
  const leave = callback => { if (!guard()) return; gesture.cancel(); cancelLibrary(); callback(); };
  const changeRegion = patch => run(() => save({ ...value, regions: value.regions.map(r => r.id === region.id ? { ...r, ...patch } : r) }, 'Style Reception region'));
  const assign = content => run(() => save(assignReceptionContent(value, region.id, content), content ? 'Place Reception content' : 'Remove Reception placement'));
  const split = axis => run(() => {
    if (!guard()) return;
    const frame = editorHost.current?.querySelector('.reception-canvas');
    const rect = receptionPixelRect(region, frame?.clientWidth || 1000, value.height, value.gutter);
    if ((axis === 'x' ? rect.width : rect.height) < 192 + value.gutter) throw new Error('Each new region needs at least 96 px. Enlarge this region first.');
    const id = `region:${crypto.randomUUID()}`; save(splitReception(value, region.id, axis, id), 'Split Reception region'); setSelected(id);
  });
  const openLibrary = () => run(() => {
    if (!guard()) return;
    pendingImage.current?.cancel(); pendingImage.current = prepareReceptionImage(store, draft.reception, region.id, value); setLibraryOpen(true);
  });
  const createText = () => run(() => {
    if (!guard()) return;
    addReceptionText(store, draft.reception, region.id, value);
  });
  const changeImage = patch => run(() => save({ ...value, imageModules: value.imageModules.map(i => i.id === image.id ? { ...i, ...patch } : i) }, 'Edit Reception Image'));
  const changeCrop = crop => changeImage({ sides: image.sides.map((side, index) => index ? side : { ...side, crop }) });
  const beginDivider = (event, divider, frame) => {
    if (!guard()) return;
    const origin = value, expected = draft.reception, version = generation, bounds = frame.getBoundingClientRect(); let candidate = origin;
    gesture.begin(event, {
      update(e) {
        const coordinate = divider.axis === 'x' ? e.clientX - bounds.left : e.clientY - bounds.top;
        const extent = divider.axis === 'x' ? bounds.width : bounds.height;
        candidate = resizeReception(origin, divider.id, (coordinate + origin.gutter / 2) / (extent + origin.gutter) * 10000, minimum);
        setPreview({ generation: version, value: candidate });
      },
      commit() { setPreview(null); if (JSON.stringify(candidate) !== JSON.stringify(origin)) run(() => saveReception(store, expected, candidate, 'Resize Reception divider', version)); },
      cancel() { setPreview(null); },
    });
  };
  const beginMove = (event, frame) => {
    if (!guard()) return;
    const expected = draft.reception, origin = value, version = generation, source = region.id; let destination = null;
    gesture.begin(event, {
      update(e) {
        destination = [...frame.querySelectorAll('[data-region-id]')].find(node => { const b = node.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; })?.dataset.regionId || null;
        setMoveTarget(destination === source ? null : destination);
      },
      commit() { setMoveTarget(null); if (destination && destination !== source) run(() => saveReception(store, expected, moveReception(origin, source, destination), 'Move / swap Reception content', version)); },
      cancel() { setMoveTarget(null); },
    });
  };
  const mobileItem = value.mobile.find(m => m.id === region.id);
  const setMobile = patch => run(() => save({ ...value, mobile: value.mobile.map(m => m.id === region.id ? { ...m, ...patch } : m) }, 'Arrange mobile Reception'));
  const orderMobile = delta => run(() => {
    const mobile = [...value.mobile], from = mobile.findIndex(m => m.id === region.id), to = from + delta;
    if (to < 0 || to >= mobile.length) return; [mobile[from], mobile[to]] = [mobile[to], mobile[from]]; save({ ...value, mobile }, 'Reorder mobile Reception');
  });
  const nav = <ReceptionNavigation reception={shown} model={model} theme={theme} onTheme={setTheme} onCanvases={() => leave(onCanvases)} onDiscover={onDiscover ? () => leave(onDiscover) : undefined}
    onReturn={onReturn ? () => leave(onReturn) : undefined} returnLabel="Back to my Workbench" />;
  return <main ref={editorHost} className="reception-page reception-editor system-workflow__token-scope" data-reception-editor data-menu-surface={theme}
    data-lattice-menu-surface data-workflow-material="tactile" data-workflow-finish="flat" aria-label="Reception editor"
    onKeyDown={event => {
      if (event.defaultPrevented || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault(); if (!guard()) return; gesture.cancel(); cancelLibrary();
        run(() => { const redo = event.key.toLowerCase() === 'y' || event.shiftKey; if (!(redo ? store.redo() : store.undo())) throw new Error('History could not be saved. Your accepted layout is unchanged.'); });
      }
      if (event.key === 'Escape') { cancelLibrary(); setOperation(null); }
    }}>
    <div className="reception-editor-main" data-preview={mode}>
      <ReceptionCanvas reception={shown} model={model} address={store.getProfileAddress()} navigation={nav} selected={editing ? region.id : null} mode={mode} onWidth={setFrameWidth}
        onSelect={editing ? select : undefined} moveTarget={moveTarget} onMoveStart={editing ? beginMove : undefined}
        onDividerStart={editing ? beginDivider : undefined} onDividerKey={(event, divider) => {
          const delta = { ArrowLeft: -100, ArrowUp: -100, ArrowRight: 100, ArrowDown: 100 }[event.key]; if (delta === undefined) return;
          event.preventDefault(); run(() => save(resizeReception(value, divider.id, divider.position + delta, minimum), 'Resize Reception divider'));
        }} renderText={editing ? (record, cell) => record.id === text?.id && cell.id === region.id
          ? <Suspense fallback={<p>Opening Text…</p>}><ReceptionTextEditor record={record} store={store} toolsHost={toolsHost} /></Suspense> : null : undefined} />
    </div>
    <aside className="reception-editor-tools" aria-label="Reception tools">
      <header><strong>Reception</strong><button className="workflow-tactile-control" type="button" onClick={() => leave(onClose)}>Done</button></header>
      <p>Saved locally after each completed edit. Publish profile details from Workbench to share it.</p>
      {error && <p role="alert">{error}</p>}
      <div className="reception-editor-actions">
        <button className="workflow-tactile-control" type="button" aria-label="Undo Reception" disabled={!history.undo} onClick={() => { if (guard()) run(() => { if (!store.undo()) throw new Error('Undo could not be saved.'); }); }}>Undo</button>
        <button className="workflow-tactile-control" type="button" aria-label="Redo Reception" disabled={!history.redo} onClick={() => { if (guard()) run(() => { if (!store.redo()) throw new Error('Redo could not be saved.'); }); }}>Redo</button>
        <button className="workflow-tactile-control" type="button" aria-pressed={!editing} onClick={() => { if (guard()) { gesture.cancel(); cancelLibrary(); setEditing(!editing); } }}>Preview</button>
        <button className="workflow-tactile-control" type="button" aria-pressed={mode === 'mobile'} onClick={() => { gesture.cancel(); setMode(mode === 'mobile' ? 'desktop' : 'mobile'); }}>Mobile layout</button>
      </div>
      {editing && <>
        <h2>Region {value.regions.indexOf(region) + 1}</h2>
        <div className="reception-editor-actions"><button className="workflow-tactile-control" type="button" onClick={() => split('x')}>Split side by side</button>
          <button className="workflow-tactile-control" type="button" onClick={() => split('y')}>Split above and below</button></div>
        <details open><summary>Add / replace content</summary><div className="reception-editor-actions">
          <button className="workflow-tactile-control" type="button" onClick={openLibrary}>Image from Library</button>
          <button className="workflow-tactile-control" type="button" onClick={createText}>New Text</button></div>
          <label>Profile content<select aria-label="Place profile content" value="" onChange={e => assign(e.target.value)}><option value="" disabled>Choose content</option>
            {RECEPTION_PROFILE_CONTENT.map(kind => <option key={kind} value={kind}>{kind}</option>)}</select></label>
          <label>Retained content<select aria-label="Reuse retained content" value="" onChange={e => assign(e.target.value)}><option value="" disabled>Choose an unplaced record</option>
            {[...value.imageModules, ...value.texts].filter(i => !value.regions.some(r => r.content === i.id)).map(i => <option key={i.id} value={i.id}>{i.name || i.article?.title || 'Untitled Text'}</option>)}</select></label>
          <button className="workflow-tactile-control" type="button" disabled={!region.content} onClick={() => assign(null)}>Remove content</button>
          <p>Removed placements remain in Retained content. Library assets are never deleted.</p>
        </details>
        <details><summary>Move / swap or merge</summary>
          {value.regions.filter(r => r.id !== region.id).map((r, index) => <div className="reception-editor-actions" key={r.id}>
            <button className="workflow-tactile-control" type="button" disabled={!region.content} onClick={() => run(() => save(moveReception(value, region.id, r.id), 'Move / swap Reception content'))}>Move / swap with region {value.regions.indexOf(r) + 1}</button>
            <button className="workflow-tactile-control" type="button" disabled={!canMergeReception(region, r)} onClick={() => region.content && r.content ? setOperation({ target: r.id }) : run(() => save(mergeReception(value, region.id, r.id), 'Merge Reception regions'))}>Merge region {index + 1 + (value.regions.indexOf(r) >= value.regions.indexOf(region) ? 1 : 0)}</button>
          </div>)}
          {operation && <div role="group" aria-label="Choose merged content"><p>The selected region’s appearance is kept. Both content records remain available.</p>
            {[region, value.regions.find(r => r.id === operation.target)].filter(Boolean).map(r => <button key={r.id} className="workflow-tactile-control" type="button"
              onClick={() => run(() => { save(mergeReception(value, region.id, operation.target, r.content), 'Merge Reception regions'); setOperation(null); })}>Keep {value.texts.find(t => t.id === r.content)?.article.title || (r.content.startsWith('text:') ? 'Untitled Text' : value.imageModules.find(i => i.id === r.content)?.name || r.content)} · region {value.regions.indexOf(r) + 1}</button>)}
            <button className="workflow-tactile-control" type="button" onClick={() => setOperation(null)}>Cancel merge</button></div>}
        </details>
        <details><summary>Region appearance</summary>
          <label>Padding mode<select aria-label="Region padding mode" value={region.padding === null ? 'global' : 'custom'} onChange={e => changeRegion({ padding: e.target.value === 'global' ? null : value.padding })}><option value="global">Global padding</option><option value="custom">Custom / full bleed</option></select></label>
          {region.padding !== null && <NumberControl label="Region padding (px)" value={region.padding} min={0} max={128} onCommit={padding => changeRegion({ padding })} />}
          <label>Horizontal alignment<select value={region.alignX} onChange={e => changeRegion({ alignX: e.target.value })}>{['left', 'center', 'right'].map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Vertical alignment<select value={region.alignY} onChange={e => changeRegion({ alignY: e.target.value })}>{['top', 'center', 'bottom'].map(v => <option key={v}>{v}</option>)}</select></label>
          <CommittedColourControls color={region.surface || (theme === 'carbon' ? '#202222' : '#f4f4f4')} getVersion={store.getGeneration}
            onChange={patch => changeRegion({ surface: patch.color })} onPreview={patch => setPreview(patch ? { generation, value: { ...value, regions: value.regions.map(r => r.id === region.id ? { ...r, surface: patch.color } : r) } } : null)} />
          <button className="workflow-tactile-control" type="button" onClick={() => changeRegion({ surface: null })}>Use theme surface</button>
        </details>
        {image && <details open><summary>Image / crop</summary>
          <label><input type="checkbox" checked={image.visibility === 'PUBLIC'} onChange={e => changeImage({ visibility: e.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include Image in publication</label>
          <div className="reception-editor-actions"><button className="workflow-tactile-control" type="button" onClick={() => changeCrop(null)}>Fit inside</button><button className="workflow-tactile-control" type="button" onClick={() => changeCrop({ x: .5, y: .5, zoom: 1 })}>Fill region</button></div>
          {image.sides[0]?.crop && ['x', 'y', 'zoom'].map(key => <NumberControl key={key} label={`Crop ${key}`} value={image.sides[0].crop[key]} min={key === 'zoom' ? 1 : 0} max={key === 'zoom' ? 4 : 1} step={.01} onCommit={n => changeCrop({ ...image.sides[0].crop, [key]: n })} />)}
          <details><summary>Artwork information</summary><OwnerSystemWorkflowMetadataContent dossier={createProfileDocumentV9AssetDossier(image.sides[0]?.asset)} /></details>
        </details>}
        {text && <label><input type="checkbox" checked={text.visibility === 'PUBLIC'} onChange={event => run(() => save({ ...value, texts: value.texts.map(t => t.id === text.id ? { ...t, visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' } : t) }, 'Reception Text publication choice'))} />Include Text in publication</label>}
        <div className="text-tools-content" ref={setToolsHost} />
        <details open={mode === 'mobile'}><summary>Mobile arrangement</summary><div className="reception-editor-actions"><button className="workflow-tactile-control" type="button" onClick={() => orderMobile(-1)}>Earlier</button><button className="workflow-tactile-control" type="button" onClick={() => orderMobile(1)}>Later</button></div>
          <label>Mobile width<select aria-label="Mobile width" value={mobileItem.columns} onChange={e => setMobile({ columns: Number(e.target.value) })}><option value={2}>Full row</option><option value={1}>Half row</option></select></label>
          <NumberControl label="Mobile minimum height (px)" value={mobileItem.height} min={80} max={1200} onCommit={height => setMobile({ height })} />
        </details>
      </>}
      <details><summary>Layout &amp; branding</summary>
        {[['radius', 160], ['gutter', 64], ['padding', 128], ['height', 2400]].map(([key, max]) => <NumberControl key={key} label={`${key[0].toUpperCase() + key.slice(1)} (px)`} value={value[key]} min={key === 'height' ? 480 : 0} max={max} onCommit={n => run(() => save({ ...value, [key]: n }, `Reception ${key}`))} />)}
        <label>Brand name<input key={value.branding.name} aria-label="Brand name" defaultValue={value.branding.name} maxLength={64} onBlur={e => { if (e.target.value !== value.branding.name) run(() => save({ ...value, branding: { ...value.branding, name: e.target.value.trim() } }, 'Reception branding')); }} /></label>
        <label>Logo<select aria-label="Reception logo" value={value.branding.logo || ''} onChange={e => run(() => save({ ...value, branding: { ...value.branding, logo: e.target.value || null } }, 'Reception logo'))}><option value="">Profile mark</option>{value.imageModules.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
        <label>Published appearance<select value={value.branding.theme} onChange={e => run(() => { save({ ...value, branding: { ...value.branding, theme: e.target.value } }, 'Reception appearance'); setTheme(e.target.value); })}><option value="carbon">Carbon</option><option value="mist">Mist</option></select></label>
        {receptionDividers(value, minimum).map((d, i) => <NumberControl key={d.id} label={`Divider ${i + 1} (%)`} value={d.position / 100} min={d.min / 100} max={d.max / 100} step={.01} onCommit={n => run(() => save(resizeReception(value, d.id, n * 100, minimum), 'Resize Reception divider'))} />)}
      </details>
      <details><summary>Shared profile facts</summary><p>These facts also appear in your other destinations. Official links come from your Universal Profile.</p>
        <button className="workflow-tactile-control" type="button" onClick={() => setProfileOpen(true)}>Edit profile details</button>
        {profileOpen && <Suspense fallback={<p>Opening profile…</p>}><ReceptionProfileEditor store={store} model={model} onClose={() => setProfileOpen(false)} /></Suspense>}
      </details>
      <details><summary>Private backup &amp; recovery</summary><WorkbenchBackupControls store={rootStore} storage={storage || globalThis.localStorage} recoveryPending={recoveries.length > 0}
        onRestored={() => { store.release(); onClose(); }} /></details>
    </aside>
    {libraryOpen && <ProfileLibraryPicker library={library} menuSurface={theme} onClose={cancelLibrary}
      onChoose={async asset => { const request = pendingImage.current; const placed = await request?.choose(asset); if (placed && request === pendingImage.current) cancelLibrary(); return placed; }} />}
  </main>;
}
