// Compile only: these calls exercise the exported production implementations.
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { captureWorkbenchPresentation } from '../src/public/ownerSystemWorkflow/workbenchPresentationCapture.js';
import { useWorkbenchToolSource, useArtworkOpener, useWorkbenchInspectionAction, workbenchModuleTransform } from '../src/public/ownerSystemWorkflow/WorkbenchViewContext.js';
import type { WorkflowDraft, WorkbenchPresentation, WorkbenchScope, WorkbenchSelection, ModuleActivation, WorkbenchViewValue } from '../src/contracts/workbench.js';

declare const draft: WorkflowDraft;
declare const presentation: WorkbenchPresentation;
declare const view: WorkbenchViewValue;
const store = createSystemWorkflowDraftStore({ profileAddress: '0x123', storage: {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
} });
const scope = store.getWorkbenchScope();
type IsUnchecked<T> = 0 extends (1 & T) ? true : false;
const scopeIsChecked: IsUnchecked<typeof scope> = false;
const scopeContract: WorkbenchScope = scope;
scope.switchWorkbench('workbench:other');
scope.commitCompletedOperation(draft, { expectedGeneration: 1 });
scope.restoreBackup(draft, { expectedGeneration: 1 });
scope.retryCompletedOperation(current => current, { expectedGeneration: 1 });
scope.guardWorkbenchTransition(() => 'Finish editing');
scope.subscribe(() => {});
const selection: WorkbenchSelection = ['image:one', 'text-frame:two', 'workbench:index'];
const activation: ModuleActivation = 'image:one';
useWorkbenchToolSource('shape:one', { color: 'module-owned control', fx: null });
useArtworkOpener('image:one', () => {});
useWorkbenchInspectionAction('display:primary', () => true);
workbenchModuleTransform(view, 'text-frame:two');
const captured = captureWorkbenchPresentation({ layout: presentation, identityOpen: false,
  imageModules: [{ id: 'image:one' }], displayPresentations: { 'display:primary': null } });
if (captured.value) captured.value.display.open;
else captured.error.toUpperCase();
const snapshot = scope.getSnapshot();
if (snapshot) snapshot.workbench?.identity.open;
const fallbackView: WorkbenchViewValue = { scale: 1, transforms: {}, entries: new Map() };
// @ts-expect-error A live registry must include its callbacks and geometry registries.
const incompleteProvider: WorkbenchViewValue = { ...fallbackView, toolSources: new Map() };
// @ts-expect-error Even a standalone context must supply its required geometry.
const incompleteFallback: WorkbenchViewValue = { scale: 1, transforms: {} };

// @ts-expect-error A module ID is not a Workbench ID.
scope.switchWorkbench('image:other');
// @ts-expect-error False is not a save candidate.
scope.commitCompletedOperation(false, { expectedGeneration: 1 });
// @ts-expect-error A generation is numeric.
scope.commitCompletedOperation(draft, { expectedGeneration: 'next' });
// @ts-expect-error Saving reports success/failure, not a new draft.
const savedDraft: WorkflowDraft = scope.commitCompletedOperation(draft, { expectedGeneration: 1 });
// @ts-expect-error Retry must return a candidate or cancellation, not a Promise.
scope.retryCompletedOperation(async current => current);
// @ts-expect-error A stale scope cannot reacquire a new activation handle.
scope.getWorkbenchScope();
// @ts-expect-error Profile switching remains a root capability.
scope.setProfileAddress('0x456');
// @ts-expect-error A Text frame is a selection target, not a module activation.
const frameActivation: ModuleActivation = 'text-frame:two';
// @ts-expect-error The Index window is selectable but is not a creative module.
const indexActivation: ModuleActivation = 'workbench:index';
// @ts-expect-error Module tools do not register against Workbench IDs.
useWorkbenchToolSource('workbench:main', { color: 'wrong target' });
// @ts-expect-error Host tool fields cannot silently accept arbitrary module data.
useWorkbenchToolSource('shape:one', { crop: { zoom: 2 } });
// @ts-expect-error Opening requires an action, not an availability flag.
useArtworkOpener('image:one', false);
// @ts-expect-error A nullable old/unavailable snapshot must be narrowed.
scope.getSnapshot().workbench;
// @ts-expect-error Capture membership preserves Image ID meaning.
captureWorkbenchPresentation({ layout: presentation, identityOpen: false, imageModules: [{ id: 'text:one' }] });
// @ts-expect-error Capture can fail; the value must be narrowed first.
captured.value.display;

void [scopeIsChecked, scopeContract, selection, activation, frameActivation, indexActivation];
