import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createArticle } from '../../text/domain/article.js';
import { workbenchOverviewModel, overviewAssetIds } from './workbenchOverviewModel.js';

test('preview uses saved origin, open frames, first sides and authored layer order without mutating its input', () => {
  const draft = createEmptySystemWorkflowDraft(`0x${'1'.repeat(40)}`); draft.grids = [];
  draft.shapes = [{ id: 'shape:a' }, { id: 'shape:closed' }];
  draft.imageModules = [{ id: 'image:a', width: 120, height: 80, sides: [{ crop: { x: .3, y: .6, zoom: 2 } }] }];
  draft.texts = [{ id: 'text:a', article: createArticle('Title') }];
  draft.miniApps = [{ id: 'miniapp:a', name: 'Interactive study', url: 'https://example.com/' }];
  draft.artworkLayers = ['image:a', { id: 'composition:a', name: 'A block', children: ['shape:a', 'text:a'] }, 'shape:closed'];
  draft.workbench = { ...createDefaultWorkbenchPresentation(), area: { left: -100, top: -50, width: 800, height: 600 },
    shapes: [{ id: 'shape:a', open: true, window: { left: -80, top: 0, width: 200, height: 100 } }, { id: 'shape:closed', open: false }],
    imageModules: [{ id: 'image:a', open: true, position: { left: 100, top: 80 } }],
    texts: [{ id: 'text:a', open: true, window: { left: 200, top: 150, width: 200, height: 250 }, frames: [{ id: 'text-frame:a', window: { left: 400, top: 150, width: 200, height: 250 } }] }] };
  const before = structuredClone(draft), result = workbenchOverviewModel(draft);
  assert.deepEqual(result.area, draft.workbench.area);
  assert.deepEqual(result.items.map(item => item.id), ['miniapp:a', 'image:a', 'shape:a', 'text:a']);
  assert.deepEqual(result.items[1].frame, { left: 100, top: 80, width: 120, height: 80 });
  assert.deepEqual(result.items[1].source.crop, draft.imageModules[0].sides[0].crop);
  assert.deepEqual(result.items[3].source.frames, draft.workbench.texts[0].frames);
  assert.equal(result.items[0].source.url, undefined, 'interactive previews have no execution destination');
  assert.deepEqual(overviewAssetIds(draft), []); assert.deepEqual(draft, before);
});
