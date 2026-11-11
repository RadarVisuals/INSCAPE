import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReception } from '../../src/profileDocument/domain/receptionPresentation.js';
import { splitReception } from '../../src/reception/receptionLayout.js';
import { createArticle } from '../../src/text/domain/article.js';

// Synthetic data, committed through the real validator; never uses an owner profile.
export function receptionStylingSeed() {
  const address = '0x3333333333333333333333333333333333333333';
  let raw;
  const store = createSystemWorkflowDraftStore({ profileAddress: address, storage: { getItem: () => null, setItem: (_, value) => { raw = value; } } });
  let reception = createReception();
  const first = reception.regions[0].id;
  reception = splitReception(reception, first, 'x', 'region:text');
  reception = splitReception(reception, first, 'y', 'region:links');
  reception = splitReception(reception, 'region:links', 'x', 'region:details');
  reception.regions = reception.regions.map(region => ({ ...region, content: region.id === first ? 'introduction' : region.id === 'region:text' ? 'text:style' : region.id === 'region:links' ? 'links' : 'details', padding: 24 }));
  reception.branding.name = 'STYLING REVIEW';
  const article = createArticle('A small world');
  article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'An authored article keeps its own typography in every presentation.' }] }] };
  reception.texts = [{ id: 'text:style', article, visibility: 'PUBLIC' }];
  const draft = store.getDraft();
  draft.identityPresentation.alias = 'Human underneath';
  draft.identityPresentation.bio = { mode: 'inscape', customText: 'Illustrations, small worlds and places to discover. This introduction should read the same before, during and after editing.' };
  draft.identityPresentation.tags.additional = ['Illustration', 'World building'];
  draft.identityPresentation.card = { version: 1, columns: 2, background: { type: 'plain', color: '#161818', speed: 1 }, fields: [
    { id: 'field:location', label: 'Location', type: 'text', value: 'Underneath' },
    { id: 'field:medium', label: 'Medium', type: 'text', value: 'Illustration / world building' },
  ] };
  if (!store.commitCompletedOperation({ ...draft, reception }, { expectedGeneration: store.getGeneration() })) throw Error('Styling seed invalid');
  return { address, key: systemWorkflowDraftKey(address), raw };
}
