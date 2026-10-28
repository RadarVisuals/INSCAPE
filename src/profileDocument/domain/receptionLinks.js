import { displayContent, displayModuleIds } from '../../systemWorkflow/domain/displayModules.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}:[A-Za-z0-9_-]{1,80}$`, 'u').test(value);
export function validPresentationReference(value, destination = false) {
  const optional = destination ? ['destinationId'] : ['gridId', 'sideId'];
  const required = destination ? ['profileAddress', 'canvasId'] : ['profileAddress', 'canvasId', 'moduleId'];
  return object(value) && exact(value, [...required, ...optional.filter(key => Object.hasOwn(value, key))])
    && /^0x[0-9a-f]{40}$/u.test(value.profileAddress) && id(value.canvasId, 'workbench')
    && (destination ? !Object.hasOwn(value, 'destinationId') || id(value.destinationId, 'workbench-view')
      : id(value.moduleId, '(?:display|image|text)') && (!Object.hasOwn(value, 'gridId') || id(value.gridId, 'grid'))
        && (!Object.hasOwn(value, 'sideId') || id(value.sideId, 'side')));
}
export function validReceptionLinks(links) {
  if (!Array.isArray(links) || links.length > 32) return false;
  const ids = new Set();
  return links.every(link => {
    if (!object(link) || !id(link.id, 'link') || ids.has(link.id)) return false;
    ids.add(link.id);
    if (link.destination !== null && !validPresentationReference(link.destination, true)) return false;
    if (link.kind === 'source') return exact(link, ['id', 'kind', 'source', 'destination']) && validPresentationReference(link.source);
    return link.kind === 'scene' && exact(link, ['id', 'kind', 'controller', 'sources', 'destination'])
      && validPresentationReference(link.controller) && link.controller.moduleId.startsWith('display:')
      && !link.controller.gridId && !link.controller.sideId && object(link.sources)
      && Object.keys(link.sources).length > 0 && Object.keys(link.sources).length <= 64
      && Object.entries(link.sources).every(([grid, source]) => id(grid, 'grid') && validPresentationReference(source) && !source.moduleId.startsWith('display:'));
  });
}

export function projectReceptionSceneMappings(reception, snapshot) {
  if (!reception?.links) return reception;
  return { ...reception, links: reception.links.map(link => {
    if (link.kind !== 'scene') return link;
    const draft = snapshot.entries.find(entry => entry.id === link.controller.canvasId)?.draft;
    if (!draft || !displayModuleIds(draft).includes(link.controller.moduleId)) return link;
    const grids = new Set(displayContent(draft, link.controller.moduleId).grids.map(grid => grid.id));
    return { ...link, sources: Object.fromEntries(Object.entries(link.sources).filter(([gridId]) => grids.has(gridId))) };
  }) };
}

// Referential checks run against the final publication, after selective canvas
// updates have been assembled. A link never adds a private canvas to publication.
export function receptionLinkProblems(reception, snapshot) {
  const entry = ref => ref.profileAddress === snapshot.profileAddress.toLowerCase() && snapshot.entries.find(item => item.id === ref.canvasId);
  const source = ref => {
    const draft = entry(ref)?.draft;
    if (!draft) return false;
    if (displayModuleIds(draft).includes(ref.moduleId)) return !ref.sideId && (!ref.gridId || displayContent(draft, ref.moduleId).grids.some(grid => grid.id === ref.gridId));
    const image = draft.imageModules?.find(item => item.id === ref.moduleId);
    if (image) return !ref.gridId && (!ref.sideId || image.sides.some(side => side.id === ref.sideId));
    const text = draft.texts?.find(item => item.id === ref.moduleId);
    if (!text || ref.sideId) return false;
    if (!text.sceneLink) return !ref.gridId;
    return displayModuleIds(draft).includes(text.sceneLink.displayId)
      && (!ref.gridId || displayContent(draft, text.sceneLink.displayId).grids.some(grid => grid.id === ref.gridId));
  };
  return (reception?.links || []).filter(link => reception.regions.some(region => region.content === link.id)).flatMap(link => {
    const destination = link.destination && entry(link.destination)?.draft;
    if (link.destination && (!destination || link.destination.destinationId && !destination.workbenchIndex?.destinations.some(item => item.id === link.destination.destinationId)))
      return [{ id: link.id, reason: 'The linked canvas or camera point is not in this publication.' }];
    if (link.kind === 'source') return source(link.source) ? [] : [{ id: link.id, reason: 'Linked content is not in this publication.' }];
    const draft = entry(link.controller)?.draft;
    if (!draft || !displayModuleIds(draft).includes(link.controller.moduleId)) return [{ id: link.id, reason: 'The linked Display is not in this publication.' }];
    const grids = displayContent(draft, link.controller.moduleId).grids;
    return grids.every(grid => link.sources[grid.id] && source(link.sources[grid.id]))
      && Object.keys(link.sources).every(id => grids.some(grid => grid.id === id)) ? []
      : [{ id: link.id, reason: 'Choose available content for every published Display scene.' }];
  });
}
