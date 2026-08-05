import { useCallback, useMemo, useRef, useState } from 'react';
import { publicationContentFingerprint } from '../profileDocument/domain/profileDocumentPublication.js';
import { canonicalSerializeProfileDocument, createProfileDocumentPublicationFilename } from '../profileDocument/domain/profileDocumentSerialization.js';
import { PROFILE_DOCUMENT_PUBLICATION_STATUS } from '../profileDocument/domain/profileDocumentPublication.js';
import { useProfileDocumentPublication } from '../profileDocument/state/useProfileDocumentPublication.js';
import { uploadProfileDocument } from '../profileDocument/storage/profileDocumentUploadClient.js';
import { buildOwnerLatticePublicationDocument } from './ownerLatticePublicationDocument.js';
import { createOwnerLatticePublicationContext } from './ownerLatticePublicationContext.js';
import AlphaSupportPanel from '../support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from '../support/alphaSupport.js';
import './ownerLatticePublicationRack.css';

function downloadCanonicalPublication(snapshot) {
  const blob = new Blob([canonicalSerializeProfileDocument(snapshot)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = createProfileDocumentPublicationFilename(snapshot);
  link.click();
  URL.revokeObjectURL(url);
}

function publishedDocument(resolution, profileAddress) {
  const document = ['RESOLVED', 'STALE'].includes(resolution?.status) ? resolution.document : null;
  return String(document?.profile?.address || '').toLowerCase() === profileAddress ? document : null;
}

export default function OwnerLatticePublicationRack({
  activeActorId,
  assetRecords,
  avatarShape,
  environment,
  getWalletPublicationContext,
  latticeDraft,
  onClose,
  onPublished,
  profile,
  profileAddress,
  publishedResolution,
  signalSettings,
  stageId,
  visitorNavigation,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotDraftFingerprint, setSnapshotDraftFingerprint] = useState(null);
  const [snapshotGeneration, setSnapshotGeneration] = useState(0);
  const [cid, setCid] = useState('');
  const [message, setMessage] = useState('Prepare a frozen public snapshot before uploading.');
  const [uploading, setUploading] = useState(false);
  const [supportIssue, setSupportIssue] = useState(null);
  const cidRef = useRef(cid);
  const cidGenerationRef = useRef(0);
  const draftGenerationRef = useRef({ fingerprint: null, generation: 0 });

  const builderInput = useMemo(() => ({
    activeActorId,
    assetRecords,
    avatarShape,
    environment,
    latticeDraft,
    profile,
    profileAddress,
    signalSettings,
    stageId,
    visitorNavigation,
  }), [activeActorId, assetRecords, avatarShape, environment, latticeDraft, profile, profileAddress,
    signalSettings, stageId, visitorNavigation]);
  const draftState = useMemo(() => {
    try {
      const candidate = buildOwnerLatticePublicationDocument({
        ...builderInput,
        exportedAt: new Date(0),
      });
      return { error: null, fingerprint: publicationContentFingerprint(candidate) };
    } catch (error) {
      return { error: error?.message || 'The public lattice cannot be projected', fingerprint: null };
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
      if (!draftFingerprint) throw new Error(draftState.error || 'The public lattice is not ready');
      const previous = snapshot || publishedDocument(publishedResolution, profileAddress);
      const next = buildOwnerLatticePublicationDocument({
        ...builderInput,
        exportedAt: new Date(),
        previousDocument: previous,
      });
      setSnapshot(next);
      setSnapshotDraftFingerprint(draftFingerprint);
      setSnapshotGeneration((generation) => generation + 1);
      cidGenerationRef.current += 1;
      cidRef.current = '';
      setCid('');
      publication.invalidate('A new snapshot was prepared; verify its CID before publication.');
      setMessage(`Version 8 revision ${next.revision} is frozen and ready for Public IPFS.`);
    } catch (error) {
      const nextMessage = error?.message || 'The publication snapshot could not be prepared.';
      setMessage(nextMessage);
      setSupportIssue({ code: ALPHA_SUPPORT_CODES.PREVIEW_VALIDATION_FAILED,
        phase: 'PUBLICATION_SNAPSHOT', providerCategory: 'LOCAL_VALIDATION', message: nextMessage });
    }
  }, [builderInput, draftFingerprint, draftState.error, profileAddress, publication, publishedResolution, snapshot]);

  const uploadSnapshot = useCallback(async () => {
    try {
      setSupportIssue(null);
      if (!snapshot) throw new Error('Prepare a snapshot before uploading.');
      if (stale) throw new Error('The owner lattice changed; prepare a new snapshot.');
      setUploading(true);
      setMessage('Uploading canonical version 8 bytes to Public IPFS…');
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
    } finally {
      setUploading(false);
    }
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
    setMessage(`Version 8 revision ${confirmed.result.document.revision} is published and verified.`);
    onPublished?.(confirmed.result);
  }, [onPublished, publication]);

  const verifiedReady = publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.CID_VERIFIED
    && Boolean(publication.verified);
  return <aside
    aria-label="Version 8 publication"
    className="owner-lattice-publication-rack"
    data-lattice-chrome
    onKeyDown={(event) => { if (event.key === 'Escape' && !publicationBusy && !uploading) onClose?.(); }}
  >
    <header><div><span>PUBLICATION MODULE</span><strong>VERSION 8</strong></div>
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
      <label htmlFor="owner-lattice-publication-cid">CID / MANUAL FALLBACK</label>
      <input id="owner-lattice-publication-cid" value={cid} autoComplete="off" spellCheck="false"
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
        {publication.transactionHash ? 'CONFIRM PUBLICATION' : 'PUBLISH VERSION 8'}
      </button>
      <span className="owner-lattice-publication-rack__status" data-state={publication.status}>{publication.status}</span>
      {publication.transactionHash && <code>{publication.transactionHash}</code>}
    </section>
    <footer><p role="status">{publication.error || message}</p><small>PUBLIC ONLY / EXACT BYTES / LUKSO MAINNET</small></footer>
  </aside>;
}
