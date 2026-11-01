import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { createNamedWorkbenchActions } from './namedWorkbenchActions.js';
import WorkbenchSwitcher from './WorkbenchSwitcher.jsx';
import { EditorCellEditingNotice } from '../../reception/EditorCellsContext.jsx';

// Owner-only wiring stays outside the name form so a later overview can reuse
// the workflow without depending on the canvas camera or this control's DOM.
export default function OwnerWorkbenchSwitcher({ store, projection, flushLayout, busy, hidden, documentNavigation, ...props }) {
  // The owner session already subscribes to every store operation, including
  // name-only changes. Do not add a second subscription to the same canvas.
  const { locked } = useWorkbenchCamera();
  const actions = createNamedWorkbenchActions({ store, projection, flushLayout, busy });
  return <WorkbenchSwitcher {...props} hidden={hidden || locked}
    items={documentNavigation?.items || store.listWorkbenches()} activeId={documentNavigation?.activeId || store.getWorkbenchId()}
    receptionAvailable={Boolean(documentNavigation)}
    actions={documentNavigation ? { ...actions, switchTo: documentNavigation.select } : actions}>
    <EditorCellEditingNotice />
  </WorkbenchSwitcher>;
}
