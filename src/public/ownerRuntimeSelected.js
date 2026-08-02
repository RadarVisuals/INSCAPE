// MODUL-8R Task 8 atomic production selection. Rollback changes MODUL8R to
// LATTICE and the import target to ./OwnerLatticeShell.jsx, then rebuilds.
export const OWNER_RUNTIME_SELECTION = 'MODUL8R';
export const importOwnerRuntime = () => import('./OwnerModul8rShell.jsx');
