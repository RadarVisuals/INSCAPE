import { useCallback, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PROFILE_DOCUMENT_PUBLICATION_STATUS } from '../../profileDocument/domain/profileDocumentPublication.js';
import { profileDocumentV9ContentFingerprint } from '../../profileDocument/domain/profileDocumentV9Serialization.js';
import { assertValidProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Validation.js';
import { useProfileDocumentPublication } from '../../profileDocument/state/useProfileDocumentPublication.js';
import { uploadProfileDocument } from '../../profileDocument/storage/profileDocumentUploadClient.js';
import AlphaSupportPanel from '../../support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from '../../support/alphaSupport.js';
import { createOwnerLatticePublicationContext } from '../ownerLatticePublicationContext.js';
import { buildOwnerSystemWorkflowPublicationDocument } from '../ownerSystemWorkflowPreviewDocument.js';
import '../ownerLatticePublicationRack.css';

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
  menuSurface,
  onClose,
  onMotionComplete,
  onPublished,
  onSnapshotChange,
  profile,
  profileAddress,
  publishedResolution,
  phase,
  systemWorkflowDraft,
}) {
  const [snapshot, setSnapshot] = useState(() => initialSnapshot ? assertValidProfileDocumentV9(initialSnapshot) : null);
  const [message, setMessage] = useState('Ready to publish your current public presentation.');
  const [operationPhase, setOperationPhase] = useState(null);
  const [supportIssue, setSupportIssue] = useState(null);
  const snapshotRef = useRef(snapshot);
  const snapshotDraftFingerprintRef = useRef(null);
  const snapshotGenerationRef = useRef(0);
  const cidRef = useRef('');
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
  const stale = Boolean(snapshotRef.current
    && snapshotDraftFingerprintRef.current !== draftFingerprint);

  const getPublicationContext = useCallback(() => createOwnerLatticePublicationContext({
    cid: cidRef.current,
    cidGeneration: cidGenerationRef.current,
    draftFingerprint,
    draftGeneration: draftGenerationRef.current.generation,
    getWalletPublicationContext,
    profileAddress,
    snapshot: snapshotRef.current,
    snapshotDraftFingerprint: snapshotDraftFingerprintRef.current,
    snapshotGeneration: snapshotGenerationRef.current,
  }), [draftFingerprint, getWalletPublicationContext, profileAddress]);
  const publication = useProfileDocumentPublication(
    getPublicationContext,
    `${draftGenerationRef.current.generation}:${snapshotGenerationRef.current}:${cidGenerationRef.current}:${stale}`,
  );
  const publicationBusy = ['VERIFYING_CID', 'AWAITING_WALLET', 'CONFIRMING_TRANSACTION', 'VERIFYING_PUBLICATION']
    .includes(publication.status);
  const busy = ['PREPARING', 'UPLOADING', 'WALLET'].includes(operationPhase) || publicationBusy;

  const prepareSnapshot = useCallback(() => {
    try {
      setSupportIssue(null);
      setOperationPhase('PREPARING');
      if (!draftFingerprint) throw new Error(draftState.error || 'The public System Workflow is not ready');
      const previous = snapshot || publishedDocument(publishedResolution, profileAddress);
      const next = buildOwnerSystemWorkflowPublicationDocument({
        ...builderInput,
        exportedAt: new Date(),
        previousDocument: previous,
      });
      snapshotRef.current = next;
      snapshotDraftFingerprintRef.current = draftFingerprint;
      snapshotGenerationRef.current += 1;
      setSnapshot(next);
      onSnapshotChange?.({ document: next, draftFingerprint });
      cidGenerationRef.current += 1;
      cidRef.current = '';
      publication.invalidate('A new snapshot was prepared; verify its CID before publication.');
      setOperationPhase('PREPARED');
      setMessage('Your current public presentation is ready to be made public.');
    } catch (error) {
      const nextMessage = error?.message || 'The publication snapshot could not be prepared.';
      setMessage(nextMessage);
      setSupportIssue({ code: ALPHA_SUPPORT_CODES.PREVIEW_VALIDATION_FAILED,
        phase: 'PUBLICATION_SNAPSHOT', providerCategory: 'LOCAL_VALIDATION', message: nextMessage });
      setOperationPhase(null);
    }
  }, [builderInput, draftFingerprint, draftState.error, onSnapshotChange, profileAddress, publication, publishedResolution, snapshot]);

  const uploadSnapshot = useCallback(async () => {
    try {
      setSupportIssue(null);
      if (!snapshot) throw new Error('Prepare a snapshot before uploading.');
      if (stale) throw new Error('The System Workflow changed; prepare a new snapshot.');
      setOperationPhase('UPLOADING');
      setMessage('Making your public presentation available…');
      const uploaded = await uploadProfileDocument(snapshot);
      cidGenerationRef.current += 1;
      cidRef.current = uploaded.cid;
      const verified = await publication.verifyCid(snapshot, uploaded.cid, { stale: false });
      setOperationPhase(verified ? 'VERIFIED' : null);
      setMessage(verified ? 'Everything is verified. Publish it to your profile when you are ready.'
        : 'The public presentation could not be verified.');
    } catch (error) {
      const nextMessage = error?.message || 'The publication upload failed.';
      setMessage(nextMessage);
      setSupportIssue({ code: ALPHA_SUPPORT_CODES.IPFS_UPLOAD_FAILED,
        phase: 'IPFS_UPLOAD', providerCategory: 'PUBLICATION_FUNCTION', message: nextMessage });
      setOperationPhase(null);
    }
  }, [publication, snapshot, stale]);

  const publish = useCallback(async () => {
    setSupportIssue(null);
    setOperationPhase('WALLET');
    setMessage('Confirm the publication request in your wallet.');
    const confirmed = await publication.publish();
    if (!confirmed?.result?.document) {
      setMessage('Publication was not confirmed.');
      setOperationPhase(null);
      return;
    }
    setOperationPhase('PUBLISHED');
    setMessage('Your public presentation is live.');
    onPublished?.(confirmed.result);
  }, [onPublished, publication]);

  const verifiedReady = publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.CID_VERIFIED
    && Boolean(publication.verified);
  const action = !snapshot || stale ? prepareSnapshot : verifiedReady ? publish : uploadSnapshot;
  const buttonLabel = operationPhase === 'PREPARING' ? 'PREPARING…'
    : operationPhase === 'UPLOADING' ? 'MAKING PUBLIC…'
      : operationPhase === 'WALLET' ? 'CONFIRM IN WALLET…'
        : operationPhase === 'PUBLISHED' || publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.PUBLISHED
          ? 'PUBLISHED' : !snapshot || stale ? 'PREPARE PUBLICATION'
            : verifiedReady ? 'PUBLISH TO PROFILE' : 'MAKE PRESENTATION PUBLIC';
  const showSupport = Boolean(publication.error || supportIssue);

  return <aside aria-label="Publish profile" className="owner-lattice-publication-rack system-workflow__motion-panel system-workflow__token-scope"
    data-lattice-chrome data-lattice-menu-surface data-menu-surface={menuSurface} data-panel-phase={phase} onKeyDown={(event) => {
      if (event.key === 'Escape' && !busy) onClose?.();
    }} onTransitionEnd={(event) => {
      if (event.target === event.currentTarget && event.propertyName === 'opacity') onMotionComplete?.();
    }}>
    <section className="owner-lattice-publication-rack__summary">
      <h2>WHAT GOES LIVE</h2>
      <p>Only your <strong>Public Grids</strong>: their visible artwork, composition, crop and transforms.</p>
      <h2>WHAT STAYS PRIVATE</h2>
      <p>Private Grids, Library organisation, drafts, selections, edit history and local preferences stay in this browser.</p>
      <small>The NFTs already exist publicly on LUKSO. Publishing only updates how your INSCAPE profile presents them.</small>
    </section>
    {draftState.error && <section><p role="alert">{draftState.error}</p></section>}
    <section className="owner-lattice-publication-rack__status-copy">
      <p role="status">{publication.error || message}</p>
      <small>Making the presentation public stores it permanently. Publishing to your profile requires one wallet confirmation.</small>
    </section>
    {showSupport && <section className="owner-lattice-publication-rack__support">
      <details><summary>HELP WITH THIS ERROR</summary><AlphaSupportPanel compact
        code={publication.supportCode || supportIssue?.code || ALPHA_SUPPORT_CODES.ALPHA_SUPPORT_REQUEST}
        phase={publication.supportCode === ALPHA_SUPPORT_CODES.CID_VERIFICATION_FAILED
          ? 'CID_VERIFY' : supportIssue?.phase || 'PUBLICATION'}
        providerCategory={supportIssue?.providerCategory || (publication.supportCode ? 'LUKSO_PROVIDER' : undefined)}
        profileAddress={profileAddress} routeClass="OWNER" transactionHash={publication.transactionHash}
        message={publication.error || supportIssue?.message} /></details>
    </section>}
    <footer className="owner-lattice-publication-rack__rail">
      <button type="button" className="owner-lattice-publication-rack__publish"
        disabled={busy || Boolean(draftState.error) || Boolean(publication.transactionHash && publication.error)}
        onClick={action}>{buttonLabel}</button>
      <button type="button" aria-label="Close Publication" disabled={busy} onClick={onClose}><X aria-hidden="true" size={15} /></button>
    </footer>
  </aside>;
}
