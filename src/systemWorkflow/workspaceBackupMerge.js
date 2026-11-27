import { currentLocalDraft, createWorkbenchCollection, isWorkbenchCollection, assertValidWorkbenchCollection } from './domain/workbenchCollection.js';
import { normalizeWorkspace } from '../library/storage/libraryWorkspaceStorage.js';

export function equivalent(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equivalent(a[key], b[key]));
}
function classify(stats, label, local, incoming) {
  const kind = local === undefined ? 'new' : equivalent(local, incoming) ? 'identical' : 'conflicts';
  stats[kind].push(label);
}
const union = (a = [], b = []) => [...new Set([...a, ...b])];
export const assetIds = library => union(library?.curatedAssetIds, library?.folders.flatMap(folder => folder.assetIds));
const collection = draft => isWorkbenchCollection(draft) ? assertValidWorkbenchCollection(draft) : createWorkbenchCollection(currentLocalDraft(draft));

export function visitCanvasReferences(workbenches, visit) {
  const surfaces = workbenches.workbenches.map(item => item.content);
  for (const surface of surfaces) for (const link of surface?.links || []) {
    for (const ref of [link.destination, link.source])
      if (ref?.profileAddress === workbenches.profileAddress && ref.canvasId) visit(ref);
  }
}

function mergeWorks(local, incoming, stats, ids) {
  if (!incoming) return local ? collection(local) : null;
  const source = collection(incoming);
  const target = local && collection(local);
  if (!target) {
    stats.new.push(...source.workbenches.map(item => item.name));
    return source;
  }
  const localById = new Map(target.workbenches.map(item => [item.id, item]));
  // A seemingly identical canvas may link to an imported conflict. Copy that
  // dependent canvas too, so its local links never change destination.
  let previousCount;
  do {
    previousCount = ids.size;
    for (const item of source.workbenches) {
      if (!localById.has(item.id) || ids.has(item.id)) continue;
      let copy = !equivalent(localById.get(item.id), item);
      visitCanvasReferences({ ...source, workbenches: [item] }, ref => { if (ids.has(ref.canvasId)) copy = true; });
      if (copy) ids.set(item.id, 'workbench:' + crypto.randomUUID());
    }
  } while (ids.size !== previousCount);
  const added = [], shared = {};
  for (const [key, value] of Object.entries(source.shared)) {
    if (!Object.hasOwn(target.shared, key)) shared[key] = structuredClone(value);
    else if (!equivalent(target.shared[key], value)) stats.conflicts.push('Shared Studio ' + key + ' (local kept)');
  }
  for (const item of source.workbenches) {
    if (localById.has(item.id) && !ids.has(item.id)) { stats.identical.push(item.name); continue; }
    const copy = structuredClone(item);
    if (ids.has(item.id)) {
      copy.name = copy.name.slice(0, 53).trimEnd() + ' (imported)';
      copy.id = ids.get(item.id);
      stats.conflicts.push(item.name + ' (imported as ' + copy.name + ')');
    } else stats.new.push(item.name);
    added.push(copy);
  }
  visitCanvasReferences({ ...source, workbenches: added }, ref => {
    ref.canvasId = ids.get(ref.canvasId) ?? ref.canvasId;
  });
  Object.assign(target.shared, shared);
  target.workbenches.push(...added);
  return target;
}

function mergeLibrary(local, incoming, stats) {
  if (!incoming) return local;
  const profile = incoming.profileAddress;
  for (const section of incoming.categoryOrganization.sections)
    classify(stats, 'Section ' + section.name, local?.categoryOrganization.sections.find(item => item.id === section.id), section);
  for (const id of incoming.favorites) classify(stats, 'Favorite ' + id, local?.favorites.includes(id) || undefined, true);
  for (const [label, items, existing] of [
    ['Canvas object', incoming.canvas.objects, local?.canvas.objects],
    ['Table placement', incoming.tables.placements, local?.tables.placements],
  ]) for (const item of items) classify(stats, label + ' ' + item.id, existing?.find(other => other.id === item.id), item);
  if (local) {
    const localSelections = new Map(), incomingSelections = new Map();
    for (const [list, map] of [[local.curatedImageSelections, localSelections], [incoming.curatedImageSelections, incomingSelections]]) {
      for (const { assetId, url } of list || []) map.set(assetId, [...(map.get(assetId) || []), url]);
    }
    const localIds = new Set(assetIds(local));
    for (const id of assetIds(incoming)) if (localIds.has(id) && !equivalent(localSelections.get(id), incomingSelections.get(id)))
      stats.conflicts.push('Image selection for ' + id + ' (local kept)');
  }
  const existingIds = new Set(assetIds(local)), all = assetIds(incoming);
  const snapshots = { ...incoming.curatedSnapshots, ...local?.curatedSnapshots };
  for (const id of all) {
    const existing = local?.curatedSnapshots?.[id], next = incoming.curatedSnapshots?.[id];
    const bucket = !existingIds.has(id) || (!existing && next) ? 'new' : existing && next && !equivalent(existing, next) ? 'conflicts' : 'identical';
    stats[bucket].push(next?.name || id);
  }
  if (local && equivalent(local, incoming)) {
    stats.identical.push(...incoming.folders.map(folder => folder.name));
    return local;
  }
  const folders = structuredClone(local?.folders || []);
  const existingFolders = new Set(folders.map(folder => folder.id));
  for (const item of incoming.folders) {
    const current = folders.find(folder => folder.id === item.id);
    if (!current) { folders.push(structuredClone(item)); stats.new.push(item.name); continue; }
    if (equivalent(current, item)) { stats.identical.push(item.name); continue; }
    stats.conflicts.push(item.name + ' (local folder settings kept)');
    const original = new Set(current.assetIds);
    current.assetIds = union(current.assetIds, item.assetIds);
    const extra = item.imageSelections?.filter(selection => !original.has(selection.assetId)) || [];
    if (extra.length) current.imageSelections = [...(current.imageSelections || []), ...extra];
  }
  if (!local) return incoming;
  const org = structuredClone(local.categoryOrganization);
  for (const section of incoming.categoryOrganization.sections) {
    const current = org.sections.find(item => item.id === section.id);
    const additions = section.categoryIds.filter(id => !existingFolders.has(id));
    if (current) current.categoryIds = union(current.categoryIds, additions);
    else org.sections.push({ ...section, categoryIds: additions });
  }
  org.rootCategoryIds = union(org.rootCategoryIds, incoming.categoryOrganization.rootCategoryIds.filter(id => !existingFolders.has(id)));
  const append = (a, b, order) => [...a, ...b.filter(item => !a.some(localItem => localItem.id === item.id))
    .map((item, i) => ({ ...item, [order]: a.length + i }))];
  const result = { ...local, favorites: union(local.favorites, incoming.favorites), folders, categoryOrganization: org,
    curatedAssetIds: union(local.curatedAssetIds, incoming.curatedAssetIds?.filter(id => !existingIds.has(id))), curatedSnapshots: snapshots,
    curatedImageSelections: [...(local.curatedImageSelections || []), ...(incoming.curatedImageSelections || []).filter(item => !existingIds.has(item.assetId))],
    canvas: { ...local.canvas, objects: append(local.canvas.objects, incoming.canvas.objects, 'presentationOrder') },
    tables: { placements: append(local.tables.placements, incoming.tables.placements, 'layer') } };
  return normalizeWorkspace(result, profile);
}

export function mergeBackup(local, incoming) {
  const stats = { new: [], identical: [], conflicts: [] }, ids = new Map();
  const workbenches = mergeWorks(local.workbenches, incoming.workbenches, stats, ids);
  const library = mergeLibrary(local.library, incoming.library, stats);
  const contexts = new Map(structuredClone(local.textRecovery || []));
  for (const [context, entries] of incoming.textRecovery || []) {
    const [profile, id] = context.split('/');
    const dest = profile + '/' + (ids.get(id) ?? id);
    const merged = contexts.get(dest) || [];
    for (const entry of entries) {
      const current = merged.find(item => equivalent(item.scope, entry.scope));
      classify(stats, 'Pending text ' + entry.scope.id, current, entry);
      if (!current) merged.push(entry);
    }
    contexts.set(dest, merged);
  }
  return { workspace: { library, workbenches, textRecovery: contexts.size ? [...contexts] : null }, stats };
}
