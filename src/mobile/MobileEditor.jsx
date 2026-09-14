import useModuleShortcutMenu from '../public/ownerSystemWorkflow/useModuleShortcutMenu.jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Crop, Eye, EyeOff, Lock, Settings2, Trash2, X } from 'lucide-react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import ArtworkTransformTools from '../public/ownerSystemWorkflow/ArtworkTransformTools.jsx';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { updateMobileModule } from './mobileSession.js';
import { MOBILE_MAX_ENTRIES, mobileTransform } from './domain/mobilePresentation.js';
import { MOBILE_FOUNDER_PROFILE } from './domain/customPresentation.js';
import MobilePresentation from './MobilePresentation.jsx';
import './mobileEditor.css';
import '../public/ownerSystemWorkflow/displayInstruments.css';

const roles = ['background', 'mask', 'artwork'];
const labels = { name: 'Username', brand: 'INSCAPE.ID', theme: 'Theme icon', flip: 'Turn icon', share: 'Share icon' };
function DropTarget({ slot, registerTarget, onAccept, disabled }) {
  const node = useRef(null), latest = useRef(onAccept); latest.current = onAccept;
  useEffect(() => {
    if (disabled) return;
    registerTarget('mobile:' + slot, { get node() { return node.current; }, label: 'Release to add ' + slot,
      placeAsset: asset => latest.current(slot, asset) });
    return () => registerTarget('mobile:' + slot, null);
  }, [slot, registerTarget, disabled]);
  return <div ref={node} className="mobile-editor-drop" data-mobile-drop={slot}
    onDragOver={event => { if (!disabled && event.dataTransfer.types.includes('application/x-inscape-asset')) event.preventDefault(); }}
    onDrop={event => { const id = event.dataTransfer.getData('application/x-inscape-asset'); if (!disabled && id) { event.preventDefault(); latest.current(slot, id); } }}>Drop {slot === 'index' ? 'artwork' : slot} from Library</div>;
}
function Field({ label, value, type = 'number', min, max, step = 1, onCommit, disabled }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = type === 'number' ? Number(draft) : draft;
    if (type === 'number' && (!draft || !Number.isFinite(next) || next < min || next > max)) { setDraft(String(value)); return; }
    if (next !== value) onCommit(next);
  };
  return <label>{label}<input type={type} value={draft} min={min} max={max} step={step} disabled={disabled}
    onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}
export default function MobileEditor({ mobile, store, profileAddress, assetsById, identity, registerTarget, suspended = false }) {
  const [error, setError] = useState(null), [editing, setEditing] = useState(true), [toolsOpen, setToolsOpen] = useState(true);
  const [tab, setTab] = useState('layers'), [selection, setSelection] = useState('artwork'), [view, setView] = useState('front');
  const [locked, setLocked] = useState(new Set()), [hidden, setHidden] = useState(new Set());
  const [positionDraft, setPositionDraft] = useState(null), [imageDraft, setImageDraft] = useState(null);
  const [navigation, setNavigation] = useState(null), [previewHeight, setPreviewHeight] = useState(720);
  const shortcutMenu = useModuleShortcutMenu({ store, profileAddress, kind: 'mobile', record: mobile });
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { setPositionDraft(null); setImageDraft(null); }, [mobile]);
  const save = useCallback((change, label = 'Edit · Mobile') => {
    if (!live.current || suspended) return false;
    try {
      const ok = updateMobileModule(store, profileAddress, change, label);
      setError(ok ? null : 'Changes could not be saved. Your draft is unchanged.'); return ok;
    } catch (cause) { setError(cause.message); return false; }
  }, [store, profileAddress, suspended]);
  function accept(slot, dropped) {
    if (locked.has(slot) || !editing || suspended || store.getProfileAddress() !== profileAddress) return false;
    try {
      const source = typeof dropped === 'string' ? assetsById.get(dropped) : dropped.assetRecord || dropped;
      const stableAssetId = dropped.stableAssetId || source?.id, selectedMedia = dropped.selectedMedia || null;
      const canonical = createProfileDocumentV9AssetResolver([{ ...source, id: stableAssetId }], { compactContentReference: false })(stableAssetId, selectedMedia);
      if (canonical.media.type !== 'image' || !canonical.media.url) throw new Error('Choose an image from Library.');
      const reference = { stableAssetId, selectedMedia };
      return save(current => {
        if (slot !== 'index') return { ...current, front: { ...current.front, [slot]: reference } };
        if (current.index.entries.length >= MOBILE_MAX_ENTRIES) throw new Error('The Index supports up to ' + MOBILE_MAX_ENTRIES + ' entries.');
        return { ...current, index: { ...current.index, entries: [...current.index.entries, { id: 'mobile-entry:' + crypto.randomUUID(), asset: reference }] } };
      }, 'Add ' + slot + ' · Mobile');
    } catch (cause) { setError(cause.message); return false; }
  }
  const content = useMemo(() => {
    const resolve = createProfileDocumentV9AssetResolver(assetsById, { compactContentReference: false });
    const asset = ref => { if (!ref) return null; try { return resolve(ref.stableAssetId, ref.selectedMedia); }
      catch { return { stableAssetId: ref.stableAssetId, name: 'Artwork unavailable', media: { url: null } }; } };
    return { ...mobile, front: { ...mobile.front, positions: positionDraft || mobile.front.positions, image: imageDraft || mobile.front.image,
      background: asset(mobile.front.background), artwork: asset(mobile.front.artwork), mask: asset(mobile.front.mask) },
      index: { ...mobile.index, entries: mobile.index.entries.map(entry => ({ id: entry.id, asset: asset(entry.asset) })) } };
  }, [mobile, assetsById, positionDraft, imageDraft]);
  const go = target => setNavigation({ target, sequence: crypto.randomUUID() });
  const positionChange = (key, value, commit) => {
    if (locked.has(key)) return;
    if (commit) { setPositionDraft(null); save(c => ({ ...c, front: { ...c.front, positions: { ...c.front.positions, [key]: value } } }), 'Move ' + key + ' · Mobile'); }
    else setPositionDraft({ ...mobile.front.positions, [key]: value });
  };
  const imageChange = (value, commit) => {
    if (locked.has('artwork')) return;
    if (commit) { setImageDraft(null); save(c => ({ ...c, front: { ...c.front, image: value } }), 'Move / crop artwork · Mobile'); }
    else setImageDraft(value);
  };
  function reorder(id, targetId) {
    save(c => {
      const entries = [...c.index.entries], from = entries.findIndex(e => e.id === id), to = entries.findIndex(e => e.id === targetId);
      if (from < 0 || to < 0 || from === to) return c;
      const [entry] = entries.splice(from, 1); entries.splice(to, 0, entry);
      return { ...c, index: { ...c.index, entries } };
    }, 'Reorder works · Mobile');
  }
  function transform(operation) {
    if (!roles.includes(selection) || locked.has(selection)) return;
    save(c => {
      const value = { ...mobileTransform(c.front, selection) };
      if (operation === 'ROTATE') value.quarterTurns = (value.quarterTurns + 1) % 4;
      else if (operation === 'MIRROR_HORIZONTAL') value.mirrorX = !value.mirrorX; else value.mirrorY = !value.mirrorY;
      return { ...c, front: { ...c.front, transforms: { ...c.front.transforms, [selection]: value } } };
    }, (operation === 'ROTATE' ? 'Rotate ' : 'Mirror ') + selection + ' · Mobile');
  }
  const toggleSet = (setter, key) => setter(old => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const drop = slot => <DropTarget slot={slot} registerTarget={registerTarget} onAccept={accept} disabled={!editing || suspended || locked.has(slot)} />;
  const editor = editing && !suspended ? { selection, locked, hidden, revision: store.getGeneration(), onSelect: setSelection, onImage: imageChange, onReorder: reorder,
    onIndexText: (key, value) => save(c => ({ ...c, index: { ...c.index, [key]: value } }), 'Edit ' + key + ' · Mobile'), renderIndexDrop: () => drop('index') } : undefined;
  const entryIndex = mobile.index.entries.findIndex(e => e.id === selection);
  const selectedReference = roles.includes(selection) ? mobile.front[selection] : mobile.index.entries[entryIndex]?.asset;
  const disabled = suspended || locked.has(selection);
  return <div className="mobile-editor-host" data-workbench-module="mobile">
    {shortcutMenu.content}
    {!mobile.editor.open && <button className="mobile-editor-reopen" onContextMenu={shortcutMenu.onContextMenu} onKeyDown={shortcutMenu.onKeyDown} onClick={() => save(c => ({ ...c, editor: { open: true } }), null)}>MOBILE</button>}
    {mobile.editor.open && <>
      <WorkbenchWindow label="Mobile" title="PRESENTATION" width={400} initialX={100} initialY={55} initialHeight={820}
        controls={<><button aria-label="Open Mobile tools" onClick={() => setToolsOpen(true)}><Settings2 size={16} /></button><button aria-label="Close Mobile editor" onClick={() => save(c => ({ ...c, editor: { open: false } }), null)}><X size={16} /></button></>}>
        <nav className="mobile-output-toolbar" aria-label="Mobile authoring">
          <button aria-pressed={editing} onClick={() => { setEditing(!editing); setPositionDraft(null); setImageDraft(null); }}>{editing ? 'Edit' : 'Preview'}</button>
          {['front', 'back', 'index'].map(target => <button key={target} aria-pressed={view === target} onClick={() => go(target)}>{target === 'back' ? 'Profile' : target === 'index' ? 'Works' : 'Front'}</button>)}
        </nav>
        <div className="mobile-editor-preview" data-editing={editing} style={{ height: previewHeight }}>
          <MobilePresentation content={content} identity={identity} active={!suspended} editor={editor} navigationRequest={navigation} onViewChange={setView}
            editPositions={editor ? positionChange : undefined} />
          {editor && view === 'front' && <div className="mobile-entry-drops">{roles.map(slot => <div key={slot}>{drop(slot)}</div>)}</div>}
        </div>
      </WorkbenchWindow>
      {toolsOpen && <WorkbenchWindow label="Mobile tools" title="LAYERS / SETTINGS" width={320} initialX={520} initialY={55} initialHeight={650}
        controls={<button aria-label="Close Mobile tools" onClick={() => setToolsOpen(false)}><X size={16} /></button>}>
        <aside className="mobile-editor-controls">
          <nav aria-label="Mobile tools sections">{['layers', 'settings'].map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value}</button>)}</nav>
          {tab === 'layers' && <>
            <nav className="system-workflow__selection-actions" aria-label="Mobile selection actions"><ArtworkTransformTools disabled={disabled || !roles.includes(selection)} onTransform={transform} />
              <button aria-label="Crop artwork" disabled={disabled || selection !== 'artwork'} onClick={() => { setTab('settings'); imageChange({ ...mobile.front.image, fit: 'cover' }, true); }}><Crop size={15} /></button>
            </nav>
            <div className="mobile-layer-list">{[...roles, ...Object.keys(mobile.front.positions)].map(key => <div className="mobile-layer-row" key={key} data-selected={selection === key}>
              <button onClick={() => { setSelection(key); go('front'); }}>{labels[key] || key}</button>
              <button aria-label={(hidden.has(key) ? 'Show ' : 'Hide ') + key + ' in editor'} onClick={() => toggleSet(setHidden, key)}>{hidden.has(key) ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              <button aria-label={(locked.has(key) ? 'Unlock ' : 'Lock ') + key} aria-pressed={locked.has(key)} onClick={() => toggleSet(setLocked, key)}><Lock size={14} /></button>
            </div>)}</div>
            <p>Three fixed image roles. Lock and hide apply only while editing.</p>
            {entryIndex >= 0 && <div className="mobile-entry-actions"><button aria-label="Move selected work earlier" disabled={entryIndex === 0} onClick={() => reorder(selection, mobile.index.entries[entryIndex - 1].id)}><ArrowUp /></button>
              <button aria-label="Move selected work later" disabled={entryIndex === mobile.index.entries.length - 1} onClick={() => reorder(selection, mobile.index.entries[entryIndex + 1].id)}><ArrowDown /></button></div>}
            {selectedReference && <button disabled={disabled} onClick={() => save(c => roles.includes(selection)
              ? { ...c, front: { ...c.front, [selection]: null } } : { ...c, index: { ...c.index, entries: c.index.entries.filter(e => e.id !== selection) } }, 'Remove artwork · Mobile')}><Trash2 size={15} />Remove {entryIndex >= 0 ? 'work' : selection}</button>}
          </>}
          {tab === 'settings' && <>
            <p className="mobile-selection-name">{selection}</p>
            {selection === 'background' && <Field label="Background colour" type="color" value={mobile.front.color} disabled={disabled} onCommit={color => save(c => ({ ...c, front: { ...c.front, color } }))} />}
            {selection === 'artwork' && <><label>Artwork fit<select value={mobile.front.image.fit} disabled={disabled} onChange={e => imageChange({ ...mobile.front.image, fit: e.target.value }, true)}><option value="contain">Fit complete artwork</option><option value="cover">Fill and crop</option></select></label>
              <Field label="Artwork scale" value={mobile.front.image.scale} min={.1} max={4} step={.01} disabled={disabled} onCommit={scale => imageChange({ ...mobile.front.image, scale }, true)} />
              <p>Drag directly on the output to position the image inside its mask.</p></>}
            {selection === 'mask' && <><Field label="Mask border (px)" value={mobile.front.border.width} min={0} max={12} disabled={disabled} onCommit={width => save(c => ({ ...c, front: { ...c.front, border: { ...c.front.border, width } } }))} />
              <Field label="Border colour" type="color" value={mobile.front.border.color} disabled={disabled} onCommit={color => save(c => ({ ...c, front: { ...c.front, border: { ...c.front.border, color } } }))} /></>}
            {mobile.front.positions[selection] && ['x', 'y'].map(axis => <Field key={axis} label={axis.toUpperCase() + ' (%)'} value={Math.round(mobile.front.positions[selection][axis] * 100)} min={axis === 'x' ? 6 : 5} max={axis === 'x' ? 94 : 95} disabled={disabled}
              onCommit={value => positionChange(selection, { ...mobile.front.positions[selection], [axis]: value / 100 }, true)} />)}
            {profileAddress === MOBILE_FOUNDER_PROFILE && <label>Presentation<select value={mobile.front.renderer} onChange={e => save(c => ({ ...c, front: { ...c.front, renderer: e.target.value } }))}><option value="assets">Library composition</option><option value="steyra">My Steyra study</option></select></label>}
            <label>Initial theme<select value={mobile.theme} onChange={e => save(c => ({ ...c, theme: e.target.value }))}><option value="dark">Dark</option><option value="light">Light</option></select></label>
            <label>Preview screen<select value={previewHeight} onChange={e => setPreviewHeight(Number(e.target.value))}><option value={640}>360 × 640</option><option value={720}>360 × 720</option><option value={780}>360 × 780</option></select></label>
          </>}
          <p className="mobile-editor-resolution">1080 × 1920 · 9:16<br />Composition fits at the bottom; background fills the screen.<br />Invisible snapping · 12 design pixels</p>
          <a href="/assets/mobile-template.svg" download>Download canvas template</a>
          <label className="mobile-editor-public"><input type="checkbox" checked={mobile.visibility === 'PUBLIC'} disabled={suspended} onChange={e => save(c => ({ ...c, visibility: e.target.checked ? 'PUBLIC' : 'PRIVATE' }))} />Include Mobile in next publication</label>
          <p>Draft saves automatically. Ctrl+Z to undo.</p>
          {error && <p role="alert">{error}</p>}
        </aside>
      </WorkbenchWindow>}
    </>}
  </div>;
}
