// @ts-check
import { createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createImagePresentation } from '../../imageModule/imageModule.js';
import { createShapePresentation } from '../../shapes/shapes.js';

// Pure projection for Preview and Prepare Publication. The host supplies live
// presentation inputs; only the existing authoring session saves the result.
// The current draft's module lists determine membership, never cached layouts.
/**
 * @param {import('../../contracts/workbench.js').CapturePresentationInput} input
 * @returns {import('../../contracts/workbench.js').CapturePresentationResult}
 */
export function captureWorkbenchPresentation({
  layout, identityOpen,
  texts, textPresentations = {},
  imageModules, imagePresentations = {}, savedImagePresentations = [],
  shapes, shapePresentations = {}, savedShapePresentations = [],
}) {
  try {
    // Optional collections are rebuilt from authored membership. Saved layouts
    // and live reports are fallbacks for those IDs only, including after Undo.
    const { texts: savedTexts, imageModules: savedImages, shapes: savedShapes, keeperDocks: savedKeepers, ...base } = layout;
    return { error: null, value: {
      ...base,
      ...(shapes ? { shapes: shapes.map((item, index) => shapePresentations[item.id]
        || savedShapes?.find(p => p.id === item.id) || savedShapePresentations.find(p => p.id === item.id)
        || createShapePresentation(item.id, index)) } : {}),
      ...(imageModules ? { imageModules: imageModules.map((item, index) => imagePresentations[item.id]
        || savedImages?.find(p => p.id === item.id) || savedImagePresentations.find(p => p.id === item.id)
        || createImagePresentation(item.id, index)) } : {}),
      ...(texts ? { texts: texts.map((text, index) => textPresentations[text.id]
        || savedTexts?.find(item => item.id === text.id) || createTextPresentation(text.id, index)) } : {}),
      identity: { ...layout.identity, open: identityOpen },
    } };
  } catch {
    return { error: 'The current workbench layout could not be prepared for publication.', value: null };
  }
}
