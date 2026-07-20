export function createOwnerRuntimeLoader(importOwnerRuntime = () => import('./ModuleGridShell.jsx')) {
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
