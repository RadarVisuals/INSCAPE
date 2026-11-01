// Compile only: exercise the actual operation, lifecycle and commit exports.
import { createWorkbenchMoveOperation } from '../src/public/ownerSystemWorkflow/workbenchMoveOperation.js';
import { createWorkbenchResizeOperation } from '../src/public/ownerSystemWorkflow/workbenchResizeOperation.js';
import { createWorkbenchGestures } from '../src/public/ownerSystemWorkflow/workbenchGestures.js';
import { moveWorkbenchGroup } from '../src/systemWorkflow/moveWorkbenchGroup.js';
import { commitWorkbenchSelectionResize, prepareWindowResize } from '../src/systemWorkflow/resizeWorkbenchSelection.js';
import { DISPLAY_WINDOW_LIMITS } from '../src/profileDocument/domain/workbenchPresentation.js';
import { useWorkbenchViewRegistration } from '../src/public/ownerSystemWorkflow/WorkbenchViewContext.js';
import type { MoveOperationInput, ResizeOperationInput, WorkbenchOperationOrigin, VisitorOperationOrigin,
  WorkbenchResizeTarget, SelectionResizeChange, MountedWorkbenchStore, WorkbenchPresentation,
  WorkbenchGestureInput, WindowId, MountedWorkbenchViewValue, Frame } from '../src/contracts/workbench.js';

declare const store: MountedWorkbenchStore;
declare const presentation: WorkbenchPresentation;
declare const moveInput: MoveOperationInput;
declare const resizeInput: ResizeOperationInput;
declare const target: WorkbenchResizeTarget;
declare const change: SelectionResizeChange;
declare const gestureInput: WorkbenchGestureInput<{ ids: WindowId[] }>;
declare const event: PointerEvent;
declare const mounted: MountedWorkbenchViewValue;
declare const frame: Frame;
declare const node: { current: HTMLElement | null };
const origin: WorkbenchOperationOrigin = { kind: 'owner', store, profileAddress: '0x123',
  isCurrent: () => store.isCurrent(), getPresentation: () => presentation };
const visitor: VisitorOperationOrigin = { kind: 'visitor', isCurrent: () => true };
const move = createWorkbenchMoveOperation({ ...moveInput, origin });
const resize = createWorkbenchResizeOperation({ ...resizeInput, origin: visitor });
const gestures = createWorkbenchGestures(gestureInput);
// These are the actual provider registries, not separately declared adapter maps.
createWorkbenchMoveOperation({ ...moveInput, registry: mounted, transforms: mounted.transforms });
createWorkbenchResizeOperation({ ...resizeInput, registry: mounted, transforms: mounted.transforms });
if (mounted.store) createWorkbenchResizeOperation({ ...resizeInput, registry: mounted,
  origin: { ...origin, store: mounted.store } });
useWorkbenchViewRegistration('image:one', node, true, frame, target);
// PresentationBoardDefinitive supplies this window-only capability: it has no
// expected content record, and uses the existing no-content-change preparer.
const displayTarget: WorkbenchResizeTarget = { enabled: true, continuousGeometry: true,
  store, profileAddress: '0x123', layoutKey: 'display', commit: commitWorkbenchSelectionResize,
  prepare: prepareWindowResize, applyFrame() {}, reportError() {}, ...DISPLAY_WINDOW_LIMITS };
useWorkbenchViewRegistration('display:primary', node, true, frame, displayTarget);
useWorkbenchViewRegistration('display:other', node, true, frame, { ...displayTarget, layoutKey: 'displays' });
commitWorkbenchSelectionResize([{ ...displayTarget, store, id: 'display:primary', ...frame }]);
type IsUnchecked<T> = 0 extends (1 & T) ? true : false;
const moveChecked: IsUnchecked<NonNullable<typeof move>> = false;
const resizeChecked: IsUnchecked<NonNullable<typeof resize>> = false;
const gesturesChecked: IsUnchecked<typeof gestures> = false;
if (move) {
  move.preview({ x: 8, y: 0 }, true);
  const saved: boolean = move.commit();
  gestures.beginMove(event, { ...move, previewDrop() {}, commitDrop: () => false });
  void saved;
}
if (resize) {
  resize.previewByKey('ArrowRight', true, false);
  gestures.beginResize(event, resize);
}
gestures.beginMarquee(event, { beforeSelection: { ids: ['image:one'] }, previousSelection: [], hits: () => ['text:two'] });
gestures.cancel(false);
commitWorkbenchSelectionResize([change]);
moveWorkbenchGroup(store, '0x123', [{ id: 'image:one', left: 20, top: 30 }], presentation, 1);

// @ts-expect-error Owner preparation requires its captured scoped writer.
const missingWriter: WorkbenchOperationOrigin = { kind: 'owner', isCurrent: () => true, profileAddress: '0x123', getPresentation: () => presentation };
const visitorWithWriter = { ...visitor, store };
// @ts-expect-error Even a wider Visitor object cannot carry a writer.
createWorkbenchMoveOperation({ ...moveInput, origin: visitorWithWriter });
// @ts-expect-error Selection membership is window identity, not Workbench identity.
createWorkbenchMoveOperation({ ...moveInput, selection: { ...moveInput.selection, ids: ['workbench:other'] } });
// @ts-expect-error Selection resizing requires a corner, not an edge.
createWorkbenchResizeOperation({ ...resizeInput, corner: 'e' });
// @ts-expect-error Camera geometry is numeric.
createWorkbenchResizeOperation({ ...resizeInput, geometry: { ...resizeInput.geometry, scale: 'fit' } });
// @ts-expect-error Commit must finish synchronously, before module frames are applied.
const asyncCommit: WorkbenchResizeTarget = { ...target, commit: async () => true };
// @ts-expect-error A module preparer must return its candidate synchronously.
const asyncPrepare: WorkbenchResizeTarget = { ...target, prepare: async draft => draft };
// @ts-expect-error The host cannot inspect the module-owned payload.
target.expected.grid;
const { minimumSize, minimumWidth, minimumHeight, ...withoutMinima } = target;
// @ts-expect-error The target must supply either a size minimum or both dimension minima.
const unboundedTarget: WorkbenchResizeTarget = withoutMinima;
const { store: removedWriter, ...withoutWriter } = change;
// @ts-expect-error A candidate cannot reach the shared commit without its scoped writer.
commitWorkbenchSelectionResize([withoutWriter]);
// @ts-expect-error Commit candidates preserve window identity.
commitWorkbenchSelectionResize([{ ...change, id: 'workbench:other' }]);
// @ts-expect-error The move's captured generation is numeric.
moveWorkbenchGroup(store, '0x123', [], presentation, 'latest');
// @ts-expect-error Preparation may fail; callers must narrow the operation first.
move.commit();
// @ts-expect-error Preview coordinates are numeric.
move?.preview({ x: 'right', y: 0 });
// @ts-expect-error Keyboard geometry accepts only the four arrow keys.
resize?.previewByKey('Enter');
// @ts-expect-error The gesture cannot await asynchronous authored completion.
if (resize) gestures.beginResize(event, { ...resize, commit: async () => true });
// @ts-expect-error A move preview returns transforms or cancellation, not an availability flag.
if (move) gestures.beginMove(event, { ...move, preview: () => true, previewDrop() {}, commitDrop: () => false });
// @ts-expect-error Releasing an abandoned gesture returns the owned pointer identity.
const pointerName: string = gestures.releaseAbandoned();
// @ts-expect-error Rollback requires the captured transform map.
if (resize) gestures.beginResize(event, { ...resize, beforeTransforms: null });
// @ts-expect-error Visitor operation input exposes no authored presentation capture.
visitor.getPresentation();
// @ts-expect-error The live registry cannot accept a restoration-only target without preparation/commit/limits.
useWorkbenchViewRegistration('image:one', node, true, frame, { store, layoutKey: 'imageModules', applyFrame() {} });
// @ts-expect-error Content-module preparation still requires its opaque expected record.
const missingImageSnapshot: WorkbenchResizeTarget = { enabled: true, store, profileAddress: '0x123', layoutKey: 'imageModules', commit: commitWorkbenchSelectionResize, prepare: prepareWindowResize, applyFrame() {}, minimumSize: 32, maximumWidth: 4096, maximumHeight: 4096 };

void [moveChecked, resizeChecked, gesturesChecked, minimumSize, minimumWidth, minimumHeight, removedWriter];
