# Inscape engineering map

Source-based guide for the 23 October 2026 cleanup. This is an implementation map, not product authority or release approval. Read `AGENTS.md`, [the active contract](INSCAPE_ACTIVE_CONTRACT.md) and [creative intent](INSCAPE_CREATIVE_INTENT.md) first. Check the actual branch and dirty tree; earlier green results do not verify later source.

The application checkout is `remediation-2026-10-19-shared-checkpoint/work` inside the saved Inscape project. The parent directory contains supporting evidence and other checkouts. Do not switch to a different checkout or reconstruct the application from historical helper scripts. Preserve unrelated local work and exclude the protected handoff from every read, inventory and snapshot.

The [30-step plan](audits/2026-10-23/code-quality-plan.md) defines the authorized preservation scope. [code-quality-progress.json](audits/2026-10-23/code-quality-progress.json) is the only execution-status authority. Each step links its result and evidence. Local implementation is not automatically committed, pushed, published or deployed.

## Follow the owner of the fact

Paths below are relative to the checkout. Files in the public workflow directory use the prefix `src/public/ownerSystemWorkflow/`.

| Fact or action | Current owner and boundary |
| --- | --- |
| Editor authority | `src/systemWorkflow/ProfileEditingBoundary.jsx` and `src/systemWorkflow/profileEditorLease.js`. Runtime's keyed profile and Workbench sessions control lifetime. Window focus never grants write authority. |
| Compositions, saving and Undo | `src/systemWorkflow/systemWorkflowDraftStore.js` and `src/systemWorkflow/domain/workbenchCollection.js`. Activation-scoped interfaces explicitly guard writers; obsolete callbacks cannot acquire a new context. Failed persistence must not become accepted content. |
| Workbench selection and tool target | `useWorkbenchSelection.js` / `workbenchSelection.js`, shared by Runtime and View. The target is derived from this model. Display placement selection, Text cursor and Library selection are distinct facts. |
| Temporary pointer operation | `workbenchGestures.js` owns capture, listeners and commit/cancel lifetime. `WorkbenchView.jsx` supplies concrete geometry adapters and current actions. Module/store actions own the committed edit. |
| Camera | `WorkbenchCamera.jsx`, `useWorkbenchNavigation.js` and `useWorkbenchCameraMotion.js`. Camera travel does not rewrite authored geometry; returning restores selection through its owner. |
| Module content and presentation | Image, Text, Shape, Keeper and other retained modules interpret their own content. `workbenchPresentationCapture.js` projects module presentation for capture. Live preview geometry is not another authoring store. |
| Local layout cache | `useWorkbenchLayoutPersistence.js` / `workbenchLayoutStorage.js`. The cache is scoped to a Workbench and its saved baseline; changed baselines invalidate it. Current shared Display tools use `workbench:tools`; per-Display views retain Grid and lock. |
| Tool content and availability | `WorkbenchViewContext.js` registers live module tool sources; `WorkbenchSharedTools.jsx` selects capabilities. `sharedDisplayToolRegistry.js` separately owns Display availability/portal tokens. Cleanup checks registration identity. Distinct contracts are retained because their consumers differ. |
| Library source and organization | `src/library/state/useLibraryStore.js` owns inventory/load generation; `src/library/storage/libraryWorkspacePersistence.js` owns organization persistence; `src/lattice/browser/useBrowserWorkspace.js` owns browser projection and transient selection. Current workspace reads use v9; obsolete version conversion was removed. Receiving modules interpret dropped material. |
| Preview and publication | `useWorkbenchPreview.js` owns read-only requests. `OwnerSystemWorkflowPublicationRack.jsx` connects explicit preparation to `src/profileDocument/state/useProfileDocumentPublication.js` and recovery. Local multiple Workbenches do not imply public collection support; the existing publication block remains. |

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
[the latest implementation and passing build](audits/2026-10-23/runtime-boundaries-2026-10-24.md).

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

`scripts/releaseEvidence.mjs` records allowed source, lockfile and artifact identities while excluding the protected handoff. A passing log without the applicable source identity is historical evidence. `scripts/lint-debt.json` binds each retained hook observation to exact source bytes, location and a reviewed invariant; it is not an automatic suppression baseline. New or changed diagnostics require explanation or repair. Do not increase budgets, weaken assertions or delete current capabilities to obtain a green result.

Coordinate browser/build runs with performance measurements. The filled-Workbench benchmark requires stable content, browser, viewport and build form and an otherwise idle measurement window. Preserve raw samples and distinguish rendering cost from synchronous collection serialization/save cost.
