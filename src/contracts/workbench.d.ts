import type { MutableRefObject, ReactNode } from 'react';

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
  [domainField: string]: unknown;
}
export interface WorkbenchCollection {
  type: 'inscape-local-workbenches'; version: number; profileAddress: string;
  activeId: WorkbenchId; shared: unknown;
  workbenches: { id: WorkbenchId; name: string; content: unknown }[];
}
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
  renameWorkbench(name: string): SaveResult;
}
/** Mounted editor/visitor windows are reached only after the readable-draft boundary. */
export interface MountedWorkbenchStore { getSnapshot(): WorkflowDraft }
export interface ToolSource { color?: ReactNode; fx?: ReactNode; image?: ReactNode; shape?: ReactNode }
export interface ViewTransform { scale: number; x: number; y: number; frame?: Frame }
export interface ResizeTarget {
  store?: MountedWorkbenchStore;
  layoutKey?: 'display' | 'displays' | 'texts' | 'miniApps' | 'imageModules' | 'shapes';
  parentTextId?: TextId;
  /** Image restores position only; other modules may restore a complete frame. */
  applyFrame(frame: Position | Frame): void;
}
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
