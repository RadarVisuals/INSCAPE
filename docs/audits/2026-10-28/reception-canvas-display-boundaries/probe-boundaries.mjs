// Read-only diagnostic examples for the current boundary audit. No browser,
// real profile storage, network, publication or production source changes.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createEmptySystemWorkflowDraft } from '../../../../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, appendWorkbench, assertValidWorkbenchCollection, projectWorkbenchDraft } from '../../../../src/systemWorkflow/domain/workbenchCollection.js';
import { displayModuleIds } from '../../../../src/systemWorkflow/domain/displayModules.js';
import { createReception, validReception } from '../../../../src/profileDocument/domain/receptionPresentation.js';
import { createArticle, validTextModules } from '../../../../src/text/domain/article.js';
import { passageArticle } from '../../../../src/text/scenePassages.js';
import { joinArticleSections } from '../../../../src/text/articleSections.js';
import { workbenchOverviewModel } from '../../../../src/public/workbenchOverview/workbenchOverviewModel.js';
import { applicationRouteUrl, readApplicationRoute } from '../../../../src/profileDiscovery/applicationNavigation.js';

const results = [];
const address = '0x' + '1'.repeat(40);
const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'audit-first' });
const second = { ...structuredClone(draft.grids[0]), id: 'grid:audit-second', title: 'Second scene' };
draft.grids.splice(1, 0, second);

let collection = createWorkbenchCollection(draft);
collection = appendWorkbench(collection, 'workbench:second', 'Second canvas', draft);
assertValidWorkbenchCollection(collection);
const targets = collection.workbenches.map(item => ({ canvasId: item.id, displayIds: displayModuleIds(projectWorkbenchDraft(collection, item.id)) }));
assert.ok(targets.every(item => item.displayIds.includes('display:primary')));
results.push({ check: 'Module identifiers are canvas-local', verified: true, targets });

const linked = { id: 'text:audit', visibility: 'PUBLIC', article: createArticle('First passage'),
  sceneLink: { displayId: 'display:primary', gridId: draft.grids[0].id, passages: [{ gridId: second.id, article: createArticle('Second passage') }] } };
assert.ok(validTextModules([linked]));
const reception = createReception();
reception.texts.push(linked); reception.regions[0].content = linked.id;
assert.equal(validReception(reception), false);
results.push({ check: 'An otherwise valid linked Text is intentionally rejected by Reception', verified: true });

draft.texts = [linked];
const before = structuredClone(draft);
const preview = workbenchOverviewModel(draft);
assert.equal(preview.items.find(item => item.source.kind === 'display').source.grid.id, draft.grids[0].id);
assert.equal(preview.items.find(item => item.source.kind === 'text').source.article.title, 'First passage');
assert.deepEqual(draft, before);
results.push({ check: 'Overview projection chooses the first Display scene and its passage without mutation', verified: true,
  projectedScene: draft.grids[0].id, projectedText: 'First passage', nextSceneAvailable: second.id });

const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const sections = { ...linked, article: { ...createArticle('Story'), content: joinArticleSections([[paragraph('Alpha')], [paragraph('Beta')]]) },
  sceneLink: { mode: 'sections', displayId: 'display:primary' } };
const body = article => JSON.stringify(article.content);
assert.match(body(passageArticle(sections, second.id, [draft.grids[0].id, second.id])), /Beta/);
assert.match(body(passageArticle(sections, second.id, [second.id, draft.grids[0].id])), /Alpha/);
assert.equal(passageArticle(linked, second.id, [second.id, draft.grids[0].id]).title, 'Second passage');
results.push({ check: 'Section mode binds by scene order; explicit passages bind by scene identity', verified: true,
  sameSceneBeforeReorder: 'Beta', sameSceneAfterReorder: 'Alpha', explicitPassageAfterReorder: 'Second passage' });

// These proposed fields are deliberately not part of today's route contract.
// Their omission is a capability gap, not a current routing defect.
const proposed = { kind: 'profile', address, canvas: true, target: { canvasId: 'workbench:second', moduleId: 'display:primary',
  gridId: second.id, destinationId: 'destination:detail' } };
const routeUrl = applicationRouteUrl({ href: 'https://example.test/' }, proposed);
const route = readApplicationRoute(new URL(routeUrl, 'https://example.test'));
assert.equal(route.target.moduleId, 'display:primary');
assert.equal(route.target.gridId, second.id);
assert.equal(route.target.canvasId, undefined);
assert.equal(route.target.destinationId, undefined);
results.push({ check: 'Current route targets have module/grid scope, not named-canvas/camera-point scope', verified: true, routeUrl, readBack: route });

await writeFile(new URL('./diagnostic-probes.json', import.meta.url), JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2) + '\n');
console.log(`${results.length}/${results.length} diagnostic probes verified`);
