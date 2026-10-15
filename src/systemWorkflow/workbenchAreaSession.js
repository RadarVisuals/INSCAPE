import { validWorkbenchArea, workbenchArea } from './domain/workbenchArea.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';

export function resizeWorkbenchCanvas(store, profile, expectedGeneration, area, presentation) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  if (store.getGeneration() !== expectedGeneration) throw new Error('The Workbench changed. Try resizing again.');
  if (!validWorkbenchArea(area)) throw new Error('Canvas dimensions must be whole pixels between 256 and 16384.');
  const draft = store.getDraft(), previous = workbenchArea(draft.workbench);
  if (previous.width === area.width && previous.height === area.height) return false;
  const layout = presentation || draft.workbench || createDefaultWorkbenchPresentation();
  if (!store.commitCompletedOperation({ ...draft, workbench: { ...layout, area: { ...area } } }, {
    expectedGeneration, historyLabel: 'Resize canvas',
  })) throw new Error('The canvas size could not be saved. Your saved work is unchanged.');
  return true;
}
