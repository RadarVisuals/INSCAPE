// @ts-check
import { keccak256, stringToHex } from 'viem';
import { currentStudioDraft } from './domain/studioComposition.js';
import { FIRST_WORKBENCH_ID, currentLocalDraft, isWorkbenchCollection, assertValidWorkbenchCollection,
  projectWorkbenchDraft, replaceWorkbenchDraft } from './domain/workbenchCollection.js';
import { validateSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';

/** @typedef {import('../contracts/workbench.js').WorkflowDraft} WorkflowDraft */
/** @typedef {import('../contracts/workbench.js').WorkbenchCollection} WorkbenchCollection */
/** @typedef {import('../contracts/workbench.js').WorkbenchId} WorkbenchId */
/** @typedef {import('../contracts/workbench.js').RecordState} RecordState */
/** @typedef {{draft: WorkflowDraft | null, record?: WorkbenchCollection, raw?: string | null, state: RecordState}} LoadedDraft */

export const SYSTEM_WORKFLOW_RECORD_STATUS = Object.freeze({
  ABSENT: 'absent',
  VALID: 'valid',
  CORRUPT: 'corrupt',
  UNAVAILABLE: 'unavailable',
});

/** @param {unknown} candidate @param {string} profileAddress @returns {{value: WorkflowDraft | null, errors: {path: string, code: string, message?: string}[]}} */
export function validateStoredDraft(candidate, profileAddress) {
  const validation = validateSystemWorkflowDraft(candidate);
  if (!validation.valid) return validation;
  return validation.value.profileAddress === profileAddress ? validation : {
    value: null, errors: [{ path: 'profileAddress', code: 'profile_mismatch' }],
  };
}

/**
 * Decode one saved record. Only the local editor can supply a matching layout
 * for older flat drafts. Backups carry their own authored geometry.
 * @param {string} raw
 * @param {string} profile normalized profile address
 * @param {(draft: WorkflowDraft, id: WorkbenchId) => unknown} [readLayout]
 * @returns {LoadedDraft}
 */
export function readWorkbenchRecord(raw, profile, readLayout) {
  /** @param {WorkflowDraft} draft @param {WorkbenchId} id */
  const adopt = (draft, id) => {
    const layout = !draft.composition && !Array.isArray(draft.cells) ? readLayout?.(draft, id) : undefined;
    return currentStudioDraft(currentLocalDraft(draft), layout);
  };
  let reason = 'invalid_json';
  /** @type {RecordState['issues']} */ let issues = [];
  try {
    const candidate = JSON.parse(raw);
    reason = 'validation_failed';
    if (isWorkbenchCollection(candidate)) {
      let record = assertValidWorkbenchCollection(candidate);
      for (const item of record.workbenches) record = replaceWorkbenchDraft(record, item.id, adopt(projectWorkbenchDraft(candidate, item.id), item.id));
      record = assertValidWorkbenchCollection(record);
      if (record.profileAddress !== profile) throw new Error('Profile mismatch');
      return { raw, record, draft: projectWorkbenchDraft(record),
        state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID }) };
    }
    // The removed Identity subtitle may exist in drafts written by the editor.
    // Discard only that obsolete property; all remaining data is still validated.
    const card = candidate?.identityPresentation?.card;
    if (card?.version === 1 && typeof card.subtitle === 'string' && card.subtitle.length <= 160) {
      delete card.subtitle;
    }
    const validation = validateStoredDraft(adopt(candidate, FIRST_WORKBENCH_ID), profile);
    const draft = validation.value;
    issues = validation.errors.slice(0, 5).map(({ path, code, message }) => ({ path, code, message }));
    if (draft) return {
      raw,
      draft,
      state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID }),
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'STUDIO_LAYOUT_UNAVAILABLE') return { raw, draft: null,
      state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE, reason: 'layout_read_failed', issues: [{ path: 'workbench', code: error.code, message: error.message }] }) };
    if (error instanceof Error && 'code' in error && error.code === 'STUDIO_DOCUMENT_CONFLICT') issues = [{ path: '$', code: error.code, message: error.message }];
    // Corruption is represented below without exposing the stored bytes.
  }
  return {
    raw,
    draft: null,
    state: Object.freeze({
      status: SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT,
      reason,
      issues,
      fingerprint: keccak256(stringToHex(String(raw))),
    }),
  };
}
