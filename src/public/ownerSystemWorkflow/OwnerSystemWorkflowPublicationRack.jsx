import { useCallback, useMemo, useRef, useState } from 'react';
import { PROFILE_DOCUMENT_PUBLICATION_STATUS } from '../../profileDocument/domain/profileDocumentPublication.js';
import {
  canonicalSerializeProfileDocumentV9,
  createProfileDocumentV9Filename,
  profileDocumentV9ContentFingerprint,
} from '../../profileDocument/domain/profileDocumentV9Serialization.js';
import { assertValidProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Validation.js';
import { useProfileDocumentPublication } from '../../profileDocument/state/useProfileDocumentPublication.js';
import { uploadProfileDocument } from '../../profileDocument/storage/profileDocumentUploadClient.js';
import AlphaSupportPanel from '../../support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from '../../support/alphaSupport.js';
import { createOwnerLatticePublicationContext } from '../ownerLatticePublicationContext.js';
import { buildOwnerSystemWorkflowPublicationDocument } from '../ownerSystemWorkflowPreviewDocument.js';
import '../ownerLatticePublicationRack.css';

function downloadCanonicalPublication(snapshot) {
  const blob = new Blob([canonicalSerializeProfileDocumentV9(snapshot)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = createProfileDocumentV9Filename(snapshot);
  link.click();
  URL.revokeObjectURL(url);
}

function publishedDocument(resolution, profileAddress) {
  if (!['RESOLVED', 'STALE'].includes(resolution?.status)) return null;
  try {
    const document = assertValidProfileDocumentV9(resolution.document);
    return document.profile.address === profileAddress ? document : null;
  } catch { return null; }
}

export default function OwnerSystemWorkflowPublicationRack({
  assetRecords,
  getWalletPublicationContext,
  initialSnapshot = null,
  onClose,
  onPublished,
  onSnapshotChange,
  profile,
  profileAddress,
  publishedResolution,
  systemWorkflowDraft,
}) {
  const [snapshot, setSnapshot] = useState(() => initialSnapshot ? assertValidProfileDocumentV9(initialSnapshot) : null);
  const [snapshotDraftFingerprint, setSnapshotDraftFingerprint] = useState(null);
  const [snapshotGeneration, setSnapshotGeneration] = useState(0);
  const [cid, setCid] = useState('');
  const [message, setMessage] = useState('Prepare a frozen public snapshot before uploading.');
  const [uploading, setUploading] = useState(false);
  const [supportIssue, setSupportIssue] = useState(null);
  const cidRef = useRef(cid);
  const cidGenerationRef = useRef(0);
  const draftGenerationRef = useRef({ fingerprint: null, generation: 0 });

  const builderInput = useMemo(() => ({ assetRecords, profile, profileAddress, systemWorkflowDraft }),
    [assetRecords, profile, profileAddress, systemWorkflowDraft]);
  const draftState = useMemo(() => {
    try {
      const candidate = buildOwnerSystemWorkflowPublicationDocument({ ...builderInput, exportedAt: new Date(0) });
      return { error: null, fingerprint: profileDocumentV9ContentFingerprint(candidate) };
    } catch (error) {
      return { error: error?.message || 'The public System Workflow cannot be projected', fingerprint: null };
    }
  }, [builderInput]);
  if (draftGenerationRef.current.fingerprint !== draftState.fingerprint) {
    draftGenerationRef.current = {
      fingerprint: draftState.fingerprint,
      generation: draftGenerationRef.current.generation + 1,
    };
  }
  const draftFingerprint = draftState.fingerprint;
  const stale = Boolean(snapshot && snapshotDraftFingerprint !== draftFingerprint);

  const getPublicationContext = useCallback(() => createOwnerLatticePublicationContext({
    cid: cidRef.current,
    cidGeneration: cidGenerationRef.current,
    draftFingerprint,
    draftGeneration: draftGenerationRef.current.generation,
    getWalletPublicationContext,
    profileAddress,
    snapshot,
    snapshotDraftFingerprint,
    snapshotGeneration,
  }), [draftFingerprint, getWalletPublicationContext, profileAddress, snapshot, snapshotDraftFingerprint, snapshotGeneration]);
  const publication = useProfileDocumentPublication(
    getPublicationContext,
    `${draftGenerationRef.current.generation}:${snapshotGeneration}:${cidGenerationRef.current}:${stale}`,
  );
  const publicationBusy = ['VERIFYING_CID', 'AWAITING_WALLET', 'CONFIRMING_TRANSACTION', 'VERIFYING_PUBLICATION']
    .includes(publication.status);

  const prepareSnapshot = useCallback(() => {
    try {
      setSupportIssue(null);
      if (!draftFingerprint) throw new Error(draftState.error || 'The public System Workflow is not ready');
      const previous = snapshot || publishedDocument(publishedResolution, profileAddress);
      const next = buildOwnerSystemWorkflowPublicationDocument({
        ...builderInput,
        exportedAt: new Date(),
        previousDocument: previous,
      });
      setSnapshot(next);
      setSnapshotDraftFingerprint(draftFingerprint);
      setSnapshotGeneration((generation) => generation + 1);
      onSnapshotChange?.({ document: next, draftFingerprint });
      cidGenerationRef.current += 1;
      cidRef.current = '';
      setCid('');
      publication.invalidate('A new snapshot was prepared; verify its CID before publication.');
      setMessage(`Version 9 revision ${next.revision} is frozen and ready for Public IPFS.`);
    } catch (error) {
      const nextMessage = error?.message || 'The publication snapshot could not be prepared.';
      setMessage(nextMessage);
      setSupportIssue({ code: ALPHA_SUPPORT_CODES.PREVIEW_VALIDATION_FAILED,
        phase: 'PUBLICATION_SNAPSHOT', providerCategory: 'LOCAL_VALIDATION', message: nextMessage });
    }
  }, [builderInput, draftFingerprint, draftState.error, onSnapshotChange, profileAddress, publication, publishedResolution, snapshot]);

  const uploadSnapshot = useCallback(async () => {
    try {
      setSupportIssue(null);
      if (!snapshot) throw new Error('Prepare a snapshot before uploading.');
      if (stale) throw new Error('The System Workflow changed; prepare a new snapshot.');
      setUploading(true);
      setMessage('Uploading canonical version 9 bytes to Public IPFS…');
      const uploaded = await uploadProfileDocument(snapshot);
      cidGenerationRef.current += 1;
      cidRef.current = uploaded.cid;
      setCid(uploaded.cid);
      setMessage('Upload complete. Verifying the exact pinned bytes…');
      const verified = await publication.verifyCid(snapshot, uploaded.cid, { stale: false });
      setMessage(verified ? 'CID verified. Wallet publication is ready.' : 'CID verification failed.');
    } catch (error) {
      const nextMessage = error?.message || 'The publication upload failed.';
      setMessage(nextMessage);
      setSupportIssue({ code: ALPHA_SUPPORT_CODES.IPFS_UPLOAD_FAILED,
        phase: 'IPFS_UPLOAD', providerCategory: 'PUBLICATION_FUNCTION', message: nextMessage });
    } finally { setUploading(false); }
  }, [publication, snapshot, stale]);

  const verifyCid = useCallback(async () => {
    if (!snapshot) return;
    setSupportIssue(null);
    setMessage('Verifying the exact pinned bytes…');
    const verified = await publication.verifyCid(snapshot, cid, { stale });
    setMessage(verified ? 'CID verified. Wallet publication is ready.' : 'CID verification failed.');
  }, [cid, publication, snapshot, stale]);

  const publish = useCallback(async () => {
    setSupportIssue(null);
    setMessage('Waiting for the verified owner wallet…');
    const confirmed = await publication.publish();
    if (!confirmed?.result?.document) {
      setMessage('Publication was not confirmed.');
      return;
    }
    setMessage(`Version 9 revision ${confirmed.result.document.revision} is published and verified.`);
    onPublished?.(confirmed.result);
  }, [onPublished, publication]);

  const verifiedReady = publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.CID_VERIFIED
    && Boolean(publication.verified);
  return <aside aria-label="Version 9 publication" className="owner-lattice-publication-rack"
    data-lattice-chrome onKeyDown={(event) => {
      if (event.key === 'Escape' && !publicationBusy && !uploading) onClose?.();
    }}>
    <header><div><span>PUBLICATION MODULE</span><strong>VERSION 9</strong></div>
      <button type="button" aria-label="Close Publication" disabled={publicationBusy || uploading} onClick={onClose}>×</button></header>
    <AlphaSupportPanel compact
      code={publication.supportCode || supportIssue?.code || ALPHA_SUPPORT_CODES.ALPHA_SUPPORT_REQUEST}
      phase={publication.supportCode === ALPHA_SUPPORT_CODES.CID_VERIFICATION_FAILED
        ? 'CID_VERIFY' : supportIssue?.phase || 'PUBLICATION'}
      providerCategory={supportIssue?.providerCategory || (publication.supportCode ? 'LUKSO_PROVIDER' : undefined)}
      profileAddress={profileAddress} routeClass="OWNER" transactionHash={publication.transactionHash}
      message={publication.error || supportIssue?.message} />
    <section><h2>PUBLIC SNAPSHOT</h2>
      <dl><div><dt>REVISION</dt><dd>{snapshot?.revision || '—'}</dd></div>
        <div><dt>STATE</dt><dd>{draftState.error ? 'BLOCKED' : stale ? 'STALE' : snapshot ? 'FROZEN' : 'READY'}</dd></div></dl>
      {draftState.error && <p role="alert">{draftState.error}</p>}
      <button type="button" disabled={publicationBusy || uploading || Boolean(draftState.error)} onClick={prepareSnapshot}>
        {snapshot ? 'UPDATE SNAPSHOT' : 'PREPARE SNAPSHOT'}
      </button>
    </section>
    <section><h2>PUBLIC IPFS</h2>
      <button type="button" disabled={!snapshot || stale || uploading || publicationBusy} onClick={uploadSnapshot}>
        {uploading ? 'UPLOADING…' : 'UPLOAD + VERIFY'}
      </button>
      <label htmlFor="owner-system-workflow-publication-cid">CID / MANUAL FALLBACK</label>
      <input id="owner-system-workflow-publication-cid" value={cid} autoComplete="off" spellCheck="false"
        onChange={(event) => {
          cidGenerationRef.current += 1;
          cidRef.current = event.target.value;
          setCid(event.target.value);
          publication.invalidate();
        }} />
      <div className="owner-lattice-publication-rack__pair">
        <button type="button" disabled={!snapshot || stale || !cid.trim() || uploading || publicationBusy} onClick={verifyCid}>VERIFY CID</button>
        <button type="button" disabled={!snapshot || stale} onClick={() => downloadCanonicalPublication(snapshot)}>DOWNLOAD</button>
      </div>
    </section>
    <section><h2>OWNER WALLET</h2>
      <button type="button" className="owner-lattice-publication-rack__publish" disabled={!verifiedReady || publicationBusy} onClick={publish}>
        {publication.transactionHash ? 'CONFIRM PUBLICATION' : 'PUBLISH VERSION 9'}
      </button>
      <span className="owner-lattice-publication-rack__status" data-state={publication.status}>{publication.status}</span>
      {publication.transactionHash && <code>{publication.transactionHash}</code>}
    </section>
    <footer><p role="status">{publication.error || message}</p><small>PUBLIC ONLY / EXACT BYTES / LUKSO MAINNET</small></footer>
  </aside>;
}
