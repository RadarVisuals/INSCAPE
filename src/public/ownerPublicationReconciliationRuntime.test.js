import assert from 'node:assert/strict';
import test from 'node:test';
import { executeOwnerPublicationReconciliationTransaction } from '../profileDocument/domain/ownerPublicationReconciliation.js';
import { createOwnerReconciliationRuntimeOperations, reportOwnerPublicationReconciliationError } from './ownerPublicationReconciliationRuntime.js';

const PROFILE = '0x1111111111111111111111111111111111111111';

test('hook runtime operations restore every prior runtime value when presentation application fails', () => {
  const runtime = {
    positions: { old: { column: 1 } },
    systemPresentation: { old: { startOpen: false } },
    avatarShape: 'square',
    visitorNavigation: { mode: 'old' },
    presentation: { keeperId: 'old-keeper', stageId: 'old-stage', environment: { type: 'old' } },
  };
  const workspaceRecordRef = { current: new Map([[PROFILE, { presence: 'absent' }]]) };
  let presentationAttempts = 0;
  const runtimeOperations = createOwnerReconciliationRuntimeOperations({
    profileAddress: PROFILE,
    plan: {
      avatarShape: 'circle', visitorNavigation: { mode: 'new' },
      keeperId: 'new-keeper', stageId: 'new-stage', environment: { type: 'new' },
    },
    nextPositions: { next: { column: 2 } },
    nextSystemPresentation: { next: { startOpen: true } },
    current: {
      positions: runtime.positions, systemPresentation: runtime.systemPresentation,
      avatarShape: runtime.avatarShape, visitorNavigation: runtime.visitorNavigation,
      keeperId: runtime.presentation.keeperId, stageId: runtime.presentation.stageId,
      environment: runtime.presentation.environment,
    },
    adapters: {
      setPositions: (value) => { runtime.positions = value; },
      setSystemPresentation: (value) => { runtime.systemPresentation = value; },
      setAvatarShape: (value) => { runtime.avatarShape = value; },
      setVisitorNavigation: (value) => { runtime.visitorNavigation = value; },
      onApplyRestoredPresentation: (value) => {
        presentationAttempts += 1;
        runtime.presentation = value;
        if (presentationAttempts === 1) throw new Error('observable runtime failure');
      },
    },
    workspaceRecordRef,
  });

  assert.throws(() => executeOwnerPublicationReconciliationTransaction({
    profileAddress: PROFILE,
    baselineOperation: { apply: () => true, compensate: () => true },
    runtimeOperations,
  }), /observable runtime failure/);
  assert.deepEqual(runtime, {
    positions: { old: { column: 1 } },
    systemPresentation: { old: { startOpen: false } },
    avatarShape: 'square',
    visitorNavigation: { mode: 'old' },
    presentation: { keeperId: 'old-keeper', stageId: 'old-stage', environment: { type: 'old' } },
  });
  assert.deepEqual(workspaceRecordRef.current.get(PROFILE), { presence: 'absent' });
});

test('hook reconciliation reporting emits the parent and every collected compensation failure', () => {
  const reports = [];
  const parent = Object.assign(new Error('baseline write failed'), {
    compensationErrors: [
      { name: 'runtime presentation', error: new Error('runtime restore failed') },
      { name: 'canonical lattice', error: new Error('profile changed') },
      { name: 'Library workspace', error: new Error('workspace restore failed') },
    ],
  });
  reportOwnerPublicationReconciliationError(parent, (code, error) => reports.push({ code, message: error.message }));
  assert.deepEqual(reports, [
    { code: 'owner-publication-reconciliation', message: 'baseline write failed' },
    { code: 'owner-publication-reconciliation-compensation', message: 'runtime presentation: runtime restore failed' },
    { code: 'owner-publication-reconciliation-compensation', message: 'canonical lattice: profile changed' },
    { code: 'owner-publication-reconciliation-compensation', message: 'Library workspace: workspace restore failed' },
  ]);
});
