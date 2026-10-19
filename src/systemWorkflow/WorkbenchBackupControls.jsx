import { useEffect, useRef, useState } from 'react';
import { parseWorkbenchBackup, serializeWorkbenchBackup, summarizeWorkbenchBackup, restoreWorkbenchBackup, WORKBENCH_BACKUP_LIMIT } from './workbenchBackup.js';
import { textRecoveries } from '../text/textEditRecovery.js';
import './workbenchBackup.css';

export default function WorkbenchBackupControls({ store, storage, getDraft = () => store.getDraft(), onRestored, recoveryPending = false, disabled = false }) {
  const [pending, setPending] = useState(null), [message, setMessage] = useState(''), [reading, setReading] = useState(false);
  const live = useRef(null), request = useRef(0), resources = useRef(new Map());
  live.current = { store, getDraft, onRestored };
  useEffect(() => () => {
    request.current++;
    resources.current.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); }); resources.current.clear();
  }, [store]);
  useEffect(() => { if (disabled) { request.current++; setPending(null); setReading(false); } }, [disabled]);
  const hasRecovery = () => recoveryPending || textRecoveries(store, store.getProfileAddress()).length > 0;
  const currentBase = () => { try { return JSON.stringify(live.current.getDraft()); } catch { return null; } };
  const download = () => {
    if (disabled) return;
    try {
      if (hasRecovery()) throw Error('Save your pending Text edits first, or download their article backups from Text tools.');
      const source = serializeWorkbenchBackup(live.current.getDraft());
      const url = URL.createObjectURL(new Blob([source], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `inscape-workbench-${store.getProfileAddress().slice(2, 10)}.json`;
      document.body.append(link); link.click(); link.remove();
      resources.current.set(url, setTimeout(() => { URL.revokeObjectURL(url); resources.current.delete(url); }, 60000));
      setMessage('Backup download requested. Check your browser’s downloads.');
    } catch (error) { setMessage(error.message || 'The backup could not be created.'); }
  };
  const read = async file => {
    if (disabled) return;
    const token = ++request.current, profile = store.getProfileAddress(), generation = store.getGeneration();
    const fingerprint = store.getRecordState().fingerprint;
    const base = currentBase();
    setPending(null); setMessage(''); setReading(true);
    try {
      if (file.size > WORKBENCH_BACKUP_LIMIT) throw Error('This Workbench backup is too large.');
      const backup = parseWorkbenchBackup(await file.text(), profile);
      if (token !== request.current || live.current.store !== store) return;
      if (store.getProfileAddress() !== profile || store.getGeneration() !== generation || currentBase() !== base) throw Error('Your Workbench changed. Choose the backup again.');
      setPending({ backup, profile, generation, fingerprint, base });
    } catch (error) { if (token === request.current) setMessage(error.message); }
    finally { if (token === request.current) setReading(false); }
  };
  const restore = () => {
    if (disabled || !pending) return;
    if (hasRecovery()) { setMessage('Save pending Text edits or download their article backups before restoring this Workbench.'); return; }
    if (store.getProfileAddress() !== pending.profile || store.getGeneration() !== pending.generation || currentBase() !== pending.base) {
      setPending(null); setMessage('Your Workbench changed. Choose the backup again.'); return;
    }
    const { saved, warning } = restoreWorkbenchBackup(store, pending.backup, { expectedGeneration: pending.generation, expectedFingerprint: pending.fingerprint }, storage);
    if (!saved) { setMessage('The backup was not restored. The saved draft changed or browser storage is unavailable. Your previous work has not been replaced.'); return; }
    setPending(null); setMessage('Workbench restored and saved locally. Nothing was published.');
    live.current.onRestored?.(warning);
    if (warning) setMessage(warning);
  };
  return <section className="workbench-backup system-workflow__settings-section" aria-label="Workbench backup">
    <header><strong>Workbench backup</strong></header>
    <p>A private file of your complete saved composition, including private modules and artwork references. Media files, wallet credentials, Library caches and interface preferences are not included. Keep this file private.</p>
    {store.getRecordState().status !== 'corrupt' && <button className="workflow-tactile-control" type="button" disabled={disabled} onClick={download}>Download Workbench backup</button>}
    <label>Open Workbench backup<input type="file" accept=".json,application/json" aria-label="Open Workbench backup" disabled={disabled || recoveryPending}
      onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) void read(file); }} /></label>
    {reading && <p role="status">Opening backup…</p>}
    {pending && <div className="workbench-backup__preview">
      <strong>Replace this profile’s entire local Workbench?</strong>
      <p>Backup from {new Date(pending.backup.createdAt).toLocaleString()}. {summarizeWorkbenchBackup(pending.backup.draft)}</p>
      <p>This replaces public and private modules, content and saved composition layout. It clears local undo history. Download your current backup first if you want to keep it. It does not change your published profile.</p>
      <button className="workflow-tactile-control" type="button" disabled={disabled || recoveryPending} onClick={restore}>Replace Workbench with backup</button>
      <button className="workflow-tactile-control" type="button" onClick={() => { request.current++; setPending(null); setMessage(''); }}>Cancel Workbench restore</button>
    </div>}
    {recoveryPending && <p>Save pending Text edits or download their article backups before restoring this Workbench.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
