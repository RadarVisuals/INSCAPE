import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createArticle } from '../../text/domain/article.js';
import { workbenchOverviewModel } from './workbenchOverviewModel.js';

test('preview uses saved origin, open frames, artwork and authored layer order without mutating its input', () => {
  const draft = createEmptySystemWorkflowDraft(`0x${'1'.repeat(40)}`);
  draft.shapes = [{ id: 'shape:a' }, { id: 'shape:closed' }];
  draft.imageModules = [{ id: 'image:a', width: 120, height: 80, artwork: { crop: { x: .3, y: .6, zoom: 2 } } }];
  draft.texts = [{ id: 'text:a', article: createArticle('Title') }];
  draft.artworkLayers = ['image:a', { id: 'composition:a', name: 'A block', children: ['shape:a', 'text:a'] }, 'shape:closed'];
  draft.workbench = { ...createDefaultWorkbenchPresentation(), area: { left: -100, top: -50, width: 800, height: 600 },
    shapes: [{ id: 'shape:a', open: true, window: { left: -80, top: 0, width: 200, height: 100 } }, { id: 'shape:closed', open: false }],
    imageModules: [{ id: 'image:a', open: true, position: { left: 100, top: 80 } }],
    texts: [{ id: 'text:a', open: true, window: { left: 200, top: 150, width: 200, height: 250 }, frames: [{ id: 'text-frame:a', window: { left: 400, top: 150, width: 200, height: 250 } }] }] };
  const before = structuredClone(draft), result = workbenchOverviewModel(draft);
  assert.doesNotMatch(result.contains, /Display/);
  assert.deepEqual(result.area, draft.workbench.area);
  assert.deepEqual(result.items.map(item => item.id), ['image:a', 'shape:a', 'text:a']);
  assert.deepEqual(result.items[0].frame, { left: 100, top: 80, width: 120, height: 80 });
  assert.deepEqual(result.items[0].source.crop, draft.imageModules[0].artwork.crop);
  assert.deepEqual(result.items[2].source.frames, draft.workbench.texts[0].frames);
  assert.equal(result.items[2].source.article, draft.texts[0].article);
  assert.deepEqual(draft, before);
});

test('a mixed composition uses one native layout for artwork and source details', () => {
  const composition = { version: 3, cells: [{ id: 'shape:cell', members: [] }],
    shapes: [{ id: 'shape:cell', name: 'Cell' }, { id: 'shape:free', name: 'Drawing' }],
    imageModules: [], texts: [], artworkLayers: ['shape:cell', 'shape:free'],
    workbench: { ...createDefaultWorkbenchPresentation(), area: { left: 0, top: 0, width: 1440, height: 900 },
      shapes: ['shape:cell', 'shape:free'].map((id, index) => ({ id, open: true, window: { left: 80 + index * 200, top: 40, width: 160, height: 120 } })) },
  };
  const model = workbenchOverviewModel({ composition, grids: [], texts: [{ id: 'text:unused' }] });
  assert.equal(model.composition, composition);
  assert.deepEqual(model.area, composition.workbench.area);
  assert.deepEqual(model.items.map(item => item.id), ['shape:cell', 'shape:free']);
  assert.match(model.contains, /1 cell/);
  assert.deepEqual(model.items[1].frame, { left: 280, top: 40, width: 160, height: 120 });
});
