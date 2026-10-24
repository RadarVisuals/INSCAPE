// Choose an available initial article; tool visibility belongs to editor preferences.
export function restoreTextToolsView(views = {}, records = [], presentations = []) {
  const target = records.find(record => presentations.find(item => item.id === record.id)?.open !== false
    && views[record.id]?.mode !== 'read');
  return { open: Boolean(target), ...(target ? { targetId: target.id } : {}) };
}
