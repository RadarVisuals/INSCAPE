import { MAX_WORKBENCH_GROUPS, validWorkbenchGroupName, validWorkbenchGroups } from './domain/workbenchGroups.js';

export function editWorkbenchGroups(store, profileAddress, action) {
  if (!store || store.getProfileAddress() !== profileAddress) throw new Error('This Workbench is no longer active.');
  const generation = store.getGeneration(), draft = store.getDraft();
  let groups = draft.workbenchGroups || [];
  const original = groups.find(group => group.id === action.id);
  if (action.type !== 'create' && (!original || JSON.stringify(original) !== JSON.stringify(action.expected)))
    throw new Error('This group changed. Reopen it and try again.');
  let id = action.id, label;
  if (action.type === 'create') {
    if (groups.length >= MAX_WORKBENCH_GROUPS) throw new Error(`A Workbench can have up to ${MAX_WORKBENCH_GROUPS} groups.`);
    id = `workbench-group:${globalThis.crypto.randomUUID()}`;
    groups = [...groups, { id, name: action.name.trim(), memberIds: [...action.memberIds] }];
    label = 'Create Workbench group';
  } else if (action.type === 'rename') {
    groups = groups.map(group => group !== original ? group : { ...group, name: action.name.trim() });
    label = 'Rename Workbench group';
  } else if (action.type === 'members') {
    groups = groups.map(group => group !== original ? group : { ...group, memberIds: [...action.memberIds] });
    label = 'Edit Workbench group members';
  } else if (action.type === 'visibility') {
    if (!['PRIVATE', 'PUBLIC'].includes(action.visibility)) throw new Error('Choose Private or Public for this group.');
    groups = groups.map(group => group !== original ? group : { ...group, visibility: action.visibility });
    label = 'Change Workbench group visibility';
  } else if (action.type === 'position') {
    groups = groups.map(group => {
      if (group !== original) return group;
      const { position, ...rest } = group;
      return action.position === null ? rest : { ...rest, position: { ...action.position } };
    });
    label = action.position === null ? 'Unstack Workbench group' : original.position ? 'Move Workbench stack' : 'Stack Workbench group';
  } else if (action.type === 'ungroup') {
    groups = groups.filter(group => group !== original); label = 'Ungroup Workbench modules';
  } else throw new Error('Unknown group action.');
  if (groups.some(group => !validWorkbenchGroupName(group.name))) throw new Error('Choose a group name between 1 and 48 characters.');
  if (!validWorkbenchGroups(groups, draft)) throw new Error('Each available module can belong to one group. Remove it from its current group first.');
  if (JSON.stringify(groups) === JSON.stringify(draft.workbenchGroups || [])) return id;
  if (!store.commitCompletedOperation({ ...draft, workbenchGroups: groups }, { expectedGeneration: generation, historyLabel: label }))
    throw new Error('The group could not be saved. Your saved work is unchanged; try again.');
  return id;
}
