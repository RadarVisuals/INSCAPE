export const validTextToolsView = value => value && Object.keys(value).length === 1 && typeof value.open === 'boolean';

// Consolidate old per-article tool preferences without changing articles or
// their Read/Write modes. Only the profile-local workspace stores this state.
export function restoreTextToolsView(views = {}, records = [], presentations = []) {
  if (validTextToolsView(views['workbench:text-tools'])) return { ...views['workbench:text-tools'] };
  const target = records.find(record => presentations.find(item => item.id === record.id)?.open !== false
    && (views[record.id]?.settings ?? views[record.id]?.mode !== 'read'));
  return { open: Boolean(target), ...(target ? { targetId: target.id } : {}) };
}
