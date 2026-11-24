import { artworkLayers, artworkModuleId, artworkWindowIds } from '../../systemWorkflow/domain/artworkLayers.js';

// Selection contains window ids. The tool target is a projection, never a
// separately synchronized fact.
// mode distinguishes native selection, explicit selection, and activation
// retained after arrival; it replaces the old handles-only discriminator.
const sameIds = (left, right) => left.length === right.length && left.every((id, index) => id === right[index]);
const modules = content => [
  ...['imageModules', 'shapes', 'texts', 'keeperDocks'].flatMap(key => (content?.[key] || []).map(item => item.id)),
];
function availableIds(content) {
  const ids = new Set(modules(content));
  for (const text of content?.workbench?.texts || []) {
    if (ids.has(text.id)) for (const frame of text.frames || []) ids.add(frame.id);
  }
  ids.add('workbench:index');
  return ids;
}
function choose(state, ids, mode = 'explicit', blockId = state.blockId) {
  const unique = [...new Set(ids)], nextMode = unique.length ? mode : null;
  return sameIds(state.ids, unique) && state.mode === nextMode && state.blockId === blockId
    ? state : { ids: unique, mode: nextMode, blockId };
}
export function reconcileWorkbenchSelection(state, content) {
  const available = availableIds(content);
  const ids = state.ids.filter(id => available.has(id));
  const blockId = state.blockId && artworkLayers(content).some(layer => layer.id === state.blockId) ? state.blockId : null;
  return choose(state, ids, state.mode, blockId);
}
export function initialWorkbenchSelection(content, targetId = null) {
  return reconcileWorkbenchSelection({ ids: targetId ? [targetId] : [], mode: targetId ? 'module' : null, blockId: null }, content);
}
export function workbenchSelectionTarget(state, content) {
  if (state.ids.length !== 1) return null;
  const id = artworkModuleId(content, state.ids[0]);
  return modules(content).includes(id) ? id : null;
}
export function changeWorkbenchSelection(previous, action, content) {
  if (action.type === 'restore') return reconcileWorkbenchSelection(action.state || initialWorkbenchSelection(content), content);
  const state = reconcileWorkbenchSelection(previous, content);
  let next = state;
  if (action.type === 'clear') next = choose(state, [], null);
  else if (action.type === 'select' || action.type === 'arrive') next = choose(state, action.id ? [action.id] : [], action.type === 'arrive' ? 'activation' : 'module');
  else if (action.type === 'focus') {
    // Focus may visit the next Shift-selection candidate without replacing an
    // explicit group. Text continuation focus retains its selected window id.
    if (state.mode === 'explicit' && state.ids.length) return state;
    // Refocusing the arrived window or its owner does not recreate a rail
    // selection. A deliberate click/Layers choice uses select/layers instead.
    if (state.ids.length === 1 && (state.ids[0] === action.id || artworkModuleId(content, state.ids[0]) === action.id)) return state;
    next = choose(state, action.id ? [action.id] : [], 'module');
  } else if (action.type === 'replace') {
    // A retained arrival target is not an existing explicit membership.
    const selected = state.mode === 'activation' ? [] : state.ids;
    const ids = typeof action.ids === 'function' ? action.ids(selected) : action.ids;
    next = choose(state, ids || [], 'explicit');
  } else if (action.type === 'layers') {
    const ids = artworkWindowIds(content, action.ids);
    const previousIds = state.mode === 'activation' ? [] : state.ids;
    const selected = action.additive
      ? ids.every(id => previousIds.includes(id)) ? previousIds.filter(id => !ids.includes(id)) : [...previousIds, ...ids]
      : ids;
    next = choose(state, selected, !action.additive && ids.length === 1 ? 'module' : 'explicit', action.part || null);
  } else if (action.type === 'enter') {
    next = choose(state, [], null, action.id);
  } else if (action.type === 'leave') {
    const block = artworkLayers(content).find(layer => layer.id === state.blockId);
    next = choose(state, action.selectMembers !== false && block ? artworkWindowIds(content, block.children) : state.ids, 'explicit', null);
  }
  return reconcileWorkbenchSelection(next, content);
}
