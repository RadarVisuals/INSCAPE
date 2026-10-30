# Inscape engineering map

Source-based guide, updated during the 29 October 2026 consolidation. This is an implementation map, not product authority or release approval. Read `AGENTS.md`, [the active contract](INSCAPE_ACTIVE_CONTRACT.md) and [creative intent](INSCAPE_CREATIVE_INTENT.md) first. Check the actual branch and dirty tree; earlier green results do not verify later source.

The application checkout is `remediation-2026-10-19-shared-checkpoint/work` inside the saved Inscape project. The parent directory contains supporting evidence and other checkouts. Do not switch to a different checkout or reconstruct the application from historical helper scripts. Preserve unrelated local work and exclude the protected handoff from every read, inventory and snapshot.

The [29 October consolidation plan](audits/2026-10-29/codebase-consolidation/PLAN.md) defines the current bounded work. Its [progress record](audits/2026-10-29/codebase-consolidation/progress.json) links execution evidence and the final report outside the source inventory. The [23 October plan](audits/2026-10-23/code-quality-plan.md) and its progress record describe that earlier round. Local implementation is not automatically committed, pushed, published or deployed.

## Follow the owner of the fact

Paths below are relative to the checkout. Files in the public workflow directory use the prefix `src/public/ownerSystemWorkflow/`.

| Fact or action | Current owner and boundary |
| --- | --- |
| Editor authority | `src/systemWorkflow/ProfileEditingBoundary.jsx` and `src/systemWorkflow/profileEditorLease.js`. Runtime's keyed profile and Workbench sessions control lifetime. Window focus never grants write authority. |
| Compositions, saving and Undo | `src/systemWorkflow/systemWorkflowDraftStore.js` and `src/systemWorkflow/domain/workbenchCollection.js`. Activation-scoped interfaces explicitly guard writers; obsolete callbacks cannot acquire a new context. Failed persistence must not become accepted content. |
| Workbench selection and tool target | `useWorkbenchSelection.js` / `workbenchSelection.js`, shared by Runtime and View. The target is derived from this model. Display placement selection, Text cursor and Library selection are distinct facts. |
| Selection move and resize | `workbenchMoveOperation.js` and `workbenchResizeOperation.js` prepare the concrete operation used by pointer and keyboard, capture its originating scope/registrations, and expose preview, validity and synchronous commit. `WorkbenchView.jsx` connects selection, geometry and input. Modules supply resize capabilities and interpret their own content; Shape supplies its group scale limits. |
| Temporary pointer lifetime | `workbenchGestures.js` owns capture, listeners, rollback and one completion. Invalid originating targets cancel through this existing lifecycle. `moveWorkbenchGroup.js` and `resizeWorkbenchSelection.js` retain the single authored commit. Ordinary window movement remains local presentation outside artwork Undo; Visitor transformations remain temporary. |
| Camera | `WorkbenchCamera.jsx`, `useWorkbenchNavigation.js` and `useWorkbenchCameraMotion.js`. Camera travel does not rewrite authored geometry; returning restores selection through its owner. |
| Module content and presentation | Image, Text, Shape, Keeper and other retained modules interpret their own content. `workbenchPresentationCapture.js` projects module presentation for capture. Live preview geometry is not another authoring store. |
| Local layout cache | `useWorkbenchLayoutPersistence.js` / `workbenchLayoutStorage.js`. The cache is scoped to a Workbench and its saved baseline; changed baselines invalidate it. Current shared Display tools use `workbench:tools`; per-Display views retain Grid and lock. |
| Tool content and availability | `WorkbenchViewContext.js` registers live module tool sources; `WorkbenchSharedTools.jsx` selects capabilities. `sharedDisplayToolRegistry.js` separately owns Display availability/portal tokens. Cleanup checks registration identity. Distinct contracts are retained because their consumers differ. |
| Library source and organization | `src/library/state/useLibraryStore.js` owns inventory/load generation; `src/library/storage/libraryWorkspacePersistence.js` owns organization persistence; `src/lattice/browser/useBrowserWorkspace.js` owns browser projection and transient selection. Current workspace reads use v9; obsolete version conversion was removed. Receiving modules interpret dropped material. |
| Preview and publication | `useWorkbenchPreview.js` owns read-only requests. `OwnerSystemWorkflowPublicationRack.jsx` owns explicit canvas/shared-details selection and preparation; `src/profileDocument/domain/canvasPublication.js` combines selected changes with retained public versions. Unknown publication state blocks preparation. `src/profileDocument/state/useProfileDocumentPublication.js` owns the separate publication operation and its verification. Opening or changing the selection does not publish or save a draft. |

The 24 October continuation separates six concrete host responsibilities from Runtime:
`OwnerWorkbenchSession.jsx` owns profile/restore/activation lifetime and preference disposal;
`useWorkbenchModuleRegistry.js` owns temporary module reports and live input targets;
`useOwnerWorkbenchLibrary.js` owns inventory projection and decoded dimensions;
`prepareWorkbenchPreview.js` prepares the captured preview document while `useWorkbenchPreview.js`
keeps request cancellation and stale-result rejection; `workbenchCommands.js` dispatches the shared
toolbar/context-menu commands through existing module sessions; `OwnerWorkbenchModules.jsx`
mounts the retained modules without adding a DOM wrapper. The seven repeated report-registration
implementations now share one local helper, preserving Display's distinct null-report semantics.

The subsequent bounded continuation moves publication surface lifetime and focus into
`useWorkbenchPublicationPanel.js`. `useWorkbenchPresentation.js` owns layout-session
restoration and the shared capture projection; it delegates storage to the existing
`useWorkbenchLayoutPersistence.js`. Preview, publication, backup and switching still
consume the same validated projection. Module reports now expose grouped capabilities.

Runtime still assembles providers, chrome and cross-surface actions.
Selection, authored content, editor authority and persistence retain their existing owners.
This is a bounded host cleanup, not full independence of all modules. See
[the 24 October implementation and its build evidence](audits/2026-10-23/runtime-boundaries-2026-10-24.md).

The 29 October selection-operation boundary is checked through `src/contracts/workbench.d.ts` and `tsconfig.contracts.json`: the scoped store, registration/context, capture projection, two operation adapters, gesture lifecycle and two authored commit owners. The mounted resize registry and adapters share one complete target capability; module payloads stay opaque to the host. Negative calls and virtual mutations check the actual exported bodies. Real Image/Text preparers and faulting storage are covered by `workbenchOperationIntegration.test.js`, with UI transitions in `local-workbenches.browser.mjs`. This does not make every module JSX body statically checked. Direct module-window gestures and Grid-placement resize remain outside this extraction.

## Two different preference policies remain

`editorPreferencesStore.js` owns Library options, docks, Text tool state/frames, Navigator, Keeper and sidebar preferences. It validates input, exposes read/write errors, checks editor authority and external stored bytes, and offers retry. Explicit replacement on retry is not automatic conflict merging.

`workbenchPreferences.js` separately owns optional chrome, composition lock, dock visibility, grid, snap, module gap and surface choices. Its store lives for the profile session, so pending values survive composition switches. Both preference owners use `localPreferencesStore.js` for read errors, write authority, external-change checks, retry and disposal. Their keys and formats remain separate. Workbench preference changes save synchronously; editor arrangement changes retain their existing short batching interval. Failed reads retain the stored copy; failed writes retain the current visible values and expose an explicit save action. These fields do not duplicate dock rectangles or Text/Navigator/Keeper screen positions, and neither preference record contains composition content.

## Verify the changed boundary

Run commands from the application checkout. Use focused unit and browser cases for the affected lifecycle and transitions. `scripts/browserSuites.json` classifies every browser suite; the runner takes explicit suite names for additional cases.

```powershell
npm run lint
npm run typecheck
node scripts/runBrowserTests.mjs <suite-name>
npm run build
npm run build:check
```

For a complete local checkpoint, run `npm run verify` and `npm run design-system:build`, plus the applicable targeted suites in the regression matrix. `verify` includes the full unit suite, classified release browser suites, standards, inventory, production build/budget and production startup. Set a fresh `INSCAPE_VERIFY_REPORT` directory to preserve evidence. Use `INSCAPE_BROWSER_EXECUTABLE` to select an installed Chromium browser when needed. LUKSO-facing work also follows the project's engineering baseline and current official sources.

`scripts/verificationPlan.mjs` defines those required steps for local and CI execution. CI runs source checks, production checks and four isolated browser shards, then `scripts/aggregateVerification.mjs` requires all jobs, exact catalog coverage, complete test results and matching source/runtime/build identities. Shard assignment is deterministic; recorded CI durations only balance the assignment. A partial scope or a diagnostic build is not release acceptance. The final check keeps the existing name, `Source, tests and production build`; its workflow is local until pushed and run externally.

Both `npm test` and the verification plan run four test files concurrently, with native discovery and process isolation retained. This bounds resource contention between build tests and nested process inventories; the full gate must still prove completion. Windows inventory uses the existing CIM dependency, terminates on query errors and rejects empty or malformed ownership records. The 3-second inventory deadline remains unchanged. Keep archived source copies in `.verification` or outside the application checkout so Node's native discovery cannot execute backup tests.

Windows verification resolves one PowerShell executable: `INSCAPE_PROCESS_POWERSHELL` when explicitly set, otherwise installed `pwsh.exe` on PATH, otherwise Windows PowerShell when `pwsh.exe` is absent. Its absolute path, actual version and binary hash enter the verification identity; owned children inherit that exact selection. A selected runtime's failure does not trigger a fallback. Only runtime metadata is cached, never process snapshots. Both PowerShell versions emit the same UTC-millisecond creation identity, and evidence from different process-inventory runtimes cannot be combined.

`scripts/runBrowserTests.mjs` records pending/running/final suite states and checks source stability. Its watchdog bounds a suite process; it does not replace test assertions or extend their deadlines. `scripts/verificationProcess.mjs` reuses the existing process-creation identity tracker, with a directly owned Node command held for startup and normal-exit inventory checkpoints. Periodic inventory requests do not accumulate while an observation is pending; explicit startup, completion and stop checkpoints still request fresh observations. `runVerificationTests.mjs` hosts Node's native test runner with the same discovery, process isolation and supported arguments; Node's CLI preload runs in workers rather than its coordinator. This proves cleanup of observed process trees, not an operating-system guarantee for forks that disappear before observation or are created after a prior checkpoint. Source changes during a browser or release run invalidate that run; put logs and final reports outside the source inventory.

`scripts/releaseEvidence.mjs` records allowed source, lockfile and artifact identities while excluding the protected handoff. A passing log without the applicable source identity is historical evidence. `scripts/lint-debt.json` binds each retained hook observation to exact source bytes, location and a reviewed invariant; it is not an automatic suppression baseline. New or changed diagnostics require explanation or repair. Do not increase budgets, weaken assertions or delete current capabilities to obtain a green result.

The founder explicitly approved one measured budget exception during the 29 October consolidation: core JavaScript was 2,686,423 raw / 882,484 gzip bytes after duplicate operation and shortcut wiring was removed. Its gzip allowance changed from 882,000 to 883,000 bytes (+0.11%); the old limit failed and is retained in the evidence. All other limits and checks remain unchanged. See the consolidation plan for this decision and its final evidence pointer.

Coordinate browser/build runs with performance measurements. The filled-Workbench benchmark requires stable content, browser, viewport and build form and an otherwise idle measurement window. Preserve raw samples and distinguish rendering cost from synchronous collection serialization/save cost.
