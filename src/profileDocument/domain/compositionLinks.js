import { isRecord as object } from '../../recordValidation.js';
import { exact } from '../../text/domain/article.js';

const id = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}:[A-Za-z0-9_-]{1,80}$`, 'u').test(value);
export function validPresentationReference(value, destination = false) {
  const optional = destination ? ['destinationId'] : [];
  const required = destination ? ['profileAddress', 'canvasId'] : ['profileAddress', 'canvasId', 'moduleId'];
  return exact(value, required, optional)
    && /^0x[0-9a-f]{40}$/u.test(value.profileAddress) && id(value.canvasId, 'workbench')
    && (destination ? !Object.hasOwn(value, 'destinationId') || id(value.destinationId, 'workbench-view')
      : id(value.moduleId, '(?:image|text)'));
}
export function validCompositionLinks(links) {
  if (!Array.isArray(links) || links.length > 32) return false;
  const ids = new Set();
  return links.every(link => {
    if (!object(link) || !id(link.id, 'link') || ids.has(link.id)) return false;
    ids.add(link.id);
    if (link.destination !== null && !validPresentationReference(link.destination, true)) return false;
    return link.kind === 'source' && exact(link, ['id', 'kind', 'source', 'destination']) && validPresentationReference(link.source);
  });
}

// Referential checks run against the final publication, after selective canvas
// updates have been assembled. A link never adds a private canvas to publication.
export function compositionLinkProblems(composition, snapshot) {
  const entry = ref => ref.profileAddress === snapshot.profileAddress.toLowerCase() && snapshot.entries.find(item => item.id === ref.canvasId);
  const source = ref => {
    const draft = entry(ref)?.draft;
    if (!draft) return false;
    const native = draft.composition || draft;
    const image = native.imageModules?.find(item => item.id === ref.moduleId);
    if (image) return Boolean(image.artwork);
    const text = native.texts?.find(item => item.id === ref.moduleId);
    return Boolean(text);
  };
  return (composition?.links || []).filter(link => composition.cells.some(region => region.content === link.id)).flatMap(link => {
    const destination = link.destination && entry(link.destination)?.draft;
    if (link.destination && (!destination || link.destination.destinationId && !destination.workbenchIndex?.destinations.some(item => item.id === link.destination.destinationId)))
      return [{ id: link.id, reason: 'The linked canvas or camera point is not in this publication.' }];
    return source(link.source) ? [] : [{ id: link.id, reason: 'Linked content is not in this publication.' }];
  });
}
