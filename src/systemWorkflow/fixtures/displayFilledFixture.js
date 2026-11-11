import { createEmptySystemWorkflowDraft, createEmptySystemWorkflowWorldCoverGrid, assertValidSystemWorkflowDraft } from '../domain/systemWorkflowDraft.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE } from '../../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createDefaultWorkbenchPresentation, createNewDisplayPresentation } from '../../profileDocument/domain/workbenchPresentation.js';

export const filledSvgMetadata = { assets: [{ url: 'https://art.test/filled-creature.svg?version=2',
  fileType: 'application/xml', width: 1400, height: 1100 }] };
export const filledAssets = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map((asset, index) => index === 0
  ? { ...asset, attributes: [{ key: 'Selected artwork', value: 'Vector creature', type: 'string' }] } : asset);
export const filledProfile = OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
export const filledDisplayId = 'display:filled-secondary';

// Three authored scenes, 32 layered artwork references each: two in the primary
// Display (one private), and one in a second public Display. Source images are
// existing transparent actors, scenery and backdrops, not generated placeholders.
export function createFilledDisplayDraft() {
  const draft = createEmptySystemWorkflowDraft(filledProfile, { generateId: () => 'filled-main' });
  const grid = (name, visibility = 'PUBLIC') => ({
    ...structuredClone(draft.grids[0]), id: `grid:${name}`, title: name, visibility,
    subtitle: `A layered ${name} composition`,
    placements: Array.from({ length: 32 }, (_, index) => {
      const asset = filledAssets[index % filledAssets.length];
      return {
        id: `${name}-art-${index}`, stableAssetId: asset.id,
        column: index === 30 ? 36 : index === 29 ? 31 : (index % 8) * 3,
        row: Math.floor(index / 8) * 3, columnSpan: 5, rowSpan: 4,
        layer: 31 - index, navigationOrder: index * 7 % 32,
        visibility: index === 31 ? 'PRIVATE' : 'PUBLIC', locked: index === 24,
        crop: index % 2 ? null : { x: .25 + index % 3 * .25, y: .5, zoom: 1 + index % 4 / 2 },
        transform: { quarterTurns: index % 4, mirrorX: index % 3 === 0, mirrorY: index % 5 === 0 },
        inspectionMode: index % 2 ? 'IN_PLACE' : 'LIFT',
        ...(index % 6 === 0 ? { mediaFrameRatio: 1.5 } : {}),
        ...(index % 4 === 0 ? { selectedMedia: {
          ...(index === 0 ? { url: filledSvgMetadata.assets[0].url, width: 1400, height: 1100 }
            : { url: `${asset.originalImageUrl}?attachment=${index}`, width: 1200 + index, height: 900 }),
        } } : {}),
      };
    }),
    groups: [[0, 3, 6], [8, 9], [28, 29, 30]].map((indices, index) => ({
      id: `group:${name}-${index}`, placementIds: indices.map(id => `${name}-art-${id}`),
    })),
  });
  draft.grids = [grid('filled-main'), grid('filled-private', 'PRIVATE'), createEmptySystemWorkflowWorldCoverGrid()];
  draft.displays = [{ id: filledDisplayId, visibility: 'PUBLIC', artboard: structuredClone(draft.artboard),
    geometry: structuredClone(draft.geometry), appearance: structuredClone(draft.appearance),
    grids: [grid('filled-secondary'), createEmptySystemWorkflowWorldCoverGrid()] }];
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.displays = [{ id: filledDisplayId, ...createNewDisplayPresentation('LANDSCAPE', 1) }];
  return assertValidSystemWorkflowDraft(draft);
}
