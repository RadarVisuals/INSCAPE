import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceStatus } from '../workspace/WorkspaceBoundary.jsx';
import WorkspaceRecoveryButton from '../workspace/WorkspaceRecoveryButton.jsx';
import { useJsonDownload } from '../workspace/useJsonDownload.js';
import { authoredStorage } from '../workspace/profileWorkspace.js';
import { applyWorkspaceRestore, exportWorkspaceBackup, previewWorkspaceRestore, parseWorkbenchBackup, serializeWorkbenchBackup, summarizeWorkbenchBackup, restoreWorkbenchBackup, WORKBENCH_BACKUP_LIMIT } from './workbenchBackup.js';
import { textRecoveries } from '../text/textEditRecovery.js';
import { preparePublishedReception, preparePreviousReception, readReceptionRecovery, restorePreparedReception } from '../reception/publishedReceptionRecovery.js';
import { publishedPresentationSnapshot } from '../presentation/presentationSources.js';
import './workbenchBackup.css';
const ReceptionRestorePreview = lazy(() => import('../reception/ReceptionRestorePreview.jsx'));

export default function WorkbenchBackupControls({ store, storage, getDraft = () => store.getDraft(), onRestored, recoveryPending = false, disabled = false, receptionRecovery }) {
  const [pending, setPending] = useState(null), [message, setMessage] = useState(''), [reading, setReading] = useState(false);
  const [mode, setMode] = useState('replace');
  const live = useRef(null), request = useRef(0), opener = useRef(null);
  const [previous] = useState(() => receptionRecovery && readReceptionRecovery(storage, store.getProfileAddress()));
  const profile = store.getProfileAddress();
  const downloadJson = useJsonDownload(store);
  const native = authoredStorage(storage) !== storage;
  const workspaceState = useWorkspaceStatus(profile);
  live.current = { store, getDraft, onRestored, disabled };
  useEffect(() => () => {
    request.current++;
  }, [store]);
  useEffect(() => { if (disabled) { request.current++; setPending(null); setReading(false); } }, [disabled]);
  const hasRecovery = () => recoveryPending || textRecoveries(store, store.getProfileAddress()).length > 0;
  const backupDraft = () => store.getBackupSnapshot?.(live.current.getDraft()) ?? live.current.getDraft();
  const currentBase = () => { try { return JSON.stringify(backupDraft()); } catch { return null; } };
  const collection = store.isCollection?.();
  const stageReception = (previous, event) => {
    if (disabled) return;
    try {
      const { scope, publishedResolution, collection } = receptionRecovery;
      const prepared = previous ? preparePreviousReception(scope, storage) : preparePublishedReception(scope, publishedResolution);
      opener.current = event.currentTarget;
      setPending({ reception: prepared, scope, source: previous ? null : publishedResolution.document,
        snapshot: previous ? collection : publishedPresentationSnapshot(publishedResolution.document),
        profile: store.getProfileAddress(), generation: store.getGeneration(), base: currentBase() });
      setMessage('');
    } catch (error) { setMessage(error.message); }
  };
  const downloadFile = source => {
    if (live.current.store !== store || live.current.disabled) throw Error('The active workspace changed.');
    downloadJson(source, `inscape-${native ? 'workspace' : 'workbench'}-${profile.slice(2, 10)}.json`);
  };
  const download = async () => {
    if (disabled) return;
    try {
      if (native) await exportWorkspaceBackup(profile, downloadFile);
      else downloadFile(serializeWorkbenchBackup(backupDraft()));
      setMessage('Backup download requested. Check your browser’s downloads.');
    } catch (error) { setMessage(error.message || 'The backup could not be created.'); }
  };
  const review = async (source, mode, token) => {
    const plan = await previewWorkspaceRestore(source, profile, mode);
    if (request.current === token && live.current.store === store && !live.current.disabled)
      setPending({ plan, source });
  };
  const read = async file => {
    if (disabled) return;
    const token = ++request.current, profile = store.getProfileAddress(), generation = store.getGeneration();
    const fingerprint = store.getRecordState().fingerprint;
    const base = currentBase();
    setPending(null); setMessage(''); setReading(true);
    try {
      if (native) {
        const source = await file.text();
        if (token === request.current) await review(source, mode, token);
        return;
      }
      if (file.size > WORKBENCH_BACKUP_LIMIT) throw Error('This Workbench backup is too large.');
      const backup = parseWorkbenchBackup(await file.text(), profile);
      if (token !== request.current || live.current.store !== store) return;
      if (store.getProfileAddress() !== profile || store.getGeneration() !== generation || currentBase() !== base) throw Error('Your Workbench changed. Choose the backup again.');
      if (collection && backup.version !== 2) throw Error('Choose an all-Workbenches backup. A single Workbench backup cannot replace this collection.');
      setPending({ backup, profile, generation, fingerprint, base });
    } catch (error) { if (token === request.current) setMessage(error.message); }
    finally { if (token === request.current) setReading(false); }
  };
  const restore = async () => {
    if (disabled || !pending) return;
    if (pending.plan) {
      const token = ++request.current;
      const current = () => token === request.current && live.current.store === store && !live.current.disabled
        && store.getProfileAddress() === pending.plan.profile && (store.hasWriteAccess?.() ?? true);
      try {
        setReading(true);
        const warning = await applyWorkspaceRestore(pending.plan, current);
        setPending(null);
        setMessage(warning || 'Workspace restored on this device.');
      } catch (error) { setMessage(error.message); }
      finally { setReading(false); }
      return;
    }
    if (hasRecovery()) { setMessage('Save pending Text edits or download their article backups before restoring this Workbench.'); return; }
    if (store.getProfileAddress() !== pending.profile || store.getGeneration() !== pending.generation || currentBase() !== pending.base) {
      setPending(null); setMessage('Your Workbench changed. Choose the backup again.'); return;
    }
    if (pending.reception) {
      try {
        const { scope, publishedResolution } = receptionRecovery;
        if (scope !== pending.scope || pending.source && (publishedResolution?.status !== 'RESOLVED' || publishedResolution.document !== pending.source))
          throw Error('The publication changed. Reopen this preview.');
        const warning = restorePreparedReception(scope, pending.reception, storage);
        if (store.whenCommitted && !await store.whenCommitted()) throw Error('Profile Bento is in memory. Keep this tab open and retry saving.');
        if (live.current.store !== store) return;
        live.current.onRestored?.(warning || 'Profile Bento loaded. Previous local work is in Backup. Nothing published.');
      } catch (error) { setMessage(error.message); }
      return;
    }
    const { saved, warning, error } = await restoreWorkbenchBackup(store, pending.backup, { expectedGeneration: pending.generation, expectedFingerprint: pending.fingerprint }, storage);
    if (live.current.store !== store) return;
    if (!saved) { setMessage(error || 'The backup was not restored. The saved draft changed or browser storage is unavailable. Your previous work has not been replaced.'); return; }
    setPending(null); setMessage('Workbench restored and saved locally. Nothing was published.');
    live.current.onRestored?.(warning);
    if (warning) setMessage(warning);
  };
  return <section className="workbench-backup system-workflow__settings-section" aria-label="Workbench backup">
    {receptionRecovery && <>
      <header><strong>Published Profile Bento</strong></header>
      <p>Loads Profile Bento with a local recovery copy. Other canvases stay unchanged.</p>
      <button type="button" disabled={disabled || receptionRecovery.publishedResolution?.status !== 'RESOLVED' || !receptionRecovery.publishedResolution.document?.reception}
        onClick={event => stageReception(false, event)}>Load published Profile Bento</button>
      {previous?.status === 'ready' && <button type="button" disabled={disabled} onClick={event => stageReception(true, event)}>Restore previous local Profile Bento</button>}
      {previous?.status === 'unavailable' && <p role="status">{previous.message}</p>}
    </>}
    <header><strong>{native ? 'Workspace backup' : 'Workbench backup'}</strong></header>
    {native && <p role="status">{workspaceState?.status === 'ready'
      ? 'Saved on this device' : workspaceState?.status === 'saving' ? 'Saving workspace' : 'Workspace storage needs attention'}
      {workspaceState?.lastExportedAt && ' · Last exported ' + new Date(workspaceState.lastExportedAt).toLocaleString()}
      {workspaceState?.lastExportedRevision !== workspaceState?.authoredRevision && (workspaceState?.lastExportedAt ? ' · Changes since last export' : ' · No export yet')}</p>}
    {native ? <p>Includes your curated Library, Workbenches, articles and recovery copies. Artwork uses media references. Keep this file private.</p> : <p>A private file of {collection ? 'all your local compositions, Profile Bento and shared Keeper settings' : 'your complete saved composition and Profile Bento'}, including private modules and artwork references. Media files, wallet credentials, Library caches and interface preferences are not included. Keep this file private.</p>}
    {native && ['memory', 'unsaved'].includes(workspaceState?.status) ? <WorkspaceRecoveryButton key={profile} profile={profile} disabled={disabled} /> : store.getRecordState().status !== 'corrupt' && <button className="workflow-tactile-control" type="button" disabled={disabled} onClick={download}>{native ? 'Download workspace backup' : collection ? 'Download all Workbenches' : 'Download Workbench backup'}</button>}
    <label>Open Workbench backup<input type="file" accept=".json,application/json" aria-label="Open Workbench backup" disabled={disabled || (!native && recoveryPending)}
      onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) void read(file); }} /></label>
    {native && <label>Restore mode <select value={mode} disabled={disabled || reading} onChange={async event => {
      const next = event.target.value;
      setMode(next);
      if (!pending?.source) return;
      const token = ++request.current;
      setReading(true); setMessage('');
      try { await review(pending.source, next, token); }
      catch (error) { if (token === request.current) { setPending(null); setMessage(error.message); } }
      finally { if (token === request.current) setReading(false); }
    }}><option value="replace">Replace</option><option value="merge">Merge</option></select></label>}
    {reading && <p role="status">Opening backup…</p>}
    {pending?.plan && <div className="workbench-backup__preview">
      <strong>{pending.plan.legacy ? 'Workbench-only backup' : 'Workspace backup'} · {profile}</strong>
      <p>On this device: {pending.plan.localCounts}. In file: {pending.plan.incomingCounts}.</p>

      {pending.plan.mode === 'replace' ? <p>{pending.plan.legacy ? 'Replaces local Workbenches and their articles.' :
        'Replaces your Library, all Workbenches, articles and recovery buffers.'} Your published profile is unchanged.</p> :
        <>{Object.entries(pending.plan.stats).map(([kind, items]) => <details key={kind}><summary>{kind} ({items.length})</summary>
          <p>{items.join(', ') || 'None'}</p></details>)}<p>Conflicting Workbenches are copied under new names. Local settings take priority.</p></>}
      <button type="button" disabled={disabled || reading} onClick={download}>Export current workspace first</button>
      {pending.plan.blocked && <p role="alert">{pending.plan.blocked}</p>}
      <button type="button" disabled={disabled || reading || Boolean(pending.plan.blocked)} onClick={restore}>{pending.plan.mode === 'replace' ? 'Confirm Replace' : 'Confirm Merge'}</button>
      <button type="button" onClick={() => { request.current++; setPending(null); setReading(false); }}>Cancel restore</button>
    </div>}
    {pending && !pending.plan && !pending.reception && <div className="workbench-backup__preview">
      <strong>{collection || pending.backup.version === 2 ? 'Replace all of this profile’s local Workbenches?' : 'Replace this profile’s entire local Workbench?'}</strong>
      <p>Backup from {new Date(pending.backup.createdAt).toLocaleString()}. {summarizeWorkbenchBackup(pending.backup.draft)}</p>
      <p>This replaces public and private modules, content and saved composition layout. It clears local undo history. Download your current backup first if you want to keep it. It does not change your published profile.</p>
      <button className="workflow-tactile-control" type="button" disabled={disabled || recoveryPending} onClick={restore}>Replace Workbench with backup</button>
      <button className="workflow-tactile-control" type="button" onClick={() => { request.current++; setPending(null); setMessage(''); }}>Cancel Workbench restore</button>
    </div>}
    {!native && recoveryPending && <p>Save pending Text edits or download their article backups before restoring this Workbench.</p>}
    {message && <p role="status">{message}</p>}
    {pending?.reception && createPortal(<Suspense fallback={<p role="status">Opening restore preview.</p>}>
      <ReceptionRestorePreview reception={pending.reception.reception} snapshot={pending.snapshot} label="Profile Bento restore preview"
        onClose={() => { setPending(null); setMessage(''); opener.current?.focus(); }} actions={<>
          {message && <span role="alert">{message}</span>}
          <button type="button" className="workflow-tactile-control" autoFocus disabled={disabled} onClick={restore}>Back up current and load Profile Bento</button>
        </>} />
    </Suspense>, document.body)}
  </section>;
}
