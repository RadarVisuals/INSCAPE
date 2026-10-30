import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react';

/** Prefixes distinguish targets; existing runtime validators still check syntax/length. */
export type ProfileAddress = `0x${string}`;
export type WorkbenchId = `workbench:${string}`;
export type DisplayId = `display:${string}`;
export type ImageId = `image:${string}`;
export type ShapeId = `shape:${string}`;
export type TextId = `text:${string}`;
export type MiniAppId = `miniapp:${string}`;
export type KeeperId = `keeper:${string}`;
export type ModuleId = DisplayId | ImageId | ShapeId | TextId | MiniAppId | KeeperId;
export type TextFrameId = `text-frame:${string}`;
export type SelectionId = ModuleId | TextFrameId | 'workbench:index';
export type WindowId = SelectionId;
/** Activation is a single module or no module; selection can contain several windows. */
export type ModuleActivation = ModuleId | null;
export type WorkbenchSelection = SelectionId[];
export interface Position { left: number; top: number }
export interface Frame extends Position { width: number; height: number }
export interface ImagePresentation { id: ImageId; open: boolean; position: Position }
export interface ShapePresentation { id: ShapeId; open: boolean; window: Frame }
export interface TextPresentation { id: TextId; open: boolean; window: Frame; frames?: { id: TextFrameId; window: Frame }[] }
export interface MiniAppPresentation { id: MiniAppId; open: boolean; window: Frame }
export interface DisplayPresentation {
  name: string; open: boolean; window: Frame;
  shortcut: { position: Position; visible: boolean; icon: unknown;
    iconPresentation: { labelSize: number; offsetX: number; offsetY: number; scale: number; size: number } };
}
export interface WorkbenchPresentation {
  version: number;
  display: DisplayPresentation;
  identity: { open: boolean; window: Position & { width: number; height?: number } };
  area?: { width: number; height: number };
  displays?: (DisplayPresentation & { id: DisplayId })[];
  miniApps?: MiniAppPresentation[];
  texts?: TextPresentation[];
  imageModules?: ImagePresentation[];
  shapes?: ShapePresentation[];
  keeperDocks?: { id: KeeperId; position: Position }[];
}
/** Module payloads remain validated by their own domains, not by this host contract. */
export interface WorkflowDraft {
  profileAddress: string;
  draftVersion: number;
  workbench?: WorkbenchPresentation;
  identityPresentation: { alias: string; [field: string]: unknown };
  grids: unknown[];
  workbenchGroups?: { memberIds: ModuleId[] }[];
  [domainField: string]: unknown;
}
export interface WorkbenchCollection {
  type: 'inscape-local-workbenches'; version: number; profileAddress: string;
  activeId: WorkbenchId; shared: unknown;
  workbenches: { id: WorkbenchId; name: string; introduction?: string; thumbnailCrop?: ThumbnailCrop | null; content: unknown }[];
}
export interface ThumbnailCrop { x: number; y: number; zoom: number }
export type WorkbenchBackup = WorkflowDraft | WorkbenchCollection;
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
export interface CommitOptions {
  expectedGeneration?: number;
  historyLabel?: string;
  recordHistory?: boolean;
  historyPresentation?: WorkbenchPresentation;
}
export interface RestoreOptions { expectedGeneration?: number; expectedFingerprint?: string }
export type SaveResult = boolean;
export type Release = () => void;
export type TransitionGuard = () => string | null;
export interface RecordState { status: 'absent' | 'valid' | 'corrupt' | 'unavailable'; reason?: string; fingerprint?: string; issues?: unknown[] }
/** Current unreadable snapshots throw. An old scope created without a draft can retain null. */
export interface WorkbenchScope {
  hasWriteAccess(): boolean;
  isCurrent(): boolean;
  getProfileAddress(): string;
  getWorkbenchId(): WorkbenchId;
  getSnapshot(): WorkflowDraft | null;
  getDraft(): WorkflowDraft | null;
  getGeneration(): number;
  getHistory(): { undo: string | null; redo: string | null };
  getRecordState(): RecordState;
  getLastCommitFailure(): string | null;
  isCollection(): boolean;
  listWorkbenches(): { id: WorkbenchId; name: string }[];
  getBackupSnapshot(draft?: WorkflowDraft): WorkbenchBackup | null;
  subscribe(listener: () => void): Release;
  guardWorkbenchTransition(check: TransitionGuard): Release;
  beginHistoryGroup(): void | false;
  endHistoryGroup(): void | false;
  undo(): SaveResult;
  redo(): SaveResult;
  commitCompletedOperation(candidate: WorkflowDraft, options?: CommitOptions): SaveResult;
  retryCompletedOperation(createCandidate: (draft: WorkflowDraft) => WorkflowDraft | null | false, options?: CommitOptions): SaveResult;
  restoreBackup(candidate: WorkbenchBackup, options?: RestoreOptions): SaveResult;
  createWorkbench(name: string, options?: { workbench?: WorkbenchPresentation; generateId?: () => string }): WorkbenchId | false;
  switchWorkbench(id: WorkbenchId, options?: { workbench?: WorkbenchPresentation }): SaveResult;
  renameWorkbench(name: string, options?: { workbench?: WorkbenchPresentation }): SaveResult;
  leaveWorkbench(value?: undefined, options?: { workbench?: WorkbenchPresentation }): SaveResult;
}
/** Mounted editor/visitor windows are reached only after the readable-draft boundary. */
export interface MountedWorkbenchStore extends WorkbenchScope {
  getSnapshot(): WorkflowDraft;
  getDraft(): WorkflowDraft;
}
export interface ToolSource { color?: ReactNode; fx?: ReactNode; image?: ReactNode; shape?: ReactNode }
export interface ViewTransform { scale: number; x: number; y: number; frame?: Frame; gridScale?: number }
export type ResizeLayoutKey = 'display' | 'displays' | 'texts' | 'miniApps' | 'imageModules' | 'shapes';
/** The registration hook and operation adapters use the same complete capability. */
export type ResizeTarget = WorkbenchResizeTarget;
export interface WorkbenchActionsValue {
  registerArtworkOpener?(id: ModuleId, action: MutableRefObject<() => void>): Release;
  registerInspection?(id: ModuleId, action: MutableRefObject<(source?: HTMLElement) => boolean | void>): Release;
}
export interface WorkbenchViewGeometry {
  scale: number;
  transforms: Partial<Record<WindowId, ViewTransform>>;
  presentationTransforms?: Partial<Record<WindowId, ViewTransform>>;
  entries: Map<WindowId, HTMLElement>;
}
/** The sole mounted provider supplies these registries and callbacks together. */
export interface MountedWorkbenchViewValue extends WorkbenchViewGeometry {
  store?: MountedWorkbenchStore;
  toolSources: Map<ModuleId, MutableRefObject<ToolSource>>;
  toolsChanged: () => void;
  frames: Map<WindowId, MutableRefObject<Frame | null> & { move?: ((position: Position) => void) | null }>;
  resizeTargets: Map<WindowId, MutableRefObject<ResizeTarget | null>>;
  register: (id: WindowId, node: HTMLElement | null) => void;
  changed: () => void;
}
/** Standalone windows have geometry only, without a partial live registry. */
export interface StandaloneWorkbenchViewValue extends WorkbenchViewGeometry {
  store?: undefined;
  toolSources?: undefined;
  toolsChanged?: undefined;
  frames?: undefined;
  resizeTargets?: undefined;
  register?: undefined;
  changed?: undefined;
}
export type WorkbenchViewValue = MountedWorkbenchViewValue | StandaloneWorkbenchViewValue;
export interface CapturePresentationInput {
  layout: WorkbenchPresentation;
  identityOpen: boolean;
  hasPrimaryDisplay?: boolean;
  displays?: { id: DisplayId }[];
  miniApps?: { id: MiniAppId }[];
  texts?: { id: TextId }[];
  imageModules?: { id: ImageId }[];
  shapes?: { id: ShapeId }[];
  displayPresentations?: Partial<Record<DisplayId, DisplayPresentation | null>>;
  miniAppPresentations?: Partial<Record<MiniAppId, MiniAppPresentation>>;
  textPresentations?: Partial<Record<TextId, TextPresentation>>;
  imagePresentations?: Partial<Record<ImageId, ImagePresentation>>;
  shapePresentations?: Partial<Record<ShapeId, ShapePresentation>>;
  savedImagePresentations?: ImagePresentation[];
  savedShapePresentations?: ShapePresentation[];
}
export type CapturePresentationResult =
  | { value: WorkbenchPresentation; error: null }
  | { value: null; error: string };

export interface Vector { x: number; y: number }
export interface WorkbenchBounds { left: number; top: number; right: number; bottom: number }
export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
export type WorkbenchTransforms = Partial<Record<WindowId, ViewTransform>>;
export type SetWorkbenchTransforms = Dispatch<SetStateAction<WorkbenchTransforms>>;
export type FrameRegistration = MutableRefObject<Frame | null> & { move?: ((position: Position) => void) | null };
/** Visitor inputs cannot carry an authored writer, including through a wider object. */
export interface VisitorOperationOrigin {
  kind: 'visitor';
  isCurrent(): boolean;
  store?: never;
  profileAddress?: never;
  getPresentation?: never;
}
export interface OwnerOperationOrigin {
  kind: 'owner';
  isCurrent(): boolean;
  store: MountedWorkbenchStore;
  profileAddress: string;
  getPresentation(): WorkbenchPresentation;
}
export type WorkbenchOperationOrigin = VisitorOperationOrigin | OwnerOperationOrigin;
export interface OperationGeometry {
  scale: number;
  rectangle(nodes: readonly HTMLElement[]): Frame | null;
  bounds(): WorkbenchBounds;
}
export interface MoveOperationInput {
  origin: WorkbenchOperationOrigin;
  selection: {
    ids: readonly WindowId[];
    selectedIds: readonly WindowId[];
    content: WorkflowDraft;
    layers: readonly (ModuleId | { children: ModuleId[] })[];
  };
  registry: { entries: ReadonlyMap<WindowId, HTMLElement>; frames: ReadonlyMap<WindowId, FrameRegistration> };
  geometry: OperationGeometry & {
    snap(candidate: Frame, nodes: readonly HTMLElement[], scale: number, bypass: boolean): Partial<Position>;
  };
  transforms: WorkbenchTransforms;
  setTransforms: SetWorkbenchTransforms;
  reportError(message: string): void;
}
export interface WorkbenchMoveOperation {
  ids: WindowId[];
  nodes: HTMLElement[];
  mode: 'visitor' | 'presentation' | 'authored';
  beforeTransforms: WorkbenchTransforms;
  valid(): boolean;
  preview(delta: Vector, bypass?: boolean): WorkbenchTransforms | null;
  commit(): boolean;
}
/** Window-only Display preparation has no content snapshot; content modules do. */
export type ResizeContentExpectation =
  | { layoutKey: 'display' | 'displays'; expected?: unknown }
  | { layoutKey: Exclude<ResizeLayoutKey, 'display' | 'displays'>; expected: unknown };
/** Module data is deliberately opaque to the host; only module preparers interpret it. */
export interface SelectionResizeCandidate extends Frame {
  id: WindowId;
  store: MountedWorkbenchStore;
  profileAddress: string;
  parentTextId?: TextId;
  gridScale?: number;
  getPresentation?: () => WorkbenchPresentation;
  prepare(draft: WorkflowDraft, change: SelectionResizeChange): WorkflowDraft;
  applyFrame(frame: Frame): void;
  reportError?: (message: string) => void;
}
export type SelectionResizeChange = SelectionResizeCandidate & ResizeContentExpectation;
export type SelectionResizeCommit = (changes: SelectionResizeChange[]) => boolean;
export interface ResizeTargetCapabilities {
  enabled: boolean;
  store?: MountedWorkbenchStore;
  profileAddress: string;
  parentTextId?: TextId;
  prepare: SelectionResizeChange['prepare'];
  commit: SelectionResizeCommit;
  /** Image history restores position only; other targets restore their full frame. */
  applyFrame(frame: Position | Frame): void;
  reportError?: (message: string) => void;
  reflow?: boolean;
  continuousGeometry?: boolean;
  maximumWidth: number;
  maximumHeight: number;
  minimumScale?: number;
  maximumScale?: number;
  groupScaleLimits?: { minimum: number; maximum: number };
  resizeStep?: number;
  resizeCorner?: (frame: Frame, corner: ResizeCorner, delta: Vector, bypass: boolean) => Frame;
  constrainFrame?: (frame: Frame, options: { edge: ResizeCorner; bounds: WorkbenchBounds }) => Frame;
}
export type WorkbenchResizeTarget = ResizeTargetCapabilities & ResizeContentExpectation & (
  | { minimumSize: number; minimumWidth?: number; minimumHeight?: number }
  | { minimumSize?: number; minimumWidth: number; minimumHeight: number }
);
/** The adapter checks enabled, writer identity and profile before using this refinement. */
export type AuthoredResizeTarget = WorkbenchResizeTarget & { store: MountedWorkbenchStore };
export interface ResizeOperationInput {
  origin: WorkbenchOperationOrigin;
  ids: WindowId[];
  registry: {
    entries: ReadonlyMap<WindowId, HTMLElement>;
    resizeTargets: ReadonlyMap<WindowId, MutableRefObject<WorkbenchResizeTarget | null>>;
  };
  geometry: OperationGeometry & {
    cameraOffset: Vector;
    moduleScale(id: WindowId): number;
    areaBounds(): WorkbenchBounds;
    snapResize(rectangle: Frame, anchor: Vector, corner: ResizeCorner, factor: number,
      nodes: readonly HTMLElement[], scale: number, minimum: number, maximum: number, bypass: boolean): number;
  };
  transforms: WorkbenchTransforms;
  corner: ResizeCorner;
  setTransforms: SetWorkbenchTransforms;
}
export interface WorkbenchResizeOperation {
  ids: WindowId[];
  nodes: HTMLElement[];
  mode: 'visitor' | 'authored';
  beforeTransforms: WorkbenchTransforms;
  valid(): boolean;
  preview(delta: Vector, bypass?: boolean): boolean;
  previewByKey(key: ArrowKey, shift?: boolean, bypass?: boolean): boolean;
  commit(): boolean;
}
export type GestureStartEvent = Pick<PointerEvent, 'button' | 'pointerId' | 'clientX' | 'clientY'>;
export interface GestureMoveInput {
  nodes: readonly HTMLElement[];
  beforeTransforms: WorkbenchTransforms;
  valid?: () => boolean;
  preview(delta: Vector, bypass: boolean): WorkbenchTransforms | null;
  commit(transforms: WorkbenchTransforms): boolean;
  previewDrop(event: PointerEvent): void;
  commitDrop(event: PointerEvent): boolean;
}
export type GestureResizeInput = Pick<WorkbenchResizeOperation, 'beforeTransforms' | 'valid' | 'preview' | 'commit'>;
export interface GestureMarqueeInput<Selection> {
  beforeSelection: Selection;
  previousSelection: WindowId[];
  hits(rectangle: Frame): WindowId[];
}
export interface WorkbenchGestureInput<Selection> {
  getHost(): HTMLElement | null;
  restoreTransforms(transforms: WorkbenchTransforms): void;
  replaceSelection(ids: WindowId[]): void;
  restoreSelection(selection: Selection): void;
  previewMarquee(rectangle: Frame | null): void;
  finishSnap(): void;
  cancelDrop(): void;
  events?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  visibility?: Document;
}
export interface WorkbenchGestures<Selection> {
  isActive(): boolean;
  ownsPointer(pointerId: number): boolean;
  cancel(rollback?: boolean): void;
  releaseAbandoned(): number | null;
  beginMove(event: GestureStartEvent, operation: GestureMoveInput): boolean;
  beginResize(event: GestureStartEvent, operation: GestureResizeInput): boolean;
  beginMarquee(event: GestureStartEvent, operation: GestureMarqueeInput<Selection>): boolean;
}
