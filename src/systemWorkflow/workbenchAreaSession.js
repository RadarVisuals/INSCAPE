import { validWorkbenchArea, workbenchArea } from './domain/workbenchArea.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';

export function resizeWorkbenchCanvas(store, profile, expectedGeneration, area, presentation) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  if (store.getGeneration() !== expectedGeneration) throw new Error('The Workbench changed. Try resizing again.');
  if (!validWorkbenchArea(area)) throw new Error('Canvas dimensions must be whole pixels between 1 and 16384, within the Workbench editing limits.');
  const draft = store.getDraft(), previous = workbenchArea(draft.workbench);
  const next = workbenchArea({ area });
  if (['left', 'top', 'width', 'height'].every(key => previous[key] === next[key])) return false;
  const layout = presentation || draft.workbench || createDefaultWorkbenchPresentation();
  if (!store.commitCompletedOperation({ ...draft, workbench: { ...layout, area: { ...area } } }, {
    expectedGeneration, historyLabel: 'Resize canvas',
  })) throw new Error('The canvas size could not be saved. Your saved work is unchanged.');
  return true;
}
