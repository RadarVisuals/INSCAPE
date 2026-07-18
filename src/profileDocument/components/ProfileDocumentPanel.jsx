import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { countProfileDocumentAssets } from '../domain/profileDocumentBuilder.js';
import { createProfileDocumentFilename, formatProfileDocumentJson } from '../domain/profileDocumentSerialization.js';
import { parseProfileDocumentJson } from '../domain/profileDocumentValidation.js';
import { PROFILE_DOCUMENT_LIMITS } from '../domain/constants.js';

export default function ProfileDocumentPanel({ snapshot, imported, stale, error, activeProfileAddress, onBuild, onPreview, onImport, onRestore, onClose }) {
  const fileRef = useRef(null); const [message, setMessage] = useState('');
  const current = imported || snapshot;
  const exportSnapshot = () => {
    try {
      if (!snapshot) throw new Error('Build a snapshot before export');
      const json = formatProfileDocumentJson(snapshot); const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = createProfileDocumentFilename(snapshot); link.click(); URL.revokeObjectURL(url); setMessage('Export ready. This is a local document, not a publication.');
    } catch (error) { setMessage(error.message); }
  };
  const readImport = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { if (file.size > PROFILE_DOCUMENT_LIMITS.maxJsonBytes) throw new Error(`Document exceeds ${PROFILE_DOCUMENT_LIMITS.maxJsonBytes} bytes`); const value = parseProfileDocumentJson(await file.text()); onImport(value); setMessage(value.profile.address === activeProfileAddress ? 'Document valid.' : 'Document valid — belongs to another profile.'); }
    catch (error) { setMessage(error.errors?.map((item) => item.message).slice(0, 3).join(' · ') || error.message); }
  };
  return <aside className="profile-document-panel" role="dialog" aria-modal="false" aria-labelledby="profile-document-title">
    <header><div><span>Portable profile document</span><h2 id="profile-document-title">Share profile</h2></div><button type="button" onClick={onClose} aria-label="Close Share"><X aria-hidden="true" /></button></header>
    <div className="profile-document-panel__status"><span>{current ? 'DOCUMENT VALID' : 'LOCAL SNAPSHOT EMPTY'}</span><span>VERSION 1</span>{stale && <span>DRAFT CHANGED</span>}{imported && <span>IMPORTED DOCUMENT</span>}</div>
    {current ? <dl><div><dt>Profile</dt><dd>{current.profile.cachedIdentity.name || current.profile.address}</dd></div><div><dt>Revision</dt><dd>{current.revision}</dd></div><div><dt>Public spaces</dt><dd>{current.spaces.length}</dd></div><div><dt>Public asset references</dt><dd>{countProfileDocumentAssets(current)}</dd></div><div><dt>Keeper</dt><dd>{current.presentation.keeperId}</dd></div></dl> : <p>No public snapshot has been generated.</p>}
    <p className="profile-document-panel__hint">Private pinned spaces are excluded.</p>
    <div className="profile-document-panel__actions"><button type="button" onClick={onBuild}>{snapshot ? 'Rebuild snapshot' : 'Build snapshot'}</button><button type="button" disabled={!snapshot} onClick={() => onPreview('snapshot')}>Preview profile</button><button type="button" disabled={!snapshot || stale} onClick={exportSnapshot}>Export profile</button><button type="button" onClick={() => fileRef.current?.click()}>Import profile</button>{imported && <><button type="button" onClick={() => onPreview('imported')}>Preview import</button><button type="button" onClick={onRestore}>Restore presentation</button></>}</div>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={readImport} />
    {(message || error) && <p className="profile-document-panel__message" role="status">{message || error}</p>}
  </aside>;
}
