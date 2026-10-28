import { publishedCanvasEntries, canvasDocument } from '../profileDocument/domain/publishedCanvases.js';
import { displayContent, displayModuleIds } from '../systemWorkflow/domain/displayModules.js';
import { resolveWorkbenchDestination } from '../systemWorkflow/domain/workbenchIndex.js';
import { passageArticle } from '../text/scenePassages.js';

// Call only after document verification. The assembled publication is the sole
// source, including retained versions of canvases excluded from this update.
export function publishedPresentationSnapshot(document) {
  return Object.freeze({ kind: 'published', profileAddress: document.profile.address.toLowerCase(),
    revision: `${document.documentId}:${document.revision}`, stale: false,
    entries: Object.freeze(publishedCanvasEntries(document).map(entry => Object.freeze({
      ...entry, draft: { ...canvasDocument(document, entry), profileAddress: document.profile.address },
    }))),
  });
}

const unavailable = reason => ({ status: 'unavailable', reason });
export function receptionDisplayAssetIds(snapshot, reception) {
  const placed = new Set(reception.regions.map(region => region.content));
  return [...new Set((reception.links || []).filter(link => placed.has(link.id)).flatMap(link => {
    const ref = link.kind === 'scene' ? link.controller : link.source;
    if (ref.profileAddress !== snapshot?.profileAddress?.toLowerCase()) return [];
    const draft = snapshot.entries.find(entry => entry.id === ref.canvasId)?.draft;
    return draft && displayModuleIds(draft).includes(ref.moduleId) ? displayContent(draft, ref.moduleId).grids
      .filter(grid => grid.id !== 'grid:world-cover').flatMap(grid => grid.placements.map(item => item.stableAssetId).filter(Boolean)) : [];
  }))];
}
function canvasSource(snapshot, reference) {
  if (!snapshot || !reference || reference.profileAddress?.toLowerCase() !== snapshot.profileAddress?.toLowerCase())
    return unavailable('profile');
  const entry = snapshot.entries.find(entry => entry.id === reference.canvasId);
  return entry ? { status: 'ready', entry, stale: snapshot.stale } : unavailable('canvas');
}

// Showing a source and opening a camera point are intentionally separate APIs.
export function resolvePresentationSource(snapshot, reference, session = null) {
  const result = canvasSource(snapshot, reference);
  if (result.status !== 'ready') return result;
  if (session && (session.scope?.profileAddress?.toLowerCase() !== snapshot.profileAddress.toLowerCase()
    || session.scope.canvasId !== reference.canvasId || session.scope.revision !== snapshot.revision)) return unavailable('session');
  const scenes = session?.scenes || {};
  const { draft } = result.entry, id = reference.moduleId;
  if (displayModuleIds(draft).includes(id)) {
    const content = displayContent(draft, id);
    const gridId = reference.gridId ?? scenes[id]?.gridId ?? content.grids[0]?.id;
    const grid = content.grids.find(grid => grid.id === gridId);
    return grid ? { ...result, kind: 'display', content, grid } : unavailable('scene');
  }
  const image = draft.imageModules?.find(record => record.id === id);
  if (image) {
    const side = reference.sideId ? image.sides.find(side => side.id === reference.sideId) : image.sides[0];
    return side ? { ...result, kind: 'image', record: image, side } : unavailable('side');
  }
  const text = draft.texts?.find(record => record.id === id);
  if (text) {
    const link = text.sceneLink;
    const display = link && displayModuleIds(draft).includes(link.displayId) ? displayContent(draft, link.displayId) : null;
    const gridId = reference.gridId ?? scenes[link?.displayId]?.gridId ?? display?.grids[0]?.id;
    if (link && !display?.grids.some(grid => grid.id === gridId)) return unavailable('scene');
    return { ...result, kind: 'text', record: text, article: passageArticle(text, gridId, display?.grids.map(grid => grid.id)) };
  }
  return unavailable('module');
}

export function resolvePresentationDestination(snapshot, reference) {
  const result = canvasSource(snapshot, reference);
  if (result.status !== 'ready' || !reference.destinationId) return result;
  const destination = result.entry.draft.workbenchIndex?.destinations.find(item => item.id === reference.destinationId);
  return destination ? { ...result, destination, view: resolveWorkbenchDestination(destination, result.entry.draft) } : unavailable('destination');
}

// Small experiment boundary, not a persisted Reception schema. Each scene maps
// by stable ID to one existing source; it never copies its content into a cell.
export function resolveSceneBinding(snapshot, binding, session) {
  const controller = resolvePresentationSource(snapshot, binding.controller);
  if (controller.status !== 'ready' || controller.kind !== 'display') return unavailable('controller');
  const scope = session?.scope;
  if (scope?.profileAddress?.toLowerCase() !== snapshot.profileAddress.toLowerCase()
    || scope?.canvasId !== binding.controller.canvasId || scope?.revision !== snapshot.revision) return unavailable('session');
  const scene = session.scenes[binding.controller.moduleId];
  const source = scene && binding.sources[scene.gridId];
  if (!source || !controller.content.grids.some(grid => grid.id === scene.gridId)) return unavailable('binding');
  return resolvePresentationSource(snapshot, source);
}
