# Separate local Workbench overview

24 October 2026. Implemented in the application checkout on
`codex/audit-checkpoint-2026-10-19`, starting at
`6d7d428d91e2dce5629ccea7b48c345faabaec59`. Changes are local and uncommitted.
Existing unrelated edits and audit material were preserved. No push, upload,
deployment or wallet operation was performed.

## Accepted result

The founder chose a list of names beside one large selected preview, an optional
introduction and modest metadata, and explicitly asked to keep this separate
from the Workbench component. The view has a fixed layout with no composition
arrangement tools. At 1024px the preview is approximately 560 × 350px; wider
layouts retain a large preview capped at 460px high. On narrow screens the name
list sits above the preview. Canvas proportions and authored positions remain
unchanged inside the fitted preview.

Selecting a name changes only the preview and details. Open Workbench explicitly
activates the selected composition. New Workbench creates an empty local
composition and selects its overview; the editor opens only through Open.
Edit details saves the name and optional 280-character introduction together.
Empty introductions disappear from the reading view. Content counts and canvas
dimensions are derived from real saved data; no edit date is invented.

## Responsibility review and changes

The existing collection store and per-activation editor scopes were suitable.
The required extension was a safe departure from the editor without switching
to another composition: commit the live layout, then revoke the old scope before
showing the overview. This uses the same named-Workbench workflow and transition
guards as switching. Storage failure, pending Text recovery or unfinished edits
keep the current editor open. Returning to the same Workbench creates a fresh
scope; old asynchronous actions cannot regain write access.

| Responsibility | Owner |
| --- | --- |
| Editor versus overview lifetime | `OwnerWorkbenchSession.jsx` |
| Browse selection and collection commands | `workbenchOverview/OwnerWorkbenchOverview.jsx` |
| List, details form, focus and responsive layout | `workbenchOverview/WorkbenchOverview.jsx` |
| Saved geometry/content projection | `workbenchOverview/workbenchOverviewModel.js` |
| Inert preview rendering | `workbenchOverview/WorkbenchOverviewPreview.jsx` |
| Introduction validation and saved metadata | Existing collection domain and draft store |
| Editor departure preparation | Existing `namedWorkbenchActions.js` |

The Workbench component owns none of the overview UI. The owner runtime only
connects the navigation action to the existing save workflow. WorkspaceNavigation
remains a presentation component shared with the editor. Collection-wide detail
editing and preview reads are root-store APIs, unavailable to module scopes.
There is no duplicate composition store, overview-layout schema or thumbnail cache.

Only selected content is projected. Image, Shape and retained Display rendering
reuse Navigator's read-only renderer; Text uses the existing article renderer
and frame measurement. TextViewport gained an optional frame index so continuation
frames retain reading order and show the title only once. HTML artwork gets a
named placeholder with its saved bounds; the overview mounts no iframe or editor.
The preview waits for nonzero layout dimensions before measuring linked text.

Remaining boundaries: the selected Display preview uses its first saved Grid,
Images use their first authored side, and HTML artwork is intentionally a
placeholder. Interactive content is inspected by opening its Workbench. The
collection still serializes into one synchronous local-storage record. This
work does not claim collection-wide save performance improvements. Existing
local-collection publication restrictions remain; public overview, visitor
switching and publication selection are separate work.

## Verification

- Complete `npm test`: **1,450 passed**.
- Focused model, collection and named-workflow checks: **114 passed**, including
  metadata independence, immutable reads, backup/reload roundtrips, failure
  atomicity, layout capture and scope revocation.
- Affected browser checks: **38 passed** across overview (2), named Workbenches
  (5), sidebar (9), Navigator (10), linked Text frames (6) and storage/recovery (6).
  Evidence combines the final overview run with passing affected-suite results.
- Browser evidence covers read-only selection with unchanged saved bytes, explicit
  opening, name/introduction persistence, failed-save retry, failed departure,
  empty canvases, first-entry focus, no editable content/iframes, and real Image,
  Shape and linked-Text rendering. Desktop 1440/1024, intermediate 700 and narrow
  390px screenshots were inspected for clipping, overflow and action placement.
- Lint, strict Workbench contracts, design-system inventory and its 10 tests pass.
- Production build and `build:check` pass. Initial runtime remains isolated from
  owner modules. The overview is a separate lazy entry. Total non-wallet JS is
  about 2.531 MB raw / 815.5 kB gzip. The aggregate budget was raised narrowly
  to 2,532,000 / 816,000 bytes; initial-load, owner-static, wallet and asset limits
  were not raised. The aggregate includes optional chunks, not only startup code.
- `git diff --check` passes. The pre-existing `format:check` warning in
  `WorkbenchView.jsx` remains; the changed owner runtime is formatted.

The first mixed-content preview run exposed measurement at an initial zero
scale, leaving a continuation frame empty. Waiting for measured preview dimensions
fixed it; the regression now checks both nonempty continuation content and one
title. The earlier failing run is superseded by the final overview evidence.

Before implementation, GitHub's Verify Inscape run for the current commit was
cancelled and Netlify reported success for the existing PR preview. Those remote
statuses do not verify these uncommitted changes. Current evidence is local.

Logs, bundle report and screenshots are in
[`workbench-overview-evidence/`](workbench-overview-evidence/).

## Follow-up: overview ignores clicks in the real app

The founder reported that the overview was completely unresponsive. Inspection
of the open production-route tab confirmed that its controls inherited
`pointer-events: none` from `.application-interface`. The editor explicitly
enables its own pointer input; the separate overview had omitted that surface
rule. Earlier tests mounted the owner boundary directly and therefore missed
this integration failure. It was not a storage deadlock or a frozen runtime.

The overview now opts into pointer input at its root while its preview remains
inert. No persistence or component ownership changed. The storage fixture has
an optional production-shell wrapper using the actual application CSS, and all
overview tests run through it. A real pointer-hit assertion failed before the
fix and passed afterwards; the full click/edit/select/open flow also passes.
Eight browser checks (overview and storage recovery), the production build,
bundle checks and refreshed design-system inventory pass. The fix was also
verified in the founder's already-open tab without a refresh by opening Edit
details; no name or introduction was saved during that check. Follow-up logs
are saved with the `pointer-` prefix in the evidence directory.
