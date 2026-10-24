import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { createArticle } from '../../text/domain/article.js';
import { publicDisplayModules, publicCanvasItems, resolvePublicCanvasTarget, articleExcerpt, publicReadingPages } from './profileOverviewModel.js';
import { readApplicationRoute, applicationRouteUrl, resolveApplicationDestination } from '../../profileDiscovery/applicationNavigation.js';

const address = `0x${'1'.repeat(40)}`;
function publication() {
  const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'first' });
  draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:private', visibility: 'PRIVATE' });
  draft.texts = [
    { id: 'text:public', visibility: 'PUBLIC', article: createArticle('An essay') },
    { id: 'text:private', visibility: 'PRIVATE', article: createArticle('Private notes') },
  ];
  return buildProfileDocumentV9({ profileAddress: address, systemWorkflowDraft: draft });
}
test('overview derives only published destinations, without mutating older documents', () => {
  const doc = publication(), before = JSON.stringify(doc);
  const items = publicCanvasItems(doc);
  assert.deepEqual(items.map(item => item.title), ['DISPLAY MODULE', 'An essay']);
  assert.equal(items.some(item => item.title === 'Private notes'), false);
  assert.equal(resolvePublicCanvasTarget(doc, { moduleId: 'text:private' }), null);
  assert.equal(resolvePublicCanvasTarget(doc, { moduleId: 'display:primary', gridId: 'grid:private' }), null);
  assert.equal(resolvePublicCanvasTarget(doc, { moduleId: 'text:public', gridId: 'grid:wrong' }), null);
  assert.deepEqual(resolvePublicCanvasTarget(doc, { moduleId: 'text:public' }), { moduleId: 'text:public' });
  assert.deepEqual(resolvePublicCanvasTarget(doc, { moduleId: 'display:primary' }), items[0].target);
  assert.equal(JSON.stringify(doc), before);
});
test('empty public canvas has a usable empty index and absent targets stay unavailable', () => {
  const doc = publication(); doc.grids = []; delete doc.texts;
  assert.deepEqual(publicCanvasItems(doc), []);
  assert.equal(resolvePublicCanvasTarget(doc, { moduleId: 'display:primary' }), null);
});
test('text excerpts preserve inline word boundaries and bound long content', () => {
  assert.equal(articleExcerpt({ type: 'doc', content: [
    { type: 'paragraph', content: [{ text: 'A ' }, { text: 'bold' }, { text: ' idea.' }] },
    { type: 'paragraph', content: [{ text: 'Another line.' }] },
  ] }), 'A bold idea. Another line.');
  assert.equal(articleExcerpt({ text: 'x'.repeat(500) }).length, 241);
});
test('canvas links round-trip with targets, Discover return context, and authority separation', () => {
  const location = { href: `https://example.test/?view=${address}&keep=yes#anchor` };
  const expected = { kind: 'profile', address, canvas: true, target: { moduleId: 'display:primary', gridId: 'grid:one' } };
  const href = applicationRouteUrl(location, expected);
  assert.deepEqual(readApplicationRoute(new URL(href, location.href)), expected);
  assert.deepEqual(readApplicationRoute({ search: '?discover' }, { inscapeReturnRoute: expected }).returnTo, expected);
  assert.deepEqual(resolveApplicationDestination(expected, { status: 'complete' }), { kind: 'public', address, canvas: true, target: expected.target });
  assert.deepEqual(resolveApplicationDestination(expected, { status: 'complete', profileAddress: address, ownershipVerified: true }), { kind: 'workbench', address });
  const overview = applicationRouteUrl({ href: new URL(href, location.href).href }, { kind: 'profile', address });
  assert.equal(overview.includes('canvas='), false);
  assert.equal(overview.includes('module='), false);
  assert.equal(overview.includes('grid='), false);
  assert.match(overview, /keep=yes/);
  assert.deepEqual(readApplicationRoute({ search: `?view=${address}&module=text:ignored` }), { kind: 'profile', address, target: { moduleId: 'text:ignored' } });
});

test('reading pages retain published sources and article appearance without mutation', () => {
  const doc = publication(), before = JSON.stringify(doc);
  const pages = publicReadingPages(doc);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].article, doc.texts[0].article);
  assert.equal(pages.some(p => p.title === 'Private notes'), false);
  assert.equal(JSON.stringify(doc), before);
  assert.equal(publicReadingPages({ ...doc, grids: [], texts: [] }).length, 0);
});
test('multi-sided images and scene-linked writing retain every published entry', () => {
  const doc = publication();
  doc.imageModules = [{ id: 'image:one', name: 'Sides', width: 300, height: 200,
    sides: [{ id: 'a', asset: { description: 'Front' } }, { id: 'b', asset: { description: 'Back' } }] }];
  doc.texts[0].sceneLink = { passages: [{ gridId: 'other', article: createArticle('Second passage') }] };
  const pages = publicReadingPages(doc);
  assert.equal(pages.filter(p => p.kind === 'image').length, 2);
  assert.equal(pages.find(p => p.title === 'Sides · 2').side, doc.imageModules[0].sides[1]);
  assert.equal(pages.some(p => p.kind === 'text'), false, 'scene-linked Text stays connected to its Display');
  assert.equal(publicCanvasItems(doc).find(p => p.kind === 'text').record, doc.texts[0]);
  assert.equal(publicReadingPages(doc, 'image:one').length, 2);
  assert.equal(new Set(pages.map(p => p.key)).size, pages.length);
});

test('Displays stay whole with distinct presentation, grids and scoped targets', () => {
  const doc = publication();
  doc.grids.push({ ...doc.grids[0], id: 'grid:next', title: 'Next' });
  doc.displays = [{ id: 'display:second', geometry: { ...doc.geometry }, appearance: { ...doc.appearance }, grids: [{ ...doc.grids[0], id: 'grid:other' }] }];
  doc.workbench = { display: { name: 'First', shortcut: {} }, displays: [{ id: 'display:second', name: 'Second', shortcut: {} }] };
  const before = JSON.stringify(doc), modules = publicDisplayModules(doc);
  assert.equal(modules.length, 2);
  assert.equal(modules[0].document.grids, doc.grids);
  assert.equal(modules[1].document.grids, doc.displays[0].grids);
  assert.equal(modules[1].document.workbench.display.name, 'Second');
  assert.equal(modules[1].document.texts, undefined);
  assert.deepEqual(resolvePublicCanvasTarget(doc, { moduleId: 'display:primary', gridId: 'grid:next' }), { moduleId: 'display:primary', gridId: 'grid:next' });
  assert.equal(resolvePublicCanvasTarget(doc, { moduleId: 'display:second', gridId: 'grid:next' }), null);
  assert.equal(publicReadingPages(doc).some(item => item.kind === 'display' || item.kind === 'composition'), false);
  assert.equal(JSON.stringify(doc), before);
});
