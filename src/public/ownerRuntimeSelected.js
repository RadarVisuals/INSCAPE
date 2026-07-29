// Phase 4 build selection. Rollback requires changing LATTICE to LEGACY below,
// changing the import target to ./ModuleGridShell.jsx, then rebuilding.
export const OWNER_RUNTIME_SELECTION = 'LATTICE';
export const importOwnerRuntime = () => import('./OwnerLatticeShell.jsx');
