import {
  OWNER_RUNTIME_SELECTION,
  importOwnerRuntime as importSelectedOwnerRuntime,
} from './ownerRuntimeSelected.js';

export const OWNER_RUNTIME = Object.freeze({
  LATTICE: 'LATTICE',
  LEGACY: 'LEGACY',
});

export { OWNER_RUNTIME_SELECTION };

export function selectOwnerRuntimeImporter(selection, {
  importLattice,
  importLegacy,
}) {
  if (typeof importLattice !== 'function' || typeof importLegacy !== 'function') {
    throw new TypeError('Both owner runtime importers are required');
  }
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
