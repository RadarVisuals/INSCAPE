import { createEmptySystemWorkflowDraft } from '../../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createArticle } from '../../src/text/domain/article.js';
import { createDefaultWorkbenchPresentation } from '../../src/profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
export const layersProfile = `0x${'1'.repeat(40)}`;
export function layersDraft() {
  const draft = createEmptySystemWorkflowDraft(layersProfile); draft.grids = [];
  const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[0].id);
  const side = id => ({ id: `side:${id}`, asset: structuredClone(asset), crop: { x: .4, y: .5, zoom: 1 }, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } });
  draft.imageModules = ['body', 'eyes'].map((id, index) => ({ id: `image:${id}`, name: index ? 'Eyes' : 'Body', width: 260, height: 220,
    sides: [side(`${id}-1`), side(`${id}-2`)], visibility: 'PUBLIC' }));
  draft.shapes = [{ id: 'shape:landscape', name: 'Landscape', color: '#758278', opacity: 1, visibility: 'PUBLIC' }];
  draft.texts = [{ id: 'text:mist', article: createArticle('Mist'), visibility: 'PUBLIC' }];
  draft.workbench = { ...createDefaultWorkbenchPresentation(),
    imageModules: [{ id: 'image:body', open: true, position: { left: 260, top: 180 } }, { id: 'image:eyes', open: true, position: { left: 380, top: 280 } }],
    shapes: [{ id: 'shape:landscape', open: true, window: { left: 160, top: 140, width: 540, height: 400 } }],
    texts: [{ id: 'text:mist', open: true, window: { left: 310, top: 230, width: 260, height: 180 } }],
  };
  draft.artworkLayers = ['shape:landscape', 'image:body', 'text:mist', 'image:eyes'];
  return draft;
}
