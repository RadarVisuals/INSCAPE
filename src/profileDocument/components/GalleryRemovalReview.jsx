import { useLayoutEffect, useMemo, useRef } from 'react';
import OwnerSystemWorkflowPublicationRack from '../../public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx';
import { publishedCompositionEntries } from '../domain/publishedCanvases.js';
import { canonicalSerializeProfileDocumentV9 } from '../domain/profileDocumentV9Serialization.js';
import './publicUtilityPanel.css';

export default function GalleryRemovalReview({ removal, getWalletPublicationContext, onRetry, onPublished, onClose }) {
  const dialog = useRef(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  const request = useMemo(() => {
    const { document, ids } = removal;
    const selected = new Set(ids);
    const entries = publishedCompositionEntries(document, 'gallery').filter(entry => selected.has(entry.id))
      .map(entry => ({ id: entry.id, name: entry.name, keepOnProfile: entry.destinations.includes('profile') }));
    return { document, ids, entries,
      async verifyBaseline() {
        const latest = await onRetry();
        if (!dialog.current?.open) throw new Error('The Gallery review was closed.');
        if (latest?.status !== 'RESOLVED' || latest.busy || !latest.document)
          throw new Error('The latest Gallery could not be verified. Try again when it is available.');
        if (canonicalSerializeProfileDocumentV9(latest.document) !== canonicalSerializeProfileDocumentV9(document))
          throw new Error('Gallery has changed. Close this review and select the work again.');
      } };
  }, [removal, onRetry]);
  return <dialog ref={dialog} className="public-utility-panel system-workflow__token-scope"
    data-workflow-material="tactile" data-workflow-finish="flat" aria-label="Remove from Gallery"
    onCancel={event => event.preventDefault()}>
    <OwnerSystemWorkflowPublicationRack galleryRemoval={request} profileAddress={removal.document.profile.address}
      getWalletPublicationContext={getWalletPublicationContext} onClose={onClose} onPublished={(result, context) => {
        const listed = new Set(publishedCompositionEntries(result.document, 'gallery').map(entry => entry.id));
        const allRemoved = request.ids.every(id => !listed.has(id));
        onPublished(result, allRemoved ? { destination: 'gallery', removedTitles: request.entries.map(entry => entry.name) } : context);
      }} />
  </dialog>;
}
