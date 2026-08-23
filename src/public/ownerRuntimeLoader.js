import {
  OWNER_RUNTIME_SELECTION,
  importOwnerRuntime as importSelectedOwnerRuntime,
} from './ownerRuntimeSelected.js';

export const OWNER_RUNTIME = Object.freeze({
  MODUL8R: 'MODUL8R',
  SYSTEM_WORKFLOW: 'SYSTEM_WORKFLOW',
  LATTICE: 'LATTICE',
  LEGACY: 'LEGACY',
});

export { OWNER_RUNTIME_SELECTION };

export function selectOwnerRuntimeImporter(selection, {
  importModul8r,
  importSystemWorkflow,
  importLattice,
  importLegacy,
}) {
  if (typeof importModul8r !== 'function' || typeof importSystemWorkflow !== 'function'
      || typeof importLattice !== 'function' || typeof importLegacy !== 'function') {
    throw new TypeError('All owner runtime importers are required');
  }
  if (selection === OWNER_RUNTIME.MODUL8R) return importModul8r;
  if (selection === OWNER_RUNTIME.SYSTEM_WORKFLOW) return importSystemWorkflow;
  if (selection === OWNER_RUNTIME.LATTICE) return importLattice;
  if (selection === OWNER_RUNTIME.LEGACY) return importLegacy;
  throw new TypeError(`Unsupported owner runtime selection: ${String(selection)}`);
}

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
