import { compositionArtworkFields } from './retiredInterfaceAppearance.js';
import { createImagePresentation } from '../../imageModule/imageModule.js';
import { createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { COMPOSITION_LAYOUT_KEYS, validCompositionEditorDocument, createCompositionEditorDocument, reconcileCompositionCells } from '../../composition/compositionEditorDocument.js';
import { applyCompositionLayout, COMPOSITION_LAYOUT_DEFAULTS } from '../../composition/compositionLayoutGenerator.js';
import { createShapePresentation } from '../../shapes/shapes.js';
import { artworkLayers } from './artworkLayers.js';
import { assertValidSystemWorkflowDraft, createBlankWorkbenchDraft } from './systemWorkflowDraft.js';
import { DEFAULT_WORKBENCH_AREA } from './workbenchArea.js';

export function createStudioComposition(layout) {
  const blank = createCompositionEditorDocument();
  if (layout === 'bento') return reconcileCompositionCells(blank, applyCompositionLayout(blank, COMPOSITION_LAYOUT_DEFAULTS, 1));
  if (layout !== 'canvas') throw new Error('Choose Canvas or Bento.');
  return { ...blank, workbench: { ...blank.workbench, area: { ...DEFAULT_WORKBENCH_AREA } } };
}

export function createStudioDraft(profileAddress, layout = 'canvas') {
  const { version, ...content } = createStudioComposition(layout);
  return { ...createBlankWorkbenchDraft(profileAddress), ...content };
}

// One-time read boundary for the two shapes written by the current editor.
// Neither shape is retained as an editing mode. Conflicting IDs fail explicitly:
// opening a workspace never overwrites or renames authored content to fit it.
export function currentStudioDraft(input, livePresentation) {
  if (Array.isArray(input?.cells) && !Object.hasOwn(input, 'composition')) return assertValidSystemWorkflowDraft(input);
  const { composition: saved, ...base } = input || {};
  const composition = saved === undefined ? undefined : compositionArtworkFields(saved);
  if (saved !== undefined && (COMPOSITION_LAYOUT_KEYS.some(key => Object.hasOwn(base, key)) || !validCompositionEditorDocument(composition)))
    throw new Error('Invalid saved Studio composition. Its stored copy has been kept.');
  const outer = assertValidSystemWorkflowDraft(base);
  const { version, ...blank } = createStudioComposition('canvas');
  const mergeRecords = (first = [], second = []) => {
    const result = [...first];
    for (const item of second) {
      const existing = result.find(value => value.id === item.id);
      if (!existing) result.push(item);
      else if (JSON.stringify(existing) !== JSON.stringify(item))
        throw Object.assign(new Error(`The two saved document paths contain conflicting data for ${item.id}. Their stored copy has been kept.`), { code: 'STUDIO_DOCUMENT_CONFLICT' });
    }
    return result;
  };
  const next = { ...blank, ...outer };
  const presentation = { ...blank.workbench, ...outer.workbench, ...livePresentation };
  if (composition) {
    const { version: _version, ...content } = composition;
    Object.assign(next, content);
    Object.assign(presentation, composition.workbench);
    const area = outer.workbench?.area;
    if (area) {
      const other = presentation.area, left = Math.min(area.left || 0, other.left || 0), top = Math.min(area.top || 0, other.top || 0);
      presentation.area = { left, top, width: Math.max((area.left || 0) + area.width, (other.left || 0) + other.width) - left,
        height: Math.max((area.top || 0) + area.height, (other.top || 0) + other.height) - top };
    }
  }
  const defaults = { shapes: createShapePresentation, texts: createTextPresentation, imageModules: createImagePresentation };
  for (const key of Object.keys(defaults)) {
    const items = mergeRecords(outer[key], composition?.[key]);
    next[key] = items;
    const positions = new Map(mergeRecords((livePresentation || outer.workbench)?.[key], composition?.workbench[key]).map(item => [item.id, item]));
    presentation[key] = items.map((item, index) => positions.get(item.id) || defaults[key](item.id, index));
  }
  next.workbench = presentation;
  next.artworkLayers = composition ? [...artworkLayers(outer), ...artworkLayers(composition)] : artworkLayers(outer);
  if (outer.workbench?.keeperDocks) next.workbench.keeperDocks = outer.workbench.keeperDocks;
  const locks = [...new Set([...(outer.workbench?.lockedLayerIds || []), ...(composition?.workbench.lockedLayerIds || [])])];
  if (locks.length) next.workbench.lockedLayerIds = locks;
  return assertValidSystemWorkflowDraft(next);
}
