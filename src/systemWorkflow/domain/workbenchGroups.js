// Workbench membership is authored once, independently of window layout and
// Display placement groups. Camera/selection/expanded presentation are not saved.
export const MAX_WORKBENCH_GROUPS = 32;
export const MAX_WORKBENCH_GROUP_MEMBERS = 128;
export const WORKBENCH_GROUP_STACK_SIZE = Object.freeze({ width: 180, height: 160 });
export const validWorkbenchGroupPosition = position => position && Object.keys(position).length === 2
  && ['left', 'top'].every(axis => Number.isFinite(position[axis]) && position[axis] >= 8 && position[axis] <= 4000 - 8 - WORKBENCH_GROUP_STACK_SIZE[axis === 'left' ? 'width' : 'height']);
const groupId = /^workbench-group:[A-Za-z0-9_-]{1,80}$/u;
const records = value => Array.isArray(value) ? value : [];
export const validWorkbenchGroupName = name => typeof name === 'string' && name === name.trim()
  && name.length > 0 && name.length <= 48 && !/[\u0000-\u001f\u007f]/u.test(name);

export function workbenchGroupModules(draft) {
  const modules = new Map();
  if (draft?.grids?.length) modules.set('display:primary', draft.workbench?.display?.name || 'Display');
  for (const record of records(draft?.displays).filter(record => typeof record?.id === 'string')) modules.set(record.id,
    records(draft.workbench?.displays).find(item => item?.id === record.id)?.name || 'Display');
  for (const [key, label] of [['texts', 'Text'], ['imageModules', 'Image'], ['shapes', 'Shape'], ['keeperDocks', 'Keeper']]) {
    for (const [index, record] of records(draft?.[key]).entries()) if (typeof record?.id === 'string') modules.set(record.id,
      record.name || record.article?.title || `${label} ${index + 1}`);
  }
  return modules;
}

export function workbenchMemberIds(draft, windowIds) {
  const modules = workbenchGroupModules(draft);
  return [...new Set(windowIds.map(id => modules.has(id) ? id
    : draft.workbench?.texts?.find(text => text.frames?.some(frame => frame.id === id))?.id).filter(Boolean))];
}

export function workbenchGroupWindowIds(draft, group) {
  return group.memberIds.flatMap(id => [id, ...(draft.workbench?.texts?.find(text => text.id === id)?.frames || []).map(frame => frame.id)]);
}

export function validWorkbenchGroups(groups, draft) {
  if (!Array.isArray(groups) || groups.length > MAX_WORKBENCH_GROUPS) return false;
  const available = workbenchGroupModules(draft), ids = new Set(), members = new Set();
  return groups.every(group => {
    if (!group || Object.keys(group).some(key => !['id', 'name', 'memberIds', 'position'].includes(key))
      || Object.hasOwn(group, 'position') && !validWorkbenchGroupPosition(group.position) || !groupId.test(group.id) || ids.has(group.id)
      || !validWorkbenchGroupName(group.name) || !Array.isArray(group.memberIds)
      || group.memberIds.length > MAX_WORKBENCH_GROUP_MEMBERS) return false;
    ids.add(group.id);
    return group.memberIds.every(id => {
      if (!available.has(id) || members.has(id)) return false;
      members.add(id); return true;
    });
  });
}

// Only remove references to modules deleted by this completed operation. Unknown
// references in a loaded/new record remain validation errors, never silent repair.
export function reconcileRemovedWorkbenchMembers(previous, candidate) {
  if (!Array.isArray(candidate?.workbenchGroups) || !candidate.workbenchGroups.length) return candidate;
  const available = workbenchGroupModules(candidate);
  const removed = new Set([...workbenchGroupModules(previous).keys()].filter(id => !available.has(id)));
  if (!removed.size) return candidate;
  return { ...candidate, workbenchGroups: candidate.workbenchGroups.map(group => !Array.isArray(group?.memberIds) ? group
    : { ...group, memberIds: group.memberIds.filter(id => !removed.has(id)) }) };
}
