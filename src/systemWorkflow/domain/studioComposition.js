import { createImagePresentation } from '../../imageModule/imageModule.js';
import { createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createReceptionEditorDocument, reconcileReceptionCells } from '../../reception/receptionEditorDocument.js';
import { applyReceptionLayout, RECEPTION_LAYOUT_DEFAULTS } from '../../reception/receptionLayoutGenerator.js';
import { createShapePresentation } from '../../shapes/shapes.js';
import { artworkLayers } from './artworkLayers.js';
import { validateSystemWorkflowDraft } from './systemWorkflowDraft.js';
import { DEFAULT_WORKBENCH_AREA } from './workbenchArea.js';

export function createStudioComposition(layout) {
  const blank = createReceptionEditorDocument();
  if (layout === 'bento') return reconcileReceptionCells(blank, applyReceptionLayout(blank, RECEPTION_LAYOUT_DEFAULTS, 1));
  if (layout !== 'canvas') throw new Error('Choose Canvas or Bento.');
  return { ...blank, workbench: { ...blank.workbench, area: { ...DEFAULT_WORKBENCH_AREA } } };
}

// These existing module types have their own canvas presentation and reader.
// Moving them into a native layer document would change their behavior.
export function studioCellsUnavailableReason(draft) {
  if (draft.grids?.length || draft.displays?.length || draft.workbench?.displays?.length) return 'This canvas uses Display.';
  if (draft.workbench?.keeperDocks?.length) return 'This canvas uses a Keeper dock.';
  if (draft.workbenchGroups?.length || draft.workbenchIndex) return 'This canvas uses workspace groups or a camera index.';
  if (draft.texts?.some(text => text.sceneLink || text.pagination) || draft.workbench?.texts?.some(text => text.frames))
    return 'This canvas uses linked or paginated text.';
  return '';
}

export function enableStudioCells(draft) {
  const reason = studioCellsUnavailableReason(draft);
  if (reason) throw new Error(reason);
  const { workbench, shapes = [], texts = [], imageModules = [], artworkLayers: layers, ...rest } = draft;
  const blank = createStudioComposition('canvas');
  const presentation = { ...blank.workbench, ...workbench };
  const records = { shapes, texts, imageModules };
  const defaults = { shapes: createShapePresentation, texts: createTextPresentation, imageModules: createImagePresentation };
  for (const [key, items] of Object.entries(records)) {
    const positions = new Map(workbench?.[key]?.map(item => [item.id, item]));
    presentation[key] = items.map((item, index) => positions.get(item.id) || defaults[key](item.id, index));
  }
  return { ...rest, composition: { ...blank, ...records, workbench: presentation, artworkLayers: layers || artworkLayers(draft) } };
}


// The full canvas host can open this exact artwork only while every authored
// field has a counterpart there. Unknown or Bento-only metadata stays native.
export function canvasModuleDraft(draft) {
  const { composition, ...rest } = draft;
  if (!composition) return null;
  const { cells, branding, version, shapes, texts, imageModules, workbench, artworkLayers: layers, ...bentoSettings } = composition;
  if (version !== 3 || cells.length || branding.name || branding.logo || Object.keys(bentoSettings).length) return null;
  const artwork = { shapes, texts, imageModules, workbench, artworkLayers: layers };
  if (Object.keys(artwork).some(key => Object.hasOwn(rest, key))) return null;
  const next = { ...rest, ...artwork };
  return validateSystemWorkflowDraft(next).valid ? next : null;
}
