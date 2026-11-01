import { editorOverview } from './editor-menu.mjs';

export async function seedPresentation(page, { portrait = false } = {}) {
  for (const number of ['01', '02']) await page.route(`**/mountain_${number}.webp`, route => route.fulfill({ path: `public/assets/stage/mountains/mountain_${number}.webp`, contentType: 'image/webp' }));
  if (portrait) await page.route('**/skull_reaper/full.webp', route => route.fulfill({ path: 'public/assets/actors/skull_reaper/full.webp', contentType: 'image/webp' }));
  await page.evaluate(async portrait => {
    const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createWorkbenchIndex } = await import('/src/systemWorkflow/domain/workbenchIndex.js');
    const { defaultTextAppearance } = await import('/src/text/domain/article.js');
    const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[2].id);
    asset.name = 'Mountain study'; asset.description = 'A quiet study of the horizon.'; asset.attributes = [{ key: 'Mood', value: 'Quiet', type: null }];
    const other = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[3].id);
    other.name = 'Second artwork'; other.attributes = [{ key: 'Material', value: 'Paper', type: null }];
    const store = window.guardedStore(), draft = store.getDraft();
    draft.workbench.area = { left: 0, top: 0, width: 5000, height: 5000 };
    draft.appearance.menuSurfaceId = 'carbon';
    draft.workbench.texts[0].window = { left: 300, top: 3500, width: 4200, height: 1100 };
    draft.texts[0].article.title = 'HORIZON / FIELD NOTES';
    draft.texts[0].article.appearance = { ...defaultTextAppearance(), fontSize: 100, titleFontSize: 160, padding: { top: 80, right: 80, bottom: 80, left: 80 } };
    draft.texts[0].article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Collected fragments of a landscape. Three placements, two independent works, one composition.' }] }] };
    draft.shapes = [{ id: 'shape:ground', name: 'Ground', color: '#a9b9b1', opacity: 1, visibility: 'PRIVATE' }];
    draft.workbench.shapes = [{ id: 'shape:ground', open: true, window: { left: 0, top: 0, width: 5000, height: 5000 } }];
    draft.imageModules = [asset, asset, other].map((asset, i) => ({ id: `image:study${i}`, name: asset.name, width: 1900, height: 1300, visibility: 'PRIVATE',
      sides: [{ id: `side:study${i}`, asset, crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }));
    draft.workbench.imageModules = draft.imageModules.map((item, i) => ({ id: item.id, open: true, position: { left: 350 + (i % 2) * 2300, top: 400 + Math.floor(i / 2) * 1500 } }));
    draft.artworkLayers = ['shape:ground', ...draft.imageModules.map(item => item.id), draft.texts[0].id];
    draft.workbenchIndex = { ...createWorkbenchIndex(), destinations: [
      { id: 'workbench-view:vision', name: 'Vision', view: { left: 300, top: 300, width: 4300, height: 1500 }, visibility: 'PUBLIC' },
      { id: 'workbench-view:detail', name: 'Detail 1', view: { left: 300, top: 1800, width: 2100, height: 1500 }, visibility: 'PRIVATE' },
    ] };
    if (portrait) {
      const portraitAsset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[1].id);
      draft.workbench.area = { left: 0, top: 0, width: 962, height: 1216 };
      draft.texts = []; draft.workbench.texts = [];
      draft.shapes[0].color = '#001722'; draft.workbench.shapes[0].window = { ...draft.workbench.area };
      draft.imageModules = [{ ...draft.imageModules[0], width: 962, height: 1216,
        sides: [{ ...draft.imageModules[0].sides[0], asset: portraitAsset }] }];
      draft.workbench.imageModules = [{ id: draft.imageModules[0].id, open: true, position: { left: 0, top: 0 } }];
      draft.artworkLayers = ['shape:ground', draft.imageModules[0].id];
      draft.workbenchIndex = createWorkbenchIndex();
    }
    if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Presentation fixture save failed');
  }, portrait);
  await page.reload(); await editorOverview(page);
}
