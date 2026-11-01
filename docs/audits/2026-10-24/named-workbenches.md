# Named Workbenches: local workflow and boundary review

24 October 2026. The founder requested continuation of named Workbenches,
starting with an assessment of intertwined responsibilities, followed later by
designing the overview. The implementation remains local in
`remediation-2026-10-19-shared-checkpoint/work`, on
`codex/audit-checkpoint-2026-10-19`, starting at
`6d7d428d91e2dce5629ccea7b48c345faabaec59`.

## Finding and changes

The existing composition boundary was adequate for multiple local canvases.
Each composition owns its modules, area and authored layout. Identity, Reception
and Keeper data are shared; the Library supplies source material. Switching
revokes the departing editor handle and mounts one arriving runtime. History
and recovery remain scoped. No general store or module rewrite was necessary.

The naming UI did mix form state, storage commands and camera visibility, while
the owner runtime supplied save checks inline. Those responsibilities now have
explicit boundaries:

| Responsibility | Owner |
| --- | --- |
| Forms, selector, errors and focus return | `WorkbenchSwitcher.jsx` |
| Owner state and camera visibility wiring | `OwnerWorkbenchSwitcher.jsx` |
| Preparing create/rename/switch from a live canvas | `namedWorkbenchActions.js` |
| Name validation, collection validation, atomic writes, authority and activation | Existing collection domain and draft store |
| Live geometry and derived cache | Existing presentation and layout persistence hooks |

The owner session already subscribes to accepted operations, including renames;
the adapter does not add a duplicate subscription or collection cache. The
workflow reads its original scoped store handle. Delayed commands fail before
flushing a departed layout. Domain validation owns name rules; the persistence
boundary validates the complete candidate, including generated IDs, before any
write or activation. Invalid and duplicate IDs cannot partially create a canvas.

One concrete save gap was fixed: Rename previously flushed the layout cache but
discarded the captured layout when writing the collection. It now accepts the
same current-layout input as create/switch and saves name plus geometry together.
The editor remains mounted and existing content Undo is retained. Pending Text,
unfinished gestures/crops, missing geometry, failed cache writes, lost authority
and changed storage prevent unsafe changes. Failed naming retains the form for
retry. Storage read failures and external edits receive different recovery text.

The existing eight-slot cap is explained when reached. A real narrow screenshot
exposed the compact sidebar covering the naming form; the open form now occupies
the layer above that sidebar. The normal switcher retains its existing layer.
Wide and narrow screenshots were inspected for clipping, focus and overlap.

## Verification

Verification results and logs are recorded in `named-workbenches-evidence/`.
The focused store, backup and new action tests cover atomic rename, live geometry,
retry, stale commands, validation, all eight slots and transition guards.

The browser run at `.browser-test-runtime/run-1792861838796/` passed 27 tests:
named Workbenches (5), storage/backup/editor exclusion (6), recovery (1), layout
reload (3), sidebar (9), and shared Keeper/exploration (3). All-eight-slots tests
include actual creation, switching, reload, long names and unobscured fields at
1440 and 390 pixels. Existing checks also cover 700 pixels, separate content and
area, Undo/Redo, publication exclusion, failed Text recovery and backup downloads.

The starting-tree build comparison replaces only this pass's originally clean
runtime, switcher, CSS, store and collection-domain files with their HEAD source
through an isolated build plugin. All pre-existing unrelated local changes stay
in the comparison. It passed at 809,226 core gzip bytes, leaving 274 bytes under
the existing 809,500-byte limit. Centralizing repeated validation and reducing
workflow code brought the completed implementation to 809,585 bytes, a measured
359-byte increase. The core gzip allowance increases by 400 bytes to 809,900,
retaining comparable headroom. The raw ceiling and all loading-boundary budgets
remain unchanged. This adjustment follows measurement; it does not conceal a
dependency increase or move code outside the measured set.

`npm run format:check` reports the pre-existing formatting of `WorkbenchView.jsx`.
That file is unmodified by this pass; the changed owner runtime passes its direct
Prettier check. Lint's existing 92 recorded hook-dependency observations remain.

Initial tool failures are distinguished from product failures: the filesystem
sandbox prevented esbuild's parent-directory resolution; supported escalated
runs launched normally. One intermediate browser reload was interrupted by source
hot reload and passed on the stable rerun. Earlier full-test attempts had only
the production-build integration failure, first from the sandbox and then from
the bundle budget. The exact-budget assertion was updated with the measured
allowance before the final full-suite run.

Final results:

- `npm test`: **1439/1439 passed**, including the alternate-output production
  build integration. [Log](named-workbenches-evidence/unit-final.log).
- Focused collection, backup and action tests: **109/109 passed** before the
  final copy/validation cleanup; the complete suite covers their final versions.
- Browser regressions: **27/27 passed** across the six suites above.
  [Results](named-workbenches-evidence/browser-results.json). After final
  validation and wording cleanup, named Workbenches passed **5/5** again.
  [Final run](named-workbenches-evidence/local-workbenches.log).
- Production build and `build:check`: passed. Core JS is 2,516,877 raw /
  809,585 gzip bytes; initial JS stays 822,791 raw bytes.
  [Build](named-workbenches-evidence/build.log),
  [check](named-workbenches-evidence/build-check.log),
  [bundle report](named-workbenches-evidence/bundle-report.json).
- Lint, strict contract typecheck, design-system inventory check and scoped
  whitespace check passed. The owner runtime passes direct Prettier checking;
  the unrelated existing `WorkbenchView.jsx` formatting issue remains as above.
- Inspected final naming screenshots:
  [1440 pixels](named-workbenches-evidence/workbenches-naming-1440.png),
  [390 pixels](named-workbenches-evidence/workbenches-naming-390.png).

## Remaining scope and saved state

The store still coordinates collection persistence, history and the editor lease.
Those responsibilities share one transaction boundary; splitting them further
without a concrete conflict would add coordination. Module operations still
receive an explicitly derived active draft. Layout cache and canonical authored
geometry remain distinct; this pass does not migrate the whole layout model.
Saving serializes one collection record synchronously, bounded to eight local
Workbenches and existing size limits. This is not new performance evidence.

The overview design is next. Publication scope, public collection format and
visitor switching remain unfinished. Deletion, duplication and additive import
are not added by this local finishing pass. No reception or habitat decisions
were inferred from the founder screenshots.

At inspection, GitHub's exact-HEAD Verify Inscape run 38 was cancelled, while the
Netlify deploy-preview status was successful. Neither result covers these local
changes. All prior unrelated changes were preserved. No commit, push, upload,
wallet interaction or deployment was performed.
