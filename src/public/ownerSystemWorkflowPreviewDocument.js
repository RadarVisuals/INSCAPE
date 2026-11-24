import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';

export function buildOwnerSystemWorkflowPreviewDocument({
  assetRecords,
  createdAt = 0,
  exportedAt = createdAt,
  profile,
  profileAddress,
  revision = 1,
  systemWorkflowDraft,
  workbench,
}) {
  return buildProfileDocumentV9({
    assetRecords,
    createdAt,
    exportedAt,
    profileAddress,
    profileIdentity: profile,
    revision,
    systemWorkflowDraft,
    workbench,
  });
}

export function buildOwnerSystemWorkflowPublicationDocument({ previousDocument = null, ...input }) {
  const previous = previousDocument === null ? null : assertValidProfileDocumentV9(previousDocument);
  if (previous && previous.profile.address !== input.profileAddress) {
    throw new TypeError('The previous publication belongs to a different profile');
  }
  const exportedAt = input.exportedAt ?? new Date();
  return buildOwnerSystemWorkflowPreviewDocument({
    ...input,
    createdAt: previous?.createdAt ?? exportedAt,
    exportedAt,
    revision: previous ? previous.revision + 1 : 1,
  });
}
