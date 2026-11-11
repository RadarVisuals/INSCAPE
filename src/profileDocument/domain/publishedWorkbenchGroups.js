import { MAX_WORKBENCH_GROUPS, validWorkbenchGroups, workbenchGroupModules } from '../../systemWorkflow/domain/workbenchGroups.js';

// Project from already-filtered public modules. Names, ordering, counts and
// preview sources therefore cannot expose private membership indirectly.
export function projectPublishedWorkbenchGroups(groups, publicContent) {
  const available = workbenchGroupModules(publicContent);
  return (groups || []).filter(group => group.visibility === 'PUBLIC').map(group => ({
    id: group.id, name: group.name, visibility: 'PUBLIC',
    memberIds: group.memberIds.filter(id => available.has(id)),
    ...(group.position ? { position: { ...group.position } } : {}),
  })).filter(group => group.memberIds.length);
}

export function validPublishedWorkbenchGroups(groups, document) {
  return validWorkbenchGroups(groups, document)
    && groups.every(group => group.visibility === 'PUBLIC' && group.memberIds.length > 0);
}

// Restoring a publication retains local private organization. Former public
// groups missing from the snapshot become private; private group IDs and their
// members take precedence over an imported public group. Private members of a
// restored public group are retained locally, never added to its public copy.
export function restorePublishedWorkbenchGroups(document, current, restored) {
  if (!document.workbenchGroups && !current?.workbenchGroups) return undefined;
  const incoming = document.workbenchGroups || [], previous = current?.workbenchGroups || [];
  const incomingIds = new Set(incoming.map(group => group.id)), incomingMembers = new Set(incoming.flatMap(group => group.memberIds));
  const local = previous.filter(group => group.visibility !== 'PUBLIC' || !incomingIds.has(group.id))
    .map(group => group.visibility === 'PUBLIC' ? { ...structuredClone(group), visibility: 'PRIVATE',
      memberIds: group.memberIds.filter(id => !incomingMembers.has(id)) } : structuredClone(group));
  const localIds = new Set(local.map(group => group.id)), assigned = new Set(local.flatMap(group => group.memberIds));
  const publicModules = workbenchGroupModules(document), available = workbenchGroupModules(restored);
  const published = incoming.filter(group => !localIds.has(group.id)).map(group => {
    const privateMembers = (previous.find(item => item.id === group.id)?.memberIds || []).filter(id => !publicModules.has(id) && available.has(id));
    const memberIds = [...new Set([...group.memberIds, ...privateMembers])].filter(id => !assigned.has(id));
    memberIds.forEach(id => assigned.add(id));
    return { ...structuredClone(group), memberIds };
  }).filter(group => group.memberIds.length);
  if (published.length + local.length > MAX_WORKBENCH_GROUPS) throw new TypeError('Restoring these groups would exceed the 32-group limit. Remove an unused local group first.');
  return [...published, ...local];
}
