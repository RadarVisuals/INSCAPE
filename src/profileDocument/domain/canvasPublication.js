import { FIRST_WORKBENCH_ID, isWorkbenchCollection, createWorkbenchCollection, projectWorkbenchDraft } from '../../systemWorkflow/domain/workbenchCollection.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from './profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { CANVAS_CONTENT_KEYS, canvasContent, canvasDetails, canvasDocument, publishedCanvasEntries, publishedCompositionEntries, validPublicationDestinations } from './publishedCanvases.js';
import { projectReception, validReception } from './receptionPresentation.js';
import { projectReceptionSceneMappings } from './receptionLinks.js';
import { publishedPresentationSnapshot } from '../../presentation/presentationSources.js';
import { normalizeProfileAddress } from '../../library/config.js';

export function canReplaceInvalidPublication(resolution, profileAddress) {
  const address = normalizeProfileAddress(profileAddress);
  return Boolean(address && !resolution?.busy && resolution?.status === 'INVALID'
    && resolution.errorCode === 'INVALID_DOCUMENT' && normalizeProfileAddress(resolution.address) === address);
}

export function resolvePublicationBaseline(resolution, profileAddress, { replaceInvalid = false } = {}) {
  if (!resolution?.busy && resolution?.status === 'RESOLVED') {
    const document = assertValidProfileDocumentV9(resolution.document);
    if (document.profile.address !== normalizeProfileAddress(profileAddress)) throw new Error('The publication must belong to this profile.');
    return document;
  }
  if (!resolution?.busy && resolution?.status === 'UNAVAILABLE') return null;
  if (canReplaceInvalidPublication(resolution, profileAddress)) {
    if (replaceInvalid) return null;
    throw new Error('Confirm replacement of the invalid publication before preparing changes.');
  }
  throw new Error('Wait for the latest publication to be verified before preparing changes.');
}

const canonical = value => JSON.stringify(value, function (key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item;
});
export function canvasPublicationCandidates({ record, assetRecords, profile }) {
  const collection = isWorkbenchCollection(record) ? record : createWorkbenchCollection(record);
  const build = draft => buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: collection.profileAddress,
    profileIdentity: profile, assetRecords });
  const candidates = collection.workbenches.map(item => {
    try {
      const { reception, composition, ...draft } = projectWorkbenchDraft(collection, item.id);
      const document = build(draft);
      const content = canvasContent(document);
      if (composition) {
        if (composition.version !== 3 || !validReception(composition)) throw new Error('Invalid Studio composition.');
        content.composition = projectReception(composition);
      }
      return { ...canvasDetails(item), content, document };
    } catch (error) { return { ...canvasDetails(item), error: error.message }; }
  });
  if (collection.shared.reception) {
    try {
      // A first publication from the Profile Bento must never include artwork
      // from an unselected canvas just to satisfy the v9 document envelope.
      const { reception, ...shared } = collection.shared;
      if (!validReception(reception)) throw new Error('Invalid local Bento.');
      const document = build({ ...createEmptySystemWorkflowDraft(collection.profileAddress), ...shared, grids: [] });
      candidates.push({ id: 'reception', name: 'Bento', reception: projectReception(reception), document });
    } catch (error) { candidates.push({ id: 'reception', name: 'Bento', error: error.message }); }
  }
  return candidates;
}
export function canvasPublicationChanges(candidates, previous, placements = {}) {
  const published = previous ? publishedCompositionEntries(previous) : [];
  return candidates.map(({ document, error, ...entry }) => {
    const before = published.find(item => item.id === entry.id);
    const destinations = placements[entry.id] ?? before?.destinations ?? (entry.id === 'reception' ? ['profile'] : ['gallery']);
    return { id: entry.id, name: entry.name, destinations, error, first: !before,
      changed: Boolean(error) || canonical(before) !== canonical({ ...entry, destinations }) };
  });
}
export function buildCanvasPublication({ candidates, selectedIds, includeShared, placements = {}, previousDocument, exportedAt = new Date() }) {
  const previous = previousDocument ? assertValidProfileDocumentV9(previousDocument) : null;
  if (!selectedIds.length && !includeShared) throw new Error('Select at least one changed composition or profile details.');
  if (new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !candidates.some(item => item.id === id)))
    throw new Error('The selected composition is unavailable.');
  const selected = candidates.filter(item => selectedIds.includes(item.id));
  const invalid = selected.find(item => item.error);
  if (invalid) throw new Error(invalid.name + ': ' + invalid.error);
  const current = candidates.find(item => item.document)?.document;
  if (!current || previous && current.profile.address !== previous.profile.address) throw new Error('The publication must belong to this profile.');
  if (!previous && !includeShared) throw new Error('The first publication also needs profile details.');
  const entries = previous ? publishedCanvasEntries(previous) : [];
  let reception = previous?.reception, receptionDestinations = previous?.receptionDestinations;
  for (const { document, ...entry } of selected) {
    const index = entries.findIndex(item => item.id === entry.id);
    const profileBento = entry.id === 'reception';
    const destinations = placements[entry.id] ?? (profileBento ? receptionDestinations || ['profile'] : entries[index]?.destinations || ['gallery']);
    if (!validPublicationDestinations(destinations)) throw new Error('Choose Gallery, Profile or both for ' + entry.name + '.');
    if (profileBento) { reception = entry.reception; receptionDestinations = destinations; }
    else {
      const next = { ...entry, destinations };
      if (index < 0) entries.push(next); else entries[index] = next;
    }
  }
  if (!entries.length && !reception && previous?.canvas !== null) throw new Error('Select a composition for the first publication.');
  const shared = includeShared ? current : previous;
  const root = entries.length ? canvasDocument(shared, entries[0])
    : canvasDocument(shared, { content: canvasContent(candidates.find(item => item.id === 'reception')?.document || previous) });
  const document = { ...root, canvas: entries.length ? canvasDetails(entries[0]) : null, canvases: entries.slice(1),
    ...(reception ? { reception } : {}), ...(receptionDestinations ? { receptionDestinations } : {}),
    createdAt: previous?.createdAt || new Date(exportedAt).toISOString(), exportedAt: new Date(exportedAt).toISOString(), revision: (previous?.revision || 0) + 1 };
  // Only selected content can change. Verify retained links against the final
  // whole document without modifying an unselected work or its mappings.
  let snapshot;
  function projectLinks(layout) {
    if (!layout.links?.length) return layout;
    snapshot ??= publishedPresentationSnapshot(document);
    return projectReceptionSceneMappings(layout, snapshot);
  }
  if (selectedIds.includes('reception')) document.reception = projectLinks(document.reception);
  if (document.composition && selectedIds.includes(document.canvas.id)) document.composition = projectLinks(document.composition);
  document.canvases = document.canvases.map(item => item.content.composition?.links?.length && selectedIds.includes(item.id)
    ? { ...item, content: { ...item.content, composition: projectLinks(item.content.composition) } } : item);
  return assertValidProfileDocumentV9(document);
}

// This edit is based solely on the verified public revision. Pending local edits
// in Studio must never be published along with a Gallery removal.
export function buildGalleryRemoval(previousVerifiedDocument, workIds, exportedAt = new Date()) {
  const document = assertValidProfileDocumentV9(previousVerifiedDocument);
  const ids = Array.isArray(workIds) ? workIds : [workIds];
  const selection = new Set(ids);
  if (!selection.size || selection.size !== ids.length) throw new Error('Select one or more distinct Gallery works.');
  const selected = publishedCompositionEntries(document, 'gallery').filter(item => selection.has(item.id));
  if (selected.length !== selection.size) throw new Error('A selected work is no longer in the published Gallery.');

  const removed = new Set(selected.filter(item => !item.destinations.includes('profile')).map(item => item.id));
  if (removed.has('reception')) {
    delete document.reception;
    delete document.receptionDestinations;
  } else if (selection.has('reception')) {
    document.receptionDestinations = ['profile'];
  }

  const survivingCanvases = (document.canvases || []).filter(item => !removed.has(item.id));
  for (const item of survivingCanvases) if (selection.has(item.id)) item.destinations = ['profile'];
  if (document.canvases) document.canvases = survivingCanvases;
  if (removed.has(document.canvas?.id || FIRST_WORKBENCH_ID)) {
    // Only the root work stores its artwork directly on the v9 envelope.
    for (const key of CANVAS_CONTENT_KEYS) delete document[key];
    const [next, ...additional] = survivingCanvases;
    document.canvases = additional;
    if (next) {
      const { content, ...details } = next;
      Object.assign(document, content);
      document.canvas = details;
    } else {
      const { artboard, geometry, appearance } = createEmptySystemWorkflowDraft(document.profile.address, { generateId: () => 'empty' });
      Object.assign(document, { artboard, geometry, appearance, grids: [], metadata: {}, canvas: null });
    }
  } else if (document.canvas && selection.has(document.canvas.id)) {
    document.canvas.destinations = ['profile'];
  }

  document.revision++;
  document.exportedAt = new Date(exportedAt).toISOString();
  try {
    return assertValidProfileDocumentV9(document);
  } catch (error) {
    const blockers = error.errors?.filter(issue => issue.code === 'unavailable_reception_link');
    if (blockers?.length) {
      const names = [...new Set(blockers.map(issue => issue.compositionName))].map(name => '“' + name + '”').join(', ');
      throw new Error('Removing this selection would break published links in ' + names + '. Update those links or keep their target works on Profile.');
    }
    throw error;
  }
}
