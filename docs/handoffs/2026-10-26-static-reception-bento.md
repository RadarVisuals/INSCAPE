# Static Reception bento implementation handoff

Date: 26 October 2026. Recipient: a fresh Codex instance with no conversation
history. Task: implement the founder-approved static, customizable Reception
bento in the existing Inscape application. Deliver working authoring,
persistence and public rendering, and completely remove the implementation
paths that this work supersedes. This is an execution brief, not a request for
another general proposal or an isolated demonstration.

The founder approved the interactions described below and specifically asked
for a thorough replacement rather than another layer over old code. They are
not a developer and cannot be expected to discover abandoned paths, duplicate
styles or incomplete persistence several days after delivery. Make the state
of the implementation understandable and verify the whole affected path.

This handoff was prepared without implementing the bento. The source baseline
is `3cfd6cf5da12218938d7706268ebd10bed890966`. The new accepted direction is also
recorded near the top of `docs/INSCAPE_ACTIVE_CONTRACT.md`. That contract remains
product authority; this file supplies execution details, observed source
locations, defaults and acceptance scenarios. Recheck the actual checkout
before acting because other work may have continued.

## Start in the correct checkout

The saved project root is a supporting workspace, not the application root:

`C:/Users/Hidden Swarm/Documents/ChatGPT/inscape`

The authorized application checkout is:

`C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work`

Run application Git, package, build and test commands in that checkout. A fresh
GitHub clone uses its repository root instead; the paths below are relative to
the application root. Do not silently use `E:/vscode/inscape`, which is a
different checkout with its own local experiments. Do not run historical patch
or installation scripts from the saved project's parent directory.

Read in this order before editing:

1. The saved project root's `AGENTS.md`, when available, then the application's
   `AGENTS.md`.
2. `docs/INSCAPE_ACTIVE_CONTRACT.md`, especially the new static bento decision,
   the 26 October published gallery, Hanssen direction, Reception wireframe,
   development-data policy, profile editing/private recovery, Display status,
   identity/publication boundaries and visual-language sections. Newer dated
   decisions supersede older descriptions in that same document.
3. `docs/INSCAPE_CREATIVE_INTENT.md`. The portfolio framing of this Reception
   does not redefine all of Inscape as a conventional portfolio builder.
4. `docs/design-references/2026-10-25-hanssen/README.md` and the images it links.
5. `docs/design-references/2026-10-26-bento/README.md` and all four referenced
   geometry images. Inspect the live About page and its navigation/theme/scroll
   behavior as well.
6. `docs/design-system/README.md`, relevant foundations/components, and the
   actual production controls you plan to reuse.
7. `docs/DEVELOPMENT_CHECKS.md`, current `package.json`, the browser runner and
   `.github/workflows/verify.yml`.
8. `docs/standards/LUKSO_ENGINEERING_BASELINE.md` before touching public-document
   or other LUKSO-facing behavior. Verify time-sensitive standards against
   official sources as that file requires.

Never read, edit, stage, delete or use
`docs/INSCAPE_ALPHA_CONTINUATION_HANDOFF.md` from any checkout. Exclude it from
recursive document reads and staging. This new handoff is a different file.

## Source checkpoint and existing local material

The baseline branch was `codex/audit-checkpoint-2026-10-19`; both local HEAD and
the directly queried remote branch pointed to the full baseline SHA above.
The documentation work is on `codex/static-bento-handoff-2026-10-26`.
Use [checkpoint evidence](../audits/2026-10-26/bento-handoff/README.md) for the
verified remote tag, branch and checks. Do not infer pushed state from this
paragraph alone; query Git when starting.

At handoff preparation, no application source file was locally modified. One
pre-existing audit file was modified:
`docs/audits/2026-10-23/code-quality-progress.json`.
It records an older technical closeout and is not new bento code. It was copied
unchanged to the saved project root's
`handoffs/2026-10-26-bento-local-backup/code-quality-progress.json` and left in
place. Its SHA-256 is
`8bf24f49f157fa2ddf6aa6880301a6ab4e301e7986e65f9391a86248affc479f`.
Do not overwrite it, stage it incidentally, or interpret its old local-only
statements as the current Git status.

There were also many untracked screenshots and logs under `docs/audits/` and
`output/`. They are preserved local evidence, not source files to bulk-stage or
delete. Never use `git add .`, `git clean`, `git reset --hard` or blanket folder
replacement as a shortcut. Stage the intended changes by path after review.

Git protects committed source, not browser localStorage, private drafts,
environment secrets, media caches or all untracked evidence. Before a schema
change that could affect existing local work, preserve that real work through
the existing private-backup facility or an equivalent verified local backup.
Use disposable browser profiles for testing. No clear-all-storage operation on
the founder's actual browser is authorized.

A recovery should start by opening the checkpoint in a separate worktree or
fresh branch after preserving current changes. Do not reset the shared checkout
or force-push over someone else's work. For ongoing implementation, use an
appropriate `codex/` branch following the app's worktree instructions. Do not
merge into main, deploy production, upload profile documents, request wallet
signatures or publish on-chain based on this handoff.

## What the founder has approved

The immediate request is a real bento editor without animation. The maker can
split regions, resize their subdivisions, move content between them, merge
regions, and configure radius, gutter and padding. The experience should be
visually close to Hanssen's coherent framed presentation while remaining
personalizable through layout, identity and content.

The founder accepted these interaction principles:

- Begin a new composition with one empty region.
- Split a selected region into two side-by-side regions or two stacked regions.
- Drag a shared divider to change their proportions.
- Place or replace a supported module in a region.
- Move a module placement to an empty region or swap placements between filled
  regions.
- Merge adjacent regions when their combined area is rectangular.
- Remove content without destroying the surrounding layout.
- Set global gutter and padding independently, with per-region padding
  overrides, content alignment and full-bleed media where appropriate.
- Give mobile the same content with its own readable arrangement; offer a
  sensible vertical default and owner-adjustable order and sizing.

The earlier conversation also chose logo/name branding, a small number of tabs,
light/dark appearance, and inward/outward rounded contours. These belong to the
static visual target. Use actual existing routes for navigation rather than
inventing new destinations to fill a template.

The maker's goal is to present identity, work, projects and repertoire. Inscape
also remains a creative environment for attributable, structured artwork. Keep
the relationship to Workbench compositions, assets, metadata and source
identity intact. Reception layout must not flatten a composition or rewrite
artwork provenance.

### Scope boundaries

Do not add GSAP or another animation library. There is no scroll-driven layout
morphing, tweening, choreography, scene-progress bus, autoplay, transition editor
or hidden motion configuration in this version. The founder sent a licensing
inquiry to Webflow; permission is unresolved. The static geometry must work
without it. A divider following a pointer is direct manipulation, not an
animation feature. Keep ordinary scrolling and immediate state changes usable.

Display is deliberately parked but its retained behavior must continue to
work. Do not restore its Add/menu entry, turn its old Stage/Grid into the bento
model, delete it as obsolete, or add Display-to-Text synchronization to this
task. Existing intrinsic artwork animation and unrelated gallery/viewer motion
are outside the bento change and should not be globally disabled.

Do not implement Desktop, a blog/CMS, new Video/music modules, a plugin SDK,
arbitrary script blocks, collaboration, monetization, minting or a new hosting
stack. The platform's Web3 direction does not authorize changing its current
publication transport or authority model. Do not redesign the existing Aerra
gallery, Workbench editor, Keeper or canvas viewer as collateral work.

## Observed implementation that must be traced

The inspected baseline contains a fixed read-only Reception wireframe. It does
not contain an existing working customizable bento editor that merely needs its
controls enabled. The source locations below are a starting map, not permission
to delete every file on the list.

| Responsibility | Current source and observed behavior |
| --- | --- |
| Reception renderer | `src/profileDocument/components/ProfileOverview.jsx`: fixed identity, links, introduction, details and space blocks. A separate Explore action opens the temporary exploration room. Uses verified identity view-model data. No split, resize, merge or content-placement editor. |
| Reception CSS | `src/profileDocument/components/profileOverview.css`: hard-coded four-column `.reception-bento` with 8px gaps; fixed grid-area selectors; 24px block padding; breakpoint overrides at 900 and 600px. The same file also contains exploration and visitor-return styles, which must not be blindly deleted. |
| Public route selection | `src/profileDocument/components/ProfileDocumentV9Preview.jsx`: Reception, published gallery and direct-module visitor canvas are selected through the existing entry/target route. It imports `profileOverview.css` independently of the Reception component. |
| Application routing | `src/App.jsx`, `src/profileDiscovery/applicationNavigation.js`, `src/profileDiscovery/useApplicationNavigation.js`. Preserve profile address, route state, browser Back/Forward and explicit public targets. |
| Old Reception data shape | `src/profileDocument/domain/receptionPresentation.js`: `validReception` currently accepts only `{ version: 1, items: [...] }`, a bounded unique list of Image/Text/Display IDs. `projectReception` filters that list through allowed public modules. This is retired selection/curation data, not geometry. The wireframe does not render it. |
| Draft validation | `src/systemWorkflow/domain/systemWorkflowDraft.js`: optional `reception` is passed through the existing validator. Trace all constructors and copies when changing its meaning. |
| Collection ownership | `src/systemWorkflow/domain/workbenchCollection.js`: Reception is a shared profile-level fact alongside identity and Keeper, not duplicated into every canvas's content. |
| Public validation and projection | `src/profileDocument/domain/profileDocumentV9Validation.js`, `profileDocumentV9Builder.js`, `canvasPublication.js`, `publishedCanvases.js`: check Reception references, private exclusions, root/shared facts and selected-canvas publication. |
| Restoration and reconciliation | `src/profileDocument/domain/profileDocumentV9Reconciliation.js`, `src/profileDocument/storage/ownerDraftReconciliation.js`: existing publication-to-draft/collection paths preserve Reception. |
| Draft transactions and history | `src/systemWorkflow/systemWorkflowDraftStore.js`, `systemWorkflowAuthoringSession.js`, `draftHistory.js`: completed operations, generation checks, confirmed saves and chronological undo already exist. Reuse their boundary. |
| Owner entry and publication UI | `src/public/ownerSystemWorkflow/OwnerSystemWorkflowProfile.jsx`, `OwnerSystemWorkflowRuntime.jsx`, `OwnerWorkbenchSession.jsx`, `OwnerSystemWorkflowPublicationRack.jsx`, `useWorkbenchPublicationPanel.js`; trace callbacks and collection store rather than adding another singleton. |
| Editing lock and recovery | `src/systemWorkflow/ProfileEditingBoundary.jsx`, `profileEditorLease.js`, and `src/public/ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx`. One editor per profile/origin remains required. |
| Identity content | `src/profileDocument/components/publishedIdentityRackViewModel.js`, official profile identity state and `src/public/identity/IdentityPortrait.jsx`. Distinguish authored branding/persona from the verified publishing identity. |
| Shared visitor/module helpers | `src/profileDocument/components/profileOverviewModel.js` also owns direct-target and reading helpers; it is not all obsolete merely because its filename contains overview. |
| Design-system description | `design-system/registry.js`, Reception entry. It still says composition entry is unavailable, although current code enters the published gallery. Correct stale current descriptions as part of delivery. |
| Existing Reception checks | `browser-tests/reception-card.browser.mjs`, `profile-overview-fixture.jsx`, `profile-overview-fixture.html`; currently assert no Edit reception and no old `.bento-stage`. Update the obsolete expectations while retaining public isolation, navigation and focus checks. |
| Potential stale demonstration | `browser-tests/bounded-stage.browser.mjs` and `bounded-stage-review.html` still refer to the previous expansion-based bento. Investigate actual registration/imports; remove superseded fixtures/tests and catalog entries if they are dead. Do not quietly treat their presence as a supported feature. |

Search the complete relevant repository for usages, including re-exports,
dynamic imports, CSS imports, schema keys, storage/recovery/reset code, snapshot
builders, browser fixtures and documentation. Use `rg`/`rg --files` and exclude
the protected document. Search by both identifiers and behavior, not only the
word bento. Check package/build references if deleting a file.

Before editing, explain briefly to the founder: what owns the current view,
draft, publication and styling; what you will reuse; what must be replaced; and
which boundaries remain unchanged. Technical choices should be investigated by
the agent rather than handed to the founder as developer questions.

## Visual target and reusable styling

Primary example: [Hanssen About](https://hanssen-template.framer.website/about).
Secondary context: [Hanssen Work](https://hanssen-template.framer.website/work).
The reference is by Gola Templates and hosted in Framer. Inspect the public
pages; copying their executable runtime, commercial template source, images or
font assets is not required or authorized.

Use the saved [geometry packet](../design-references/2026-10-26-bento/README.md).
The founder close-up is especially important. It shows a compact top-left
navigation whose footprint is carved into the adjoining image silhouette. The
image boundary descends below navigation, rounds outward at its outside edge,
and curves inward at the navigation's far end before joining the top image edge.
The lower-right name label on the wider About image is another example of this
relationship. The reference should be recognizable through proportion,
negative space, hierarchy and contour, even with different content.

### Outer and inner corners

Outside corners are convex rounded corners. Inside corners are concave joins
around a real navigation/tab/label footprint. Four rounded rectangles alone are
not an implementation of the founder's example.

Use a single coherent geometry calculation for rendering and relevant clipping.
CSS clipping, masks, SVG geometry or another small native technique may be used
after checking the existing implementation and supported browsers. Do not make
an implementation depend on opaque fake corners painted in a hard-coded page
color. If a composited corner technique is used, demonstrate correctness with
both themes, transparent assets, custom content and variable sizes.

The shape must remain continuous when radius, spacing, navigation width or the
viewport changes. Clamp the rendered geometry to available edge lengths so
large radii cannot self-intersect. Radius zero produces intentional square
geometry. Gutter zero allows a clean flush join. Do not silently round a zero
value upward. Keep thin borders aligned without bright seams or doubled strokes.

Do not put arbitrary inward holes at every internal grid intersection. Internal
cells remain usable regions; concave contours belong to actual cutouts in the
frame. A notch must respond to the real footprint of its navigation, including
long names and narrow layouts. Decorative pieces use no pointer hit area and
must not block controls or drag handles. Focus rings remain visible outside
paint clipping. With media, the painted image and its clipping contour must
agree; no rectangular media bleed behind a rounded frame.

### Proportion and hierarchy

Keep the compact outer margins, narrow even gaps, large content surfaces,
asymmetry and restrained flat material of Hanssen. An image-led large block
beside smaller introduction/link panels should be a natural composition, not a
mandatory immutable preset. A new blank layout still starts as one region.

The desktop frame uses the available presentation area. Preserve readable
content and explicit scroll ownership rather than silently clipping long text
to fit a screenshot. Hanssen's pinned image beside scrolling content is useful
reference behavior, not a requirement to add a general pinning editor now.
Avoid nested scrolling by accident; any panel that owns overflow must remain
reachable by keyboard and touch. Mobile uses natural vertical document flow.

### Tokens, controls and fonts

Inspect the actual token owners and shared controls before adding CSS:

- `src/public/ownerSystemWorkflow/workflowTactile.css` owns shared control
  behavior and material variables.
- `src/public/ownerSystemWorkflow/workflowFlat.css` maps migrated surfaces to
  the existing neutral theme tokens and Carbon/Mist behavior.
- `src/public/ownerSystemWorkflow/workbenchToolChrome.css`, existing detached
  shells and tool controls supply compatible editor geometry and interaction.
- `src/lattice/rendering/latticeMenuSurface.css` and its theme infrastructure
  own shared menu surface roles.
- Follow imports from `src/index.css` to real font/token owners. Do not assume
  generated `design-system/tokens.generated.json` is an editable source of truth.

Use Inscape Sora for interface copy and Inscape IBM Plex Sans Condensed for
technical/dense secondary copy. The creation bar's approved Inter Variable
exception does not authorize changing other font roles. Authored Text content
keeps its own existing supported font choices. Use existing Lucide icons and
stroke weights, control hit sizes, focus treatment, menus and input patterns.

Reuse shared classes/components by composition where suitable, not by copying
their entire declarations into a new bento stylesheet. Add bento-specific
geometry/layout styling only where it owns a real new responsibility. If a
shared primitive needs an extension, make one scoped extension and verify its
existing consumers. Do not globally change `--control-radius` to implement an
authored bento radius: content geometry and editor-control geometry differ.

Do not add a parallel palette, font loader, shadow language or theme store.
Distinguish the creator's saved default appearance from a visitor's temporary
light/dark choice. A visitor's toggle cannot rewrite published settings. Both
themes must use the same structure and dimensions. Do not invert artwork pixels.

The logo and display name are branding. Preserve a clear route to the actual
verified Universal Profile; authored values cannot impersonate its authority.
Use existing compatible identity/media fields and safe rendering. Do not add
arbitrary SVG/HTML execution to make a new logo feature. Tabs must navigate to
real content. Preserve About/Canvases/Discover and existing owner-return paths
as applicable; no fake Desktop/Blog destinations or duplicate navigation rails.

## Detailed editing behavior

### Selection and available actions

Owner edit mode exposes layout controls. Public reading mode contains no drag
handles, resize targets, destructive menus or authoring listeners. Keep one
renderer with capabilities rather than separate almost-identical DOM trees.
Selecting a region reveals its selection boundary and contextual actions;
ordinary hover does not leave selection outlines on every cell. Clicking an
input or editing text must not start a layout drag.

Offer concise actions near the selection: Split side by side, Split above and
below, Add/Replace content, Move/Swap, Merge, and Remove content. Reuse the
existing menu/control patterns. Explicit labels are preferable to ambiguous
horizontal/vertical icons alone. Do not require right-click for essential work.

Empty regions have an owner-only placement affordance. In public rendering they
are intentional empty space, without construction copy such as Add module or
Bento customization comes later. Reuse existing error/empty-state conventions.

### Splitting

Split only the selected region. The region's previous content stays in the
first/top-left child; the second child starts empty. Do not duplicate the source
module or make a second Text article. A near-even starting ratio is reasonable.
Select the new empty child so the next action can place content. Preserve the
original region's outer boundary and all unaffected sibling geometry.

The gutter is subtracted once between the children. It must not accumulate as
double padding through nested splits. Block a split that cannot fit its usable
minimum sizes and show an intelligible reason. Deep splitting must remain
bounded; choose and document limits from actual usability/performance and the
existing document size limit, not from an untested arbitrary promise of infinity.

### Divider resizing

Drag the actual shared divider. Compute proportions in the available space
after gutter subtraction, not from the whole browser width. Respect container
offsets, scrolling, zoom and device scaling. The visible divider can be subtle
but its hit area must be usable. Pointer movement previews geometry; pointer
release commits one completed undoable operation, not one save per event.

Provide a keyboard/numeric alternative using the same operation, with a visible
focus state and meaningful accessible value. Do not intercept native editing
keys from text inputs. Constrain both sides to usable sizes. Resize one split
without unexpectedly changing unrelated branches or content IDs.

Pointer cancellation, Escape, lost capture, blur, unmount, a changed profile,
or a changed draft generation cancels the temporary gesture safely. Release
listeners/capture. A failed save must not leave the screen claiming that the
candidate is the accepted layout. Never freeze normal scrolling after a drag.

### Moving and swapping

Use an explicit region/content drag affordance, not the whole interactive
module surface. A text selection, link click or future media control must keep
its own input behavior. Show the actual destination and whether dropping will
move or swap. Dropping onto the same cell or outside valid targets is a no-op.

Moving to an empty cell transfers the placement and leaves the source cell
empty. Swapping filled cells exchanges their content references in one
transaction. Cell geometry and cell padding stay with the destination; source
module content, asset identity and module-owned settings stay with the module.
Provide an equivalent Move/Swap command for keyboard and touch users.

Keep references stable and do not duplicate article content, asset records or
entire Workbench documents during the gesture. Cancelled/invalid drops do not
write. Moving a bento placement must not move its original Workbench window.

### Merging

Allow a merge when adjacent regions share an edge and their union is a complete
rectangle. Exclude diagonal-only and L-shaped combinations. A common case is
undoing a previous split, but do not silently turn the promised rectangular
adjacency rule into an unexplained siblings-only rule. Choose a representation
that can normalize legitimate merges, or explain a concrete limitation before
calling the feature complete.

Two empty regions merge directly. One filled and one empty region retain the
filled placement. For two filled regions, show both contents and let the user
choose which occupies the merged region; cancellation changes nothing. Neither
choice deletes the underlying source module/article. The removed placement is
undoable, and the source remains accessible through its canonical owner.
Do not concatenate articles, flatten images or discard one silently.

The merged region inherits a deterministic geometry and appearance rule, shown
in the preview. A practical rule is selected-region appearance plus the chosen
content. Remove the obsolete internal divider and collapse empty structural
nodes. The operation and undo/redo must preserve every unaffected placement.

### Radius, gutter, padding and alignment

Expose the three controls clearly with units and a visible current value:

| Setting | Meaning and scope |
| --- | --- |
| Radius | Authored bento frame/cell contour. Drives the compatible inside/outside shape treatment; does not change all application buttons. |
| Gutter | The space between neighboring regions, applied once. Distinct from outer frame margin and internal padding. |
| Padding | Global inset from a region boundary to its content; a region can override it and reset to the global value. Zero allows supported media to be full bleed. |

Use a small clear global panel and a contextual per-region section rather than
an always-visible matrix of controls. Per-region alignment is left/center/right
and top/center/bottom. Preserve existing image fit/cover/crop semantics; changing
padding cannot rewrite the source media or stretching/cropping policy silently.

Starting visual values around 20px radius, 8px gutter and 24px text padding are
reasonable implementation candidates, not founder-approved exact pixels. Match
the inspected reference and existing tokens, record final defaults, and make
zero, intermediate and maximum values work. Reuse existing module bounds where
appropriate. Reject invalid/non-finite serialized values; clamp only the
rendered corner extent when a valid radius exceeds the currently available
space. Do not silently mutate authored settings on every resize.

Continuous controls preview smoothly through direct updates and commit once
when a gesture completes. Numeric entry has explicit commit/cancel behavior.
Each completed user action is one chronological undo step. Content/text editing
keeps its native editing history scope.

## Responsive presentation and content ownership

Desktop and mobile layouts share the same canonical content. Do not duplicate
Text articles, image records or identity data to make a mobile version. Default
mobile ordering must be stable and understandable; the owner can adjust it in
a mobile-layout preview within the editor. Mobile layout customization does
not require bringing the entire Workbench editor onto phones.

Start with vertical flow. Allow suitable side-by-side pairs only when their
content and targets remain usable. Long text grows rather than being clipped
to a tiny desktop-height box. Media retains its declared fit/aspect behavior.
Tabs and identity controls remain reachable with long names and at 320px width.
No sideways page overflow, shrunken desktop typography, or full-screen wheel
hijacking. Keep touch scrolling independent of editing gestures.

Decide how desktop structural changes reconcile the mobile arrangement before
implementing. New cells must appear deterministically; removed cells and stale
references must be removed; existing mobile order/overrides must not be reset
on every desktop edit. Content replacement propagates because it has one owner.
Do not store a separately serialized copy of the whole composition per viewport.

Bento owns region identity, subdivision geometry, assignment, presentation
spacing and mobile arrangement. Modules own their content and supported render
behavior. Use stable region IDs and explicit content references. Image and Text
should use their existing models and renderer/editor services. Existing
identity, introduction and link presentation may bind to the canonical profile
view model; do not clone that identity into another mutable bento object.

Investigate module scope across named Workbenches. Reception is profile-shared;
an unqualified module ID in the active canvas is not a safe general lookup if
IDs can repeat across canvases. Use explicit qualified references where needed,
and resolve them only against eligible data for the current mode. Do not change
the active editor merely to render or preview a referenced module.

The initial implementation must demonstrate real image and text content,
identity/links, save/reload and public projection. A layout containing only
colored placeholders is not complete. No new module framework is needed:
extract a small reusable content-rendering boundary only when the real existing
components require it. Keep Display's future insertion possible without
building its integration or cross-module animation now.

## State, persistence and publication

Trace UI action to candidate state, validation, confirmed canonical save,
history, preview, public projection, validation and restoration. Extend the
existing authoritative stores; do not create `bentoDraft` localStorage beside
the canonical profile draft, global DOM events, a hidden second theme source,
or a duplicate publication serializer.

A layout tree of splits and leaves may be a suitable internal model, but choose
it after reviewing existing structures. Do not serialize both a tree and
computed rectangles as competing authorities. Derived geometry is a projection.
Validate topology, stable IDs, bounds, finite ratios, maximum size/depth, content
references, padding/radius/gutter and allowed keys. Cycles, missing references,
duplicate placement identities and unsupported content must fail predictably.

The old `{ version: 1, items }` Reception selection model is not a layout model.
Replace or remove its superseded validator/projection behavior across all
current paths. Do not preserve it behind version detection merely to avoid
updating call sites. The development-data policy removes hypothetical backward
compatibility obligations. It does not authorize destruction of actual local
work; preserve that before any explicit schema replacement. Choose one coherent
current schema and update builders, readers, defaults, backup/restore and tests
together. Follow the repository's current versioning rules rather than bumping
only the UI or only one public path.

Keep profile-scoped editing lease and generation checks. Owner access is not
granted by a query parameter or by the presence of cached draft bytes. A second
tab follows the existing view/retry behavior; a profile switch cancels stale
operations. Browser storage failure remains an error with meaningful recovery,
not an apparent successful save followed by lost work.

Temporary state includes selection, open menus, pointer candidates, drag
targets, focus, current mobile preview and visitor theme/navigation choices.
Authored state includes accepted geometry, placement assignments, defaults and
overrides. Keep those categories separate. Cache invalidation must be explicit;
no derived cache becomes an alternative saved layout.

The current public v9 envelope has a shared profile/Reception and selected
canvases, with an aggregate 512 KiB bound. The current collection limit is eight
canvases. Recheck these definitions in code. Reception publication is part of
the profile/shared selection. Preserve unselected published canvases and the
separation between private changes, prepared publication and actual publication.

If a bento references content, its public projection must include only content
the owner explicitly makes public through the existing workflow. Never auto-
publish a private canvas or copy private module payloads into Reception to make
a cell appear filled. Resolve references against the publication being built,
including retained unselected public canvases. Where an assignment cannot be
published, explain it in preparation and offer a deliberate correction; do not
silently lose content or fetch it from an owner's local draft in Visitor mode.

Visitor rendering receives verified public data only. No private module list,
editor-only sidebar, wallet tools, local backup information or draft preview
may leak into it. A visitor must be able to open the published composition with
no wallet connected. Existing direct module links, missing-target notices,
About/gallery navigation and browser Back/Forward remain functional.

Preserve explicit upload admission, exact-byte verification, signatures,
transactions and read-back confirmation. Exercise them through the existing
mocked end-to-end fixtures. Do not perform real uploads or wallet actions as a
test. Fresh-owner restoration and same-owner existing-local-work precedence
must still work with the new Reception representation.

## Required replacement and cleanup process

Prepare a small disposition table before editing, then complete it during
delivery. For each existing responsibility list its source, whether it is
reused/refactored/replaced/removed, its replacement owner and the check that
proves it. This is the evidence for the founder's requirement that old behavior
not remain underneath the new screen.

Check every affected layer:

1. Routes and imports, including lazy imports, application entry and Preview.
2. Components, hooks, callbacks and shared adapters.
3. Draft/schema fields, validators, constructors and default data.
4. Collection sharing, storage, hydration, backup, restoration and reset paths.
5. Public builders, projections, validation, selection and direct links.
6. CSS files, selectors, variables, inline overrides, theme variants and
   breakpoints. Remove superseded declarations at their source.
7. Fixtures, browser tests, unit tests, review HTML pages and suite catalog
   registration. Replace obsolete assertions with checks of the new behavior.
8. Design-system registry/specimens and generated token inventory.
9. Current product/implementation documentation, test commands and links.
10. Dependencies, exports and build entries if the replacement makes any unused.

Do not finish with OldBento/NewBento variants, a legacy-mode flag, duplicate
owner/public layout code, a dead Reception editor, CSS overrides stacked below
the old grid, or unused test fixtures that still imply the old UI exists.
Do not merely rename stale CSS and import it again. During implementation a
small intermediate slice is acceptable, but delivery must have one production
path. Keep the old behavior until the replacement actually works, then remove
the superseded code within the same completed task.

The word grid has several legitimate meanings here: Workbench canvas alignment,
Grid Shape, experimental Display scenes and the Aerra gallery. They are not the
Reception bento. Do not delete them because a search matches grid/bento wording.
Similarly, exploration/Keeper and visitor-return styles share a CSS file with
Reception but have independent consumers. Preserve or deliberately relocate
those live rules without creating a second copy.

Historical audit reports and screenshots describe prior states and can remain
as evidence. Mark current descriptions accurately; do not erase history to make
a text search return zero. Keep unrelated source, user files and the protected
handoff untouched. For retained matching symbols, explain why they still serve
a live responsibility. Cleanup is complete when the old runtime path and its
dependencies are gone, not when every occurrence of a historical name is gone.

## Implementation order

1. Verify checkout, branch, dirty state and checkpoint. Read required context,
   inspect the reference and capture the existing Reception in disposable test
   data at wide/narrow sizes and both themes.
2. Trace responsibilities and write the disposition table. Decide the single
   canonical bento model and content ownership from actual dependencies.
3. Implement pure layout operations/validation and integrate one transaction
   boundary, with meaningful tests for split/resize/move/merge/undo/failure.
4. Replace the fixed Reception rendering with the shared static renderer,
   including real supported content and the Hanssen contour. Add the owner
   controls through existing styling and access boundaries.
5. Complete mobile arrangement, global/local spacing, branding and real
   navigation/theme behavior. Verify long content and actual media early.
6. Complete save/reload, backup/recovery, collection projection, publication and
   restoration. Test private exclusions and selected-canvas interactions.
7. Remove obsolete paths across the full disposition table. Update current
   contract implementation status, design-system descriptions and inventory.
8. Run final checks on the final source, inspect actual screenshots/interactions,
   and report exact remaining limitations. Commit in reviewable slices following
   the current user's Git authorization; retain the pre-bento checkpoint.

Do not stop at a beautiful standalone HTML mock, a fixture-only implementation,
an editor that cannot save, a public view that cannot load, or a tree model
without usable controls. If an actual product ambiguity prevents completion,
show the concrete alternatives and ask one focused question while continuing
independent work. Routine engineering decisions belong to the implementing agent.

## Behavioral acceptance scenarios

Use real production components with disposable, representative fixtures. The
following scenarios are required outcomes, not tests that simply assert source
strings or class names.

| Scenario | Required result |
| --- | --- |
| Blank start | One empty region; reachable split/place controls in owner mode; no construction tools for a visitor. |
| First composition | Split left/right, split the right child into two rows, put an image left and distinct text/link content right. The intended asymmetric composition renders without overlapping or missing content. |
| Repeated subdivision | Nested splits preserve all unaffected cells and stable references; no multiplying gutter or padding. Minimum-size/depth limits have a usable explanation. |
| Divider pointer resize | Resize through both directions, near limits and after scrolling. One accepted operation, one undo; no stuck capture. |
| Divider keyboard resize | Same outcome through accessible control/numeric entry; focus retained and current value exposed. |
| Cancellation | Escape, lost pointer, blur, route/profile change and unmount discard the candidate and clean up listeners. |
| Move to empty | Source becomes empty, target displays the same content; source identity/article data unchanged. |
| Swap | Two filled regions exchange assignments atomically; cell padding stays with cells; undo restores both. |
| Merge empty/filled | Correct rectangular union, divider removed and deterministic appearance/content preserved. |
| Merge two filled | Explicit content choice, cancel is a no-op, no deletion of source modules, undo restores placements. |
| Invalid merge/drop | L-shaped, diagonal and outside destinations do not mutate state. |
| Remove content | Region remains; only the placement is cleared; underlying content remains recoverable. |
| Geometry extremes | Zero/default/high radius, gutter and padding work in both themes; no self-intersection, doubled seams, blocked targets or media bleed. |
| Inner corners | Founder screenshot's navigation cutout is visibly reproduced with variable navigation width and light/dark surfaces. Ordinary outer border-radius alone fails this check. |
| Long identity/navigation | Long names/links and narrow widths preserve navigation, focus, contour and readable text. |
| Shared content | Editing a referenced Text or Image through its canonical owner updates both viewport layouts without a duplicate article/module. |
| Mobile layout | Vertical default and deliberate ordering; owner overrides survive unrelated desktop edits; removed cells leave no stale mobile entries. |
| Text and media overflow | Long text remains readable; transparent/raster/SVG image handling retains the existing renderer policy, fit and provenance. |
| History | Completed split, merge, move, resize and appearance changes undo/redo chronologically; native text undo remains scoped. |
| Save failure | Simulated canonical storage failure preserves the previously accepted data/history and reports failure; retry actually retries. |
| Reload and private backup | Accepted current-format layout and assignments survive reload and explicit backup/restore without silently replacing newer local work. |
| Profile isolation | Two profiles and same-profile second tab cannot share or race authored bento state; stale async work cannot commit. |
| Preview parity | Owner preview and public renderer have matching geometry, clipping, content and themes for the same allowed data. |
| Public privacy | A private module/canvas can never enter public bento bytes or appear through a local-draft fallback. |
| Partial publication | Updating Reception or a selected canvas preserves unselected public canvases and validates all cross-canvas references. |
| Visitor routing | Signed-out About/Canvases/Discover, direct work links, missing targets, Back/Forward and owner return work without activating a private editor. |
| Retained functionality | Existing Workbench gallery/viewer, exploration/Keeper and affected Image/Text/Display behavior still work. |
| Cleanup | One canonical production path; retired selectors, imports, fixtures, schema branches and stale registry entries have an explicit disposition. |

Inspect at least 1440px and a wide desktop, 768px, 390px and 320px, plus a short
landscape viewport. Use Carbon and Mist, keyboard-only and touch emulation,
long content, empty/error/loading states and reduced-motion settings. If Safari
is not available, state that limit; do not claim cross-browser certification
from Chromium screenshots. Verify chosen clipping/masking support rather than
assuming visual success in one browser proves it everywhere.

## Verification commands and evidence

Use Node `>=24.20.0 <25` and the repository lockfile. At preparation, Node
24.20.0 and npm 11.19.0 were available and dependencies were already installed.
Do not install a replacement UI/drag/grid/animation framework without a concrete
need that cannot be met by existing code and native capabilities.

Run focused pure-model/storage/projection tests while working. The existing
Reception browser suite and public routing/gallery/publication/recovery suites
are regression candidates; inspect the current browser catalog for exact names.
Use the existing runner, for example `npm run test:browser -- reception-card`,
which owns an isolated server and test browser. Add the new bento interactions
to the maintained verification selection instead of leaving them as an optional
unregistered demonstration. Avoid changing test assertions merely to hide a
regression in a retained behavior.

Before calling the implementation complete:

- Run `npm run lint` and `npm run typecheck` for the affected production source.
- Run focused new/changed behavioral tests and relevant existing browser suites.
- Regenerate `npm run design-system:tokens` after CSS changes, review its diff,
  then run `npm run design-system:check` and relevant design-system tests.
- Run `npm run test:lukso-standards` after standards/publication-facing changes.
- Run `npm run build` and `npm run build:check`; verify lazy owner/wallet
  boundaries and the current budgets. Do not silently raise budgets to pass.
- Run the complete `npm test` before a release checkpoint.
- Use the required complete `npm run verify` release gate for release claims.
  A focused pass or a Netlify preview is not a full gate. If inherited failures
  remain, report their source and exact effect instead of declaring all green.

Capture and inspect before/after screenshots, including the concave navigation
join at useful magnification and both themes. Include representative real text
and artwork, not only blank cells. Record commands, source SHA/dirty state,
results, viewport/theme and actual limits. Preserve failure logs separately;
do not overwrite evidence to make an earlier failed run appear successful.

The handoff preparation ran all 1,462 unit tests successfully outside the
sandbox after the first run encountered a Windows/esbuild access restriction.
It did not run a new full browser/release gate. The baseline Netlify preview
status was success, while both GitHub Actions runs for that exact SHA were
cancelled. Treat these as a starting record, not proof of the future implementation.

## What to report to the founder

The final delivery should make the result assessable without reading code:

1. Where to open the actual bento editor and public/preview experience.
2. Which requested interactions and corner details work, with inspected visual
   evidence and a concise explanation of the controls.
3. What existing components/tokens/data owners were reused.
4. A completed list of removed or replaced code, CSS, fields, fixtures and
   registry entries, including the replacement responsibility for each.
5. Any retained old-looking symbol and the concrete live behavior it still owns.
6. What was tested, which checks failed or were not run, and real limitations.
7. Exact local/committed/pushed state, branch and commits, checkpoint location,
   and confirmation that unrelated user files were preserved.

Do not present a working screenshot as proof of completed integration or
cleanup. If old paths remain, say which and why; the founder explicitly asked
not to be left discovering that work later.
