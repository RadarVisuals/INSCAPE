# Static Reception bento implementation handoff

Date: 26 October 2026. Recipient: a fresh Codex instance with no conversation
history. Task: implement the founder-approved static, customizable Reception
bento through a separate Reception editor in the existing Inscape application.
First separate and verify the concrete shared tools it needs. Deliver working
authoring, persistence and public rendering, and completely remove the implementation
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

## Cross-chat review and dispatch state (26 October 2026)

This brief was checked against the complete conversation **Stuur inspiratie-sites
uit Framer** (`01a177a2-b476-7a83-8dd8-7fdff3a09ced`) and the earlier decisions in
**Check Framer preview access** (`01a17032-43ca-79f1-aab6-216e0cb5b660`). The
founder stopped the proposed dispatch with "nog niet sturen", then asked for
this combined review. No implementation chat was created by that dispatch.
Reading or reviewing this file does not itself authorize starting another chat.
Begin implementation when the founder explicitly assigns that execution task.

After this review, the founder chose a separate Reception editor that reuses
existing tools, then asked to inventory and separate those tools first. They
authorized updating this handoff and committing/pushing the documentation
before a new chat is started. This supersedes the intervening proposal for a
Reception mode inside the free Workbench. It does not authorize starting that
new chat, implementing the editor or changing the live preview during this
documentation task. The implementation scope below includes the agreed order.

The later choice is a freely configurable, module-based bento with Hanssen as
its static visual reference. Earlier exploration of hairline dividers,
[Studio Almond](https://www.almond.studio/) and
[Notter + Vigne](https://notter-vigne.ch/) was reference research. It did not
replace Hanssen or establish an additional mandatory hairline mode. A bento is
the layout structure; it need not mean a fixed collection of identical cards.
Keep the user's chosen proportions, spacing and corner settings meaningful.

The split/move/merge, mobile and spacing principles below were proposed and
accepted in that conversation. Detailed cancellation, validation and recovery
rules are engineering requirements derived from those interactions and the
existing application boundaries, not claims that the founder specified every
implementation detail. Exact default dimensions remain implementation choices.
Additional custom palettes, background treatments and branding typography were
discussed without a finalized set of controls. Do not silently turn that
brainstorm into a new general theme/font editor in this static slice.

Use these terms consistently:

- **Reception layout:** the profile-level arrangement being built here. A new
  blank Reception starts with one region; this does not create a new Workbench.
- **Canvas / Workbench composition:** an existing independently authored work,
  opened for presentation through Canvases or for creation through Workbench.
- **Region / module placement:** a Reception area and its reference to content.
  New Reception content has its own records using the existing module models;
  it does not require an instance on a Workbench. If existing content is ever
  linked, changing its Reception layout must not move its Workbench placement.

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

The review verified remote handoff commit
`b1df6f858f02d80577f66783cdefd61e950d6d9f` and the remote checkpoint tag. That
commit is the initial handoff and changes documentation/reference images only.
The subsequent reviewed revision adds the separate-editor decision, tool
inventory and content flow without changing application source. Before execution,
verify that the checked-out handoff includes those sections and that the intended
documentation commit has been pushed; do not assume the initial commit includes
later decisions. Use Git history and the remote branch to establish exact state.

The handoff branch is different from PR #5's branch. PR #5 and its existing
Netlify preview still use `codex/audit-checkpoint-2026-10-19`; pushing the handoff
branch does not update that preview. Preserve this distinction in later Git
and deployment reports. Verify the chosen delivery branch when implementation
is assigned; do not silently switch branches or merge simply to update a URL.

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

The immediate request is a separate, real Reception editor without animation,
built from the existing shared tools. The maker can
split regions, resize their subdivisions, move content between them, merge
regions, and configure radius, gutter and padding. The experience should be
visually close to Hanssen's coherent framed presentation while remaining
personalizable through layout, identity and content.

The founder accepted these interaction principles:

- Begin a new Reception layout with one empty region.
- Split a selected region into two side-by-side regions or two stacked regions.
- Drag a shared divider to change their proportions.
- Add or replace supported content directly in a region through the shared
  Library, Text tools or canonical profile/link presentation.
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

### Existing experience to preserve

The baseline already includes the work completed in the original chat:

- Reception's **Enter Inscape / Canvases** route opens the published collection
  for signed-out desktop and mobile visitors. It has List/Grid, optional Wrap
  and temporary card size; About returns to Reception. This is implemented,
  despite older reference-packet paragraphs describing it as future work.
- A gallery tile opens the composed canvas fitted in a bounded inspection,
  with optional expansion, camera points and scoped composition/artwork
  metadata. It does not directly activate the Workbench editor. Owner editing
  is a separate action. Thumbnail cropping does not change the actual artwork.
- The gallery's compact bottom-centre Inscape menu and glass controls were
  deliberately chosen for that surface. Reception's Hanssen navigation cutout
  is a separate scoped design choice, not an instruction to relocate every
  navigation control or redesign the gallery.
- Selective publication preserves the last published state of unselected
  canvases. Reception/profile changes have their own shared selection. No real
  user composition was automatically published by these implementation tasks.
- The baseline includes the wrap flicker repair: repeated visible copies are
  prepared together by the gallery's shared visibility owner. Preserve it when
  integrating Reception navigation; do not reintroduce per-card unmount gaps.

See the [published gallery evidence](../audits/2026-10-26/published-gallery/README.md)
and [wrap frame analysis](../audits/2026-10-26/gallery-wrap/README.md). Those are
baseline records, not evidence that the future bento has passed verification.
New Reception rendering must reuse the current artwork policies, including
transparent media and isolated SVG rendering, rather than reducing every
source to a gallery thumbnail. Its region geometry must not rewrite the
referenced module's authored Workbench position, size or crop.

### Later idea retained for continuity, outside this implementation

The founder's longer-term idea is a fixed outer bento frame whose internal
allocation changes as the visitor scrolls: a large left block shrinks as
another enters; that second block fills the frame; further scrolling reveals
another arrangement. "Full screen" in that example meant filling the bento
frame. Linked text and images could follow the same progression or move in
different directions, while branding/navigation stays recognizable.

The founder saw the retained Display module and its existing scene/text links
as a possible basis. The other chat reported that more than one Text module
can already follow one Display; verify that existing implementation before a
future integration. It does not establish that Display already rearranges
bento geometry. Preserve the retained code without reactivating it now.

References discussed for that future exploration:

- [Founder-supplied Codrops article](https://tympanus.net/codrops/2026/10/26/animating-agents-gsap-animaxxing/).
- Museum of Motion: [Pinned](https://tympanus.net/Demos/MuseumOfMotion/exhibits/pinned/),
  [Waypoints](https://tympanus.net/Demos/MuseumOfMotion/exhibits/waypoints/) and
  [Rearrange](https://tympanus.net/Demos/MuseumOfMotion/exhibits/rearrange/).
- [GSAP skills](https://github.com/greensock/gsap-skills) and
  [Animaxxing recipes](https://github.com/johnpolacek/animaxxing-skills).

These links preserve the conversation, not a dependency choice or an instruction
to install skills, build a motion framework, or add placeholder animation data.
The founder said the licensing inquiry was sent and chose to build statically
while awaiting an answer. No reply or permission is evidenced by this handoff.
Future motion controls and the library choice require their own implementation
scope. Stable region IDs and clear ownership are sufficient groundwork now.

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

## Separate editor and shared tools

The accepted architecture is a separate Reception editor inside Inscape. It
uses the same real building blocks and persistence/publication authority as
appropriate, with its own layout, selection, commands and content scope. It is
not an extra named Workbench, a hidden canvas used as a content warehouse, or
the entire Workbench runtime with unrelated controls hidden by CSS.

The source inspection explains the distinction. `OwnerWorkbenchToolbar.jsx`
handles camera-aware creation gestures and Workbench keyboard behavior as well
as toolbar presentation. `WorkbenchToolbar.jsx` contains reusable menu/focus
behavior but still assumes several Workbench tools. `TextWorkbench.jsx` and
`ImageWindow.jsx` own free-canvas positioning, camera and window behavior.
Mounting those complete hosts would bring dependencies Reception does not need.
The lower-level text, image and color code provides concrete reuse boundaries;
some still need host-specific assumptions removed before they can be shared.

### Initial inventory and extraction targets

This table records the initial inventory reviewed with the founder. Preserve
the required behaviors; choose exact file boundaries from the current code.
It is not an instruction to implement every option present in an old panel.

| Tool or service | Reception needs | Existing source and required separation |
| --- | --- | --- |
| Library | Browse/search the existing material, select a specific image and place it into the chosen region. | `src/library/`, `useOwnerWorkbenchLibrary.js`, `OwnerSystemWorkflowLibraryPresenter.jsx` and the existing browser/placement path. Reuse the Library and its identity/media records. Separate asset selection from Workbench/Display drop coordinates; capture the Reception region as the destination. |
| Text | Create and edit text, typography, alignment and links directly in a region. | `src/text/ArticleEditor.jsx`, `TextTools.jsx`, `TextColourTools.jsx`, the article model and edit/recovery services. Reuse formatting/editor behavior; separate the content/tool body from `TextWorkbench.jsx` windows and `SharedTextTools` host placement where needed. Do not bring Display connection, Workbench frame-flow or unrelated management tabs into this slice. |
| Image and crop | Choose/replace artwork; fit or fill a region and position the crop. Preserve transparent/raster/SVG media, source identity and meaningful loading/retry. | `src/imageModule/ImageArtwork.jsx`, `ImageWorkbench.jsx`, `imageModuleSession.js`, and existing crop/projection helpers. Reuse the media pipeline and crop mathematics. Separate crop interaction and recovery/focus callbacks from the Workbench window/camera. Do not rebuild SVG rendering or substitute a Library thumbnail for the original artwork. |
| Color | Edit supported text and surface colors with the existing controls and a precise selected target. | `src/colour/ColourControls.jsx` and `CommittedColourControls.jsx` are already largely independent. Bind them to Reception's selected content/region through explicit values and completed edits. Keep temporary previews, cancel and one-gesture/one-undo behavior. This is not a new global palette/font system. |
| Profile and links | Present/edit the existing name, introduction, profile image and links; add the agreed branding/navigation presentation. | Canonical identity data, `src/public/identity/IdentityCardSettings.jsx` and `publishedIdentityRackViewModel.js`. Separate useful field controls from their existing host where needed. Explain when editing a shared profile fact affects other destinations; do not create a competing Reception identity. A custom logo is authored branding, not a replacement for verified UP authority. |
| Artwork information | Keep creator/source metadata and attributes reachable for the selected artwork. | Existing metadata view models/content and `SharedDisplayTools.jsx`. Reuse the information, separating content from Workbench/Display tool registration and dock hosting. Avoid another permanent info bar on every cell. |
| Common controls | Familiar buttons, toolbar/menu behavior, inputs, focus and panel styling. | Existing toolbar, menu, panel and token components. Extract/use the actual shared implementation; Reception composes its own relevant actions. Do not copy a toolbar/CSS file and maintain a second equivalent implementation. Full detachable/tabbed docking is not a prerequisite unless it is needed by a concrete retained tool. |
| Save, undo, recovery and publication | Confirmed edits with correct scope, history, reload/backup and explicit publishing. | Existing profile draft/collection store, editing lease, completed-operation history and publication pipeline. Add an explicit Reception edit target where required; these services currently contain Workbench assumptions and are not proven drop-in adapters. Do not create a second independent store or publisher. |

Keep canvas resolution, free X/Y placement, camera points/index, Workbench Layers,
Shapes/FX, mini-app authoring and Display linking out of Reception's initial
command set. They remain available in their existing product scopes. Extra
rotate/mirror, image-side controls and advanced docking were not separately
selected for this first Reception toolbar; their mere existence does not make
them a prerequisite. Existing artwork content must still render correctly.

Reception owns new tools for split/merge, divider resize, move/swap, region
padding/radius/gutter/alignment, branding/navigation and desktop/mobile layout
preview. Do not register unrelated Workbench actions and merely hide their
buttons: context menus, command search, shortcuts and drag targets must all
use the editor's applicable actions. Define each editor's action once and use
it from its relevant inputs rather than copying handlers between menus.

### How the maker adds content

The user opens **Edit Reception**, selects a region and chooses **Add content**.
Image opens the shared Library and assigns the chosen artwork to a new Image
record in Reception. Text creates a Reception-owned record using the existing
article model and opens the shared editor. Profile/links uses the existing
canonical profile facts. An existing Reception content record can be assigned
again through an explicit reuse action when supported. No step requires the
maker to create or select an otherwise unused Workbench.

New Reception Image/Text instances belong to one authoritative profile-scoped
Reception content collection within the canonical draft. Both viewport layouts
refer to those records. Keep this a use of existing module models, with region
presentation supplying the host geometry; do not invent new unrelated article
or asset formats. Library assets remain shared source material. Choosing the
same asset twice does not silently link the two module instances' editable
settings. A new region is not a new Workbench and must not consume a slot in
the eight-canvas collection or appear as a gallery tile.

Content creation and assignment are one completed operation: cancelled Library
selection or failed persistence cannot leave a phantom placement. Bind async
media selection to the originating editor, profile, region and edit generation;
switching editors or replacing/removing that region invalidates the result.
Edit, replace and remove actions must distinguish content from its placement.
Removing a placement keeps the layout and must retain the documented recovery
or reassignment path for its content; it never deletes a shared Library asset.

Copying or live-linking arbitrary modules from another canvas was discussed but
not settled. Do not make that an implicit dependency or build a cross-canvas
picker in this slice. If existing references must be retained, scope them
explicitly and preserve public/private boundaries; do not reinterpret a link as
a copy or synchronize two editable records in the background. Canvases remains
reachable through the existing navigation. A new canvas-preview content module
is not required by this first inventory.

### Ownership of appearance and changes

Reception owns the cell's outer spacing, surface and contour. Text owns its
article content, typography, paragraph spacing and text alignment. The current
Text tools also expose box padding, backgrounds and edges: do not show both
those settings and competing bento controls for the same physical boundary.
Separate content controls from container controls, and render through explicit
host inputs without rewriting stored article settings to make them disappear.
Workbench retains its current text-box controls and behavior.

The same principle applies to artwork crop versus cell geometry, authored
radius versus tool-button radius, and saved appearance versus temporary visitor
theme. Every setting has one owner. A shared control/style improvement should
reach both editors because they import the same implementation; a new
Workbench-specific operation must not appear in Reception automatically.

Perform extraction in small, working steps: first Library/Image placement and
rendering, then Text/Color, using existing common controls throughout. Verify
the original Workbench after each changed boundary and prove the extracted
pieces with real Reception image/text content. These are intermediate checkpoints
within the full implementation assignment, not permission for a whole-app
rewrite or a reason to stop permanently at a test-only demonstration. Keep
future Display insertion possible through the existing module boundaries;
do not design a speculative editor/plugin framework in advance.

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
write. Moving a bento placement changes its Reception assignment only; any
separately linked Workbench placement stays unchanged.

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
spacing and mobile arrangement. Reception-owned module records own their content
and use the existing supported render behavior. Use stable region IDs and
explicit Reception content references. Image and Text use their existing
models and renderer/editor services. Existing
identity, introduction and link presentation may bind to the canonical profile
view model; do not clone that identity into another mutable bento object.

Reception is profile-shared; its own content does not live in the active
Workbench. Never resolve an unqualified Reception ID against whichever canvas
happens to be active. Any retained external reference needs an explicit scope
and eligible data for the current mode. Do not change the active Workbench to
render, edit or preview Reception content.

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
Authored state includes Reception content records, accepted geometry, placement
assignments, defaults and overrides. Keep those categories separate. Cache
invalidation must be explicit; no derived cache becomes an alternative saved layout.

The current public v9 envelope has a shared profile/Reception and selected
canvases, with an aggregate 512 KiB bound. The current collection limit is eight
canvases. Recheck these definitions in code. Reception publication is part of
the profile/shared selection. Preserve unselected published canvases and the
separation between private changes, prepared publication and actual publication.

Reception's public projection includes its selected public placements and the
eligible Reception-owned content needed by them, using the same Image/Text/asset
validation and bounded public document. Private and unplaced editing material
does not become public merely because it is in the Reception draft. Keep
Reception under the explicit profile/shared publication selection; exclude its
changes when that selection is off and preserve the last public Reception.
There is no hidden Workbench to publish along with it. Inspect current first-
publication prerequisites and explain them through the existing workflow rather
than silently creating or publishing a canvas to satisfy them.

If a retained placement references content elsewhere, include only content the
owner explicitly makes public through the existing workflow. Never auto-publish
a private canvas or copy its private module payload into Reception to fill a
cell. Resolve such references against the publication being built, including
retained unselected public canvases. Where an assignment cannot be published,
explain it in preparation and offer a deliberate correction; do not silently
lose content or fetch it from an owner's local draft in Visitor mode.

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
2. Trace responsibilities and write the disposition table and concrete tool
   inventory. Establish Reception's canonical content ownership, layout model,
   selection, command scope and existing draft/history/publication boundaries.
3. Extract only the required shared tools, starting with Library/Image, then
   Text/Color and necessary control primitives. Keep the original Workbench
   using those same implementations and verify its behavior after each slice.
   Do not build a generic editor framework or carry over Workbench-only commands.
4. Connect the separate Reception editor to those real tools: select a region,
   add an Image from Library, create/edit Text and assign profile/link content.
   Prove canonical save, cancellation, recovery and scoped history for this
   initial production flow before expanding the layout controls.
5. Implement pure layout operations/validation and integrate the existing
   transaction boundary, with meaningful split/resize/move/merge/undo/failure
   checks. Keep content records independent of their region assignments.
6. Replace the fixed Reception rendering with the shared owner/public static
   renderer, real supported content and the Hanssen contour. Connect Reception's
   own controls and command registration through existing access boundaries.
7. Complete mobile arrangement, global/local spacing, branding and real
   navigation/theme behavior. Verify long content and actual media early.
8. Complete save/reload, backup/recovery, collection projection, publication and
   restoration. Include Reception-owned content, private/unplaced exclusions,
   shared-section selection and selected-canvas interactions.
9. Remove obsolete paths across the full disposition table. Update current
   contract implementation status, design-system descriptions and inventory.
10. Run final checks on the final source, inspect actual screenshots/interactions,
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
| Separate editor entry | Editing Reception does not create or consume a Workbench slot, change the active canvas's content or mount the full Workbench camera/window runtime. |
| Blank start | One empty region; reachable split/place controls in owner mode; no construction tools for a visitor. |
| Direct content creation | Add an Image through the shared Library and create/edit Text directly in Reception without first placing either on a Workbench. Each has one canonical Reception-owned record, survives save/reload and follows scoped history; cancellation/failure leaves no orphan assignment. |
| Shared-tool regression | The original Workbench still creates and edits Image/Text content using the extracted production tools. Library selection, crop, typography and color remain functional; the disposition review identifies the common implementation used by both editors. |
| Editor command scope | Reception shortcuts, context menus and panels expose only its registered tools. Free-canvas size, camera/index, Workbench Layers, Shapes/FX, mini-app and Display-link commands cannot run through hidden handlers; leaving the editor cancels pending gestures and stale writes. |
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
| Appearance ownership | Reception cell controls own the outer padding, background and corners; Text tools own typography and paragraph layout. There is no doubled container styling, and existing Workbench Text box settings are preserved. |
| Inner corners | Founder screenshot's navigation cutout is visibly reproduced with variable navigation width and light/dark surfaces. Ordinary outer border-radius alone fails this check. |
| Long identity/navigation | Long names/links and narrow widths preserve navigation, focus, contour and readable text. |
| Shared content | Editing a Reception-owned Text or Image updates both viewport layouts without a duplicate article/module. Any retained external reference resolves through its explicit owner, never whichever Workbench happens to be active. |
| Mobile layout | Vertical default and deliberate ordering; owner overrides survive unrelated desktop edits; removed cells leave no stale mobile entries. |
| Text and media overflow | Long text remains readable; transparent/raster/SVG image handling retains the existing renderer policy, fit and provenance. |
| History | Completed split, merge, move, resize and appearance changes undo/redo chronologically; native text undo remains scoped. |
| Save failure | Simulated canonical storage failure preserves the previously accepted data/history and reports failure; retry actually retries. |
| Reload and private backup | Accepted current-format layout and assignments survive reload and explicit backup/restore without silently replacing newer local work. |
| Profile isolation | Two profiles and same-profile second tab cannot share or race authored bento state; stale async work cannot commit. |
| Preview parity | Owner preview and public renderer have matching geometry, clipping, content and themes for the same allowed data. |
| Public privacy | A private module/canvas can never enter public bento bytes or appear through a local-draft fallback. |
| Reception publication | Selecting the shared Reception section publishes its eligible placed content through the existing publisher; private and unplaced records stay out. Leaving that section unchecked preserves the previous public Reception. No hidden Workbench is created to satisfy publication prerequisites. |
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
