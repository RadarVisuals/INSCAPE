import { useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { countProfileDocumentAssets } from '../domain/profileDocumentBuilder.js';
import { canonicalSerializeProfileDocument, createProfileDocumentFilename, createProfileDocumentPublicationFilename, formatProfileDocumentJson } from '../domain/profileDocumentSerialization.js';
import { parseProfileDocumentJson } from '../domain/profileDocumentValidation.js';
import { PROFILE_DOCUMENT_LIMITS, PROFILE_DOCUMENT_VERSION } from '../domain/constants.js';
import { PROFILE_DOCUMENT_PUBLICATION_STATUS } from '../domain/profileDocumentPublication.js';
import { useProfileDocumentPublication } from '../state/useProfileDocumentPublication.js';
import { uploadProfileDocument } from '../storage/profileDocumentUploadClient.js';

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export default function ProfileDocumentPanel({ draft, snapshot, imported, stale, error, activeProfileAddress, getPublicationContext,
  draftSaveStatus = 'saving', onBuild, onPreview, onImport, onRestore, onPublished, onClose }) {
  const fileRef = useRef(null); const [message, setMessage] = useState(''); const [cid, setCid] = useState('');
  const [uploading, setUploading] = useState(false);
  const cidRef = useRef(cid); const cidGenerationRef = useRef(0);
  const livePublicationContext = useCallback(() => ({ ...getPublicationContext(), cidInput: cidRef.current,
    cidGeneration: cidGenerationRef.current }), [getPublicationContext]);
  const publication = useProfileDocumentPublication(livePublicationContext, `${cidGenerationRef.current}:${stale}`);
  const current = imported || draft || snapshot;
  const publicationBusy = ['VERIFYING_CID', 'AWAITING_WALLET', 'CONFIRMING_TRANSACTION', 'VERIFYING_PUBLICATION'].includes(publication.status);
  const exportSnapshot = () => {
    try {
      if (!snapshot) throw new Error('Build a snapshot before export');
      downloadText(formatProfileDocumentJson(snapshot), createProfileDocumentFilename(snapshot)); setMessage('Export ready. This is a local document, not a publication.');
    } catch (error) { setMessage(error.message); }
  };
  const downloadPublication = () => {
    try {
      if (!snapshot) throw new Error('Build a snapshot before publication');
      if (stale) throw new Error('Rebuild the stale snapshot before publication');
      downloadText(canonicalSerializeProfileDocument(snapshot), createProfileDocumentPublicationFilename(snapshot));
      setMessage('Canonical publication file ready. Upload this exact file unchanged to Pinata Public IPFS.');
    } catch (error) { setMessage(error.message); }
  };
  const uploadPublication = async () => {
    try {
      if (!snapshot) throw new Error('Build a snapshot before publication');
      if (stale) throw new Error('Rebuild the stale snapshot before publication');
      setUploading(true); setMessage('Uploading canonical publication to Public IPFS...');
      const uploaded = await uploadProfileDocument(snapshot);
      cidGenerationRef.current += 1; cidRef.current = uploaded.cid; setCid(uploaded.cid);
      setMessage('Publication uploaded. Verifying the pinned bytes before wallet publication...');
      const verified = await publication.verifyCid(snapshot, uploaded.cid, { stale });
      setMessage(verified ? 'Public IPFS upload verified. Wallet publication is ready.' : 'Upload completed, but gateway verification is not ready yet. Use Verify CID to retry.');
    } catch (error) { setMessage(error.message); }
    finally { setUploading(false); }
  };
  const publishPublication = async () => {
    const confirmed = await publication.publish();
    if (!confirmed?.result?.document) return;
    onPublished?.(confirmed.result);
    setMessage('Publication confirmed and restored as this profile\'s canonical owner baseline.');
  };
  const readImport = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { if (file.size > PROFILE_DOCUMENT_LIMITS.maxJsonBytes) throw new Error(`Document exceeds ${PROFILE_DOCUMENT_LIMITS.maxJsonBytes} bytes`); const value = parseProfileDocumentJson(await file.text()); onImport(value); setMessage(value.profile.address === activeProfileAddress ? 'Document valid.' : 'Document valid — belongs to another profile.'); }
    catch (error) { setMessage(error.errors?.map((item) => item.message).slice(0, 3).join(' · ') || error.message); }
  };
  return <aside className="profile-document-panel" role="dialog" aria-modal="false" aria-labelledby="profile-document-title">
    <header><div><span>Portable profile document</span><h2 id="profile-document-title">Share profile</h2></div><button type="button" onClick={onClose} aria-label="Close Share"><X aria-hidden="true" /></button></header>
    <div className="profile-document-panel__status"><span data-state={draftSaveStatus}>{draftSaveStatus === 'saved' ? 'SAVED DRAFT' : draftSaveStatus === 'error' ? 'SAVE FAILED' : 'SAVING DRAFT'}</span><span>VERSION {current?.version || PROFILE_DOCUMENT_VERSION}</span>{stale && <span>UNPUBLISHED CHANGES</span>}{snapshot && !stale && <span>PUBLICATION SNAPSHOT READY</span>}{!snapshot && <span>NOT YET PREPARED</span>}{imported && <span>IMPORTED DOCUMENT</span>}</div>
    {current ? <dl><div><dt>Profile</dt><dd>{current.profile.cachedIdentity.name || current.profile.address}</dd></div><div><dt>Revision</dt><dd>{current.revision}</dd></div><div><dt>Public spaces</dt><dd>{current.spaces.length}</dd></div><div><dt>Public asset references</dt><dd>{countProfileDocumentAssets(current)}</dd></div><div><dt>Keeper</dt><dd>{current.presentation.keeperId}</dd></div></dl> : <p>No saved draft is available.</p>}
    <p className="profile-document-panel__hint">Private spaces and canvas artwork are excluded.</p>
    <div className="profile-document-panel__actions"><button type="button" onClick={() => onPreview('draft')}>Preview current draft</button><button type="button" onClick={onBuild}>{snapshot ? 'Update publication snapshot' : 'Prepare publication snapshot'}</button><button type="button" disabled={!snapshot || stale} onClick={exportSnapshot}>Export profile</button><button type="button" onClick={() => fileRef.current?.click()}>Import profile</button>{imported && <><button type="button" onClick={() => onPreview('imported')}>Preview import</button><button type="button" onClick={onRestore}>Restore presentation</button></>}</div>
    <section className="profile-document-panel__publication" aria-labelledby="profile-publication-title">
      <h3 id="profile-publication-title">Public IPFS publication</h3>
      <p>Upload the prepared snapshot to Public IPFS, verify its exact bytes, then authorize the on-chain pointer with your wallet.</p>
      <button type="button" disabled={!snapshot || stale || uploading || publicationBusy} onClick={uploadPublication}>{uploading ? 'Uploading to Public IPFS...' : 'Upload publication to Public IPFS'}</button>
      <button type="button" disabled={!snapshot || stale || uploading || publicationBusy} onClick={downloadPublication}>Download canonical file (manual fallback)</button>
      <label htmlFor="profile-publication-cid">Public IPFS CID</label>
      <input id="profile-publication-cid" value={cid} onChange={(event) => { cidGenerationRef.current += 1; cidRef.current = event.target.value; publication.invalidate('The CID changed; re-verification is required'); setCid(event.target.value); }} placeholder="CID or ipfs://CID" autoComplete="off" spellCheck="false" />
      <div className="profile-document-panel__actions">
        <button type="button" disabled={!snapshot || stale || !cid.trim() || uploading || publicationBusy} onClick={() => publication.verifyCid(snapshot, cid, { stale })}>Verify CID</button>
        <button type="button" disabled={!publication.verified || (!publication.transactionHash && (publication.status !== PROFILE_DOCUMENT_PUBLICATION_STATUS.CID_VERIFIED && publication.status !== PROFILE_DOCUMENT_PUBLICATION_STATUS.ERROR)) || ['AWAITING_WALLET','CONFIRMING_TRANSACTION','VERIFYING_PUBLICATION'].includes(publication.status)} onClick={publishPublication}>{publication.transactionHash ? 'Retry publication confirmation' : 'Request wallet publication'}</button>
      </div>
      <p className="profile-document-panel__publication-state" data-state={publication.status}>Publication: {publication.status}</p>
      {publication.transactionHash && <p className="profile-document-panel__hash">Transaction: {publication.transactionHash}</p>}
      {publication.error && <p className="profile-document-panel__message" role="alert">{publication.error}</p>}
    </section>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={readImport} />
    {(message || error) && <p className="profile-document-panel__message" role="status">{message || error}</p>}
  </aside>;
}
