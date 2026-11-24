import { publishedCanvasEntries, canvasDocument } from '../profileDocument/domain/publishedCanvases.js';
import { resolveWorkbenchDestination } from '../systemWorkflow/domain/workbenchIndex.js';

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
function canvasSource(snapshot, reference) {
  if (!snapshot || !reference || reference.profileAddress?.toLowerCase() !== snapshot.profileAddress?.toLowerCase())
    return unavailable('profile');
  const entry = snapshot.entries.find(entry => entry.id === reference.canvasId);
  return entry ? { status: 'ready', entry, stale: snapshot.stale } : unavailable('canvas');
}

// Showing a source and opening a camera point are intentionally separate APIs.
export function resolvePresentationSource(snapshot, reference) {
  const result = canvasSource(snapshot, reference);
  if (result.status !== 'ready') return result;
  const { draft } = result.entry, id = reference.moduleId;
  const native = draft.composition || draft;
  const image = native.imageModules?.find(record => record.id === id);
  if (image) {
    return image.artwork ? { ...result, kind: 'image', record: image, artwork: image.artwork } : unavailable('image');
  }
  const text = native.texts?.find(record => record.id === id);
  return text ? { ...result, kind: 'text', record: text, article: text.article } : unavailable('module');
}

export function resolvePresentationDestination(snapshot, reference) {
  const result = canvasSource(snapshot, reference);
  if (result.status !== 'ready' || !reference.destinationId) return result;
  const destination = result.entry.draft.workbenchIndex?.destinations.find(item => item.id === reference.destinationId);
  return destination ? { ...result, destination, view: resolveWorkbenchDestination(destination, result.entry.draft) } : unavailable('destination');
}
