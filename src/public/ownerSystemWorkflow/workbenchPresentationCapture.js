import { createDefaultWorkbenchPresentation, createMiniAppPresentation, createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { PRIMARY_DISPLAY_ID } from '../../systemWorkflow/domain/displayModules.js';
import { createImagePresentation } from '../../imageModule/imageModule.js';
import { createShapePresentation } from '../../shapes/shapes.js';
import { createKeeperPresentation } from '../../keeper/keeper.js';

// Pure projection for Preview and Prepare Publication. The host supplies live
// presentation inputs; only the existing authoring session saves the result.
// The current draft's module lists determine membership, never cached layouts.
export function captureWorkbenchPresentation({
  layout, identityOpen, hasPrimaryDisplay = true,
  displays, miniApps, texts, displayPresentations = {}, miniAppPresentations = {}, textPresentations = {},
  imageModules, imagePresentations = {}, savedImagePresentations = [],
  shapes, shapePresentations = {}, savedShapePresentations = [],
  keeperDocks, keeperPresentations = {}, savedKeeperPresentations = [],
}) {
  try {
    if (hasPrimaryDisplay && displayPresentations[PRIMARY_DISPLAY_ID] === null
      || displays?.some(({ id }) => displayPresentations[id] === null)) {
      throw new Error('A Display shortcut is unresolved');
    }

    // Optional collections are rebuilt from authored membership. Saved layouts
    // and live reports are fallbacks for those IDs only, including after Undo.
    const { displays: savedDisplays, miniApps: savedMiniApps, texts: savedTexts, imageModules: savedImages, shapes: savedShapes, keeperDocks: savedKeepers, ...base } = layout;
    return { error: null, value: {
      ...base,
      ...(keeperDocks ? { keeperDocks: keeperDocks.map((item, index) => keeperPresentations[item.id]
        || savedKeepers?.find(p => p.id === item.id) || savedKeeperPresentations.find(p => p.id === item.id)
        || createKeeperPresentation(item.id, index)) } : {}),
      ...(shapes ? { shapes: shapes.map((item, index) => shapePresentations[item.id]
        || savedShapes?.find(p => p.id === item.id) || savedShapePresentations.find(p => p.id === item.id)
        || createShapePresentation(item.id, index)) } : {}),
      ...(imageModules ? { imageModules: imageModules.map((item, index) => imagePresentations[item.id]
        || savedImages?.find(p => p.id === item.id) || savedImagePresentations.find(p => p.id === item.id)
        || createImagePresentation(item.id, index)) } : {}),
      ...(texts ? { texts: texts.map((text, index) => textPresentations[text.id]
        || savedTexts?.find(item => item.id === text.id) || createTextPresentation(text.id, index)) } : {}),
      ...(miniApps ? { miniApps: miniApps.map((app, index) => miniAppPresentations[app.id]
        || savedMiniApps?.find(item => item.id === app.id) || createMiniAppPresentation(app.id, index)) } : {}),
      ...(displays ? { displays: displays.map(({ id }) => ({ id, ...(displayPresentations[id]
        || savedDisplays?.find(item => item.id === id) || createDefaultWorkbenchPresentation().display) })) } : {}),
      display: hasPrimaryDisplay ? displayPresentations[PRIMARY_DISPLAY_ID] || layout.display
        : { ...createDefaultWorkbenchPresentation().display, open: false },
      identity: { ...layout.identity, open: identityOpen },
    } };
  } catch {
    return { error: 'The Display shortcut artwork is still unavailable. Open Library to resolve it, or reset its icon before publishing.', value: null };
  }
}
