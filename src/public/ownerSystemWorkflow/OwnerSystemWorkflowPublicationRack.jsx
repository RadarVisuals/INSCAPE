import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import WorkbenchDestinationPanel from './WorkbenchDestinationPanel.jsx';
import { PROFILE_DOCUMENT_PUBLICATION_STATUS } from '../../profileDocument/domain/profileDocumentPublication.js';
import { profileDocumentV9ContentFingerprint } from '../../profileDocument/domain/profileDocumentV9Serialization.js';
import { assertValidProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Validation.js';
import { useProfileDocumentPublication } from '../../profileDocument/state/useProfileDocumentPublication.js';
import { usePublicationRecovery } from '../../profileDocument/state/usePublicationRecovery.js';
import { uploadProfileDocument } from '../../profileDocument/storage/profileDocumentUploadClient.js';
import AlphaSupportPanel from '../../support/AlphaSupportPanel.jsx';
import { publicationUploadIssue } from '../../support/publicationUploadIssue.js';
import { ALPHA_SUPPORT_CODES } from '../../support/alphaSupport.js';
import { createOwnerLatticePublicationContext } from '../ownerLatticePublicationContext.js';
import { buildOwnerSystemWorkflowPublicationDocument } from '../ownerSystemWorkflowPreviewDocument.js';
import { canvasPublicationCandidates, canvasPublicationChanges, buildCanvasPublication, buildGalleryRemoval, canReplaceInvalidPublication, resolvePublicationBaseline } from '../../profileDocument/domain/canvasPublication.js';
import { publicationDestinations, publicationViewDestination } from '../../profileDocument/domain/publishedCanvases.js';
import { isWorkbenchCollection, projectWorkbenchDraft } from '../../systemWorkflow/domain/workbenchCollection.js';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
import '../ownerLatticePublicationRack.css';

export default function OwnerSystemWorkflowPublicationRack({ galleryRemoval, ...props }) {
  if (galleryRemoval) {
    return <GalleryRemovalPublication key={props.profileAddress + ':' + galleryRemoval.ids.join(',') + ':' + galleryRemoval.document.revision}
      galleryRemoval={galleryRemoval} {...props} />;
  }
  return <StudioPublication {...props} />;
}

function GalleryRemovalPublication({ galleryRemoval, ...props }) {
  const { document, ids, entries } = galleryRemoval;
  const buildSnapshot = useCallback((exportedAt = document.exportedAt) => {
    if (document.profile.address !== props.profileAddress) throw new Error('This publication belongs to a different profile.');
    return buildGalleryRemoval(document, ids, exportedAt);
  }, [document, ids, props.profileAddress]);
  return <PublicationDelivery {...props} galleryRemoval={galleryRemoval} buildSnapshot={buildSnapshot}>
    {() => <section className="owner-lattice-publication-rack__summary">
      <p>{entries.length === 1 ? 'This work will be removed from Gallery.' : `${entries.length} works will be removed from Gallery in one publication.`}</p>
      <ul aria-label="Selected works" className="gallery-removal-selection">{entries.map(entry =>
        <li key={entry.id}><strong>{entry.name}</strong> <span>{entry.keepOnProfile ? 'Stays on Profile' : 'Leaves the current publication'}</span></li>)}</ul>
      <p>Any existing local Studio drafts stay on this device.</p>
    </section>}
  </PublicationDelivery>;
}

function StudioPublication({ assetRecords, profile, profileAddress, publishedResolution, systemWorkflowDraft, workbench,
  preparationError, store, ...delivery }) {
  const [replacementConsent, setReplacementConsent] = useState(null);
  const replacementAvailable = canReplaceInvalidPublication(publishedResolution, profileAddress);
  const replaceInvalid = replacementAvailable && replacementConsent === publishedResolution;
  const baseline = useMemo(() => {
    try { return { document: resolvePublicationBaseline(publishedResolution, profileAddress, { replaceInvalid }) }; }
    catch (error) { return { document: null, error: error.message }; }
  }, [publishedResolution, profileAddress, replaceInvalid]);
  const previous = baseline.document;
  const [chosenIds, setChosenIds] = useState(null);
  const selectedIds = useMemo(() => chosenIds ?? (replacementAvailable ? [] : [store?.getWorkbenchId()]),
    [chosenIds, replacementAvailable, store]);
  const [placements, setPlacements] = useState({});
  const [includeShared, setIncludeShared] = useState(false);
  const firstPublication = publishedResolution?.status === 'UNAVAILABLE';
  const sharedRequired = firstPublication || replacementAvailable;
  const publishShared = sharedRequired || includeShared;
  const noSavedReplacement = replacementAvailable && store?.getRecordState().status === 'absent';
  const recordState = useMemo(() => {
    if (noSavedReplacement) return { error: 'This device has no saved compositions for this profile. Open Studio on the device with your drafts, or restore a Studio backup here.' };
    try { return { record: store?.getBackupSnapshot({ ...systemWorkflowDraft, ...(workbench ? { workbench } : {}) }) }; }
    catch (error) { return { error: error.message }; }
  }, [store, systemWorkflowDraft, workbench, noSavedReplacement]);
  const record = recordState.record;
  const referenceIds = useMemo(() => {
    const drafts = isWorkbenchCollection(record) ? record.workbenches.map(item => projectWorkbenchDraft(record, item.id)) : record ? [record] : [];
    return [...new Set(drafts.map(draft => draft.identityPresentation.avatar.stableAssetId).filter(Boolean))];
  }, [record]);
  const browser = useOwnerLatticeBrowser(profileAddress, false, referenceIds);
  // The reference reader covers other canvases; the current canvas supplies
  // its refined records. Both can contain the same NFT. Reconcile that overlap
  // here, before the document builder validates one record per identity.
  const publicationAssets = useMemo(() => new Map([
    ...(browser.records || []), ...(assetRecords || []),
  ].map(asset => [asset.id, asset])), [browser.records, assetRecords]);
  const candidates = useMemo(() => record ? canvasPublicationCandidates({ record, profile,
    assetRecords: publicationAssets }) : [], [record, profile, publicationAssets]);
  const changes = useMemo(() => canvasPublicationChanges(candidates, previous, placements), [candidates, previous, placements]);
  const selectedChanges = useMemo(() => selectedIds.filter(id => changes.some(item => item.id === id && item.changed)), [selectedIds, changes]);
  const collectionInput = useMemo(() => ({ candidates, selectedIds: selectedChanges, placements, includeShared: publishShared, previousDocument: previous }),
    [candidates, selectedChanges, placements, publishShared, previous]);

  const changeDestination = (item, destination, checked) => {
    const destinations = publicationDestinations.filter(target => target === destination ? checked : item.destinations.includes(target));
    setPlacements(current => ({ ...current, [item.id]: destinations }));
    setChosenIds(selectedIds.includes(item.id) ? selectedIds : [...selectedIds, item.id]);
  };

  const builderInput = useMemo(() => ({ assetRecords: publicationAssets, profile, profileAddress, systemWorkflowDraft, workbench }),
    [publicationAssets, profile, profileAddress, systemWorkflowDraft, workbench]);
  const buildSnapshot = useCallback((exportedAt = previous?.exportedAt || new Date(0), prepared) => {
    if (preparationError) throw new Error(preparationError);
    if (recordState.error) throw new Error(recordState.error);
    if (store && baseline.error) throw new Error(baseline.error);
    return store ? buildCanvasPublication({ ...collectionInput, exportedAt })
      : buildOwnerSystemWorkflowPublicationDocument({ ...builderInput, exportedAt, previousDocument: prepared || previous });
  }, [builderInput, preparationError, store, collectionInput, baseline.error, previous, recordState.error]);
  return <PublicationDelivery {...delivery} profileAddress={profileAddress} buildSnapshot={buildSnapshot} selectedIds={store ? selectedChanges : undefined}>
    {disabled => <>
      {store && replacementAvailable && <section className="owner-lattice-publication-rack__summary">
        <h3>Replace invalid publication</h3>
        <p>The published document cannot be opened. You can publish a replacement from your local work.
          The replacement includes only the compositions you select below, your local profile details and shared Keeper. Works missing from this list cannot be recovered from the invalid publication.</p>
        <label><input type="checkbox" checked={replaceInvalid} disabled={disabled || noSavedReplacement}
          onChange={event => setReplacementConsent(event.target.checked ? publishedResolution : null)} />{' '}
          Replace the invalid publication with my selected local content</label>
      </section>}
      {store && !noSavedReplacement && <section className="owner-lattice-publication-rack__summary">
        <h3>Compositions</h3>
        <fieldset disabled={disabled}><legend>Publication scope</legend>
          {changes.map(item => <div className="publication-work" role="group" aria-label={item.name} key={item.id}>
            <label><input type="checkbox" checked={selectedChanges.includes(item.id)} disabled={!item.changed}
              onChange={event => setChosenIds(event.target.checked ? [...selectedIds, item.id] : selectedIds.filter(id => id !== item.id))} />{' '}
              {item.name} · {item.first ? 'First publication' : item.changed ? 'Update' : 'Published'}</label>
            <div className="publication-destinations">{publicationDestinations.map(destination =>
              <label key={destination}><input type="checkbox" checked={item.destinations.includes(destination)}
                onChange={event => changeDestination(item, destination, event.target.checked)} />
                {destination === 'gallery' ? 'Gallery' : 'Profile'}</label>)}</div>
            {item.error && <small>{item.error}</small>}
          </div>)}
          <button type="button" onClick={() => setChosenIds(changes.filter(item => item.changed).map(item => item.id))}>Select all changed compositions</button>
          <label className="publication-shared"><input type="checkbox" checked={publishShared} disabled={sharedRequired}
            onChange={event => setIncludeShared(event.target.checked)} />{' '}Profile details and shared Keeper{sharedRequired ? ' (required)' : ''}</label>
        </fieldset>
        <p role="status">Selected: {changes.filter(item => selectedChanges.includes(item.id)).map(item => item.name).join(', ') || 'No compositions'}{publishShared ? ' · profile details included' : ''}</p>
      </section>}
      <section className="owner-lattice-publication-rack__summary">
        <h3>What goes live</h3>
        <p>Your public images, text and shapes, composition layout, Keeper content and custom identity card.</p>
        <h3>What stays private</h3>
        <p>Private layers, Library organisation, Layers tools, Activity, selections and local preferences stay private.</p>
        <small>The NFTs already exist publicly on LUKSO. Publishing only updates how your INSCAPE profile presents them.</small>
      </section>
    </>}
  </PublicationDelivery>;
}

function PublicationDelivery({ initialSnapshot = null, galleryRemoval, getWalletPublicationContext, profileAddress,
  onClose, onMotionComplete, onPublished, onSaveWorkbench, phase, buildSnapshot, selectedIds, children }) {
  const [snapshot, setSnapshot] = useState(() => initialSnapshot ? assertValidProfileDocumentV9(initialSnapshot) : null);
  const [message, setMessage] = useState(galleryRemoval ? 'Prepare this change before making it public.' : 'Ready to publish your current public presentation.');
  const [operationPhase, setOperationPhase] = useState(null);
  const [supportIssue, setSupportIssue] = useState(null);
  const snapshotRef = useRef(snapshot);
  const snapshotDraftFingerprintRef = useRef(null);
  const snapshotGenerationRef = useRef(0);
  const cidRef = useRef('');
  const cidGenerationRef = useRef(0);
  const draftGenerationRef = useRef({ fingerprint: null, generation: 0 });
  const draftState = useMemo(() => {
    try {
      return { error: null, fingerprint: profileDocumentV9ContentFingerprint(buildSnapshot()) };
    } catch (error) {
      return { error: error?.message || 'The public presentation could not be prepared.', fingerprint: null };
    }
  }, [buildSnapshot]);
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
  const mounted = useRef(false);
  const publishing = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; uploadControllerRef.current?.abort(); };
  }, []);
  const publication = useProfileDocumentPublication(
    getPublicationContext,
    `${draftGenerationRef.current.generation}:${snapshotGenerationRef.current}:${cidGenerationRef.current}:${stale}`,
  );
  const publicationBusy = ['VERIFYING_CID', 'AWAITING_WALLET', 'CONFIRMING_TRANSACTION', 'VERIFYING_PUBLICATION']
    .includes(publication.status);
  const busy = ['PREPARING', 'CHECKING_ACCESS', 'AUTHORIZING', 'UPLOADING', 'VERIFYING_CID', 'BASELINE', 'WALLET'].includes(operationPhase) || publicationBusy;
  const recovery = usePublicationRecovery(profileAddress, publication.status, busy);

  const prepareSnapshot = useCallback(() => {
    try {
      setSupportIssue(null);
      setOperationPhase('PREPARING');
      if (!draftFingerprint) throw new Error(draftState.error || 'The public System Workflow is not ready');
      const next = buildSnapshot(new Date(), snapshot);
      if (!galleryRemoval && onSaveWorkbench && !onSaveWorkbench(next.workbench)) throw new Error('The Workbench setup could not be saved.');
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
        phase: 'PUBLICATION_SNAPSHOT', providerCategory: 'LOCAL_VALIDATION' });
      setOperationPhase(null);
    }
  }, [buildSnapshot, draftFingerprint, draftState.error, galleryRemoval, onSaveWorkbench, publication, snapshot]);

  const uploadSnapshot = useCallback(async () => {
    if (uploadControllerRef.current) return;
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    let uploadPhase = 'CHECKING_ACCESS';
    try {
      setSupportIssue(null);
      if (!snapshot) throw new Error('Prepare a snapshot before uploading.');
      if (stale) throw new Error('The System Workflow changed; prepare a new snapshot.');
      if (!cidRef.current) {
        setOperationPhase('CHECKING_ACCESS');
        setMessage('Checking upload access.');
        const uploaded = await uploadProfileDocument(snapshot, {
          getContext: () => uploadContextRef.current(), signal: controller.signal,
          onPhase: phase => {
            if (controller.signal.aborted) return;
            uploadPhase = phase;
            setOperationPhase(phase);
            setMessage(phase === 'AUTHORIZING' ? 'Confirm upload access in your wallet. This signature authorizes only this presentation.' : 'Making your public presentation available…');
          },
        });
        if (controller.signal.aborted) return;
        cidGenerationRef.current += 1;
        cidRef.current = uploaded.cid;
      }
      setOperationPhase('VERIFYING_CID');
      setMessage('Checking the uploaded presentation.');
      const verified = await publication.verifyCid(snapshot, cidRef.current, { stale: false });
      if (controller.signal.aborted) return;
      setOperationPhase(verified ? 'VERIFIED' : null);
      setMessage(verified ? 'Everything is verified. Publish it to your profile when you are ready.'
        : 'The public presentation could not be verified.');
    } catch (error) {
      if (controller.signal.aborted) return;
      const issue = publicationUploadIssue(error, uploadPhase);
      setMessage(issue.message);
      setSupportIssue(issue);
      setOperationPhase(null);
    } finally {
      if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
    }
  }, [publication, snapshot, stale]);

  const publish = useCallback(async () => {
    if (publishing.current || uploadControllerRef.current) return;
    publishing.current = true;
    setSupportIssue(null);
    try {
      if (galleryRemoval) {
        setOperationPhase('BASELINE');
        setMessage('Checking the latest Gallery publication.');
        await galleryRemoval.verifyBaseline();
        if (!mounted.current) return;
      }
      setOperationPhase('WALLET');
      setMessage('Confirm the publication request in your wallet.');
      const confirmed = await publication.publish();
      // Studio delivers the original submitter's verified receipt even after
      // switching workspaces. A closed Gallery review no longer owns its UI.
      if (galleryRemoval && !mounted.current) return;
      if (!confirmed?.result?.document) {
        setMessage('Publication was not confirmed.');
        setOperationPhase(null);
        return;
      }
      setOperationPhase('PUBLISHED');
      setMessage('Your public presentation is live.');
      onPublished?.({ ...confirmed.result, transactionHash: confirmed.receipt?.transactionHash || confirmed.transactionHash },
        { destination: publicationViewDestination(confirmed.result.document, selectedIds) });
    } catch (error) {
      if (!mounted.current) return;
      setMessage(error?.message || 'The latest publication could not be verified. Try again.');
      setOperationPhase(null);
    } finally {
      publishing.current = false;
    }
  }, [galleryRemoval, onPublished, publication, selectedIds]);

  const verifiedReady = Boolean(publication.verified) && !publication.transactionHash;
  const rejectedSnapshot = !stale && supportIssue?.code === 'INVALID_PROFILE_DOCUMENT';
  const progressMessage = publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.CONFIRMING_TRANSACTION
    ? 'Transaction submitted. Waiting for confirmation…'
    : publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_PUBLICATION
      ? 'Transaction confirmed. Checking your public presentation…' : message;
  const action = !snapshot || stale ? prepareSnapshot : verifiedReady ? publish : uploadSnapshot;
  const buttonLabel = operationPhase === 'BASELINE' ? 'Checking publication.'
    : operationPhase === 'PREPARING' ? 'Preparing…'
    : operationPhase === 'CHECKING_ACCESS' ? 'Checking access…'
      : operationPhase === 'AUTHORIZING' ? 'Authorize upload…'
    : operationPhase === 'UPLOADING' ? 'Making public…'
    : operationPhase === 'VERIFYING_CID' ? 'Checking uploaded presentation.'
      : operationPhase === 'WALLET' ? publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.CONFIRMING_TRANSACTION
        ? 'Confirming transaction…' : publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.VERIFYING_PUBLICATION
          ? 'Checking publication…' : 'Confirm in wallet…'
        : operationPhase === 'PUBLISHED' || publication.status === PROFILE_DOCUMENT_PUBLICATION_STATUS.PUBLISHED
          ? 'Published' : !snapshot || stale ? 'Prepare publication'
            : rejectedSnapshot ? 'Presentation rejected' : verifiedReady ? 'Publish to profile'
              : cidRef.current ? 'Check uploaded presentation again'
                : supportIssue?.code === 'PUBLICATION_SERVICE_UPDATE_REQUIRED' ? 'Check upload service again' : 'Make presentation public';
  const showSupport = Boolean(publication.error || supportIssue);

  const statusMessage = !busy && recovery.blocked ? 'Resolve the previous publication before preparing another one.'
    : supportIssue ? message : publication.error || (draftState.error ? null : progressMessage);
  const close = () => {
    if (!busy && !publishing.current && !uploadControllerRef.current) onClose?.();
  };
  return <WorkbenchDestinationPanel title={galleryRemoval ? 'Remove from Gallery' : 'Publish'} onClose={close}
    closeLabel={galleryRemoval ? 'Close removal' : 'Close Publication'} closeDisabled={busy} aria-busy={busy}
    aria-label={galleryRemoval ? 'Remove from Gallery' : 'Publish profile'} className="owner-lattice-publication-rack"
    data-lattice-chrome data-lattice-menu-surface data-panel-phase={phase} onKeyDown={event => {
      if (event.key !== 'Escape') return;
      if (galleryRemoval) { event.preventDefault(); event.stopPropagation(); }
      close();
    }} onTransitionEnd={(event) => {
      if (event.target === event.currentTarget && event.propertyName === 'opacity') onMotionComplete?.();
    }}>
    <div className="workbench-destination-body">
    {children(busy || operationPhase === 'PUBLISHED')}
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
            if (acknowledged.result) onPublished?.({ ...acknowledged.result, transactionHash: recovery.record?.transactionHash },
              { destination: publicationViewDestination(acknowledged.result.document) });
          }}>ACKNOWLEDGE RESULT</button>
          : <button type="button" className="workbench-destination-action" disabled={recovery.status === 'CHECKING'} onClick={recovery.check}>CHECK AGAIN</button>}
      </div>
    </section>}
    <section className="owner-lattice-publication-rack__status-copy">
      {statusMessage && <p role="status">{statusMessage}</p>}
      <small>Making the presentation public stores it permanently. Upload access requires a wallet signature; publishing to your profile then requires a transaction confirmation.</small>
    </section>
    {showSupport && <section className="owner-lattice-publication-rack__support">
      <details><summary>Help with this error</summary><AlphaSupportPanel compact
        code={supportIssue?.code || publication.supportCode || ALPHA_SUPPORT_CODES.ALPHA_SUPPORT_REQUEST}
        phase={supportIssue?.phase || (publication.supportCode === ALPHA_SUPPORT_CODES.CID_VERIFICATION_FAILED
          ? 'CID_VERIFY' : 'PUBLICATION')}
        providerCategory={supportIssue?.providerCategory || (publication.supportCode ? 'LUKSO_PROVIDER' : undefined)}
        profileAddress={profileAddress} routeClass="OWNER" transactionHash={publication.transactionHash}
         /></details>
    </section>}
    </div>
    <footer className="owner-lattice-publication-rack__rail">
      {galleryRemoval && <button type="button" className="workbench-destination-action" disabled={busy} onClick={close}>Cancel</button>}
      <button type="button" className="owner-lattice-publication-rack__publish workbench-destination-action"
        disabled={busy || rejectedSnapshot || operationPhase === 'PUBLISHED' || recovery.blocked || Boolean(draftState.error) || Boolean(publication.transactionHash && publication.error)}
        onClick={action}>{buttonLabel}</button>
    </footer>
  </WorkbenchDestinationPanel>;
}
