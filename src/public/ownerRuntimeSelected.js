// System Workflow Phase 4B atomic production selection. Rollback changes
// SYSTEM_WORKFLOW to MODUL8R and the import target to ./OwnerModul8rShell.jsx,
// then rebuilds.
export const OWNER_RUNTIME_SELECTION = 'SYSTEM_WORKFLOW';
export const importOwnerRuntime = () => import('./OwnerSystemWorkflowShell.jsx');
