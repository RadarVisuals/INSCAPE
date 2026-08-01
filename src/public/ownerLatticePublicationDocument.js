import { normalizeProfileAddress } from '../library/config.js';
import { buildProfileDocumentV8 } from '../profileDocument/domain/profileDocumentBuilder.js';
import { assertValidProfileDocument } from '../profileDocument/domain/profileDocumentValidation.js';

function timestampMilliseconds(value, label) {
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be a valid timestamp`);
  return milliseconds;
}

function previousPublicationState(previousDocument, profileAddress) {
  if (previousDocument == null) return null;
  if (normalizeProfileAddress(previousDocument?.profile?.address) !== profileAddress) {
    throw new TypeError('The previous publication must match the lattice profile authority');
  }
  if (!Number.isSafeInteger(previousDocument.revision) || previousDocument.revision < 1) {
    throw new TypeError('The previous publication revision is invalid');
  }
  const createdAt = timestampMilliseconds(previousDocument.createdAt, 'Previous publication creation time');
  const exportedAt = timestampMilliseconds(previousDocument.exportedAt, 'Previous publication export time');
  if (createdAt > exportedAt) throw new TypeError('The previous publication timestamps are invalid');
  return Object.freeze({ createdAt, exportedAt, revision: previousDocument.revision });
}

/**
 * Builds one frozen publication candidate from canonical owner state.
 *
 * This is deliberately separate from the deterministic Preview document. It
 * performs no storage, upload, wallet, provider, or publication operation.
 */
export function buildOwnerLatticePublicationDocument({
  activeActorId,
  assetRecords,
  avatarShape = 'square',
  environment,
  exportedAt = new Date(),
  latticeDraft,
  previousDocument = null,
  profile,
  profileAddress,
  signalSettings,
  stageId,
  visitorNavigation,
}) {
  const address = normalizeProfileAddress(profileAddress);
  if (!address || latticeDraft?.profileAddress !== address) {
    throw new TypeError('The lattice draft must match the publication profile authority');
  }
  const previous = previousPublicationState(previousDocument, address);
  const requestedExport = timestampMilliseconds(exportedAt, 'Publication export time');
  const exportMilliseconds = previous
    ? Math.max(requestedExport, previous.exportedAt + 1)
    : requestedExport;
  const createdMilliseconds = previous?.createdAt ?? exportMilliseconds;
  const document = buildProfileDocumentV8({
    assets: assetRecords || [],
    createdAt: createdMilliseconds,
    exportedAt: exportMilliseconds,
    latticeDraft,
    profileAddress: address,
    profileIdentity: profile,
    publicPresentation: {
      avatarShape,
      environment,
      keeperId: activeActorId,
      stageId,
      visitorNavigation,
    },
    revision: (previous?.revision || 0) + 1,
    signalSettings,
  });
  return assertValidProfileDocument(document);
}
