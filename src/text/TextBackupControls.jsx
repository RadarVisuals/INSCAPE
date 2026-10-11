import { useEffect, useRef, useState } from 'react';
import { ARTICLE_BACKUP_FILE_LIMIT, parseArticleBackup, serializeArticleBackup } from './articleBackup.js';

export default function TextBackupControls({ article, onChange, disabled, recoveryPending }) {
  const [pending, setPending] = useState(null), [message, setMessage] = useState(''), [reading, setReading] = useState(false);
  const latest = useRef(article); latest.current = article;
  const request = useRef(0), resources = useRef(new Map());
  useEffect(() => () => {
    request.current++;
    resources.current.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); });
    resources.current.clear();
  }, []);
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([serializeArticleBackup(latest.current)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'inscape-article.json';
      document.body.append(link); link.click(); link.remove();
      resources.current.set(url, setTimeout(() => { URL.revokeObjectURL(url); resources.current.delete(url); }, 60000));
      setMessage('Backup download requested. Check your browser’s downloads.');
    } catch { setMessage('The backup could not be downloaded. Your text is still here.'); }
  };
  const read = async file => {
    const token = ++request.current, base = serializeArticleBackup(latest.current);
    setPending(null); setMessage(''); setReading(true);
    try {
      if (file.size > ARTICLE_BACKUP_FILE_LIMIT) throw new Error('This backup file is too large.');
      const value = parseArticleBackup(await file.text());
      if (token !== request.current) return;
      if (serializeArticleBackup(latest.current) !== base) throw new Error('The article changed while opening the backup. Choose the file again.');
      setPending({ article: value, base });
    } catch (error) { if (token === request.current) setMessage(error.message); }
    finally { if (token === request.current) setReading(false); }
  };
  const replace = () => {
    if (disabled || recoveryPending) return;
    if (serializeArticleBackup(latest.current) !== pending.base) {
      setPending(null); setMessage('The article changed. Choose the backup again before replacing it.'); return;
    }
    onChange(pending.article); setPending(null); setMessage('Backup applied. Check the save status below.');
  };
  return <details className="text-backup-controls text-settings-wide">
    <summary>Article backup</summary>
    <p>Save a file of this article, including edits waiting to be saved. Artwork links are included; image files and Display connections are not.</p>
    <button type="button" onClick={download}>Download article backup</button>
    <label>Open article backup<input aria-label="Open article backup" type="file" accept=".json,application/json" disabled={disabled || recoveryPending}
      onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) void read(file); }} /></label>
    {reading && <p role="status">Opening backup…</p>}
    {pending && <div className="text-backup-preview">
      <p>Replace this article’s text and appearance with “{pending.article.title || 'Untitled article'}”? Its Display connection and publication setting stay in place.</p>
      <button type="button" disabled={disabled || recoveryPending} onClick={replace}>Replace article with backup</button>
      <button type="button" onClick={() => { request.current++; setPending(null); setMessage(''); }}>Cancel backup</button>
    </div>}
    {recoveryPending && <p>Retry saving your edits before replacing this article.</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}
