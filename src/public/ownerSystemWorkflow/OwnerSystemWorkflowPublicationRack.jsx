import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WorkbenchDestinationPanel from './WorkbenchDestinationPanel.jsx';
import { PROFILE_DOCUMENT_PUBLICATION_STATUS } from '../../profileDocument/domain/profileDocumentPublication.js';
import { profileDocumentV9ContentFingerprint } from '../../profileDocument/domain/profileDocumentV9Serialization.js';
import { assertValidProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Validation.js';
import { useProfileDocumentPublication } from '../../profileDocument/state/useProfileDocumentPublication.js';
import { usePublicationRecovery } from '../../profileDocument/state/usePublicationRecovery.js';
import { uploadProfileDocument } from '../../profileDocument/storage/profileDocumentUploadClient.js';
import AlphaSupportPanel from '../../support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from '../../support/alphaSupport.js';
import { createOwnerLatticePublicationContext } from '../ownerLatticePublicationContext.js';
import { buildOwnerSystemWorkflowPublicationDocument } from '../ownerSystemWorkflowPreviewDocument.js';
import { canvasPublicationCandidates, canvasPublicationChanges, buildCanvasPublication } from '../../profileDocument/domain/canvasPublication.js';
import { isWorkbenchCollection, projectWorkbenchDraft } from '../../systemWorkflow/domain/workbenchCollection.js';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
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
  profile,
  profileAddress,
  publishedResolution,
  phase,
  systemWorkflowDraft,
  workbench,
  onSaveWorkbench,
  preparationError,
  store,
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
  const previous = useMemo(() => publishedDocument(publishedResolution, profileAddress), [publishedResolution, profileAddress]);
  const [selectedIds, setSelectedIds] = useState(() => [store?.getWorkbenchId()]);
  const [includeShared, setIncludeShared] = useState(false);
  const firstPublication = publishedResolution?.status === 'UNAVAILABLE';
  const publishShared = firstPublication || includeShared;
  const recordState = useMemo(() => {
    try { return { record: store?.getBackupSnapshot({ ...systemWorkflowDraft, ...(workbench ? { workbench } : {}) }) }; }
    catch (error) { return { error: error.message }; }
  }, [store, systemWorkflowDraft, workbench]);
  const record = recordState.record;
  const referenceIds = useMemo(() => {
    const drafts = isWorkbenchCollection(record) ? record.workbenches.map(item => projectWorkbenchDraft(record, item.id)) : record ? [record] : [];
    return [...new Set(drafts.flatMap(draft => [...draft.grids, ...(draft.displays || []).flatMap(item => item.grids)]
      .flatMap(grid => grid.placements.map(item => item.stableAssetId)).concat(draft.identityPresentation.avatar.stableAssetId,
        ...[draft.workbench?.display, ...(draft.workbench?.displays || [])].map(item => item?.shortcut?.icon?.stableAssetId))).filter(Boolean))];
  }, [record]);
  const browser = useOwnerLatticeBrowser(profileAddress, false, referenceIds);
  const candidates = useMemo(() => record ? canvasPublicationCandidates({ record, profile,
    assetRecords: [...(browser.records || []), ...(assetRecords || [])] }) : [], [record, profile, browser.records, assetRecords]);
  const changes = useMemo(() => canvasPublicationChanges(candidates, previous), [candidates, previous]);
  const selectedChanges = useMemo(() => selectedIds.filter(id => changes.some(item => item.id === id && item.changed)), [selectedIds, changes]);
  const collectionInput = useMemo(() => ({ candidates, selectedIds: selectedChanges, includeShared: publishShared, previousDocument: previous }),
    [candidates, selectedChanges, publishShared, previous]);

  const builderInput = useMemo(() => ({ assetRecords, profile, profileAddress, systemWorkflowDraft, workbench }),
    [assetRecords, profile, profileAddress, systemWorkflowDraft, workbench]);
  const draftState = useMemo(() => {
    try {
      if (preparationError) throw new Error(preparationError);
      if (recordState.error) throw new Error(recordState.error);
      if (store && !['RESOLVED', 'UNAVAILABLE'].includes(publishedResolution?.status)) throw new Error('Wait for the latest publication to be verified before preparing changes.');
      const candidate = store ? buildCanvasPublication({ ...collectionInput, exportedAt: previous?.exportedAt || new Date(0) })
        : buildOwnerSystemWorkflowPublicationDocument({ ...builderInput, exportedAt: new Date(0) });
      return { error: null, fingerprint: profileDocumentV9ContentFingerprint(candidate) };
    } catch (error) {
      return { error: error?.message || 'The public System Workflow cannot be projected', fingerprint: null };
    }
  }, [builderInput, preparationError, store, collectionInput, publishedResolution?.status, previous, recordState.error]);
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
  const uploadContextRef = useRef(getPublicationContext);
  uploadContextRef.current = getPublicationContext;
  const uploadControllerRef = useRef(null);
  useEffect(() => () => uploadControllerRef.current?.abort(), []);
  const publication = useProfileDocumentPublication(
    getPublicationContext,
    `${draftGenerationRef.current.generation}:${snapshotGenerationRef.current}:${cidGenerationRef.current}:${stale}`,
  );
  const publicationBusy = ['VERIFYING_CID', 'AWAITING_WALLET', 'CONFIRMING_TRANSACTION', 'VERIFYING_PUBLICATION']
    .includes(publication.status);
  const busy = ['PREPARING', 'CHECKING_ACCESS', 'AUTHORIZING', 'UPLOADING', 'WALLET'].includes(operationPhase) || publicationBusy;
  const recovery = usePublicationRecovery(profileAddress, publication.status, busy);

  const prepareSnapshot = useCallback(() => {
    try {
      setSupportIssue(null);
      setOperationPhase('PREPARING');
      if (!draftFingerprint) throw new Error(draftState.error || 'The public System Workflow is not ready');
      const next = store ? buildCanvasPublication(collectionInput) : buildOwnerSystemWorkflowPublicationDocument({
        ...builderInput,
        exportedAt: new Date(),
        previousDocument: snapshot || previous,
      });
      if (onSaveWorkbench && !onSaveWorkbench(next.workbench)) throw new Error('The Workbench setup could not be saved.');
      snapshotRef.current = next;
      snapshotDraftFingerprintRef.current = draftFingerprint;
      snapshotGenerationRef.current += 1;
      setSnapshot(next);
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
  }, [builderInput, draftFingerprint, draftState.error, onSaveWorkbench, publication, previous, snapshot, store, collectionInput]);

  const uploadSnapshot = useCallback(async () => {
    if (uploadControllerRef.current) return;
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    try {
      setSupportIssue(null);
      if (!snapshot) throw new Error('Prepare a snapshot before uploading.');
      if (stale) throw new Error('The System Workflow changed; prepare a new snapshot.');
      setOperationPhase('CHECKING_ACCESS');
      setMessage('Checking upload access…');
      const uploaded = await uploadProfileDocument(snapshot, {
        getContext: () => uploadContextRef.current(), signal: controller.signal,
        onPhase: phase => {
          setOperationPhase(phase);
          setMessage(phase === 'AUTHORIZING' ? 'Confirm upload access in your wallet. This signature authorizes only this presentation.' : 'Making your public presentation available…');
        },
      });
      cidGenerationRef.current += 1;
      cidRef.current = uploaded.cid;
      const verified = await publication.verifyCid(snapshot, uploaded.cid, { stale: false });
      setOperationPhase(verified ? 'VERIFIED' : null);
      setMessage(verified ? 'Everything is verified. Publish it to your profile when you are ready.'
        : 'The public presentation could not be verified.');
    } catch (error) {
      if (controller.signal.aborted) return;
      const nextMessage = error?.message || 'The publication upload failed.';
      setMessage(nextMessage);
      setSupportIssue({ code: ALPHA_SUPPORT_CODES.IPFS_UPLOAD_FAILED,
        phase: 'IPFS_UPLOAD', providerCategory: 'PUBLICATION_FUNCTION', message: nextMessage });
      setOperationPhase(null);
    } finally {
      if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
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
    onPublished?.({ ...confirmed.result, transactionHash: confirmed.receipt?.transactionHash || confirmed.transactionHash });
  }, [onPublished, publication]);

  const verifiedReady = publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.CID_VERIFIED
    && Boolean(publication.verified);
  const progressMessage = publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.CONFIRMING_TRANSACTION
    ? 'Transaction submitted. Waiting for confirmation…'
    : publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_PUBLICATION
      ? 'Transaction confirmed. Checking your public presentation…' : message;
  const action = !snapshot || stale ? prepareSnapshot : verifiedReady ? publish : uploadSnapshot;
  const buttonLabel = operationPhase === 'PREPARING' ? 'Preparing…'
    : operationPhase === 'CHECKING_ACCESS' ? 'Checking access…'
      : operationPhase === 'AUTHORIZING' ? 'Authorize upload…'
    : operationPhase === 'UPLOADING' ? 'Making public…'
      : operationPhase === 'WALLET' ? publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.CONFIRMING_TRANSACTION
        ? 'Confirming transaction…' : publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_PUBLICATION
          ? 'Checking publication…' : 'Confirm in wallet…'
        : operationPhase === 'PUBLISHED' || publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.PUBLISHED
          ? 'Published' : !snapshot || stale ? 'Prepare publication'
            : verifiedReady ? 'Publish to profile' : 'Make presentation public';
  const showSupport = Boolean(publication.error || supportIssue);

  return <WorkbenchDestinationPanel title="Publish" onClose={onClose} closeLabel="Close Publication" closeDisabled={busy}
    aria-label="Publish profile" className="owner-lattice-publication-rack"
    data-lattice-chrome data-lattice-menu-surface data-menu-surface={menuSurface} data-panel-phase={phase} onKeyDown={(event) => {
      if (event.key === 'Escape' && !busy) onClose?.();
    }} onTransitionEnd={(event) => {
      if (event.target === event.currentTarget && event.propertyName === 'opacity') onMotionComplete?.();
    }}>
    <div className="workbench-destination-body">
    {store && <section className="owner-lattice-publication-rack__summary">
      <h3>Choose canvases</h3>
      <p>Only checked changes go live. Other canvases keep their published version.</p>
      <fieldset disabled={busy || operationPhase === 'PUBLISHED'}><legend>Publication scope</legend>
        {changes.map(item => <label key={item.id} style={{ display: 'block', marginBlock: 12 }}>
          <input type="checkbox" checked={selectedChanges.includes(item.id)} disabled={!item.changed}
            onChange={event => setSelectedIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />{' '}
          {item.name} — {item.first ? 'First publication' : item.changed ? 'Update' : 'No changes'}
          {item.error && <small>{item.error}</small>}
        </label>)}
        <button type="button" onClick={() => setSelectedIds(changes.filter(item => item.changed).map(item => item.id))}>Select all changed canvases</button>
        <label style={{ display: 'block', marginBlock: 12 }}><input type="checkbox" checked={publishShared} disabled={firstPublication}
          onChange={event => setIncludeShared(event.target.checked)} />{' '}Profile details, Reception and shared Keeper{firstPublication ? ' · required for first publication' : ''}</label>
      </fieldset>
      <p role="status">Selected: {changes.filter(item => selectedChanges.includes(item.id)).map(item => item.name).join(', ') || 'No canvases'}{publishShared ? ' · profile details included' : ''}</p>
    </section>}
    <section className="owner-lattice-publication-rack__summary">
      <h3>What goes live</h3>
      <p>Your public Images, Text and Shapes, <strong>Public Grids</strong>, Keeper content, custom Identity card and prepared Workbench setup: window positions, starting open state, Display name and shortcut.</p>
      <h3>What stays private</h3>
      <p>Private Grids, Library organisation, Layers tools, Activity, selections and local preferences stay private.</p>
      <small>The NFTs already exist publicly on LUKSO. Publishing only updates how your INSCAPE profile presents them.</small>
    </section>
    {draftState.error && <section><p role="alert">{draftState.error}</p></section>}
    {!busy && recovery.blocked && <section className="owner-lattice-publication-rack__recovery">
      <h3>Previous publication</h3>
      <p role="status">{recovery.message}</p>
      {recovery.record?.transactionHash && <small className="owner-lattice-publication-rack__hash">Transaction: {recovery.record.transactionHash}</small>}
      <div className="owner-lattice-publication-rack__rail">
        {['PUBLISHED', 'FAILED'].includes(recovery.status)
          ? <button type="button" className="workbench-destination-action" onClick={() => {
            const acknowledged = recovery.acknowledge();
            if (!acknowledged) return;
            publication.reset();
            setOperationPhase(null);
            setMessage(recovery.message);
            if (acknowledged.result) onPublished?.({ ...acknowledged.result, transactionHash: recovery.record?.transactionHash });
          }}>ACKNOWLEDGE RESULT</button>
          : <button type="button" className="workbench-destination-action" disabled={recovery.status === 'CHECKING'} onClick={recovery.check}>CHECK AGAIN</button>}
      </div>
    </section>}
    <section className="owner-lattice-publication-rack__status-copy">
      <p role="status">{!busy && recovery.blocked ? 'Resolve the previous publication before preparing another one.' : publication.error || progressMessage}</p>
      <small>Making the presentation public stores it permanently. Upload access requires a wallet signature; publishing to your profile then requires a transaction confirmation.</small>
    </section>
    {showSupport && <section className="owner-lattice-publication-rack__support">
      <details><summary>Help with this error</summary><AlphaSupportPanel compact
        code={publication.supportCode || supportIssue?.code || ALPHA_SUPPORT_CODES.ALPHA_SUPPORT_REQUEST}
        phase={publication.supportCode === ALPHA_SUPPORT_CODES.CID_VERIFICATION_FAILED
          ? 'CID_VERIFY' : supportIssue?.phase || 'PUBLICATION'}
        providerCategory={supportIssue?.providerCategory || (publication.supportCode ? 'LUKSO_PROVIDER' : undefined)}
        profileAddress={profileAddress} routeClass="OWNER" transactionHash={publication.transactionHash}
        message={publication.error || supportIssue?.message} /></details>
    </section>}
    </div>
    <footer className="owner-lattice-publication-rack__rail">
      <button type="button" className="owner-lattice-publication-rack__publish workbench-destination-action"
        disabled={busy || operationPhase === 'PUBLISHED' || recovery.blocked || Boolean(draftState.error) || Boolean(publication.transactionHash && publication.error)}
        onClick={action}>{buttonLabel}</button>
    </footer>
  </WorkbenchDestinationPanel>;
}
