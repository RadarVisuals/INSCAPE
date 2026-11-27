import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { createArticle } from '../../text/domain/article.js';
import { resolvePublicCanvasTarget } from './profileOverviewModel.js';
import { readApplicationRoute, applicationRouteUrl, resolveApplicationDestination } from '../../navigation/applicationNavigation.js';

const address = `0x${'1'.repeat(40)}`;
function publication() {
  const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'first' });
  draft.texts = [
    { id: 'text:public', visibility: 'PUBLIC', article: createArticle('An essay') },
    { id: 'text:private', visibility: 'PRIVATE', article: createArticle('Private notes') },
  ];
  return buildProfileDocumentV9({ profileAddress: address, systemWorkflowDraft: draft });
}
test('only published texts and images can be opened directly', () => {
  const document = publication();
  document.imageModules = [{ id: 'image:public' }];
  for (const moduleId of ['text:public', 'image:public']) {
    assert.deepEqual(resolvePublicCanvasTarget(document, { moduleId }), { moduleId });
  }
  for (const moduleId of ['text:private', 'image:missing']) {
    assert.equal(resolvePublicCanvasTarget(document, { moduleId }), null);
  }
  assert.equal(resolvePublicCanvasTarget({}, null), null);
});
test('canvas links round-trip with targets and authority separation', () => {
  const location = { href: `https://example.test/?view=${address}&keep=yes#anchor` };
  const expected = { kind: 'profile', address, canvas: true, target: { moduleId: 'text:public' } };
  const href = applicationRouteUrl(location, expected);
  assert.deepEqual(readApplicationRoute(new URL(href, location.href)), expected);
  assert.deepEqual(resolveApplicationDestination(expected, { status: 'complete' }), { kind: 'public', address, canvas: true, target: expected.target });
  assert.deepEqual(resolveApplicationDestination(expected, { status: 'complete', profileAddress: address, ownershipVerified: true }),
    { kind: 'public', address, canvas: true, target: expected.target }, 'Opening a shared artwork link preserves its public target even for its owner');
  const overview = applicationRouteUrl({ href: new URL(href, location.href).href }, { kind: 'profile', address });
  assert.equal(overview.includes('canvas='), false);
  assert.equal(overview.includes('module='), false);
  assert.match(overview, /keep=yes/);
  assert.deepEqual(readApplicationRoute({ search: `?view=${address}&module=text:ignored` }), { kind: 'profile', address, target: { moduleId: 'text:ignored' } });
});
