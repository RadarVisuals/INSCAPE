import { isWorkbenchCollection, createWorkbenchCollection, projectWorkbenchDraft } from '../../systemWorkflow/domain/workbenchCollection.js';
import { buildProfileDocumentV9 } from './profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { canvasContent, canvasDetails, canvasDocument, publishedCanvasEntries } from './publishedCanvases.js';
import { projectReception } from './receptionPresentation.js';

const canonical = value => JSON.stringify(value, function (key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item;
});
export function canvasPublicationCandidates({ record, assetRecords, profile }) {
  const collection = isWorkbenchCollection(record) ? record : createWorkbenchCollection(record);
  return collection.workbenches.map(item => {
    try {
      const document = buildProfileDocumentV9({ systemWorkflowDraft: projectWorkbenchDraft(collection, item.id), profileAddress: collection.profileAddress, profileIdentity: profile, assetRecords });
      return { ...canvasDetails(item), content: canvasContent(document), document };
    } catch (error) { return { ...canvasDetails(item), error: error.message }; }
  });
}
export function canvasPublicationChanges(candidates, previous) {
  const published = previous ? publishedCanvasEntries(previous) : [];
  return candidates.map(({ document, error, ...entry }) => {
    const before = published.find(item => item.id === entry.id);
    return { id: entry.id, name: entry.name, error, first: !before, changed: Boolean(error) || canonical(before) !== canonical(entry) };
  });
}
export function buildCanvasPublication({ candidates, selectedIds, includeShared, previousDocument, exportedAt = new Date() }) {
  const previous = previousDocument ? assertValidProfileDocumentV9(previousDocument) : null;
  if (!selectedIds.length && !includeShared) throw new Error('Select at least one changed canvas or profile details.');
  if (new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !candidates.some(item => item.id === id))) throw new Error('The selected canvas is unavailable.');
  const selected = candidates.filter(item => selectedIds.includes(item.id));
  const invalid = selected.find(item => item.error);
  if (invalid) throw new Error(`${invalid.name}: ${invalid.error}`);
  const current = candidates.find(item => item.document)?.document;
  if (!current || previous && current.profile.address !== previous.profile.address) throw new Error('The publication must belong to this profile.');
  if (!previous && !includeShared) throw new Error('The first publication also needs profile details.');
  const entries = previous ? publishedCanvasEntries(previous) : [];
  for (const { document, ...entry } of selected) {
    const index = entries.findIndex(item => item.id === entry.id);
    if (index < 0) entries.push(entry); else entries[index] = entry;
  }
  if (!entries.length) throw new Error('Select a canvas for the first publication.');
  const shared = includeShared ? current : previous;
  const root = canvasDocument(shared, entries[0]);
  if (shared.reception) root.reception = projectReception(shared.reception);
  return assertValidProfileDocumentV9({ ...root, canvas: canvasDetails(entries[0]), canvases: entries.slice(1),
    createdAt: previous?.createdAt || new Date(exportedAt).toISOString(), exportedAt: new Date(exportedAt).toISOString(), revision: (previous?.revision || 0) + 1 });
}
