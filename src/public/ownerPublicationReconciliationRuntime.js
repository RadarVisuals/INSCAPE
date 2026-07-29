import { normalizeProfileAddress } from '../library/config.js';
import { reportControlledError } from '../diagnostics.js';

export function reportOwnerPublicationReconciliationError(error, report = reportControlledError) {
  report('owner-publication-reconciliation', error);
  for (const failure of Array.isArray(error?.compensationErrors) ? error.compensationErrors : []) {
    const stage = typeof failure?.name === 'string' && failure.name ? failure.name.slice(0, 80) : 'unknown compensation';
    const message = typeof failure?.error?.message === 'string' && failure.error.message
      ? failure.error.message
      : 'Compensation failed without an error message';
    report('owner-publication-reconciliation-compensation', new Error(`${stage}: ${message}`));
  }
}

export function createOwnerReconciliationRuntimeOperations({
  profileAddress,
  plan,
  nextPositions,
  nextSystemPresentation,
  current,
  adapters,
  workspaceRecordRef,
}) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || !plan || !current || !adapters || !workspaceRecordRef?.current) {
    throw new TypeError('Complete profile-scoped runtime reconciliation inputs are required');
  }
  const previous = {
    positions: structuredClone(current.positions),
    systemPresentation: structuredClone(current.systemPresentation),
    avatarShape: current.avatarShape,
    visitorNavigation: structuredClone(current.visitorNavigation),
    presentation: {
      keeperId: current.keeperId,
      stageId: current.stageId,
      environment: structuredClone(current.environment),
    },
  };
  const hadWorkspaceRecord = workspaceRecordRef.current.has(profile);
  const previousWorkspaceRecord = workspaceRecordRef.current.get(profile);
  return [
    { name: 'runtime positions', apply: () => adapters.setPositions(nextPositions), compensate: () => adapters.setPositions(previous.positions) },
    { name: 'runtime system presentation', apply: () => adapters.setSystemPresentation(nextSystemPresentation), compensate: () => adapters.setSystemPresentation(previous.systemPresentation) },
    { name: 'runtime avatar shape', apply: () => adapters.setAvatarShape(plan.avatarShape), compensate: () => adapters.setAvatarShape(previous.avatarShape) },
    { name: 'runtime visitor navigation', apply: () => adapters.setVisitorNavigation(plan.visitorNavigation), compensate: () => adapters.setVisitorNavigation(previous.visitorNavigation) },
    ...(adapters.onApplyRestoredPresentation ? [{
      name: 'runtime restored presentation',
      apply: () => adapters.onApplyRestoredPresentation({ keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment }),
      compensate: () => adapters.onApplyRestoredPresentation(previous.presentation),
    }] : []),
    {
      name: 'runtime workspace record',
      apply: () => workspaceRecordRef.current.set(profile, { presence: 'current', profileAddress: profile }),
      compensate: () => hadWorkspaceRecord
        ? workspaceRecordRef.current.set(profile, previousWorkspaceRecord)
        : workspaceRecordRef.current.delete(profile),
    },
  ];
}
