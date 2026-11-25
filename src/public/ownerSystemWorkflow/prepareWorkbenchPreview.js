import { ownerSystemWorkflowDecodedAsset } from './ownerSystemWorkflowAssetDimensions.js';
import { textRecoveries, TEXT_RECOVERY_MESSAGE } from '../../text/textEditRecovery.js';

async function projectCanvas({ current, draft, profileAddress, workbench, library, publicationProfile }) {
  const { records, decodedDimensions } = library;
  const { buildOwnerSystemWorkflowPreviewDocument } =
    await import('../ownerSystemWorkflowPreviewDocument.js');
  if (!current()) return null;
  const previewRecords = records.map(asset =>
    ownerSystemWorkflowDecodedAsset(
      asset,
      decodedDimensions.get(asset?.id)
    )
  );
  return buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: previewRecords,
    profile: publicationProfile,
    profileAddress,
    systemWorkflowDraft: draft,
    workbench,
  });
}

export default async function prepareWorkbenchPreview(input) {
  const { current, store, profileAddress, workbench, projectionError, composition, activeWork, publishedDocument } = input;
  if (!current()) return null;
  if (projectionError || !workbench) throw new Error(projectionError || 'The layout is not ready.');
  if (textRecoveries(store, profileAddress).length) throw new Error(TEXT_RECOVERY_MESSAGE);

  const [{ projectCompositionEditorDocument }, { publishedPresentationSnapshot }] = await Promise.all([
    import('../../composition/compositionEditorDocument.js'),
    import('../../presentation/presentationSources.js'),
  ]);
  if (!current()) return null;
  const draft = composition
    ? { profileAddress, composition: projectCompositionEditorDocument({ ...composition, workbench }) }
    : await projectCanvas(input);
  if (!current() || !draft) return null;
  if (textRecoveries(store, profileAddress).length) throw new Error(TEXT_RECOVERY_MESSAGE);

  const entry = { id: activeWork.id, name: activeWork.name, draft };
  const published = publishedDocument?.profile?.address === profileAddress ? publishedPresentationSnapshot(publishedDocument) : null;
  // Only this work is being previewed. Links to other works use their public versions.
  const snapshot = { kind: 'preview', profileAddress, revision: store.getGeneration(),
    entries: [...(published?.entries || []).filter(item => item.id !== entry.id), entry] };
  return { entry, snapshot };
}
