import {
  OWNER_RUNTIME_SELECTION,
  importOwnerRuntime as importSelectedOwnerRuntime,
} from './ownerRuntimeSelected.js';

export const OWNER_RUNTIME = Object.freeze({
  SYSTEM_WORKFLOW: 'SYSTEM_WORKFLOW',
});

export { OWNER_RUNTIME_SELECTION };

export function createOwnerRuntimeLoader(importOwnerRuntime = importSelectedOwnerRuntime) {
  let ownerRuntimePromise = null;
  return () => {
    ownerRuntimePromise ||= importOwnerRuntime();
    return ownerRuntimePromise;
  };
}

export function loadOwnerRuntimeWhenAuthorized(ownerAuthoringEnabled, loadOwnerRuntime) {
  if (ownerAuthoringEnabled !== true) return null;
  return loadOwnerRuntime();
}

export const loadOwnerRuntime = createOwnerRuntimeLoader();
