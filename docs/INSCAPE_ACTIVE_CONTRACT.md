# INSCAPE active contract

Status: sole active product-direction document
Established: 2026-08-28
Product clarification: 2026-09-06 — public Workbench and independent modules
Current focus clarified: 2026-10-30 — personal presentation, work index and incremental changes

This contract owns accepted product decisions. `INSCAPE_CREATIVE_INTENT.md`
explains their artistic purpose; `AGENTS.md` owns engineering/change discipline.
Implementation maps and dated audit reports record structure and evidence.
Read the current focus and product map first, then the affected detailed
section. Section dates identify decisions, not today's release status. Execution
history belongs in dated audits; check the current checkout and CI for status.

## Current focus and change boundaries (2026-10-30)

Reception introduces the person and their artistic world. The separate canvas
overview presents their work; opening a composition gives that work room to live
and be explored. Workbench remains the creative editing environment. The founder
wants Reception and the work index to feel like a connected editorial whole,
with recognizable maker identity through the transition. Here "work index" means
the overview of compositions, not the existing camera-point Index inside a canvas.

On 30 October the founder retired Hanssen as the overall presentation/navigation
reference and will supply a new example. Its saved packet is historical material,
not required reading or a model for future screens. Existing scoped overview and
control decisions remain in effect until changed; no replacement overall visual
reference has been selected. References guide hierarchy and relationships without
imposing every template detail on the maker's content.
The founder has a further idea for connecting the destinations and will discuss
it from their PC. Its layout and interactions are not yet specified: retain the
current routes and do not invent or implement that redesign ahead of discussion.

The Free page/header-removal and style-template experiment was rolled back
because its code growth and visible result were unsatisfactory. The founder
still wants more visual freedom from the Reception frame. Continue that goal
through small, reviewable steps; neither silently restore the rolled-back bundle
nor interpret its rollback as a permanent requirement for a fixed header.
The current bounded Reception remains the implementation baseline until changed.

Every replacement includes cleanup of the displaced implementation. Cosmetic
overrides and parallel paths are not an acceptable substitute for fixing the
existing owner. Follow the concrete replacement, style-ownership and completion
checks in `AGENTS.md`; preserve useful behavior and current authored work.

## Current product map (2026-10-19)

Consolidated on 30 October 2026. Dates in section anchors preserve existing links.

INSCAPE is an artist's Workbench for composing and experiencing identifiable
creative material through independent modules. The ordinary working route is
Workbench + Image, Text, Shape and the other retained modules. Display is an
experimental module, not the required entry point for composition.

### Reading order and status

This map is an index into this same contract, not another authority. Read the
relevant detailed section before changing behavior. Explicit dated removals and
scope decisions take precedence over older implementation descriptions; a
design-system specimen or passing fixture does not activate a parked feature.
[Creative intent](INSCAPE_CREATIVE_INTENT.md) explains meaning, while
[verification guidance](DEVELOPMENT_CHECKS.md) explains how to check implementation.
Neither independently expands this contract's scope. If an actual product
choice remains ambiguous after applying the explicit decisions, ask the founder.

**Implemented** means a route exists in the local application, not that hosted
operation or every device has been verified. **Experimental** means retained
for isolated work without ordinary creation. **Removed** means no current
product route. **Direction/reference** means accepted intent or a review
specimen, not a shipped capability. The checks below are existing acceptance
entry points, not a claim that they were all rerun with this documentation edit.

### Ordinary product routes

| Area | Current route and state boundary | Detail / acceptance entry points |
| --- | --- | --- |
| Workbench and camera | Implemented. Multiple named Workbenches per profile, with one active composition. Camera, selection, Focus/Back and inspection are temporary; module content and accepted layout edits use the existing draft boundary. | [Collection](#multiple-named-workbenches-direction-2026-10-20), [Workbench](#public-workbench-and-visitor-interaction); [camera/area](../browser-tests/workbench-area-navigation.browser.mjs), [F toggle](../browser-tests/workbench-focus-toggle.browser.mjs) |
| Image | Implemented. Add Image or drop Library artwork onto empty Workbench. One click selects; double-click/Enter focuses, F focuses/returns, I inspects. Image owns sides, crop and dimensions; asset identity stays attached. | [Image](#independent-image-module); [click](../browser-tests/image-click.browser.mjs), [artwork host](../browser-tests/artwork-document.browser.mjs) |
| Text | Implemented. Standalone rich articles, linked reading frames and focused writing. One article owns content; save failure/recovery and native text undo remain scoped to it. Display transfer/linking is conditional on the retained experimental Display. | [Text](#text-authoring); [filled editors](../browser-tests/text-filled-workbench.browser.mjs), [linked frames](../browser-tests/text-linked-frames.browser.mjs) |
| Shapes | Implemented. Rectangle and Grid creation; authored shape appearance and geometry, with owner editing and shared Visitor paint. Texture creation is retired; retained Texture records are not a new creation route. | [Shapes](#workbench-background-shapes); [shape behavior](../browser-tests/shapes.browser.mjs) |
| Groups and Index | Implemented. Named membership, stacks and saved navigation destinations. Membership/anchors and explicit publication choices are authored; browsing and camera return are temporary. These are not Display Grids. | [Groups](#named-workbench-groups); [groups](../browser-tests/workbench-groups.browser.mjs), [stacks](../browser-tests/workbench-stacks.browser.mjs), [Index](../browser-tests/workbench-index.browser.mjs) |
| Library and artwork information | Implemented. Browse source assets, select attached images and inspect their retained source information. Browsing state is not artwork authorship or wallet authority; failure must not become a successful empty result. | [Library](#editing-public-inspection-and-publication); [recovery](../browser-tests/library-recovery.browser.mjs), [filter/focus](../browser-tests/library-filter-keyboard.browser.mjs) |
| Identity, Reception and Discover | Implemented. Official profile identity stays distinct from authored presentation; the owner edits, Visitor reads and explores. Narrow widths use the same routes. | [Identity](#identity-and-authored-personas), [entry](#cover-entry-and-discover); [Reception](../browser-tests/reception-card.browser.mjs), [routing](../browser-tests/owner-profile-routing.browser.mjs) |
| Keeper | Implemented within its declared formats. A dock owns artwork/settings; roaming and conversation are temporary. Optional AI access is local-development-only and separately scoped, not a hosted promise. | [Keeper](#keeper-dock); [dock](../browser-tests/keeper.browser.mjs), [dialogue](../browser-tests/keeper-dialogue.browser.mjs), [selection](../browser-tests/keeper-selection.browser.mjs) |
| Mini Apps / HTML artwork | Implemented URL-based hosting. Remote apps own their content; instance grants are temporary. Transparent HTML artwork uses the separate restricted surface, not a general module SDK or NFT import pipeline. | [hosting](#hosted-mini-apps), [HTML](#self-contained-html-artwork-2026-10-14); [host behavior](../browser-tests/mini-apps.browser.mjs) |
| Private editing and backup | Implemented. One editor per profile within an origin/storage partition; other tabs can view the last publication. Settings exports a manual private JSON backup and validates an explicit replacement. No cross-device draft sync. | [recovery](#local-editing-and-private-recovery-2026-10-19); [two tabs and backup](../browser-tests/workbench-storage.browser.mjs), [article recovery](../browser-tests/text-article-tools.browser.mjs) |
| Preview, publication and Visitor | Implemented explicit canvas/shared-profile selection and public collection browsing. Dev and deployed editors can prepare publication through the configured upload service; preparation, upload and wallet publication remain separate. Browsing never changes the saved publication. | [gallery](#published-canvas-gallery-2026-10-26), [publication](#editing-public-inspection-and-publication); [projection](../browser-tests/workbench-publication.browser.mjs), [recovery](../browser-tests/publication-recovery.browser.mjs), [Visitor](../browser-tests/published-visitor.browser.mjs) |

Private drafts own authored content. Local preferences/layout caches own only
their stated presentation data; camera, selections, gestures and visitor changes
remain temporary. Public snapshots contain only explicitly projected public
content. Wallet authority remains external to those document and UI states.
The [development-data policy](#development-data-and-compatibility-2026-10-16)
removes a general backward-compatibility obligation; it does not remove current
save/recovery guarantees or authorize deleting the founder's current work.

### Parked, removed and future work

| Area | Status and recorded reason | Consequence / condition for further work |
| --- | --- | --- |
| Display, its Stage/Grids and Display-specific instruments | **Experimental since 16 October; reason clarified 19 October.** Choosing Display versus solo Images/Workbench blocked the founder's composition workflow. Workbench layering and shared tools come first. A future return remains open. | No ordinary Add, search command or experimental toggle. Detailed Display sections and fixtures describe retained experiments; they do not authorize restoring access. [Decision](#display-experimental-status-2026-10-16), [creation exclusion](../browser-tests/workbench-toolbar.browser.mjs). |
| Separate Mobile presentation/module | **Removed on 12 October.** The accepted replacement is the ordinary profile/Workbench route at narrow widths. | Keep responsive layout and touch support; do not restore a separate mobile entrance, schema or legacy reader. [Decision](#removed-mobile-presentation-and-module), [data rejection](../src/profileDocument/domain/removedMobile.test.js). |
| Mirror; former Animation module and layered-character assembly | **Removed**, not merely waiting in the Add menu. Animation was removed on 20 September to narrow work to the then-current composition/navigation focus; that historical reason does not make Display today's priority. | Do not restore their runtime or saved fields implicitly. Current Keeper motion, intrinsic media animation and isolated HTML artwork are separately scoped capabilities. [Mirror](#removed-mirror-module), [Animation](#removed-artwork-animation). |
| Artwork Frame/mat panel | **Removed on 21 September.** Source transparency is retained. | No restoration of decorative mats, backing or transparency overrides. Module appearance and In place/Lift inspection remain separate. [Decision](#removed-artwork-presentation-panel). |
| Shared workspace, Layers and tools dock | Implemented within the bounded migrations below. Layers, Color/Transform and module tools share docking/window infrastructure; tool layout is private and does not change artwork. Further module migrations require their own scope. | [Docking](#movable-tool-docks-2026-10-21), [Layers](#first-local-workbench-layers-slice-2026-10-21), [shared reference](#shared-creative-workspace-direction-2026-10-14). |
| Live minting, remix/co-authoring, module marketplace and generic connections | **Direction or unresolved scope.** Visitor minting has a local interaction simulation; broader protocols and commercial rules are not specified. | Define a concrete workflow, authority and acceptance criteria before implementation. Do not infer permission from asset possession or creative intent. [Minting](#minting-direction), [scope](#scope-discipline). |
| Authored starting camera, public appearance policy and public profile QR destination | **Deferred choices.** Existing reset/zoom, local preferences and address QR remain authoritative. | Specify the public destination/experience first; saved Index destinations are not an authored startup camera. [Camera](#public-workbench-and-visitor-interaction), [QR](#cover-entry-and-discover). |

### Decisions that supersede earlier wording

Current removals, compatibility and editor rules are stated in the map and
their detailed sections. The former decision-by-decision log and September
dependency checkpoint are retained in the [consolidation archive](audits/2026-10-30/contract-consolidation/history.md).
Use [Development checks](DEVELOPMENT_CHECKS.md) and source-bound evidence for
implementation/release status; no historical test total is release clearance.

## Reception editor simplification (2026-10-28)

The founder approved implementing this UX cleanup with two agents and the lead
agent. This section supersedes earlier Reception instructions about a covering
Library, automatic selection, Saved content, profile content choices, cell
content menus, content swaps and Join cells. Display creation and the design of
canvas-link authoring are explicitly outside this round.

- Start with Image from Library, New Text and an accessible Add cell action.
  Open without selecting a cell. Explicit selection has a restrained outline
  and contextual toolbar; clicking outside deselects. One toolbar stays fixed
  at the bottom centre of the editor viewport, independent of cell width and
  content scrolling. Its actions follow the selected cell. Only the move handle
  remains at the selected cell's top-left corner, as a quiet grip without a
  button background or border. Light dot centres with a thin dark contour keep
  the grip legible over light/dark artwork independently of the interface theme.
  Its full hit area and keyboard focus remain;
  hover/focus strengthens the glyph. Narrow screens wrap actions
  instead of clipping them inside a cell. Keyboard focus remains
  visible. A Library drag indicates its receiving cell temporarily.
- Library is a modeless, movable and resizable shared tool. Library and the
  other Reception tools can move outside the centered grid window, anywhere
  within the editor viewport. New tools initially leave header controls clear;
  a clicked tool comes to the front. Library's edges and corners accept actual
  pointer resizing above its content. It stays open during cell selection, repeated placement,
  cropping and undo. The grid remains interactive. Private window preferences
  do not enter authored content, history or publication. Image placement still
  opens direct crop. A click placement requires a selected cell; a drag captures
  its explicit receiving cell and current draft generation.
- One Delete cell action applies to every cell type. It removes the cell and
  its unreferenced Reception content; Library originals and records still used
  as the header logo stay intact. Normal partitions collapse neighboring space;
  a partition with no removable local seam is repacked in reading order. The
  last deletion leaves a blank starting cell. The operation is undoable.
- The cell's top-left handle moves its complete identity, content and appearance
  through the existing rectangular positions, shifting intervening cells.
  Preview precedes one completed save; Escape cancels. Arrow keys provide an
  alternative. Mobile order remains its independent responsive arrangement.
  Join cells and the content-only move/swap command are removed.
- Remove Profile, Links, Introduction and Details from authoring choices; remove
  the cell three-dot menu, Saved content and Edit profile details. Replacing
  content discards unreferenced Reception records within the same undoable
  operation. Existing public profile-block rendering is not removed by this
  editor cleanup. Workbench profile editing remains independent.
- One Settings window has always-visible Grid and Text tabs. Grid contains
  corners, gaps, a Grid color entry and the two appearance choices below.
  The optional Reception `surface` is a validated hex colour
  or null and survives local/public round trips. Per-cell surfaces override it.
  Backup/recovery remains available separately.
- Clicking the header name/logo edits the optional name and chooses a logo
  from visual image previews. The header appearance icon directly toggles the
  temporary view. Settings shows Your current view and Default for visitors
  side by side; the latter changes the authored publication default. Changing these controls
  does not edit the shared Workbench profile card.

See the dated [implementation and verification](audits/2026-10-28/reception-editor-revamp/README.md)
for this slice's original execution evidence; check current Git/CI separately.

The founder clarified that blank Text must start with an inset and full-width
title/body fields that wrap within narrow cells. Text and its reader use the
same available cell width. See the [free tools and Text correction](audits/2026-10-28/reception-free-tools/README.md).

The final spacing instruction replaces all presets and global spacing controls
with one Content spacing slider (0–128px) in Settings → Text, for Text only.
New Text starts at 24px independently of the former grid default. An adjacent
Apply to all checkbox starts unchecked and resets when the tool is reopened or
another cell is selected. Checking it applies the current value to all Reception
Text cells; subsequent slider edits use that scope until unchecked. Each
completed change is one undoable save; live previews can be cancelled. Images
use their full cell area and crop controls, with no content-spacing control.
Existing explicitly authored Text spacing remains visible and editable. The
saved format's other fields are not migrated by this UI simplification.
See the [Text-only slider verification](audits/2026-10-28/reception-text-spacing-slider/README.md).

The founder further removed the separate Cell appearance and Appearance windows.
New Text and Edit text reveal the separate Text editing tool. Settings → Text
contains only layout (spacing and alignment), never the text-formatting tools.
With no Text selected, that tab remains available and explains the required
selection. The palette action opens
only Color, for either an Image or Text cell's background; Text also exposes its
existing article/selection colour targets there. Crop remains a direct Image
toolbar action. Color is modeless, movable and resizable outside the grid, stays
open until closed, and retargets when another cell is selected. A compact pipette
icon beside the colour wheel uses the browser's explicit screen-sampling API
where supported, with a native
colour chooser fallback. Pending sampling is cancelled or ignored when its
target, generation or lifetime changes. Grid background uses the same tool.

Library's selected expanded image choice is temporary workspace selection,
qualified by source and media URL. Use selected image places that displayed
choice exactly, as drag already does; it must not substitute the source's cover.
See [Settings, colour and Library verification](audits/2026-10-28/reception-settings-colour-library/README.md).

## Linked Reception and canvas presentation (2026-10-28)

The founder approved continuing the preparatory separation into the actual
Reception/gallery connection and persisted links, and clarified that Display
must retain its direct swipe interaction. The founder subsequently withdrew the
inline gallery arrangement: there is no canvas overview beneath the Reception
bento. Canvases opens the existing separate overview again, for owner and public
visitors. Opening a card still reuses the existing viewer, metadata and Index.
An explicitly linked cell can still open a specified canvas and camera point.
Closing restores browsing position and focus.

Reception can show an existing Display, Image side or Text from a named canvas,
or map Display scenes to existing Image/Text sources. The real Display runtime
owns swipe, keyboard and playback interactions. Its Text follower shares the
same temporary motion; mapped cells follow the committed scene. Unlinked cells
stay static. Canvas/profile-qualified sources remain in their original records.
Link settings use the existing Reception store, editing lease, history, private
backup and recovery. The editor keeps its scene session stable through saves;
a new reading snapshot starts fresh temporary selection.

Publication validates sources and camera points against the final selected and
retained public canvases. It refuses unavailable content without publishing a
private canvas implicitly. Mappings for private controller scenes are omitted
from the public projection but remain locally authored. Public readers have no
local fallback. The owner reader resolves only referenced artwork through the
existing read repository, with cancellation/retry and no Library workspace or
editing capability.

Display creation remains outside ordinary Add menus. The separate
owner canvas-management overview is retained. The inline gallery in the earlier
[implementation evidence](audits/2026-10-28/reception-linked-canvases/README.md)
is superseded by this restoration of the separate overview.

Showing source content, opening a canvas/camera point and following a scene
remain separate operations. Temporary scene selection belongs to its snapshot
scope, survives view unmounting within that scope and never saves or publishes.
The [preparatory implementation report](audits/2026-10-28/scene-boundary-implementation/README.md)
preserves the earlier boundary work and fixture evidence, not additional pending
product scope.

## Static customizable Reception bento direction (2026-10-26)

Reception uses a separate editor over the canonical profile draft and one shared
owner/public renderer. The editor simplification above defines its current cell
actions and tools; the former wireframe, covering Library, Saved content, content
swaps and Join cells are retired.

- View, Preview and Edit use the same centered, bounded window, header and
  content dimensions. Preview retains the chosen desktop/mobile framing.
  Navigation sits in the header above the grid, without cutouts, exceptional
  corners or extra top spacing. Narrow headers use two contained rows with
  horizontally scrollable controls. This is the current baseline, not a ban on
  the founder's requested future visual freedom.
- Branding, About, Canvases, Discover, appearance and Edit Reception belong in
  the header; Workbench and mode-specific actions use its right side. Authored
  branding is distinct from verified Universal Profile identity. Reuse working
  routes; do not add inactive Articles/Desktop tabs.
- Start from one empty region. Add Beside/Below preserves its content; dividers
  resize the partition directly. Cells own their corner geometry and surface;
  Text owns typography and paragraph layout. Settings owns grid corners, gaps
  and background. The Text-only spacing slider above replaces global/preset
  spacing controls. Shared article content is not rewritten to imitate bento
  appearance.
- Image crop uses direct drag, keyboard alternatives and a zoom slider from
  0.1 to 4 times Fill cell. Smaller axes stay centered; overflowing axes pan.
  Save and publication retain the framing. Other canvas/overview crop limits
  remain independent. Keep technical canvas dimensions, pixel coordinates and
  zoom percentages out of the Reception layout UI.
- Reception shares Library, Text, Color, tool-window movement/resizing and
  pointer gesture infrastructure with Workbench. Window geometry and stacking
  are private preferences outside authored content, publication and undo.
  Content tools are modeless; no permanent settings column is reserved.
  Shared content owns its intrinsic styles; tool chrome must not override them
  through selector specificity. All modes retain authored profile typography.
- A Library placement retains source identity and captures its explicit cell
  and draft generation before asynchronous work. Closure, Escape or obsolete
  requests cannot replace later content. Image/Text creation and removal follow
  the current editor rules; canvas links use the separate linked-content rules.
- Mobile shares content with desktop but has its own readable arrangement.
  The owner can adjust mobile ordering, sizes and suitable side-by-side cells.
  This neither restores the removed Mobile module nor authorizes phone-wide
  Workbench editing. The isolated multi-object cell fixture remains an
  experiment; production multi-object cells need a data/public projection and
  a mobile composition decision.
- About and Done show the verified owner's saved local Reception. Viewing
  releases the editing lease; Done does not publish. Without a local draft,
  show the publication until explicit editing/recovery. Other profiles and
  visitors receive only the public projection.
- Owner reading does not depend on publication availability. Refresh the local
  record after another tab saves or the page regains foreground, retain a marked
  last-good view on read failure, and do not reload an active editor store.
  Editing and Library load only on edit entry. Successful private recovery
  returns to the same reader; no copied publication or second renderer exists.
- Use profile-scoped save/recovery, editing exclusion, completed-operation
  history and explicit public projection. Public inspection never reads private
  drafts. Keep recovery controls outside the artwork's semantic image.
- Replacement includes displaced UI, CSS, validation, projection, storage,
  fixtures and examples where no remaining consumer needs them. Preserve
  unrelated modules, current authored work and historical evidence. This scope
  does not add bento animation, GSAP, new media modules or Display creation.

Execution evidence: [static Reception](audits/2026-10-26/static-reception/README.md),
[shared controls](audits/2026-10-27/reception-shared-controls/README.md),
[reader boundaries](audits/2026-10-27/reception-audit-remediation/README.md),
[shared styling](audits/2026-10-27/reception-styling-remediation/README.md).
These reports record their tested source, not today's release status.

## Published canvas gallery (2026-10-26)

The founder requested completing mobile visitor access to the existing gallery.
Enter Inscape now opens the published collection in the shared Aerra grid, with
optional wraparound, List, temporary card size, canvas inspection and metadata.
About returns to Reception. Visitor controls have no create, arrange, edit or
crop capabilities and do not read local composition drafts.

Owner navigation clarification (2026-10-27): Canvases and Enter Inscape from
the owner's Reception open the same local collection as the Workbench, once
ownership is verified. This action does not publish or modify compositions.
Visitors and other profiles continue to use the published collection. Explicit
public canvas URLs retain their public collection intent. About itself shows
the verified owner their saved local Reception. Browser Back/Forward retain
the gallery destination.

Publish now defaults to the current changed canvas, offers individual selection
and an explicit Select all changed canvases action. Every selected canvas is
named as a first publication or update. Profile details, Reception and shared
Keeper are a separate selection, required for the first publication. Unselected
canvases retain their last public content. Private module exclusions and the
existing upload authorization, exact-byte verification and wallet transaction
remain in force. A failed or unresolved public read cannot authorize replacement.

The public v9 envelope retains its entry composition and shared profile facts.
`canvas` names that entry; bounded `canvases` contain additional composition data
without repeating profile identity, Keeper or menu appearance. The aggregate
512 KiB publication limit remains. A fresh owner can restore all published
canvases; existing local collections and edits remain authoritative.

This supersedes the earlier collection-publication block and the temporary
Reception entry to the old canvas renderer. Direct module links retain that
renderer. The gallery inspection still represents mini apps as placeholders;
Desktop and mobile authoring remain deferred. See
[implementation and checks](audits/2026-10-26/published-gallery/README.md).

## Presentation and navigation scope (2026-10-30)

The former template-specific direction is retired. The founder's new example
and connecting navigation idea are pending. The existing Reception, overview
and viewer remain the implementation baseline; do not infer a new layout,
fixed navigation position or template geometry from the old reference packet.

- Reception presents the maker, their introduction, links and chosen content.
  Preserve creator branding and the distinction between verified identity and
  authored persona.
- The work overview supports browsing and opening compositions. Previewing a
  composition must not activate its editor or change saved content.
- Opened work retains its authored geometry, title, description and relevant
  metadata, without a template prescribing its content model.
- Articles or Blog belongs within the connected presentation around the existing
  Text work; its exact presentation and label are unresolved.
- Desktop remains a separate future container for mini-apps and launchers.
  Its implementation is deferred; Workbenches remain composition and exploration
  spaces.

One active composition, reliable saves, source identity, private-owner boundaries
and explicit publication scope remain in force. Existing shared controls and
interface font roles apply until a scoped change is accepted.

## Multiple named Workbenches direction (2026-10-20)

**Engineering preservation clarification (2026-10-23):** the founder authorized
technical cleanup and coordination across separate agent tasks. Obsolete or
superseded implementation may be removed with evidence. Preserve current intended
composition authoring, Library-to-canvas workflows, retained modules, content and
the accepted UI appearance. Do not remove a functioning module or product capability
to simplify the code. This changes engineering scope, not product direction or
publication authority. The execution record is the 30-step code-quality plan under
`docs/audits/2026-10-23/`; its progress is not a new product contract.

**Accepted product direction.** Current public collection selection and browsing
are defined in [Published canvas gallery](#published-canvas-gallery-2026-10-26).
The founder chose multiple named Workbenches per profile. Each Workbench is an
independent composition canvas with its own dimensions, module instances,
authored layout, Layers order and composition blocks. One Workbench is active
at a time; opening another changes the working context rather than creating a
canvas window inside the current canvas. A profile offers an overview of its
Workbenches. Visitors can browse and switch between published Workbenches;
private Workbenches and unpublished edits are excluded. The Library remains
shared source material; reusing an asset does not share mutable module content.

The founder initially chose a profile-level Keeper accompanying Workbench
switching. The Keeper direction below supersedes the assumption of one
always-accompanying Keeper: a home/habitat and optional accompaniment are
distinct intents; multiple inhabitants remain a possibility to design.
Keeper identity/configuration must not be silently duplicated across compositions.

Reception uses its separate editor and shared tools described above. Local edits
in each Workbench must remain saved when working in another; this is distinct
from deciding which revisions to publish.

The founder chose an explicit publication-scope choice before publishing: offer
the current Workbench alone, individually checked other changed Workbenches,
and an option to select all changed canvases. The default is the current changed
Workbench. The review must name every affected Workbench and distinguish an
update to a live composition from first publication of a private one. Selecting
all is explicit, never an automatic consequence of saving or switching. Existing
per-content public exclusions still apply; this is not a command to expose every
private module. Any included profile-level changes, such as shared Keeper or
Reception configuration, need their own visible scope rather than silently
travelling with an unrelated composition. Unselected Workbenches retain their
last published revisions and all their local edits.

This supersedes the earlier single-Workbench product restriction. Local saving,
switching and explicitly selected public collections retain profile-level wallet
authority, local editor exclusion and save/recovery guarantees. Cloud draft sync
is not thereby approved. The first-slice descriptions below are dated execution
history; their former publication block is superseded by the public gallery.

The founder explained that old Workbench groups were primarily folder-like
stacks that expand on the Workbench. Multiple canvases now remove their role as
a required organizer of unrelated compositions. Retaining that folder/stack
feature is not a requirement of the new UI. Layers composition blocks remain
the accepted grouping mechanism inside a composition. This decision does not
authorize deleting current groups/content or automatically converting them.
The earlier recommendation to retain navigation groups as a required basis is
superseded; any transition of actual content must be explicit and scoped.

Display remains parked. Mobile authoring remains a separate design review.
The [multiple Workbenches workflow proposal](audits/2026-10-20/multiple-workbenches.md)
distinguishes accepted intent, observed technical dependencies, recommended
workflows and remaining founder choices. Visitor landing and shared Keeper
presentation remain to be settled; publication now has an explicit scope choice.
The original direction decision changed no runtime. The subsequently authorized
local implementation is described separately below.

### First local named-Workbench slice (2026-10-20)

**Founder measurement scope (20 October):** retain multiple Workbenches with one active runtime.
Defer the spatial overview with neighbouring canvases. First measure a well
populated ordinary Workbench, including navigation, active artwork, editing,
save cost and switching. This does not authorize mounting inactive compositions,
building frozen overview previews, or replacing the model with one giant canvas.
Keep the existing local changes and Keeper trial; no commit, push or deployment.
The [filled-Workbench measurement](audits/2026-10-20/filled-workbench-performance.md)
records twelve local runs: inactive compositions do not retain executable
artwork frames; visible animation, collection-wide saving and navigation peaks
are distinct costs. It also records the existing HTML-window geometry mismatch.
The measurement itself changes no production runtime.

**Accepted behavior.** address the measured
save path and HTML geometry, then repeat the same filled-Workbench workload.
Ordinary composition edits validate the changed draft and retain already
validated, frozen inactive content. Shared changes still validate every projected
Workbench. Collection size, external-write detection, editor authority, atomic
persistence and failure/recovery behavior remain enforced. The collection still
uses one synchronous browser-storage record; serialization and writing therefore
still grow with the collection. No deferred-save success or additional cache is
introduced. See the [follow-up measurements and checks](audits/2026-10-21/storage-html-performance.md).
The spatial overview remains deferred; existing changes and the Keeper trial are
retained. No commit, push, upload or deployment is authorized by this follow-up.

**Accepted behavior.**
The owner can name the existing Workbench, create an empty named Workbench,
switch between them and reload the last active one. Names and stable IDs,
modules, dimensions and authored composition layout belong to each Workbench.
Undo/Redo is scoped to its originating composition during the editor session.
The first create/rename retains the current draft rather than clearing it.
The current bounded implementation allows up to eight local Workbenches.

One validated profile collection owns these compositions plus shared identity,
Reception configuration and Keeper records. The Library remains shared source
material; module content is independent. Existing module operations receive a
derived active-composition view. Leaving that context revokes its write handle,
so delayed work cannot write into the arriving composition or a later reopening.
Layout caches and failed Text recovery are composition-scoped. Saving a switch
accepts both the departing layout and arriving ID together; failed persistence
keeps the current context open. Pending Text recovery and unfinished crops or
canvas gestures block context changes.

The existing profile editor lease remains in force. The exploration trial
still edits the shared Keeper and retains its existing movement, camera,
collision and F-zoom behavior. This slice adds no habitat/world behavior.
Collection backups explicitly cover all Workbenches and shared settings;
restoration explicitly replaces the whole local collection. A single-Workbench
backup cannot silently replace an existing collection. Additive import remains
future work.

Publishing a local collection is blocked with an explanation until explicit
publication selection and the public collection format are implemented.
Existing public documents cannot overwrite this local collection during
reconciliation. No visitor overview/switcher, deletion, duplication, public
routes, Layers/docking migration, cloud sync, upload or wallet action is added.
See [implementation and current checks](audits/2026-10-20/local-workbenches.md).

### Local named-Workbench finishing (2026-10-24)

The founder asked to continue named Workbenches, first checking responsibility
boundaries, and to sketch the overview afterwards. This pass finishes the
existing local create/name/switch workflow. The overview and explicit publication
selection remain separate next steps; no new visitor landing is chosen here.

Naming controls now receive explicit items and actions. An owner adapter supplies
camera visibility; a separate workflow coordinates live layout, recovery and
store commands. The existing collection store remains the sole saved authority.
Rename now commits the current layout and name together, without remounting Text
or replacing content Undo. Failed saves retain the form and accepted content.
An open naming form stays above compact navigation, and the existing eight-slot
limit has a visible explanation. No duplication, deletion, cloud sync, upload,
wallet action or deployment is added. See the
[boundary review and verification](audits/2026-10-24/named-workbenches.md).

### Separate local Workbench overview (2026-10-24)

**Accepted behavior.** Following the
named-Workbench pass, the founder chose a list of names beside one large selected
preview, an optional introduction and modest metadata. This supersedes the
earlier deferral of a local overview, while the spatial neighbouring-canvas
proposal remains deferred. The overview is a fixed browsing surface, not another
composition editor or a way to compose compositions.

The owner enters through **Overview** in the local picker or **Canvases** in the
editor sidebar. The sidebar's former **Workbenches / Workbench** pair is now
**Canvases / Editor** (25 October): Canvases opens the overview and Editor returns
to the active composition tools. This terminology distinguishes browsing from
authoring. The subsequent canvas-inspection slice below makes tile opening a
viewing action, with a smaller explicit **Edit** action to activate the editor.
The 25 October overview update replaces the original sidebar and centered layout
with a large left preview and a right column of composition names and details.
Hovering a row or focusing it with the keyboard changes only the preview and
details. Clicking, tapping or pressing Enter on a row opens its fitted canvas
presentation; **View canvas** provides the same action from its details. Touch
focus does not change the preview before the tap completes. **New Workbench**
creates an empty local composition and selects it; opening remains explicit.
On narrow screens the preview and list stack. The preview fits the saved canvas
proportions without cropping or changing authored geometry.

The same day's **List / Grid** control keeps that preview/list and adds an
Aerra-inspired responsive gallery of the same saved compositions. Grid tiles
automatically fill their bounds by centre-cropping the saved canvas. Titles and
small Edit, Crop and Information actions reveal on hover or keyboard focus.
Touch reveals them on the first tap and opens on a second tap or View.
The artwork remains visible beneath a light scrim. Information reveals the
existing introduction and Edit details inside the tile; the former standalone
counts/dimensions panel and permanent info icon are removed from Grid.
**Crop** opens the thumbnail editor directly: drag or use arrow keys to position, zoom from 1–4×,
then explicitly save. **Auto fill** resets the framing; Cancel discards edits.
The optional normalized `thumbnailCrop` belongs to that local collection entry
beside its name/introduction. It survives reload and backup, preserves separate
canvas crops, and does not alter authored geometry, artwork metadata, editor
camera or public documents. Failed writes retain the crop form and saved data.
The crop adapts to the responsive tile's aspect ratio; the manual preview uses
the current tile ratio. The List preview and the opened viewer continue
to fit the complete canvas. Grid tiles
open their canvas presentation; the smaller Edit action activates the editor.
The optional **Wrap** control repeats
the gallery vertically in both directions, with no automatic movement. It is
disabled for a single Workbench. Repeated tiles are visual copies, not new
collection items; keyboard and assistive navigation expose each Workbench once.
Keyboard browsing remains finite. Turning Wrap off gives a finite gallery for
all input methods. View and Wrap choices live in the owner profile session and
survive opening/returning from an editor; they are not saved composition data.
Aerra informed this alternative overview layout. See
[layout implementation and checks](audits/2026-10-25/overview-layouts/README.md).

The 25 October follow-up adds **Card size** (Small, Medium, Large) and
**Arrange canvases** inside the same menu. Size changes actual card dimensions,
including a one-canvas collection; rows do not stretch to cancel that choice.
It is a profile-local Workbench preference with the existing save/error/retry
boundary. Arrange temporarily shows one finite collection with drag handles,
earlier/later buttons and Done; Escape cancels a drag or finishes arrangement.
Successful drops save the existing collection array order atomically, retain
the active editor and its history, and appear in List as well as Grid. Failed
saves leave the accepted order intact and report the error. This adds no second
composition/order store. Wrap adapts its bounded visual repetitions to the card
size while retaining one accessible collection. Nearby compositions mount their
equivalent visual copies together so scroll normalization cannot reveal an empty
copy; distant compositions remain unloaded (26 October wrap-flicker fix).

The founder's subsequent gallery sketch replaces this overview's top-left
navigation and separate view toggle with one bottom-centre **INSCAPE** menu.
It contains avatar/name, **About**, **Canvases**, List/Grid/Wrap and New Workbench,
using existing profile identity and the existing Reception action. The closed
menu is the gallery's only persistent control. The menu stays available while
scrolling; the desktop preview stays beside
the scrolling list/details. Name/introduction editing locks browsing and exits
until saved or cancelled. The editor keeps its composition tools and sidebar.
Reception's own redesign, Articles/Blog, Desktop and global rollout of this
navigation remain subsequent slices. See the
[25 October overview implementation and checks](audits/2026-10-25/hanssen-overview/README.md).

Names and introductions belong to individual collection items. Introductions
are optional plain text, limited to 280 characters; absent/empty introductions
take no space in the reading view. **Edit details** saves name and introduction
together and retains entered text on failure. Metadata derives content counts
and canvas dimensions from the saved composition. No invented edit timestamps,
separate preview cache or new library ownership is added. Card size is the
explicit local presentation preference described above.

`workbenchOverview/` owns the overview adapter, presentation, preview and pure
saved-content projection. `OwnerWorkbenchSession` chooses between this view and
the active editor. Leaving the editor commits its current layout through the
existing named-Workbench workflow before revoking its scope. Failed saves or
unfinished edits keep the editor open. Returning to the same Workbench receives
a fresh scope, so delayed work from before the overview cannot write into it.
The collection store remains the sole persistence authority; module scopes do
not expose the overview's collection-wide read/details APIs.

List renders the selected saved composition; Grid projects the bounded local
collection and mounts nearby compositions plus their equivalent wrap copies. Image, Shape, Text (including linked
frames) and retained Display first-grid projections reuse existing read-only
rendering. HTML artwork is represented by its name and bounds; its executable
runtime opens only inside the Workbench. Previews are inert and contain no
editing controls. Identity/Keeper screen utilities do not become canvas content.
The existing local-collection publication gate remains in force. This pass adds
no public overview, visitor switching, publication selection, Reception redesign,
cloud sync, upload, wallet action or deployment. See the
[implementation review and evidence](audits/2026-10-24/workbench-overview.md).

### Local canvas inspection (2026-10-25)

**Accepted behavior.** Creation and
showcasing are separate. A list row or gallery tile now lifts into a fitted
inspection modal over the blurred overview. Expand fills the app viewport with
the same viewer and selected camera point. Close returns to the retained gallery
position and selected row/tile; only the smaller **Edit** action activates the
saved Workbench and mounts its editor. Failed activation retains the viewer and
reports the save failure. Browsing requires no save and never changes the active
Workbench, authored geometry, editor zoom or publication scope.

The complete canvas is the default opening view. Presentation fits its saved
bounds to the available space without the editor's minimum zoom. Existing named
Index destinations appear in an optional side drawer and compact numbered strip
below the controls. They retain their order and saved/follow-group framing,
using the existing destination resolver; selecting one changes only the view.
The narrow-screen drawer closes after choosing a point. Camera authoring remains
in the editor's existing Index. A separately curated artwork sequence remains a
possible later presentation choice, not part of this implementation.

Compact icon controls reveal **Canvas details** and **Artwork info** on hover,
keyboard focus or tap/click. Only one information panel is visible at a time;
Escape dismisses it before the viewer, and reduced motion removes travel.
The founder explicitly chose Aerra-like translucent glass for these controls.
The canvas opens with its interface hidden; mouse movement, keyboard navigation
or a tap reveals the controls over the artwork. Idle controls fade away unless
an information panel, pointer interaction or keyboard focus needs them. Header,
footer and optional Index overlay the canvas without reserving artwork space.
The overview's List/Grid/Wrap controls now sit inside the bottom Inscape menu.
The grid fills the available viewport, with no reserved header or footer.
Touch targets and accessible names remain available, with an opaque fallback
when reduced transparency is requested.
The latest founder reference supersedes the earlier rim/sheen: the shared
material follows Aerra's plain dark 50% translucent fill, 10px blur and quiet
shadow. It has no glossy gradient. Transparent artwork retains its authored
canvas background. See the [hover/menu follow-up](audits/2026-10-25/gallery-reveal/README.md).
Canvas title/introduction and derived dimensions/counts come from the existing
collection entry. Artwork info reuses the existing source dossier and metadata
component. Its selector lists the source artworks represented in the current
projection, keeping each creator, description, attributes and provenance
separate. Repeated placements share one source entry and are highlighted together
while its information panel is open. These are not merged into composition traits.

The viewer is lazy-loaded and uses the existing read-only composition renderer;
it adds no second content store, published document, schema or image export.
Current projection limits still apply: Images show their first side, retained
Display shows its first Grid, and executable mini-apps remain named placeholders.
It is a local owner presentation, not the interactive public visitor runtime or
public multi-Workbench publication. No Reception/Desktop changes, upload,
wallet request, commit, push or deployment are included. See the
[implementation and checks](audits/2026-10-25/canvas-presentation/README.md).

The subsequent motion pass follows Aerra's published no-bounce 0.6–0.7-second
panel springs through native CSS/Web Animations with an approximating settling
curve. The bottom menu expands as one glass shell; text and details reveal with
small movement and blur. Its scrollbar is hidden while short-screen scrolling
remains usable. Details remain mounted for reversible closing, but closed
content is inert and excluded from accessibility navigation. Canvas lifting,
returning and expansion have one motion owner: frame bounds, artwork framing
and backdrop animate together. Interrupted closing samples the current frame
before replacing the animation. The preview stays at a fixed measurement during
travel, preventing a second fit animation. Reduced motion removes travel and
keyboard focus stays within inspection. See
[motion and arrangement evidence](audits/2026-10-25/presentation-motion/README.md).

The subsequent close/SVG correction keeps the painting clip attached to the
animated outer frame while its destination fit remains fixed. Closing hides and
disables the overlay controls immediately. Twenty sampled return frames before
and after the correction document the former premature thumbnail-sized clip.
See [close and SVG verification](audits/2026-10-25/canvas-close-svg/README.md).

The subsequent mirrored-image seam correction paints the fitted overview/viewer
surface in physical pixels and reuses Image's shared-edge rounding for its image
clips. List, Grid, modal and expanded presentation retain authored dimensions,
crop, transforms and transparency without adding overlap. Index camera changes
now use the same interruptible motion owner as opening, closing and expansion;
the separate canvas CSS transition is removed. This is a local rendering fix,
not a saved-geometry change. See the
[seam reproduction and verification](audits/2026-10-25/gallery-image-seams/README.md).

## Keeper and optional exploration direction (2026-10-20)

The separate Keeper and exploration intents remain distinct from navigation
and presentation reference choices:
a configurable habitat and optional accompaniment serve different purposes;
the exact inhabitant count, habitat ownership and visitor behavior remain open.
An exploration world is optional, with free movement at the visitor's own pace.
Its actor, collision and camera details require their own scoped design work.
Keeper/artwork commerce remains a creative ambition rather than transaction
authority or an implemented protocol. Current trial behavior is recorded below.

## Reception wireframe replacement (2026-10-20)

Historical replacement record: the static bento and linked Reception rules above
own current behavior. The fixed wireframe and its selection-only editor are
retired. [Original evidence](audits/2026-10-20/reception-wireframe.md).

## Keeper dock in the exploration trial (2026-10-20)

The owner-only Explore room reuses the existing Keeper dock, Library, artwork
host, movement modes, swim speed, settings and recall. The profile draft owns
artwork/settings; the room does not create another saved habitat. Reuse the
first Keeper, choosing when several exist, or create an empty private dock with
Layered swim. A missing/unreadable draft requires Workbench recovery, never
replacement with an empty room draft. Use the profile's exclusive editor lease.
Visitors have no private Library or room editor. Leaving releases motion and
the lease. General scene authoring and public habitat presentation remain open.

### Larger exploration trial with Keeper camera follow (2026-10-20)

The temporary room is 2800 × 1800 with two 600-unit environment copies. Only
straight horizontal/vertical metal beams collide; organic interior detail does
not. The body's collision approximation is 8% of world-rendered size, not pixel
or tentacle collision. Direct recall bypasses colliders for recovery.

Start at 100%; F toggles a true 50% overview and returns to 100%. J, wheel zoom,
continuous zoom and scales above 100% are excluded. Ignore F while typing, using
modifiers, key repeat/composition or Library. Clean up the room-scoped shortcut.
Use the existing 460ms inspection curve on Keeper's motion clock, with reversal
from the live scale; do not create a separate zoom animation loop.

Keeper's existing motion owns travel smoothing. The camera keeps its core at the
viewport centre without follow lag and may extend outside the physical room.
World geometry, speed and collision remain unchanged. Pointer destinations are
converted into world space; held-right-button movement updates that destination.
Dock/Library stay in screen space; rig/conversation anchors are projected.
Camera, flight and scenery never write the draft. Return recalls to the start
and restores the initial view. Reduced motion keeps Keeper stationary without
animated camera follow; docked/reduced-motion zoom is immediate.

Evidence: [dock](audits/2026-10-20/exploration-keeper.md),
[collision](audits/2026-10-20/exploration-collision.md),
[camera](audits/2026-10-20/exploration-camera.md). These bounded trials do not prove
full-world performance or implement an authored public world.

## Development data and compatibility (2026-10-16)

On 2026-10-16 the founder confirmed that there were then no active users or
authored compositions requiring preservation. This is the basis of the
development compatibility policy, not a statement that later local drafts are
empty or disposable. Backward compatibility is not a requirement unless the founder
explicitly requests it for a particular task or changes this policy.

Do not retain obsolete behavior or add migration code, legacy adapters,
compatibility fallbacks, old-data tests or alternative access routes to protect
hypothetical users or compositions. Schemas, defaults, identifiers and storage
keys may change within the agreed implementation scope without supporting their
previous versions. Current functionality and current-format persistence still
need to work correctly.

This policy supersedes older compatibility and saved-content preservation
requirements elsewhere in this document and in project guidance. It does not
expand a task into an unsolicited rewrite or cleanup of unrelated source work.

## Local editing and private recovery (2026-10-19)

The founder chose one active editor per Universal Profile. Workbench entry,
published-draft reconciliation, local reset, backup restoration and Reception
editing share a profile-scoped exclusive browser lock. A second tab does not
mount an editor or replace local content. It offers the existing published
view and an explicit retry after the first editor closes or leaves. That view
shows the last publication, not private local changes. Unsupported or denied
locking leaves editing unavailable; no unlocked fallback or forced takeover is
provided. Closing/navigation releases the lock. This coordinates only the same
origin and browser storage partition; different ports, browsers and devices
retain separate local drafts. A shared Universal Profile Library is not draft
synchronization or proof of a public Inscape deployment.

Settings offers a manual JSON backup of the whole private Workbench. It contains
the current-format validated draft, including private content, module IDs,
artwork references and the current composition window layout. Wallet credentials,
media bytes, Library caches, undo history, camera and interface preferences are
excluded. It is a private file, not a publication, cloud backup or synchronization
service. Downloading requests a browser download; the app does not claim that a
file has been durably saved on disk. Pending failed Text edits must first be
saved or copied through their existing article backup before a whole-Workbench
backup or replacement can proceed.

Opening a backup validates its version, size, contents and matching profile.
It shows the backup date, module counts and replacement consequences before an
explicit Replace action. Cancelling changes nothing. Content/profile/layout
changes invalidate the prepared replacement. Confirmed restoration replaces the
whole local draft, clears session undo and invalidates derived layout/publication
tracking; it does not publish or change wallet assets. A failed canonical write
preserves the previous bytes and accepted draft. A separate cleanup failure is
reported as such, without claiming the canonical write failed. Corrupt local
drafts also expose backup recovery, even without a published document, and are
not deleted before replacement succeeds. No older backup-format migrations or
cross-profile copying are introduced.

## Display experimental status (2026-10-16)

**Founder preservation clarification (2026-10-23):** Display was temporarily
parked because the founder did not currently need it; it must continue to work.
Technical cleanup must preserve its existing implemented functionality and
include its affected behavior in verification. Keep ordinary creation access
hidden as described below; this clarification does not reactivate its menus or
approve new features. Remove obsolete implementation only when the retained
Display behavior still works. This does not require historical development-data
migrations or restoring superseded behavior.

The founder parked Display as experimental while reconsidering its role beside
the Workbench. On 19 October they clarified the reason: the large-canvas
composition setup and the choice between Display, solo Images and Workbench
left them unsure which route to use. They needed layering, but felt constrained
inside Display. The next direction is a coherent Workbench composition workflow
with shared tools, rather than asking the artist to choose a container first.
Display may return; its future role and return conditions remain undecided.
It is absent from the ordinary creation toolbar, searchable Add
commands and Workbench context-menu Add options. The design-system creation
examples follow the same restriction. There is no replacement creation menu or
experimental switch in the ordinary interface.
Display remains an experimental implementation, not an accepted replacement
for the Workbench. The 16 October decision established no compatibility
requirement to keep Display windows or automatic startup reachable. Hiding
Display does not require migrating its content elsewhere; it is not permission
to delete current local content as part of an unrelated task.
The Display behaviors described below remain implementation references for
isolated experiments; they are not permission to restore ordinary access.

## Workbench composition direction (2026-10-19)

**Accepted direction; first local Layers slice implemented below.** The founder chose the existing
design-system creative workspace as the intended visual/workflow reference,
describing an Affinity-like organization. That identifies the reference to use;
it does not claim every preview capability is already a production feature.
Production migration remains scoped. On 21 October the founder requested the
UI migration handoff and first visible Layers step, superseding the earlier
audit-first sequencing for this bounded work. Relevant regression checks still
apply; this is no claim that remaining release decisions have been resolved.

- Standalone artwork, explicitly including solo Images on the Workbench, must
  support deliberate front/back layer ordering relative to other artwork. The
  artist should not need Display merely to compose overlapping Images.
- Layers becomes the place to manage that artwork order and remove artwork.
  The hover X that closes an artwork window into a shortcut should disappear
  from this composition workflow. This is an intended replacement, not a claim
  that the existing Close action already deletes content or a decision to remove
  every non-artwork application's window lifecycle.
- Shared tools, including Color, belong in a compact dock/tab organization and
  act on the relevant selection. Shape colour is one use of the common colour
  control, not a reason for a separate, disconnected picker in every workflow.
- **Founder clarification, 21 October: Image has no colour-editing target.**
  Image tinting, recolouring and source-dependent colour editing are excluded
  from this migration. The shared Color tab serves applicable Shape and Text
  settings. Selecting an Image keeps the chosen tool tab in place, with no
  applicable colour target; it must not keep editing a previously selected
  Shape or Text. Earlier references to unresolved Image colour semantics are
  superseded by this decision.
- The founder explicitly wants tools to remain together by default, with the
  option to detach a panel, return it to the dock, or hide it. The previously
  accepted detachable/regroupable tab direction still applies. Tool visibility
  and placement are presentation state, distinct from artwork visibility and
  deletion; changing tools must not rewrite or remove the composition.

Use one authoritative artwork order and module-owned content across selection,
rendering, undo, publication and save/recovery. Temporary activation never changes
saved order. Verify overlap, reload/undo, public projection, Layers removal and
recovery, and dock detach/rejoin/hide without content loss. The concrete Layers,
Image, Shape, Text, Color/Transform and FX rules below describe their accepted
scope; generic module connections and live minting remain separate future work.
Display remains retained and experimental.

### Layers composition groups decision (2026-10-20)

**Accepted direction; first local implementation described below.** The founder
chose groups in Layers as composition blocks, rather than organizational lists
whose members can be interleaved with unrelated layers. A group's participating
artwork occupies one contiguous block in the authored front/back order. Moving
that block in Layers moves its members together in that order; members remain
individually editable and reorderable within the expanded group. An unrelated
layer can sit above or below the block; to place it between group members it
must join the group, or a member must leave. This decision does not flatten
artwork, erase asset identity or introduce group effects or nested groups.

The founder subsequently approved these formation and selection rules:

- Creating a composition group anchors its block at the frontmost selected
  member's position in the authored layer order. Selected members retain their
  relative order and canvas geometry; intervening unselected layers remain
  outside the block. Overlap may therefore change. Group formation and its order
  change are one undoable operation, restoring the complete prior state on Undo.
- In normal canvas interaction, one click selects the block; dragging moves its
  members together. Double-click focuses the whole block rather than entering
  its contents. Focus is temporary navigation, not a layer-order edit.
- An explicit Edit parts action, or Enter while the composition block is
  selected outside text/input editing, enters the group. Canvas clicks then
  select individual members. A visible context cue identifies the group and
  selected part, for example Personage > Ogen. This entry preserves the authored
  overlap; it does not invoke the existing Workbench reading spread.
- Escape first cancels or exits an active edit/gesture according to its existing
  scoped behavior. Otherwise it leaves group editing and selects the whole
  block. It must not bypass Text's own input or cancellation behavior.
- Expanding a group in Layers and clicking a member selects that part directly;
  it does not require first entering through the canvas. Merely expanding or
  collapsing the Layers row does not alter canvas geometry or authored order.

These rules resolve the formation-anchor and group-entry choices in the review.
They did not authorize a UI rebuild during that documentation round. The later
21 October migration request authorized the bounded local implementation below.

The first shared Layers scope is Images, Text and Shapes, with expandable groups.
Artwork info has its own detachable tool tab. The layer eye is temporary editor
visibility, separate from inclusion in publication. Mobile authoring is a
separate design review; this migration targets desktop, with controls remaining
reachable when its window narrows. Display remains parked.

Existing named Workbench groups still implement membership, navigation order,
compact stacks and a temporary spread for reading. They do not implement these
composition blocks. The new direction does not silently reinterpret their
member order as z-order, turn opening a group into an authored rearrangement,
or convert existing groups. Their navigation/stack behavior and the composition
model need explicit reconciliation before implementation. In particular,
spreading a character's body, eyes and effects into separate reading tiles
cannot be assumed to be the intended way to open that composition.

See the [design review and group reconciliation proposal](audits/2026-10-20/design-system-review.md#compositieblokken-en-bestaande-workbench-groepen)
for observed boundaries, unresolved choices and acceptance cases. The choice of
composition blocks supersedes the earlier open group-semantics question; it
does not approve every proposal in that review or authorize UI changes.

### Movable tool docks (2026-10-21)

**Accepted behavior.**
Layers, Transform and Color each have one independent tool instance. They start
as three tabs in one movable dock on desktop. Dragging a tab out makes a separate
window; dropping it on another dock's tab strip joins that group. Tab placement
also permits reordering. The free header area moves the whole group, and its
invisible edges/corners resize the group. Whole groups may join another dock.

Closing hides the active tab only. The Layers toolbar button and Actions
(Ctrl+K) reopen the relevant tool in its existing group. Right-click or Shift+F10
on a tab offers detach, join another visible group and close. Tab arrow keys and
the existing keyboard move/resize controls remain available. Escape, loss of
focus and editor disposal cancel an unfinished drag. A target strip highlights
only during docking; ordinary pointer use does not leave a keyboard focus box.

The dock owns only in-memory editor layout for the current runtime. Layout is
not persisted across reloads, published or entered in artwork Undo history.
Stable tool containers move between groups; artwork selection, module-owned
edits and saving remain separate. Color cancels a live preview when rearranging
or hiding its panel. Canvas Delete reveals Layers and its inline confirmation
even when another tab was active. Toolbar visibility is derived from the layout;
moving a dock does not require updating the whole owner runtime's React state.

This implements docking for these three tools, not the pending migration of
every module-specific panel. The founder explicitly declined a numeric rotation
field: do not add one from the earlier reference example. Rotate and both Mirror
actions remain in the Image toolbar. See [checks and screenshots](audits/2026-10-21/tool-docking.md).

**Accepted behavior.** a dock can also stack
several tool panes vertically, as in the supplied Layers-over-Color screenshot.
Each pane has its own tab strip, active tool and close control, so multiple tools
remain visible together. Drop a tab at a pane's upper/lower edge to stack it;
drop on its tab strip to join its tabs. A thin divider resizes the neighbouring
panes, with pointer and keyboard access and cancellation. Any free header area
moves the whole dock, and its invisible outer edges resize the common frame.
Whole docks can stack while retaining their panes; tabs can still detach.
The tab context menu also offers Dock above/below alongside detach/join/close.
Closed panes retain their placement and proportions until reopened. Small
viewports retain internal scrolling and reachable headers. This replaces the
single-tab-group layout structure with one dock frame containing pane groups;
the existing stable tool instances and module-owned edits remain unchanged.
Layout initially remained session-only. The 2026-10-23 Library and editor-preferences refinement below now persists it outside artwork history and publication.
Text stays independent. See [stacked-dock checks](audits/2026-10-22/stacked-tool-docks.md).

### Image tool window migration (2026-10-21)

**Accepted behavior.**
Image now joins Layers, Transform and Color as a fourth tab in the same dock.
It can detach, join another dock, move, resize through invisible edges, close
and reopen through Actions → Image settings. Selecting artwork does not change
the active tab. The Image tab follows one selected Image; other selections and
closed artwork have explicit empty/reopen states.

The existing Library drop choice, Remove Image side and Include Image in
publication controls keep their order and module-owned behavior. The old Image
Properties contents are replaced, not duplicated. Side selection/drop mode,
asynchronous drop invalidation, edits, storage errors and Undo remain in Image.
The host routes its existing controls through the same selection/tool-source
boundary already used by Color. Action errors, including Fit and crop completion,
remain visible beside the toolbar even when the Image tab is hidden. Settings
errors stay beside the corresponding Image controls without duplicate alerts.

Rotate, Mirror, Crop, Fit, inspection and duplication stay in the Image toolbar;
dimensions remain in Transform and Image has no Color target. This migrates the
Image tool window only; Shape and Text tools still await their own pass. Dock
layout persistence remains deferred. See [checks and screenshots](audits/2026-10-21/image-tools.md).

### Shape tool window migration (2026-10-21)

**Accepted behavior.**
Shape joins Layers, Transform, Color and Image as a fifth independent, dockable
tool. It reopens through Actions → Shape settings. Selecting another artwork
does not change the active tab. Narrow dock headers scroll horizontally while
keeping the close button reachable; keyboard tab navigation reveals its target.

The Shape selector, Name, Grid snap / spacing / line width, texture strength /
scale and publication choice retain their order and behavior. Shape supplies these controls through
its existing tool-source registration; the old Shape Properties contents are
removed. Shape owns its presentation, validation, saving and Undo. Closed Shapes
remain editable through their existing controls and can reopen through Layers.
Settings and Color report their own errors; toolbar failures remain visible
with the Shape tab hidden.

Color and dimensions remain in Color and Transform. Duplicate, order and delete
remain in the existing Shape toolbar. This introduces no new shape kinds, FX
behavior or authored schema. Text is deliberately last in the agreed sequence.
See [checks and screenshots](audits/2026-10-21/shape-tools.md).

**Founder refinement later on 21 October:** remove Show shape and Grain strength
from Shape, including its Properties reference example. Visibility is controlled
through the Layers eye; the existing Layers reopen action handles closed artwork.
The next tool is FX. Its shared Grain control must edit the selected Shape's
existing authored grain value, with module-owned validation, saving and Undo.
There must be one grain editing location, rather than duplicate controls in each
tool panel. Removing the Shape control does not reset existing grain or change
rendering/publication. FX is not implemented in this cleanup; its Grain behavior
for Shape is now agreed. Blur and effects for other module types are not inferred
from this decision. Text remains last.

### First local FX slice (2026-10-21)

**Accepted behavior.** The founder
approved Grain and the reference's Blur together in FX for the selected Shape.
This supersedes the pending FX/Blur scope above. FX is the sixth tab alongside
Layers, Transform, Color, Image and Shape. It uses the same movable dock,
invisible resize edges, detach/rejoin and close behavior. Actions → FX reopens it.
Dock arrangement remains editor-session state; reload starts the tabs together.

Shape supplies its controls through the existing module tool source and owns
validation, temporary previews, saving and Undo. The host supplies selection and
window presentation. Grain edits the existing rectangle strength (0–1, shown
as 0–100%). Grid and retained Texture keep their existing pattern models. Blur
applies to Shape paint, including Grid/Texture, as an optional authored `blur`
value from 0–12 Workbench pixels; its slider steps by 0.5. It scales with the
camera and pixel density without blurring selection or resize controls. These
values follow existing duplication, history, reload, public projection and
visitor rendering. No second effects store or publication path is introduced.

Each slider previews during a pointer drag or keyboard gesture and saves once
when completed. Escape, lost focus, cancellation, dismissal or a changed draft
discard the preview. Failed writes leave the saved artwork unchanged and show
a recoverable error in FX. Effects follow one selected Shape without changing
the active tab. Other module types and multiple selection have no FX controls
in this slice; Image and Text effects are not added. Text migration remains last.
See [implementation evidence](audits/2026-10-21/fx-tools.md).

### Independent Text tool window (2026-10-21)

**Accepted behavior.** Text stays outside
the Layers/Transform/Color/Image/Shape/FX dock. Its larger set of typography,
paragraph, writing and article controls belongs in one independent movable and
resizable window. This supersedes the earlier intention to migrate Text into
the dock and the older fixed-width, content-sized tactile inspector description.

The existing shared Text source/editor relationship remains: the active article
supplies controls, selection, Undo, saving and failed-save recovery. Only its
screen shell now reuses the same flat Carbon/Mist `WorkbenchToolPanel` as
Layers, with invisible pointer resize edges and keyboard resizing. The header
identifies the active article. Native disclosures and one body scroller retain
the existing control organization. Tool position and dimensions are session
state, independent of authored text-frame geometry and article contents.
Reopening or changing articles retains the tool frame. Initial placement and
viewport fitting keep the live camera controls reachable. Toolbar menus remain
above the independent Text window.

Workbench Text colour stays in shared Color; its position and dimensions stay
in shared Transform. Font size, paragraph spacing, columns and padding remain
typographic/layout settings in Text. Existing Display Text editing remains
supported through the same independent window. No schema, history or storage
path changes, new typography functions, or Text FX migration are introduced.
The design-system workspace now also opens Text as the real independent window
instead of a Text tab; its data remains disposable. See
[checks and screenshots](audits/2026-10-21/text-panel.md).

**Founder-approved hierarchy refinement (2026-10-21):** Text has one persistent
navigation row: **Format text** (Tekst opmaken) and **Article settings** (Artikel
instellen). Format text explicitly identifies selected text or the typing cursor,
groups character and paragraph controls separately, and keeps existing writing
tools accessible. Article settings identifies whole-article defaults and groups
default typography, layout and article management. Headings, secondary
disclosures, field labels and spacing convey distinct levels. The two scopes
remain mounted; switching is session presentation state and preserves editor
selection and history. Find reveals Format text before focusing
its search field. Shared Color/Transform and Focus writing's existing design and
behavior remain unchanged. The design-system preview uses this same component.
See [hierarchy checks](audits/2026-10-21/text-hierarchy.md).

**Founder clarification later on 21 October:** ordinary formatting shows the
actual font at the cursor or in the selection, including heading defaults;
different fonts show Mixed fonts. The ambiguous Article font placeholder and
redundant Character heading are removed. The existing inline-font reset has a
small reset control identifying its default. Article settings shows a compact
default-style summary; its Default font, Default size and default line spacing
are behind the explicit Change default style disclosure. Changing these defaults
keeps individually authored formatting. This refines presentation without adding
another font model or changing Focus writing. See
[font clarity checks](audits/2026-10-21/text-font-clarity.md).

### Existing tool-window finishing pass (2026-10-22)

**Accepted behavior.** Clarify
the existing controls before working on Keeper. Color names its article-wide
targets explicitly and replaces “Use inherited color” with “Use default text
color”; the tooltip identifies the paragraph/heading or article default being
restored. Typography reset controls use the same default terminology. Image
names its Library-drop outcomes Add as a new side and Replace current side.
Shape's existing-object chooser is Selected shape. Layers consistently calls
its composition blocks groups in its controls and identifies editing or moving
a member out of a group explicitly. These are wording changes, with the same
module-owned edits, history and storage.

The workspace reference removes its stale numeric Rotation and Show shape
controls, offers no Image color controls, and limits FX to the implemented
Shape scope (Grain for rectangles, Blur for Shapes). This reconciles earlier
accepted placement; it does not introduce effects or migrate every independent
reference example. Existing controls retain their placement and flat shell.
Keeper dock is the next round, followed by Navigator/minimap and sidebar;
saved window arrangement and Focus writing remain deferred. See
[checks and visual evidence](audits/2026-10-22/tool-window-polish.md).

### First local shared Transform / Color slice (2026-10-21)

**Accepted behavior.** A compact Carbon/Mist
companion originally used the same screen-space shell as Layers, with two tabs
in its header; the movable docking implementation above supersedes that fixed
pair. Selection changes do not switch tabs. It opens on desktop;
Actions (Ctrl+K) reopens either tab. Moving/resizing/closing tools remains local
UI state. Invisible edge/corner targets and keyboard resizing remain available.

Transform reads the registered artwork frame in Workbench coordinates, with
X/Y and width/height. The founder's correction on 21 October keeps Rotate and
both Mirror actions in the Image toolbar alongside Crop. Their initial move
into Transform was an assistant assumption, not an agreed product decision.
Do not add or relocate controls based only on their conceptual fit with a tab;
follow the agreed placement and discuss proposed changes separately. Module
limits, grid-cell sizing, validated saving and shared history remain in their
existing owners. Multiple selected frames require an explicit single frame;
closed artwork offers an open action. Image fitting/cropping stays in its
existing controls pending its own migration.

Color reuses the reference workspace's hue ring, triangle and hex control.
The founder's follow-up keeps the current Saturation/Lightness fields for now;
do not replace them with sliders or relocate them from the spoken exploration.
Pointer use of the ring/triangle must not paint a focus frame. The shared picker
distinguishes pointer focus from keyboard navigation; keyboard focus remains
visible, with Escape cancellation and arrow-key editing intact.
Shape supplies its color and opacity; texture strength remains a Shape-specific
setting. Text supplies selected words/caret, document default, title, background
and heading/caption styles. The target is explicit; range/caret selection survives
tab changes. Live color gestures preview without intermediate saves, commit once,
and cancel on Escape, focus loss, scope change or disposal. Inline Text retains
its native editing history and existing failed-save recovery. Image has no Color
target and cannot continue editing the previous Shape/Text selection.

Migrated controls are removed from the owner Image/Shape properties and Text
color controls. The retained module-specific tools are still the older surface;
this initial slice did not complete their migration or docking/detachment. The shared
host routes module-owned controls through the existing Workbench selection;
there is no second authored-content or selection store. Keyboard entry and
explicit creation target that same selection. Color-source notifications are
separate from canvas geometry notifications.

Evidence and remaining limits: [shared Transform / Color review](audits/2026-10-21/shared-transform-color.md).

### First local Workbench Layers slice (2026-10-21)

**Accepted behavior.** The owner Workbench has a
real compact Carbon/Mist Layers companion. The founder's clean-window follow-up
replaces its inherited artwork window host with a small screen-space tool panel:
title/drag button, close button and content area. The panel owns only temporary
position/size, viewport bounds and pointer/keyboard gestures; artwork, camera,
selection and saving retain their existing owners. Keyboard navigation keeps a
focus mark, while ordinary pointer dragging does not highlight the title bar.
Persistent Workbench navigation and the camera/creation rails bound its usable
height; the list shrinks and scrolls without pushing its actions offscreen. It opens
by default on desktop, can be closed/reopened from the creation toolbar, and
uses its own scrolling. The founder's 21 October clarification keeps resizing
through invisible edge/corner targets and directional cursors; only the visible
handle marks are removed. A keyboard-reachable bottom-right target supports
arrow-key resizing. The minimum is 280 × 240 px, bounded by available viewport
space. The permanent visibility/order explanation labels are removed; the eye
tooltip retains the temporary-visibility meaning. The separate Undo footer is
also removed at the founder's request; shared Workbench Undo/Redo remains
available through its existing keyboard shortcuts and commands. Layers remains draggable by
its title bar. Below 600 px it starts closed to
preserve existing controls; this is not a mobile-authoring redesign.

Images, Text and Shapes share one optional `artworkLayers` field, stored from
back to front. Entries are module IDs or contiguous composition blocks with
ordered children. Canvas paint, Layers, history, reload and the active
composition's public projection derive from it. Text continuation frames travel
with their Text. Selection/focus never raises artwork. Module content, geometry
and source assets retain their existing owners; Layers uses the existing
Workbench selection. Ordinary selection retains module handles and Text input.

Buttons, Alt+Up/Down and row dragging reorder artwork. Group formation uses the
approved frontmost-member anchor; internal ordering, ungrouping and leaving a
block preserve artwork. Canvas click/drag selects and moves a complete block,
including hidden or closed members. Double-click focuses a block; Enter or
Edit parts enters it. Expanded rows can select parts directly. Escape respects
Text input and active gestures before leaving part editing. No nested blocks,
group FX or automatic conversion of navigation groups is introduced.

Eye controls are session-only editor visibility. Deletion has inline
confirmation and one completed save; Undo restores module records, sides,
source references, captured layout and memberships. Failed or stale writes do
not partially mutate the composition. Canvas Delete opens the confirmation
even when Layers is closed and does not intercept text input. Closed artwork
remains reopenable in Layers; owner Images no longer expose the old hover X.
Library assets and other modules using their source remain independent.

The public single-composition document receives only a flat filtered order of
its published modules. Local block names and private members do not enter that
order. Preview/Visitor share the canvas projection without owner Layers tools.
This does not implement publishing multiple Workbenches.

Color, Transform, module properties, Artwork info, dock/tab grouping and
detach/rejoin remain the next migration slice. Joining a part to an existing
block currently requires ungrouping and reforming it; no implicit drag-to-join
semantics were added. Tool layout persistence/reset is not yet part of this
companion. Existing navigation groups/stacks, Keeper trial, Reception and
Library behavior remain separate. See the
[implementation and verification record](audits/2026-10-21/workbench-layers.md).

## Independent Image module

The founder accepted Image as a standalone Workbench module beside Display.
It holds one Library image per side, with no layers or nested composition.
One side holds one artwork source. Multiple sides expose a separate Next control:
every flip turns in the same direction and the last side wraps to the first.
The selected side is temporary reading state; reloading starts at side one.
Image has its own flat, borderless rectangular surface, without instrument-window
chrome, grain, shadows or rounded corners. The original media alpha is retained.
Canvas projection and clipping share one rectangle. Movement and snapping use
exact Workbench geometry, never rounded DOM positions. Crop projection uses
authored canvas dimensions independently of the camera. Only painting rounds
the projected edges to physical pixels, so adjacent modules share a boundary
through pan and zoom without rewriting authored geometry. Resting
artwork is 2D. Flip faces and perspective exist only during a side transition.
The requested side is prepared before the turn: raster media is decoded and
SVG media waits for its live document, including extensionless sources. The
visible side remains mounted while waiting; the prepared side retains its DOM
and live document when it becomes the resting image. Only these two sides are
mounted during a transition. Loading is bounded, failed preparation preserves
the current side and offers retry through Next, and closing or changing content
cancels obsolete preparation. The 600ms turn uses a symmetric easing curve.
Artwork briefly fades around the edge-on midpoint (30ms either side), softening
the dark stripe formed by compressing dark artwork. The rotating faces retain
their backface culling; the resting artwork remains fully opaque.
Each face retains its authored crop; the rotating plane can extend beyond the
resting canvas instead of being clipped again by its stationary rectangle.
The explicit Inspect action opens the existing Display Lift renderer, revealing its
full media from the cropped rectangle. Return or Escape restores that crop.
Reduced-motion users get immediate side changes and inspection transitions.

Image and Display render SVG artwork through the same isolated document runtime
as Identity. Module-owned geometry still determines crop, resize, rotation,
mirroring and layer order. The document occupies that projected media rectangle
inside a clipped SVG viewport; it does not receive module editing input.
Percentage-sized SVG documents use their source viewBox for native document
layout when larger than the image decoder's default dimensions, with a 4096-pixel
maximum side for this derived viewport. Fixed-size documents retain their native
layout. This temporary paint geometry does not rewrite saved placement dimensions,
crop or metadata. Standard external SVG 1.1 declarations are stripped before
parsing; other DTDs and internal entity declarations remain rejected. Embedded
raster layers keep their own source resolution. See the
[original-asset checks](audits/2026-10-25/canvas-close-svg/README.md).
Owner, Visitor and enlarged inspection share this rendering path. Display
prepares SVG documents within its existing bounded five-slot Grid rail while
the module is visible, so incoming artwork can start before a swipe exposes it.
After the founder's 30 October retention follow-up, an already mounted projected
SVG can remain outside the viewport for up to two minutes. At most 24 idle
documents are retained across the page; the oldest is evicted on capacity pressure.
Visible documents and Display's active preparation rail do not occupy idle slots.
Returning within that bound reuses the same isolated document. Changing its source,
removing its placement or leaving its Workbench disposes it immediately. No inactive
Workbench is mounted by retention. The host forwards the existing boolean
`inscape:html-artwork-visibility` signal, including across initial loading, so
cooperating Nomads pause offscreen and resume without rebuilding their textures.
This does not guarantee suspension of arbitrary third-party SVG scripts that ignore
the signal; their idle lifetime is still bounded. HTML artwork retains its existing
disposal policy. Internal animation state is temporary, not saved composition data.
Loading remains available to assistive technology, without a visible loading label
over the composition or inspection. Failure and Retry remain visible. This is a
bounded warm-document policy, not a guarantee of arbitrary SVG memory cost or of
reload-free returns after expiry or capacity eviction.
See the [twelve-SVG verification and limits](audits/2026-10-30/svg-retention/REPORT.txt)
and the [original retention checks](audits/2026-10-21/svg-offscreen-retention.md).
Display selects live
SVGs by rectangular bounds because a static alpha mask cannot describe animated
content. Raster artwork keeps its existing renderer. Saved URLs and schemas are
unchanged, and the runtime retains its existing restricted LUKSO RPC policy.

Width and height are independent whole-pixel dimensions from 32 to 4096.
Owner selection or keyboard focus reveals the complete Image bounds and contrasting
28-pixel resize targets. Corners resize both dimensions; midpoint handles resize
one dimension around the opposite edge. Targets keep their screen size through
zoom and are centred on their visible marks. Tiny surfaces keep more of the
target outside to preserve a movement area, while the whole mark stays clickable.
At viewport edges, hit areas
stay reachable while their marks identify the canvas edges. Redundant handles are
omitted on tiny canvases.
Resize focus fills the small visible handle mark instead of outlining the larger
transparent pointer target. Keyboard resizing retains visible focus.
The artwork itself is the move surface. As clarified on 2026-10-19, a single
click selects the Image's active tools and bounds without changing the camera.
A double-click focuses its Workbench module; keyboard Enter retains direct
Focus. After an ordinary click, F also focuses that Image without a marquee
selection. Pressing F again returns to the preceding Workbench view. Separate
ordinary clicks on an already active Image do not zoom. This
activation is separate from the existing Shift-toggle multi-module selection.
Dragging beyond five screen pixels moves its window and never focuses on release. Movement is
temporary until release; Escape, lost capture or blur cancels it. Crop retains
its own pan gesture. The separate floating title strip is removed. Close and a
small Next arrow appear on hover or keyboard focus, and remain available on
touch. The side count stays in the accessible description and tooltip rather
than covering the artwork. On tiny or thin canvases these action targets sit
outside the artwork and resize handles so the canvas remains grabbable.
Shift-click or Shift+Enter on the artwork toggles Workbench selection; focused
window arrow keys move it. Resizing saves position and dimensions together
as one undoable operation; Escape cancels the preview. Keyboard focus remains
visible. Visitor shares direct movement, inspection and quiet controls without
editing bounds or resize controls. The contextual dock also offers exact
dimensions, shared rotate/mirror actions, crop pan/zoom and Native fit.
New artwork fills the canvas through a centred crop. Library drops append a
side by default; Replace side retains its position in the sequence and starts
the new artwork at its default crop/transform. Remove side is undoable.
As explicitly clarified on 2026-10-19, Image corners resize width and height
independently: horizontal movement changes only width, vertical movement only
height, and diagonal movement changes both freely around the opposite corner.
The earlier interpretation that locked the canvas ratio is superseded. The
source artwork always retains its own proportions through the chosen Fit inside
or Fill canvas projection. Individual Image handles and selection of one Image
share this module-owned geometry, including keyboard input and per-axis snapping.
Multi-module selection retains its existing proportional group scaling.
Authored Image dimensions retain whole-pixel rounding and size/area limits.
The Image frame uses its authored Workbench dimensions directly. Browser width
or height must not apply a second per-Image fit or a resize limit: that would
cancel visible growth and reinterpret the frame after reload. Workbench
camera zoom/focus owns fitting the view. Owner and Visitor use the same geometry;
browser size only affects control reachability, not the saved or visible world
dimensions. Existing Image size limits and authored Workbench area still apply.
Side handles still change one canvas dimension; the canvas edges remain the
resize and snap targets. Resizing preserves the chosen Fit inside or Fill canvas
mode and existing crop focus/zoom, including when the canvas ratio changes.
Pointer, keyboard, selection and
numeric size edits use the same authored resize operation. Cancel restores the
previous fit; undo restores fit, dimensions and position together. Older saved
native-fit sides remain unchanged when opened or moved. Fit inside and Fill
canvas expose the existing fitting choices directly in Image tools; Fit inside
shows the full source and may leave space. Fill canvas covers the canvas through
an aspect-preserving crop. Neither mode stretches the artwork.
The first implementation supports up to sixteen modules and 32 sides each.
Image tools offer Duplicate, creating an independent Image beside the original.
It retains authored dimensions, publication inclusion, every side's source,
crop and transforms, with new module and side IDs. The copy starts on the
currently viewed side and receives selection and keyboard focus; that side
choice remains temporary. Duplication saves the copy and its position in one
undoable operation, observes the module limit, and never resets an existing crop.
Dragging Library artwork onto empty Workbench space creates one Image module at
the preview's exact position, accounting for camera pan and zoom. The preview is
centred on the pointer and respects the Workbench boundary. Initial whole-pixel
dimensions follow the source proportions within a manageable 360-pixel size.
The centred filling crop matches other Library additions; Fit inside remains
available when the full source is preferred. Creation saves the artwork and open window
position in one undoable draft operation and selects the Image tools. Drops on
existing modules retain their own behavior; Display receives a Grid placement
and Image appends a side unless Replace side is selected.
An Image created by this drop is included in the next explicit publication by
default. Empty Images created through Add remain private. Existing visibility
choices stay unchanged, and Include Image in publication remains available.
Nothing uploads or publishes on drop. It shares the owner/Visitor renderer; Visitor can flip, inspect and
move its temporary window, with no editing tools or authored resize.

Optional `imageModules` extends draft v4 and public document v9. Each side
retains the canonical resolved Library asset and source metadata, as illustrated
Text already does, separately from crop and transform. Authored dimensions
belong to the module. `workbench.imageModules` stores only window position and
open state, avoiding a second saved size. Large canvases fit proportionally in
the available viewport; viewport fitting never rewrites authored dimensions.
Missing optional fields retain the old behavior without migrations, storage-key
changes or resets. Older publication restore retains missing local Images as
private. Asset-reference and document-size limits include Image content.
The ordinary draft store owns edits, persistence errors and undo/redo; current
Display sessions cannot overwrite Image content. Crop/drag state is scoped to
its originating module and side and ends on target/content change, close,
Preview suspension or disposal. Image loads lazily when present.

## Workbench background shapes

The founder requested coloured squares and rectangles to connect or sit behind
modules, replacing the need to use empty Text modules as background blocks.
Workbench Add > Shape creates a 288-pixel square at the context-menu invocation
point. The existing Workbench window host owns movement, edge/grid snapping,
resize, camera projection and selection; Shape owns only its name, colour,
opacity, grain and order among shapes. Shapes stay below content windows even while
selected. Their array order is the single authored back-to-front order, with
Lower, Raise, To back and To front actions; this is not a global reordering of
Display, Text and Image. Shapes have no title strip over the artwork.

The existing contextual tool window offers colour, opacity, grain strength, exact dimensions,
Make square, duplication, deletion and publication inclusion. Its shape selector
and the Workbench Shapes menu keep fully covered or hidden shapes reachable.
Dimensions range from 8 to 7992 work pixels and up to 32 shapes are supported.
The owner drags directly on a shape and resizes with the existing handles.
As clarified on 2026-10-19, all four corners change width and height independently,
both immediately after creation and after selection or repeated resizing. A
single-Shape selection uses the same window geometry, snapping and constraints
as the Shape's own handles; a mixed or multi-module selection still scales
proportionally. Grid shapes retain their complete-cell sizing and cell size.
Visitor uses the same paint and camera projection without shape editing input.

Optional `shapes` extends draft v4 and public document v9. Name, colour, opacity
and order belong to the shape collection; `workbench.shapes` owns starting
window geometry and visibility. New shapes are included in the next explicit
publication by default; creation itself never publishes. Private shapes and
their layouts are excluded from public projection. Missing optional fields
mean no shapes, with no storage-key change or data reset. Restoring an older
publication retains local shapes as private, including their windows. The
existing draft store owns authored edits and undo; the existing local layout
cache retains temporary window movement and is invalidated by authored restore.
Existing empty Text modules remain unchanged.
Optional `shapes[].grain` stores strength from 0 to 1; omission retains the
previous flat fill without rewriting saved shapes. Shape reuses the Text/Display
grain texture, scale and strength control. Grain blends within the shape's fill,
follows its opacity and cannot intercept input. Duplication, undo, publication
and restore retain the authored strength; setting it to zero removes the texture.

On 2026-10-11 the founder retained Rectangle and Grid in Shapes and retired
Texture creation: rectangles already have a grain slider. Previously saved
Texture records remain readable, editable, duplicable and publishable.
Grid is a transparent patch with colour, opacity, spacing (8–512 work pixels),
line width (0.25–4 work pixels) and optional `grid.snap` (omission means enabled).
Each enabled patch supplies its own origin and spacing while the owner's Grid
snapping preference is on. Its SVG pattern has a one-device-pixel minimum stroke
so it remains visible down to 25% zoom; cell coordinates never change with zoom.
Creating or resizing a patch alone uses complete rows and columns, rounding the
requested extent up to the next cell. At a bounded resize edge it stops at the
last full cell that fits; the opposite edge stays anchored. Numeric dimensions
and cell-spacing edits use the same rule, and spacing plus size save together.
Existing partial-cell patches retain their old dimensions until an explicit
size/spacing edit. Their saved schemas and loading behavior remain compatible.
The pattern draws a closing outline on the right and bottom edges.
Scaling a mixed selection scales its
grid cell size with the composition, in the same completed undo operation.
Grid patches are visual material and optional alignment guides, not containers:
overlap does not assign group membership or constrain where content can exist.
Grid interiors pass pointer input to the artwork beneath, including their lines.
Their screen-sized perimeter selects the grid and reveals its bounds; very small
patches retain an interior hit area. Selected objects use the shared Workbench
movement/resize overlay above the paint without changing authored layer order.
In Select mode, owner Ctrl/Cmd-click cycles through registered Workbench modules
beneath the pointer. Right-click offers Select object here, ordered front to back,
with hover outlines and keyboard selection. This applies to shapes, Images,
Text, Displays and other registered content modules. Hidden/group-suppressed
members, instruments, immersive views and editing controls are excluded. Selecting
only changes temporary selection and the target module's tools, never publication
or geometry. Grid snapping remains active when pointer input passes through.
Decorative patches may opt out of snapping. Old rectangle and Texture records
are read unchanged; optional shape settings retain v4/v9 compatibility.


## Text authoring

The Text module is a simple Tiptap editor with formatting, local saving and a
reader. On 2026-09-16 the founder removed NFT tools and all file import/export
from its scope. No article upload endpoint or token transaction flow remains.
One module holds one illustrated article, or a scene-linked sequence of articles
as described below; up to 16 standalone Text modules are supported per Workbench.
Workbench Add > Text places the new module's top-left at the context-menu
invocation point, accounting for camera pan and zoom and the Workbench boundary.
Content and its initial window are saved together as one undoable operation.
Existing modules and callers without a position retain their previous placement.
Write and Read use the same full content viewport as Visitor: no duplicate window title,
formatting toolbar or saved-status footer reserves space. Window actions appear
on hover or keyboard focus in a compact strip outside the text surface, and
remain available on touch. Read/Write, move into Display, Text tools and close
occupy equal cells; the strip and resize targets retain their screen size at zoom.
Read permits direct dragging from the text surface after five screen pixels;
links and reader buttons retain their own input. Movement commits on release,
and Escape, blur or cancelled capture restores the starting position. Write
retains native text selection and the separate window grip.
The optional title is edited directly in the document; Enter continues in the
body. It remains the existing article title, not a duplicate rich-text heading.
Write always shows an inline optional title field with the placeholder “Title”,
above the body, without a separate Add title action. An empty title remains empty
in saved content and reserves no heading space in Read or Visitor. Linked-frame
measurement accounts for the editing placeholder only while writing. Title alignment (left,
centre, right) and colour are independent of paragraph formatting. The title
inherits the document colour unless explicitly overridden.
Write opens its tools, Read closes them, and the settings action can reopen them.
Focus writing temporarily presents the same article editor in a full-viewport
native modal with its title, confirmed local-save status and Return to composition.
The same editor DOM, selection and undo history move between the composition
and the focused viewport; there is no second article copy or saved layout change.
The mode is available directly in Text tools for standalone and Display
Text. Existing article typography is retained while content reflows to the wider
reading area. A transparent article gets a temporary backing chosen for contrast
with its existing body ink; authored appearance is unchanged.
Escape and Return restore the inspector trigger and reveal the current cursor
in the original viewport. Ctrl+F returns to the existing search controls.
The modal contains keyboard focus and its input cannot select or move underlying
Display layers. Disabling, suspending or disposing the editor ends the temporary
mode. Save failures remain visible and returning exposes the existing recovery
actions. Focus writing does not affect public presentation or publication.
The owner has one shared Text tools window for standalone Text and Text being
edited inside a Display. Selecting another Text retargets this window without
moving it or changing either article's Read/Write mode. Explicit closure remains
closed until reopened. A non-Text target, closed module or Preview hides the
Text controls; returning to Text restores the open tool at its previous screen
position. Its header identifies the current article. Editors, selection/undo
history and failed-save recovery remain scoped to their originating articles.
Within an unlocked Display, an open Text tool follows the selected Text layer.
Formatting, appearance, artwork captions and save recovery belong
to a separate movable Text tools window. Save failures expose a small output
indicator; Retry reads the latest saved draft and preserves unrelated edits.
Conflicting text requires an explicit replacement choice. Failed recovery never
resets the draft or reports an unconfirmed save as successful.
New Text starts with its dark background colour enabled and remains frameless. Background colour/opacity and the
frame are independent authored settings; older articles retain their appearance.
On 2026-10-12 the founder requested a simpler Text inspector after finding the
Text/Layout/Appearance tabs combined with Document/Selection/Title targets
confusing. The independent 326-pixel tool window now has one continuous panel:
current text formatting is immediately visible; spacing, writing tools, default
text style, title, text box layout, background/edges, Display connection and
article backup use named disclosures. Current formatting explicitly applies at
the cursor or to selected text. Default text style supplies inherited article
styles and preserves individual overrides; Title keeps its independent controls.
Writing tools contains Outline, Find and replace and Insert page break. Ctrl+F
opens that section and focuses search directly; closing it clears search marks.
Native disclosures retain all controls and the originating editor/history while
closed. They are temporary UI state, never article data.
The tool has no resize handles and uses the shared dark tactile material,
quiet formatting buttons and Lucide icons. Only the outer window surface scrolls;
outline, settings and save feedback do not introduce nested scrolling regions.
Confirmed save/recovery status remains at the bottom, with a sticky footer.
Height follows content within available space above the Workbench toolbars.
It opens beside the module without moving or resizing the authored article.
The target title remains visible in the movable header. Focus writing retains
its existing system window theme. Authored article colours remain independent.
Follow Display and Move into Display remain explicit separate actions within
Display connection. Read as pages belongs to Text box layout. Publication
inclusion stays below the settings. All editor, transfer, persistence and recovery
responsibilities remain module-owned; no schema, identifier or storage key changes.
Library artwork enters through direct drag
into the text; there is no separate artwork-selection dropdown.
The Library passes the release point to the receiving module. Text resolves it
against its live editor, including scroll and zoom, and inserts without replacing
an earlier selection. Insertion starts a separate editor undo step. Library owns
drop routing and stale-target checks; Text owns the article position and save.
Text tools offers optional per-side inner spacing in text pixels, including zero.
Custom spacing uses the full available text width; Automatic retains the existing
responsive padding and reading-width limit.
Automatic bottom spacing in standalone Text yields to the available height when
the article itself fits, avoiding scrolling solely for empty end space. Longer
articles retain scrolling and their normal end spacing; custom padding is respected.
Optional `appearance.padding` belongs to the article and travels through draft,
publication, restore and Display transfer.
Articles without it retain their existing layout without a migration or reset.
Dragging the Text move handle onto an unlocked Display attaches it to that Grid;
dragging its handle out detaches it as a private standalone Text. The tools also
offer keyboard-accessible move actions. Each move is atomic and undoable, retaining
rich formatting and appearance. A drop preview identifies the receiving Display.
Text is owned once, either by its independent module or by its Grid placement.
Writing uses labelled icon controls and retains its undo history across Read.
Link validation accepts the editor's optional null `title` attribute as equivalent
to omission. Non-null link titles remain unsupported. Existing links are not
rewritten; the normal HTTPS/mailto checks and publication validation still apply.
Paragraphs and headings support left, centre and right alignment, plus
justification with the last line left, centred, right or fully justified.
Optional block alignment is shared by Write, Read and Visitor; older articles
without it retain their existing appearance.
Write and Read share typography, white-space handling and font features so
authored spaces, line breaks and ligatures cannot silently reflow at the mode
switch. Selected text supports an explicit colour and a return to document
colour, alongside the existing font and formatting marks.
Text supports one continuous body arranged into one, two or three
columns with an authored gap of 0–128 text pixels (24 when omitted). The title
spans the body width. In two- and three-column compositions, the available frame
height below the title and inside the authored padding determines the column
breaks: fill down, then continue to the right. Resizing reflows complete lines;
extra columns are clipped at the frame edge and the owner sees “Text doesn’t fit”.
The full article remains saved and available through Focus writing, which keeps
its continuous editor. One-column articles retain contained scrolling; the
explicit page reader retains its pagination. Write, Read, Visitor and Display
share the bounded column layout. Existing multi-column articles acquire this
height-aware layout without rewriting their content, identifiers or settings.
This is flowing article content, not separately editable column modules.
On 2026-09-30 the founder accepted linked, freely positioned Text frames with
direct writing in every frame. The + action adds a continuation after that
frame; its own position, width and height determine how much of the article
fits. Text flows through the authored order and reflows when any frame changes.
The title appears in the first frame. Removing a continuation preserves the
entire article and flows it through the remaining frames. Closing the original
Text minimizes the whole chain. The owner sees frame numbers, connection lines
while selected, and an overflow notice on the final frame when content remains.
There is one article, selection and editing history across the chain; typing,
formatting and undo in a continuation act on that same document. Focus writing
remains an optional continuous view. The initial implementation permits eight
frames per article, sharing its typography, appearance and publication setting.
Follow Display, Read as pages and moving Text into Display are unavailable while
continuations are attached; remove them to use those existing workflows.
The optional `workbench.texts[].frames` array stores only continuation identifiers
and geometry, in reading order. The existing Text record remains the sole saved
content. Measured break positions and editor projections are temporary, rebuilt
when content, fonts, media or frame bounds change. Publication and restoration
retain frame order and geometry. Older layouts without this field retain their
existing single-frame behavior; no storage key or existing article is rewritten.
Optional `appearance.titleAlignment`, `titleColor`, `columns`, `columnGap` and
`textStyle.color` are validated by the existing article boundary and retained
through draft, Display transfer, publication and restore. Omitted fields keep
left title alignment, inherited colour and one column; older font-only marks
remain readable. No storage keys change and no saved content is rewritten.
The shared Workbench window owns geometry and lifecycle. Tiptap loads only for
authoring. Library images retain their resolved asset identity and source
information separately from authored captions and alternative text.
Source information remains stored with inserted artwork, but is not displayed
as an Artwork info section in Text. Authored captions remain optional.

Plain-text paste preserves authored line breaks, including CR, LF and CRLF,
and starts its own undo step. Empty or image-only clipboard data does not erase
the current text selection. Pasted HTML is not imported as article formatting.
Embedded artwork uses the editor's native drag handle to reorder within the
article. Selected artwork also offers Move artwork up/down for keyboard and touch
use. These actions swap adjacent blocks within their existing parent, preserve
the artwork source, caption and alternative text, and retain node selection.
Parent constraints, including a list item's first paragraph, are respected.
Each move is undoable through the existing editor history and saves through the
originating module. No article schema or storage keys change.

Optional `texts` extends the existing profile draft and v9 public document;
`workbench.texts` carries starting windows. Typing saves through the existing
profile draft store. Public articles use the normal Workbench publication flow.
Draft Text validation accepts only the current fields. The obsolete NFT `target`
binding is unsupported: drafts containing that field fail validation, while their
stored bytes remain intact for explicit recovery. New Text records and public
projections contain no NFT binding. No storage-key change, automatic migration
or silent content removal is introduced.
Restoring an older publication retains missing local articles as private.

Article typography may use Sora, IBM Plex Sans Condensed, Literata, Cormorant
Garamond and IBM Plex Mono under their bundled OFL licenses. The three additional
families are authored article choices, not alternative interface fonts. Existing
Sora/Plex interface typography remains authoritative.

Text tools exposes a separate Title size when an optional title is present.
Optional `appearance.titleFontSize` accepts 8–300 pixels and travels with the
article through saving, Display transfer and publication. Omission retains the
existing 28-pixel title; body Text size remains independent.

Selected text also supports its own size (8–300 text pixels) and tracking
(letter spacing from -0.1 to 1 em). These are optional numeric `textStyle.fontSize`
and `textStyle.letterSpacing` marks on selected words, paragraphs or body
headings, separate from document-wide size. Mixed selections show Mixed;
clearing either override restores inherited styling without removing other
marks. Valid numeric edits apply immediately while the field retains focus.
Incomplete or out-of-range input stays local; finishing restores the last valid
value. Clearing a field resets its override on Enter or blur. Escape restores
the formatting from before editing that field, including mixed selections.
The existing plain-text article title has independent tracking through optional
`appearance.titleLetterSpacing`, alongside its existing title-size control.
A small index, classification or sub-label such as ARCHIVE // 01 is an ordinary
body line styled with these same controls, without a separate metadata field.
Write, Read, Visitor and Display Text share these authored values. Saving,
undo/redo, Display transfer, publication and restore retain them. Existing
articles without these optional values keep their appearance and storage keys;
reading them does not rewrite their content. Tracking is relative to the styled
text's font size and follows the existing content and Workbench scaling.

Text tools also offers Title gap and individual paragraph/heading space before
and after, from 0 to 512 text pixels. A cursor targets its containing block;
a text selection targets the covered blocks. Optional numeric `spaceBefore`
and `spaceAfter` block attributes retain spacing alongside alignment, and
optional `appearance.titleGap` controls space below the separate article title.
Explicit adjacent before/after spacing adds without margin collapse. Clearing a
value restores the existing defaults, including compact Text and the 20-pixel
title gap. Blank paragraphs remain authored content and are never removed by
spacing edits. Line spacing and font sizes remain independent.
Mixed values, immediate valid edits, Escape cancellation and reset use the existing
numeric controls. Write, Read, Visitor and Display share the spacing projection;
draft saving, undo, transfer, publication and restore preserve it. Missing values
keep old layouts without rewriting saved articles or changing storage keys.

When an authored line break or saved newline joins several lines in one
paragraph, Text tools identifies that shared paragraph and offers Separate this
line. The action isolates the cursor's line as its own paragraph or heading,
retaining inline formatting, block alignment, surrounding text and outer
spacing. New internal boundaries start at zero spacing. It is one undoable
editor operation and does not change saved schemas. It is unavailable for a
selection spanning lines or for wrapping caused only by available width;
spacing controls continue to target real paragraphs, without automatic splits.

On 2026-09-29 the founder requested line spacing and verification with longer
illustrated articles. Optional `appearance.lineHeight` sets body line spacing
as a unitless font-size multiplier from 1 to 3. Optional paragraph/heading
`lineHeight` attributes override it for the cursor's block or selected blocks.
The separate title and default heading leading remain unchanged by the body
setting. Selection can explicitly change heading leading. Document reset removes
the optional appearance field; block reset returns to inherited/default leading.
Missing values preserve the existing 1.65 body, 1.2 compact body and 1.3 heading
defaults. No storage key changes or old-data rewrite are required. New readers
must support these optional fields to open newly authored documents. The existing
article validator, draft store, transfer and publication boundaries retain them;
Write, Read, Visitor and Display use the same projection. Numeric fields retain
mixed-state indication, immediate valid edits, Escape cancellation and undo behavior.
Text windows remain fixed-size, resizable viewports with contained scrolling;
this change does not introduce automatic window growth or linked text frames.

The article editor also supports reusable heading and artwork-caption defaults
under Default text style → Heading & caption styles. Optional
`appearance.textStyles` contains only `h1`, `h2`, `h3` and `caption` roles. Each
role may specify a bundled `fontFamily`, `fontSize` (8–300), six-digit hex `color`,
`lineHeight` (1–3), or `letterSpacing` (-0.1–1 em). Body defaults remain owned
by the existing document typography controls; the separate title keeps its own
controls. Role changes apply to all matching content without rewriting nodes.
Explicit text marks and block spacing override role defaults. Removing an
override restores existing stylesheet defaults. Old articles require no migration;
readers need these optional fields to open newly styled articles. Write, Read,
Visitor and Display share their projection; save, undo, transfer, publication and
restore retain them.

Selection includes a collapsible Outline derived from the live editor document.
Its heading buttons move the cursor and scroll within the article. Labels,
positions and the active heading are temporary views, never saved copies.

Selection also offers Find and replace for the article body. Ctrl+F (Cmd+F on
Mac) while the body editor is focused opens its inspector and search field;
other page fields retain browser Find. Search is literal and ignores case,
spans inline formatting but never crosses paragraph, hard-break or artwork
boundaries. The title and artwork captions are excluded and labelled as such
through the body-only scope. Matching uses document positions without changing
authored text. The first match scrolls into view; Next/Previous and Enter/
Shift+Enter navigate with wrapping. Escape closes search and restores focus
to its trigger. Closing or retargeting the inspector, Read and Preview discard
the originating editor's temporary search state and highlights.

Replace match and Replace all use the existing editor save/recovery path. Each
action is independently undoable. Replacement inherits the first matched
character's marks; text and formatting outside matches, links outside the
replacement, and artwork references remain untouched. Empty replacement deletes
only the matched text. A candidate article must pass the existing validator
before any replacement is applied. Bulk replacement is limited to 1,000 matches
per action with an explicit refine-search message above that limit; it never
silently replaces a subset. Highlight rendering is limited to 500 near the active
match while the full count and navigation remain available. Search does not
change article schemas, draft storage keys, publication or module authority.

Document also offers a portable article JSON backup, including the current
working edits when browser saving fails. Opening a backup validates it before
an explicit Replace article action; cancellation changes nothing. Replacement
uses the existing module save/conflict/recovery boundary and preserves the
module's connection, visibility and geometry. A changed article invalidates the
pending replacement; file reads belong to their originating profile, module
and passage. Replacement is disabled while local edits need recovery. Files
contain the article and artwork references, not image bytes, profile credentials,
module IDs or Display connections. Download does not claim a confirmed save to
disk. This is manual portability, not cross-device synchronization or a change
to localStorage/IPFS publication. Failed-save memory recovery and its leave guard
remain in place; the file provides an explicit recovery copy across reloads.

## Scene-linked Text and reading pages

**Experimental Display reference.** These links describe retained behavior
when an experimental Display is present. They do not restore ordinary Display
creation or make linking a prerequisite for standalone Text.

A standalone Text may explicitly follow one Display through Text tools. New links
use one full article: explicit page breaks divide it into sections, in Display
Grid order (excluding the cover). Section one follows Grid one, regardless of the
Grid or reading page selected when linking. Write edits the full article; Read
and Visitor show the current section with contained scrolling for overflow.
Resizing never changes section boundaries. Grid changes reset section scrolling;
Text scrolling does not advance the Grid. Unmapped sections remain authored but
are not published. New links store `sceneLink: { mode: 'sections', displayId }`
without automatic reading-page pagination. Publication excludes private Grid
sections; restore merges retained local sections using the respective Grid orders.

Existing passage links retain their previous behavior: their
original article is the passage for the Grid selected when linked; additional
Grids own separate passages within that Text record. Missing passages start empty
with the original article's typography. Repeated scenery uses distinct Grids for
distinct story moments. Display owns navigation and reports its current Grid and
temporary swipe progress through a Workbench-scoped connection. Text follows that
report without choosing or advancing the Display's Grid. A closed or missing
Display shows an unavailable prompt and preserves its passages.
Text tools always offers explicit Unlink Text from Display, including after that
Display was removed. Section links retain the entire unchanged article as
standalone Text. Legacy extra passages become separate private Text modules,
preserving each complete article and appearance. This is one undoable saved
operation; insufficient module capacity or failed persistence leaves the link
and every passage intact. Missing Display guidance identifies removal instead
of asking the owner to reopen a nonexistent Display. No schema migration occurs.

Existing passage links enable Read as pages. Automatic overflow pagination and optional authored
page breaks divide one rich article into reading pages. Small previous/next
controls and a page count turn only the text; the last page stops. Returning to a
Grid starts its passage at page one. Page position is temporary and never saved.
Read and Visitor share the reader and reduced-motion behavior. Write retains one
continuous editor. Scene-linked Text remains on the Workbench rather than being
transferred into a single Grid and losing its other passages.

Optional Text `sceneLink` and `pagination` fields extend draft v4 and public v9;
`pageBreak` is an optional rich-text leaf. Existing records retain scrolling and
their previous interpretation without rewriting. Publication omits passages for
private or missing Grids and Text linked to an excluded Display. Restore retains
missing local passages for the same linked Display. Save, recovery, and undo use
the existing profile draft store. Window geometry remains independent of passages.

## Removed artwork animation

On 2026-09-20 the founder removed the Animation module, Float/Flicker and the
layered-character assembly/playback experiment to focus on core Display navigation
and authoring. This removes the Animation window, effect authoring and playback
controls, layered source preparation, Pixi renderer and assembled-frame cache.
Display, Visitor and inspection render ordinary selected artwork media. Layered
characters are not assembled into a replacement static representation.
Click-to-move is not part of current scope.

The founder confirmed that no saved drafts or animation data require compatibility.
Placement/group animation and layeredArtwork fields, authoring actions and tool
window state are removed rather than retained as dormant compatibility code.
Existing ordinary static compositions retain their schema and behavior; there is
no storage-key change, migration or draft reset.

Grid dragging, momentum, wraparound, Play Grids and inspection transitions remain
Display behavior. Removing artwork animation is not proof that Grid transition
stutter is fixed. Validate navigation with representative static compositions.

## Keeper dock

The founder requested a focused Keeper on 2026-09-29: Add → Keeper dock,
then drag one Library image onto it. Clicking releases the inhabitant onto
the Workbench; clicking again recalls it. The dock remains present and movable.
Replacing its image replaces its single inhabitant. Ordinary characters retain
the original whole-image Flip movement. On 2026-09-30 the founder also requested
Layered swim for a prepared Keeper with one body and independently floating
tentacles. These are per-character choices, not a replacement for other
characters' flip behavior or a restoration of the removed Animation module.

The Keeper wanders with pauses in a zone beside the pointer and leaves space
around it. Pointer tracking is continuous, including over controls and during
drags. Crossing the Keeper's vertical centre immediately starts a flip towards
the pointer, independently of flight direction or a rest. The short flipcard
turn uses the vertical axis; reduced motion switches facing immediately.
Flight follows with damped acceleration and braking. A resting Keeper still
responds to pointer movement; its wandering destination moves with its zone.
The owner can identify whether the source artwork faces left or right. Roaming
does not intercept Workbench clicks. Reduced motion disables this locomotion.
Return/release remains available by keyboard. On 2026-09-30 the founder also
requested interactive text carried by the character's token. Releasing then
clicking the head (or activating it by keyboard) opens a conversation. Automatic
travel pauses while idle tentacle motion continues. The founder's 2026-10-01
refinement keeps explicit click/right-button swim steering available during chat;
arrow keys on the focused head nudge it. Manual steering cancels a reaction and
invalidates pending AI movement, then settles at the chosen destination.
Closing resumes ordinary movement. The upright bubble fits the viewport and offers authored replies,
Close and Escape with focus returned to the head. Owner and Visitor share the
same player. LSP1 reactions, minting, contract changes and script execution are
not introduced here.

On 2026-09-30 the founder requested connecting their own ChatGPT account to
talk freely with Keeper. The first implementation is an optional AI chat mode
in the existing conversation panel, available only in the local development
app. Continue with ChatGPT opens OpenAI's sign-in and consent page. The local
server owns OAuth, verifies identity, lists the account's eligible models and
streams text replies. It uses the documented subscription-sharing route;
there is no browser API key, paid API fallback or public hosted integration.
The authored dialogue remains separately usable. A few bounded dialogue
excerpts may provide character voice when a message is sent to OpenAI.

Account access and the last twelve completed exchanges belong to a temporary
server session scoped to browser, profile, dock and asset. They never enter
the artwork, draft, undo history, publication or blockchain. Tokens remain in
server memory; only a public installation identifier is persisted. Server
restart clears connections and chat. Disconnect clears local access and asks
OpenAI to revoke the token. Closing the panel stops an active reply; partial
or failed replies are not added to history. Hosted access and persistence require
a separate accepted design.

On 2026-10-01 the founder requested conversational gestures and nearby artwork
awareness. Each reply may request one bounded reaction: curious head tilt,
startled spread, approach or retreat. Only Keeper moves, by at most 160 screen
pixels, through its existing motion loop. Following the founder's 2026-10-01
visual examples, the conversation uses a rounded, subtly grained speech bubble
with a tail, at most 320 by 330 screen pixels. It follows actual travel but not
idle bob or head rotation. Long replies scroll; the default view shows the latest
reply, with History available. Account, model and sharing controls occupy a
separate settings view within that same bound. The user can disable gestures;
reduced motion suppresses them.
The founder's 2026-10-01 reply-style refinement calls for concise, clean speech:
normally one to three short sentences, with real paragraph breaks and restrained
character humour. Metadata plus visual review defaults to two short paragraphs.
Internal scene labels, addresses and protocol details stay out of ordinary
conversation unless requested or needed for clarity. Explicit requests for a
full breakdown may expand the answer. This is response guidance, not truncation
of streamed text or a rewrite of the character's authored dialogue file.
Closing, changing mode, focus loss, recall, asset changes and disposal cancel
the reaction. Invalid, incomplete or stale model actions never execute.

Optional Share artwork details sends up to eight rendered Image/Display
artwork titles, relative locations and known token identities when the user sends
a message. It defaults off. Following the founder's 2026-10-01 metadata request,
Keeper may request one public LSP8 metadata lookup for at most two supplied
LUKSO artwork identities per reply. The browser rechecks each visible target
and uses the existing strict Library token metadata reader; the AI gateway does
not fetch model-supplied URLs. Results expose bounded name, description, traits,
token identity, read time and source. Unsupported identities, changed targets,
failed reads and missing metadata remain distinct; they do not imply absent
metadata or establish creator attribution, holding, issuance or control.
The shared resolver's short-lived contract context cache remains in use; token
metadata is read on request. Only the completed spoken answer enters temporary
chat history, not raw tool output. Closing or replacing the conversation aborts
the read and discards late results. The founder also requested visual recognition
on 2026-10-01: Share artwork
previews opts into sending at most two source-artwork stills, selected first then nearest, rasterized
to PNG with a longest side of 512 pixels. SVG uses the browser's non-scriptable
image decoder. These are source previews, not screenshots of the workspace,
current crops or live animation. Source access failures are visible; no preview
is substituted silently. Previews require a model accepting image input and use
the connected plan allowance. Bytes are sent for the current request only and
are not retained in chat history, status, drafts or publication. There is no
automatic capture, desktop inspection, document text or Library inventory access.
Modules explicitly expose title/identity/source/token cues; Keeper reads only its own
Workbench and rechecks targets before acting. Names and image text are untrusted
content, not instructions; the same applies to metadata fields. The AI
has no object-editing, browser, wallet, durable-memory or autonomous polling tools.

On 2026-10-06 the founder continued with Keeper selection awareness. With Share
artwork details enabled, each Send reads the existing Workbench module selection
or, when none is selected, the Display artwork selection. The bounded scene
identifies selection scope/count and prioritizes selected visible artwork for
its eight references and two optional previews. Selecting a Display module does
not mean one particular artwork inside it; ambiguous, hidden or unsupported
selections require clarification. Opening, using and closing Keeper conversation
preserves Workbench selection. Selection remains temporary and is not copied
into chat history, saved drafts or publication. Sharing defaults remain off.

An open conversation survives switching to the sign-in tab: its artwork pauses
while the page is inactive and resumes on return. Ordinary roaming still docks
on focus loss. Pending pointer gestures always clear when the page loses focus.

Keeper dialogue is read on interaction from text/JSON attachments in the
inhabitant's LSP8 token metadata, using the shared token metadata resolver.
It is not a second stored draft field: existing canonical token identities work
without re-adding the artwork. Each opened conversation reads current metadata;
publication retains the token reference, not a frozen copy of its dialogue.
Declared metadata/file verification hashes are checked against fetched bytes.
The UTF-8 `.txt` file contains JSON with `format: "inscape.keeper-dialogue"`,
`version: 1`, `language`, `start`, and `nodes`. Each node has plain `text` and
`choices`; each choice has `label` and a valid `next` node. Empty choices finish
a branch. No HTML, executable commands or external reply actions are accepted.
Reads are bounded to eight text candidates, 256 KiB per file and 25 seconds for
the conversation request; documents allow at most 512 nodes and six replies per
node. Loading, no attached dialogue, invalid/unavailable files and Retry remain
visible. Closing, recall, asset replacement, suspension and disposal cancel or
ignore obsolete work. Conversation progress is temporary and never writes the
draft or publication.

Layered swim accepts the founder's prepared SVG layout: a `keeper` group with
one `body` and numbered `tentacle-N` groups, each containing a positioned,
cropped, embedded PNG or WebP image. The importer reads only bounded raster
resources and numeric geometry; imported SVG markup and scripts never enter the
application DOM. Unsupported geometry and failed loads remain explicit errors
with Retry. This is a focused Keeper format, not a general SVG rigging editor.
Each tentacle traces an independent, subtle figure-eight. The head leads turns
continuously through 360 degrees; tentacles follow with different delays.
Actual travel speed determines gathering and opening on braking. The founder's
2026-09-30 tuning refinement requests faster travel and gather/spread response,
plus head-first turns with tentacles regrouping one by one around the body.
The sequence follows turn direction: for the right-facing source, clockwise
turns begin at the top of the tentacle fan; counterclockwise turns begin at the
bottom. Geometric order, rather than SVG group order, determines the sequence;
left-facing sources mirror it. Each direction's delayed angular travel remains
continuous when retargeting mid-turn, including across the angle wrap boundary.
Keeper tools expose swim speed (80–900 px/s, default 420), gather time (0.1–3 s,
default 0.4), spread time (0.1–3 s, default 0.55), head turn time (0.1–2 s, default
0.4), and tentacle stagger (0–0.2 s apart, default 0.06). Response times describe
roughly 90% approach to a settled target; travel speed and retargeting continue
to affect the pose. Enter or leaving a field saves one undoable change and
applies it to active swimming without resetting the creature. Reset swim tuning
restores these defaults. Existing artwork is reused through position and rotation;
mesh deformation and separately animated eyes/patterns are not part of this step.
Completed clicks on empty Workbench space choose temporary swim destinations;
controls, editing, modified clicks and left-button drags do not. Holding the
right mouse button from empty Workbench space continuously retargets a released
swimming Keeper to the cursor, including while crossing module windows. Release
ends tracking and retains the last indicated destination. Only that gesture's
context menu is suppressed; controls, modified right-clicks, docked/returning
Keepers, chat controls and reduced motion keep ordinary context behaviour.
Escape or pointer cancellation stops tracking; disposal, recall, mode changes,
suspension and focus loss cannot leave a hold active. The hold is temporary,
uses the existing swim speed, head turn and tentacle motion, and is shared by
owner and Visitor. Flip retains its original
pointer-following behavior. Both modes share flight, recall, bounds and cleanup.
Reduced motion holds the layered artwork still and retains dock controls.

On 2026-10-02 the founder requested a segmented snake using these same controls.
A prepared `keeper` group marked `data-keeper-rig="snake"` contains `body`, `eye`
and consecutive `segment-N` embedded raster groups (at least two segments, at
most 50 total parts, with the existing decoded-pixel and dimension limits).
Layered swim detects this artwork kind without adding a saved movement mode or
rewriting old docks. The head follows existing click/right-hold destinations;
the chain follows its recent path with an S ripple. Speed opens segment spacing;
braking gathers it again. Gather/spread and head-turn controls retain their
existing saved meanings; tentacle stagger and left/right source facing are
irrelevant to a snake and remain preserved but hidden. Segment geometry supplies
its source heading. The separate eye translates with the head while keeping its
orientation; the surrounding head rotates about the eye. Flight, conversation,
recall, reduced motion and disposal retain the existing shared lifecycle.
Only bounded temporary path history and part poses are introduced. Raster
conversion preserves the original vector files and embeds cropped WebPs into
new SVG copies; no executable behavior is imported from artwork.

On 2026-10-04 the founder requested a hybrid octopus from a Library LSP8
artwork. A prepared `keeper` group marked `data-keeper-rig="octopus"` supplies
one cropped embedded WebP/PNG `body`, one to eight consecutive `tentacle-N`
vector outlines with gradient stops and root/tip coordinates, and one to four
consecutive `eye-N` groups with separate apertures, gaze shapes and lids. This
uses the separate SVG float movement choice (`movement: "svg"`), as refined
by the founder after reviewing the initial Layered swim treatment. It has no
hard-coded token ID, artwork URL or bundled production character. The importer reads bounded numeric path commands and
hex colors into application-owned shapes; imported markup, scripts, external
resources, styles and arbitrary transforms never enter the application DOM.
The founder's four directional references refine SVG float: never mirror the
artwork, keep the head level through upward travel, bank for sideways travel,
and tilt farther for downward travel. Tentacles trail opposite actual motion,
including above the head during a descent; braking returns to the authored
hanging pose. Eyes look toward the destination during travel and resume pointer
attention at rest. Source left/right facing is irrelevant to this mode and is
preserved but hidden. Travel, gather/spread and stagger use the existing controls. Flip and Layered
swim keep their existing behavior, including full rotation in Layered swim.
Selecting SVG float is explicit and undoable; old docks are never auto-switched.
It shares destination/recall and lifecycle ownership with the existing dock,
but uses a separate artwork orientation model. Eyes look toward pointer attention
and blink; a fixed pool of at most eight detached goo drops falls in screen space
and fades. Animation uses the existing dock clock and temporary pose only.
Conversation keeps gentle idle motion, recall clears droplets, inactive talking
freezes the artwork, and reduced motion holds the authored pose. Owner/Visitor,
Library selection, publication, viewport sizing and existing raster/snake rigs
keep their shared boundaries. Raster conversion writes a separate 2048-square
upload SVG and preserves the source illustration.

The first implementation permits four docks per profile. Optional `keeperDocks`
records in draft v4 and public document v9 retain the name, canonical Library
image, source facing and owner publication choice; optional `movement` selects
`flip`, `swim` or `svg`, with omission preserving Flip without rewriting old records.
An optional complete `swim` record retains `speed`, `gatherSeconds`,
`spreadSeconds`, `turnSeconds` and `staggerSeconds`. Omission reads the new swim
defaults without rewriting old data. Flip ignores these settings but preserves
them when switching modes. The choices use the existing undo, draft, publication and restore boundaries;
parsed artwork and animation state are temporary. `workbench.keeperDocks` retains
dock positions. Optional `size` is the square artwork envelope in screen pixels,
from 64 to 384, editable in Keeper tools and retained through undo, publication
and restoration. New docks start at 192; older records without size retain 128
without a rewrite. Narrow viewports fit only the temporary rendered creature
and leave the authored size intact. Missing fields mean no Keepers, with no reset or storage-key
change. New docks start private. Only explicitly included docks enter Preview
and publication; their visitors use the same release/return component.
Old-publication restoration preserves local docks privately. Roaming state is
temporary and starts docked on reload; motion stops on disposal, preview
suspension, page hiding or loss of window focus. Ordinary artwork media is used
as an image; any intrinsic image animation remains the source's own behavior.

## Persistent artwork groups

**Experimental Display reference.** These are placement groups inside a Display
Grid, distinct from the ordinary [Workbench groups](#named-workbench-groups).
The Display access restriction still applies.

Display supports persistent, non-nested artwork groups within one Grid. Layers
offers Group layers for two or more ungrouped artwork placements and Ungroup for
one complete group. Text is outside this first version. Grouping preserves exact
placement geometry, crop, transforms, source identity and stacking order, including
unrelated artwork between group members. Selecting a member selects its whole
group; movement, resizing, transforms, duplication and removal reuse the existing
multi-placement operations. Lock and temporary editor visibility act on all members.
Individual geometry edits and composition spacing require ungrouping first.

Optional Grid `groups` records own IDs and `placementIds`. Membership is stored
once, not copied into placements. Ungroup retains the authored arrangement;
undo restores the group. The Display owns membership, independently of the host
and Library.

Draft-v4 and public-v9 accept the optional Grid field, including World Cover and
additional Displays. Old documents without groups retain their interpretation and
are not rewritten on read. Save, recovery, undo, duplication, publication and
restoration retain groups. Duplication creates independent group and member IDs.
Dangling, overlapping, nested, private-member and partially locked groups are invalid.

## Removed Mirror module

The founder removed the Mirror animation module on 2026-09-17. Its runtime,
creation controls, demo and `animations` draft/publication field are removed.
The founder confirmed that no saved compositions require Mirror compatibility.
Display image-flipping controls are independent and remain available.

## Removed Mobile presentation and module

On 2026-10-12 the founder removed the separate mobile experience, Mobile
Workbench module, custom mobile renderers and standalone mobile prototypes.
Creation, editing, asset resolution and new publication no longer include Mobile.
Visitors use the ordinary profile overview and Workbench routes at every viewport
size; there is no device-based mobile entrance or desktop opt-in gate. Existing
narrow-screen layouts and touch support in retained modules remain in scope.

The founder explicitly confirmed that Inscape is still in design, that there are
no saved compositions to preserve and that Mobile compatibility is not wanted.
The optional mobile field is removed from draft v4 and public document v9; strict
validation rejects it as unsupported. There is no legacy reader, migration,
restoration or publication path for Mobile. No wallet action, publication pointer,
storage-key or document-version change is part of removal.

## Authoring undo

Completed profile-draft edits share one chronological undo/redo history across
Display instances, Identity and the other retained modules. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z
or Ctrl+Y redoes. Text-entry controls retain native text undo. Pointer gestures
group continuous updates into one step. New edits discard redo, and failures to
save leave both history and the draft unchanged. History is bounded, temporary
and isolated by profile; reloading a draft clears its history. Existing saved
drafts gain no history fields or storage-key changes.

Undo restores authored draft data, not wallet transactions or old publications.
Preview navigation, playback, helper visibility, local window presentation and
publication's host-layout capture do not become artwork undo steps. Independent
Workbench preferences remain local preferences rather than authored content.

## Authority

This file records current accepted direction. Historical plans, phases,
handoffs, roadmaps, art-direction notes, archived prototypes, and deleted
documentation are not product authority. Consult Git history only when the user
explicitly requests recovery or historical evidence.

Read `docs/INSCAPE_CREATIVE_INTENT.md` after this contract before substantial
product, architecture, UI, composition, asset-model, metadata, or module work.
It is required context for why the product exists and for avoiding the false
interpretation of INSCAPE as an elaborate profile viewer or NFT-card gallery.
It does not independently expand active implementation scope; this contract
remains the sole authority for accepted direction.

The existing application remains the working baseline until a replacement is
implemented and accepted. Direction below is not permission to perform a broad
rewrite, schema migration, publication, upload, deployment, or wallet action.

## Product hierarchy

The presentation and navigation scope above distinguishes the existing
destinations from a separate deferred Desktop. Older uses of "Workbench" as the
containing desktop below describe the existing host; they do not merge the future Desktop with a
composition or require every destination to be a module on its canvas.

INSCAPE is an artist's online desktop: one environment for composing,
experiencing, and publishing artwork through independent creative modules.
It begins with the founder's own artistic practice and also accommodates other
makers. Human Underneath is the founder's artistic world, not a required theme
or content model for everyone using INSCAPE.

The hierarchy is:

1. **INSCAPE Workbench** — the containing desktop and experimental workspace.
2. **Module instance** — an independently configured creative application on
   that desktop. Multiple instances of the same type are accepted direction.
3. **Module-owned content** — for example Image sides and Text articles;
   experimental Display composes assets across Grids.
4. **Stage and Grids** — the experimental Display Module's clipped output and
   scenes, not a required container for ordinary Workbench composition.
5. **Assets and authored primitives** — material interpreted by a module.

Each profile can have multiple named composition Workbenches, with one active
editing context. Shared Library material does not share mutable module content.
The [collection rules](#multiple-named-workbenches-direction-2026-10-20) and
[public gallery](#published-canvas-gallery-2026-10-26) define saving, switching
and explicit publication selection.

The public Workbench is part of the created experience. Visitors can enter its
desktop and open the creator's published modules. The creator's Library
organization, Layers and authoring tools, Activity, and publication controls
are not part of that visitor experience. Module chrome is not Stage content.

## Workbench host and module responsibilities

- Keep the host independent of each module's creative behavior. It manages
  module instances, shortcuts, window lifecycle and geometry, shared asset
  access, persistence, publication, and owner/visitor state boundaries.
- A module owns its content model, parameters, supported inputs, rendering,
  behavior, and exposed visitor controls. The host must not need to understand
  eyes, animation effects, audio analysis, or every module-specific setting.
- The host coordinates saving and restoring settings; each module defines and
  validates what those settings mean. This direction does not specify a new
  serialization format or replace the current validation boundaries.
- Right click → Add creates a module instance. Its shortcut opens the existing
  instance. Closing a window is distinct from deleting its authored instance.
- The owner's Workbench context menu offers Add and a top-level Show/Hide dock
  command. Dock visibility is a profile-scoped local preference, never published;
  older preferences show the dock. Hidden docks release their reserved space.
  The following Display Format details describe retained experimental instances,
  not ordinary creation. Format belongs to that Display's canvas, title-bar and shortcut menus.
  The open Display's menu also offers Close module (minimize to its shortcut)
  and Delete module through the existing undoable deletion action.
  Display creation is experimental and absent from Add. Its retained presets
  are Horizontal (16:9), Vertical (9:16) and Custom size.
  The Display's Format menu offers those same presets and Custom size for later
  canvas edits, including from its shortcut. Custom size opens a bounded form
  with independent width and height; creation waits until Create is submitted.
  New Displays start with clean shortcut artwork and names, using a 960×540
  horizontal or 405×720 vertical window constrained to the available Workbench.
  Recreating a deleted primary Display starts a fresh presentation; existing
  saved presentations retain their dimensions. Shortcut fallbacks are scoped
  to the Display instance. Add and Format share the same orientation defaults.
  Format changes preserve the window's size relative to those defaults, so an
  unresized horizontal Display becomes the same size as Add → Vertical.
  Changes involving custom dimensions retain the current viewing scale per
  canvas unit where viewport bounds allow. New custom windows start at up to
  30 work pixels per canvas unit, bounded by 960×720 before viewport fitting.
  Viewport bounds still apply; existing saved windows are not rewritten on read.
  Metadata is a shared Workbench tool and is not an authored Add-menu module.
  The owner creation toolbar sits at bottom center above the existing dock;
  the dock and its Tools launcher remain available. It offers Select (V), Hand
  (H), Text (T), rectangular Shapes (R), Artwork Library, contextual Layers and
  Artwork info, searchable Actions (Ctrl/Cmd+K), and Add. Actions and Add reuse
  the existing module commands and limits. Select, Hand and creation modes are
  temporary Workbench interaction state, never saved document data. Hand pans
  over module artwork through the existing camera; Space-drag remains available.
  Text clicks target the actual unlocked Display under the pointer or create a
  standalone Text on empty Workbench space. Rectangle clicks retain the existing
  default size; drawing sets its initial size in Workbench coordinates. Escape,
  lost input, preview or a changed target cancel pending placement. The toolbar
  does not add ellipses or lines. Inspector buttons require available content;
  camera controls remain separate above the toolbar and responsive wrapping
  reserves enough space for both.
  Library stays anchored to the Workbench's left edge above ordinary module
  windows and shortcuts. Its existing drag-to-hide behavior exposes drop targets.
  Opening or resizing it never reserves space or shifts modules or shortcuts,
  including on narrow screens. Dock visibility does not close Library or change
  the open panel. Workbench and Display context menus open the same shared
  Library without changing the active module or Grid.
  The dock's Grids menu can open over Library without closing, suspending or
  resetting it. Choosing a Grid keeps both panels open, with Library's search,
  collection and scroll state intact. While both are open, Library and canvas
  interactions do not dismiss Grids or disable the Display's existing drop
  targets. Repeated Grid selection and asset drops need no composition-lock
  toggling or panel reopening.
  Each dock button reflects and toggles its own panel. Escape dismisses Grids
  first; closing Library can leave Grids open. Other dock panels and Preview
  retain their existing exclusive entry behavior. This is temporary panel state,
  with no saved-draft, publication or composition-lock change.
  Dock visibility changes preserve normal Display window pixel dimensions and
  position wherever the available bounds allow. Maximized windows continue to
  fit the available Workbench. Opening Library does not reserve desktop space.
- Multiple Display Modules can organize chapters such as Lunar Desert, a photo
  series, or other presentations, each with its own content and Grids.
- Modules must be able to cooperate through explicit inputs and outputs, for
  example music influencing an animation. Universal interoperability between
  every module is not required. Introduce concrete connections as workflows
  require them rather than building a speculative general system first.
- Initially modules are developed by the founder and the INSCAPE maintainers.
  External contributions are a possible future direction, not a commitment to
  an arbitrary-code plugin marketplace or a public developer SDK now.
- Future module types need not share the Display Module's canvas model, aspect
  ratio, or renderer. Runtime technology and isolation are implementation
  decisions to evaluate against a concrete module, not product assumptions.

## Named Workbench groups

The following describes the existing navigation/stack implementation. The
[multiple Workbenches direction](#multiple-named-workbenches-direction-2026-10-20)
removes it as a required organizer in the new UI; it does not delete current data.
The
[20 October Layers decision](#layers-composition-groups-decision-2026-10-20)
chooses composition blocks for the future Layers workflow; it does not claim
that these existing groups already enforce contiguous artwork order.

On 2026-10-05 the founder approved the next spatial-navigation step: saved,
named groups of Workbench modules. The owner Groups tool creates a group from
selection or an empty group, renames it, adds/removes members, changes member
order and ungroups without deleting or rearranging content. Selecting a saved
group selects its open windows; Focus and Back remain separate navigation actions.
A selected group can move through the existing selection gesture as one undoable
position edit. Drops onto group names preview the target and commit membership
without moving the camera or the modules. Escape cancels the drop.

Optional draft-v4 `workbenchGroups` records contain `id`, `name` and ordered
`memberIds`, plus optional stack `position` and opt-in `visibility`. Missing
visibility means private, including groups created before publication support.
Membership is owned once at the Workbench level, independent of
Display Grid placement groups and the local window-layout cache. Up to 32 groups
and 128 members per group are accepted; names contain 1–48 characters. A module
belongs to at most one group. Empty groups are valid; nested groups, duplicate
membership and unknown references are invalid. Display, Image, Text, Shape and
Keeper windows participate. Linked Text frames belong to their parent Text
module and are selected together. Closing a window retains membership; deleting
a module removes its reference in that same undoable operation.

Old drafts without groups retain their interpretation and are not rewritten on
read. Group operations use the existing profile-bound draft store and undo
history. Failed or stale saves preserve the accepted draft. Display-only editing
receives no Workbench group data. The owner explicitly enables Public group
through the existing draft operation and undo path. Public v9 projection filters
these groups against already-projected public modules, retaining only eligible
member IDs, order, name and optional anchor. Empty results are omitted. Private
group names, member names, counts and cover sources never enter the snapshot.
The optional public `workbenchGroups` field accepts only PUBLIC, nonempty groups
with bounded unique membership in that same document. Old drafts and public
documents remain valid without rewrites; private-only groups do not change the
canonical publication bytes. New public groups require the updated v9 reader.

Public restoration keeps existing private group IDs and membership authoritative
over conflicting imported grouping. Public groups absent from the incoming
snapshot are retained locally as private, surrendering members assigned to a
new public group. Private members of a restored public group remain only in the
local draft. Restoration fails explicitly if preserving local groups would exceed
the 32-group limit; it never silently deletes them to make room.

On 2026-10-06 the founder authorized continuing the grouping implementation,
with code quality and ownership separation checked throughout. Groups now offer
Stack and Unstack. Optional group `position: { left, top }` records the compact
stack's Workbench anchor; omission preserves the original module arrangement.
New stack placement uses the current canvas bounds; shrinking the canvas preserves existing stack positions, including outliers.
Dragging its grip or using arrow keys saves only that anchor as one undoable
operation. Escape, cancellation and focus loss restore the prior anchor. Stacking,
moving, membership drops and unstacking never move the camera or rewrite members.
The stack remains after reload; unstacking restores the original arrangement.

Open group is a temporary browsing action. Registered live module windows remain
mounted while compacted. Hidden windows are inert and excluded from selection
and snapping; hidden Keepers settle at their docks. Opening derives an ordered,
proportion-preserving row layout from module-owned frames, with 32-work-pixel gaps
and one column on narrow screens. Surrounding modules and other stacks dim.
Image inspection, Display scene interaction and native Text reading remain in
their existing modules. Group presentation disables window movement/resizing and
uses Text's existing read mode without replacing its editor or saving a mode change.
Unstacking is the explicit way to resume authoring the original window layout.

The temporary projection is separate from authoring transforms and layout reports.
It is derived again when membership, live frames or viewport width change and is
discarded on return, reset, suspension or disposal. Opening and returning reuse
the camera's high-resolution live-surface animation, with bounded rectangle
inputs; navigation receives no draft store or group schema. Reduced motion is
immediate. Interrupted travel settles the presentation while leaving the camera
at the interruption point. No animation frame enters draft history or publication.

A bounded, horizontally scrolling named destination strip opens saved groups.
Within an open group, an item selector and Previous/Next follow saved member order
and stop at the ends. Item focus keeps one return context for the group overview,
so Back returns from reading to the group and then to the preceding Workbench view.
Closed windows retain membership and are listed as closed in Groups; browsing
uses open windows. Empty groups remain valid drop targets and open their management
tools until they have a live member. Group controls occupy reserved fitting space.
Owner tools remain absent from Visitor mode. The shared presentation hook and
stack controls accept read-only content plus explicit actions. Only the owner
supplies anchor-edit and management actions; shared browsing imports no draft
store or group-edit session. Visitor receives only its validated public document
and supports the same stacks, named routes, reading, Previous/Next and Back.
Its camera and expanded state remain temporary. Groups with no open windows
disable their browsing action; existing module shortcuts remain available.
Unstack explicitly exits an expanded group and resumes its original authored
layout in the owner view. Dimmed stacks sit behind live group windows so they
cannot cover or intercept reading and artwork interactions.

## Public Workbench and visitor interaction

### Non-destructive canvas cropping (2026-10-20)

The canvas boundary defines the visible composition. Shrinking clips authored
content without deleting it, moving it, resizing its frames or rewriting its
source media. Enlarging reveals the retained portions. Owner and public
Preview/Visitor share the same camera-projected clipping plane; the tools,
Index and navigation remain outside it. This is presentation cropping, not
removal from the public document: public source references and complete authored
geometry remain available to the document and explicit artwork inspection.

Canvas size includes a Show outside canvas toggle. In the owner session it
reveals dimmed, editable outside content; the setting is neither saved nor
published and resets when that profile session is remounted. Ordinary clipped
content cannot be clicked beyond the boundary; fully hidden modules cannot
receive keyboard focus or marquee selection. Owner Focus on an outlying module
reveals outside content. Explicit artwork inspection and expanded group reading
use their existing temporary presentation; returning restores the canvas crop.

Existing modules and stacks can cross all four canvas edges without being
pushed back inside. Their editing space is bounded independently at -16,384 to
+16,384 work pixels on each axis, with each module's existing size constraints.
Initial placement and the alignment grid still use the canvas area. A selected
partly cropped object keeps its editing handles; Show outside canvas reveals
its full frame. Canvas resizing remains undoable and does not create a second
owner of module geometry or storage.

Viewport-owned Mini App windows, their settings and shortcuts, and the released
Keeper and its conversation stay outside the canvas clipping plane. Keeper's
authored dock remains canvas content. This preserves their existing viewport
coordinates and control stacking in both owner and Visitor.

On 20 October the founder also requested exact Fit and resizing on every side.
Fit canvas to content now uses all four object-frame bounds, with no added
margin. Fractional bounds round outward to the nearest whole work pixel, by
less than one pixel per edge. Transparent margins within the source image remain
part of its object frame; Fit does not scan alpha or rewrite media. Every canvas
edge and all four corners are editable. The opposite edge/corner stays fixed,
while the canvas origin may move independently of the artworks and camera.
Image source resolution, the 16-Image limit and the media decoding path are unchanged.

### Current implemented canvas and navigation behavior

At narrow desktop widths, Visitor profile-routing actions occupy a separate
dock row when present. Discover, Return and Exit stay reachable without
horizontal scrolling. The camera reserves the resulting dock height; long Grid
titles shrink within their own row. These same routes are available at narrow
widths without a separate mobile entrance.

On 2026-10-12 the founder retained the existing spatial composition and Text
behavior and chose an adjustable Workbench canvas. The 20 October refinement
extends resizing to all four edges and corners and removes Fit's former
48-work-pixel margin. Canvas size in the camera rail reveals these controls.
Resizing never moves or scales existing content or changes the camera. Fit uses
open registered content and collapsed group stacks without rearranging anything.
An explicit Find resize corner action
uses existing camera navigation and Back when the edge is outside the viewport.

The default remains 2,000 wide × 4,000 high work pixels. Whole-pixel dimensions
from 1 to 16,384 are saved as optional `workbench.area: { width, height, left?, top? }`
through the existing draft operation, undo, publication and restore paths.
The former 256-pixel minimum no longer adds padding to small fitted content.
Optional left/top default to zero; all four boundaries stay within the finite
Workbench editing coordinates. Layouts without an area use the default.
A drag preview is temporary; release commits once, while Escape, lost capture,
blur, hidden document, changed draft or disposal cancels it. Arrow keys resize
by 10 pixels, Shift by 100 and Alt by 1. Failed saves restore the saved boundary.
The alignment grid and initial-placement bounds derive from the same per-Workbench
area; subsequent movement and resizing use the independent editing bounds.
Its line/dot/hidden mode, colour and snapping remain independent
preferences. Module-owned grids and authored module dimensions are unchanged.

Owner and Visitor start at 100% with zero camera offset. Camera movement is free
in both axes, including when the whole work area fits on screen; manual zoom
remains 25%–200%. The work area clips the composition; it does not constrain camera navigation or Focus.
Viewport, dock and control-size changes can stop an active journey but never
refit, clamp or recenter the camera. Reset view clears navigation history and
restores zero pan while retaining zoom. The percentage button and Ctrl/Cmd+0
restore 100% zoom around the view. Existing inspection locks remain authoritative.

Old reference-frame preference fields are ignored. Other local preferences,
storage keys and authored positions retain their meaning; the optional canvas area is the only schema extension here.
Reading or reloading older 8,000-area arrangements does not move outlying modules;
Show outside canvas and Focus can still recover them beyond the visible grid.

Dragging empty Workbench space marquee-selects fully enclosed registered content
windows: shapes, images, Displays, Text and other registered canvas modules.
Keeper's dock is a screen tool and is excluded from canvas selection and groups.
An intersecting background is not selected unless its entire bounds are enclosed. Shift-drag adds to the selection; Shift-click a window header toggles it.
Focused window headers also toggle selection with Shift+Enter.
The selection's corner handles scale multiple windows proportionally around the
opposite corner. A single Image or Shape instead delegates its corners to its
own independent width/height resize behavior. Text boxes resize and reflow without scaling their letters,
including during the drag preview. Escape cancels a gesture or clears selection.
Dragging anywhere inside the selection moves the selected modules together,
including over artwork, text, headers and gaps. This temporarily takes priority
over module interactions. Clicking outside clears selection. The focused selection
also moves with arrow keys (one active grid cell while snapping, otherwise one
screen pixel; Shift multiplies the step by ten and Alt bypasses snapping). Group movement
uses temporary view state during interaction; Escape cancels an active
drag and restores its starting position.
Completing owner group movement, including keyboard movement or moving an
individual window while zoomed, reports its position back to each window.
The existing local workspace layout then saves the same positions shown on
screen. Temporary translations do not remain a second owner of placement.
Movement never chooses new dimensions or artwork fitting; Visitor movement
remains temporary and cannot write the maker's arrangement.
Group movement and corner resizing respect the independent Workbench editing bounds,
projected through the current view scale and pan. Moving a zoomed module
individually uses those same bounds and can cross the canvas crop. Group movement keeps
relative spacing intact at the boundary.
Group resizing starts from exact module geometry, using one scale factor around
the opposite selection corner. Moving and resizing a selection reuse Workbench
grid and module-edge snapping on its outer bounds; selected members never snap
individually or serve as each other's targets. Proportional resizing chooses one
eligible edge to determine the scale, with module edges preferred over the grid.
Alt bypasses snapping. Owner selections of editable Image, Text and Display
modules, including mixed selections, commit real dimensions and window positions
together through the existing draft store on release. Image uses whole-pixel
dimensions. Both group and solo Text window resizing change available space and
reflow text without changing article appearance or scene-linked passages.
Text retains continuous window dimensions during group preview and commit, so
its shared edges with Display are not quantized differently. Existing saved
spacing is preserved; resizing does not infer or repair an intended join.
Display retains its Stage ratio using continuous dimensions for both group
preview and commit; only painting rounds Display edges. Remeasuring available
space does not grow a deliberately small Display to a 320-pixel minimum.
Internal selection, movement, resizing and Library/Text drops reuse the rendered
Grid/World Cover projection before camera scaling, including World Cover's
fixed logical margins and size cap. Display resizing does not rewrite its layers.
Grid rail ownership: scene slots and camera motion use the same continuous
percentage width. Each scene plane owns its Grid clip; nested artwork planes on
the rail do not repeat that clip. Full-bleed artwork inherits the exact outer
Grid boundary; interior artwork joins use shared rounded paint endpoints.
The isolated rail moves its scene clips without per-scene additive blend
compensation, and hides offscreen scenes at exact resting slots. Grid geometry
must not be replaced with arbitrary artwork overlap or resizing.
Owner and Visitor use the same clipping rule. Saved geometry is unchanged.
A normal Display Grid maps its authored reference directly to the painted Stage
endpoints; it is not contained again inside the rounded Stage. Vertical input
and guide projection use that same row spacing. Artwork fitting and crop use
unrounded authored placement proportions before mapping into the painted opening,
so pixel rounding cannot introduce a new native-fit margin. World Cover retains
its intentional margins and cap; standalone Image keeps its own fitting frame.
Image, Text and Display share one outer-edge projection: exact Workbench frame,
module transform and camera pan are combined before shared endpoints are rounded
to physical screen pixels. Width/height are differences of those endpoints,
never independently rounded sizes. Text, Display and Image consume the shared
projection as integer physical-pixel surfaces mapped back by inverse density.
Standalone Text paints its background/frame once on that outer surface; its
transformed content uses native zoom and the authored wrapping width. Display
projects its internal paint edges into the physical Stage; pointer input and
logical control sizes have explicit conversions. No second CSS pan is applied
to an already projected window.
Subpixel camera movement can change painted coverage by one physical pixel;
it never rewrites logical geometry. Text retains its logical wrapping width.
Display's legacy exterior chrome background is removed. An explicitly enabled
Display frame is drawn inside its bounds; companion-window chrome is unchanged.
Visible Workbench grid marks use the same physical-pixel projection of the
24-work-pixel snap coordinates, without a separate half-pixel pattern offset.
Only visible rows/columns are generated. One viewport-sized canvas paints the
grid; dots reuse a rasterized row rather than expanding SVG instances per point.
The row exists only for the current paint lifecycle and never owns coordinates.
Snap calculations retain exact world coordinates and module-edge priority.
Grid-line retention is capped at three quarters of the projected grid interval
and at 18 screen pixels, so movement and resize can reach each adjacent line
when zoomed out instead of sticking across multiple cells.
Workbench coordinates and
module content remain separate inputs to one atomic save. Failed saving restores
the starting view; Escape cancels before saving. Shared endpoints are rounded
together to preserve joins. Previous temporary scaling is absorbed by the next
explicit group resize, not by a read or reload. Image size fields then report
the same dimensions as solo resize. Draft Undo/Redo restores saved window geometry
with its content; local frame recovery for missing older layouts is bounded by
the existing history limit and ends when the module unmounts.
Visitor group interaction remains temporary. Camera zoom is always view-only.
The mounted Workbench camera owns session zoom and pan together. Its navigation
controller owns wheel and Space input, destinations, return history and reset.
Selection, movement and resizing read that camera for coordinate projection and
retain their existing authoring boundaries. Navigation can cancel an editing
gesture but never receives its draft store or changes module transforms. Pan
updates do not notify scale-only module editors. This separation does not change
stored layouts, publication data or storage keys.
On 2026-10-06 the founder authorized continuing the spatial implementation.
The **Hand** tool consolidates Hand and Explore in owner and Visitor views.
It pans from empty Workbench space, artwork, module titles and resize handles,
with Explore's release momentum. Module and placement movement, resizing and
keyboard nudging are blocked while Hand is active. Stationary Image artwork clicks
activate the Image without camera travel; double-click focuses its module, as
clarified on 2026-10-19. Completed drags suppress that click. Native Text/tool inputs
and scrolling retain their own behavior. Hand is session-only and off by default;
Select restores ordinary authoring and marquee selection. Owner uses the Hand
tool in the creation toolbar; Visitor exposes the same tool beside camera controls.
Space-drag remains available in either mode, without momentum in Select.

Pan gestures now use the same live-surface projection lifetime as Focus travel.
Pointer samples paint the camera without a React state commit per sample; release
commits the settled camera. Hand measures at most twelve recent samples, ignores
paused releases, caps screen velocity and integrates exponential decay by elapsed
time for at most 700 ms. It never enters authored layout or Back history. Reduced
motion omits inertia. Escape cancels an active drag to its exact start, or stops
coasting before any Back action. New input, locks, suspension, resize, blur and
disposal stop active motion through the existing navigation owner.
At unchanged camera scale, projected surfaces share one physical-pixel translation
so release momentum cannot filter gaps between adjoining Image surfaces. The
precise camera offset and authored geometry remain independent of this painting.

Artwork visibility is owned by the shared artwork layer. Its observer defers
unloading during a temporary camera projection and rechecks settled clipping
geometry afterward. This prevents a brief offscreen crossing from restarting an
SVG document; artwork that remains offscreen still releases its document.

On 2026-10-11 the founder approved named saved camera destinations and a
Workbench Index. Add > Index creates one optional navigation instrument. It can
remain pinned to the screen or travel with the canvas. Its window uses the shared
Workbench host; navigation tools are not composition/group members. Owner moves
and resizes commit once at gesture completion. Visitors may browse/close it
without writing the maker's layout.
The Index retains readable screen-pixel dimensions and controls at every zoom.
When unpinned, only its position follows the canvas through the shared camera's
live paint subscription; it is not artwork and never joins composition selection
or raster projection. Dragging converts screen movement to canvas position;
resizing retains screen-pixel dimensions. Existing saved window values load
unchanged, without rewriting destinations, schemas or storage keys.
`workbenchIndex` is optional in draft v4 and public v9: `open`, `pinned`, `window`,
up to 32 ordered `destinations`, and nullable `landingId`. Each destination stores
an id, name and authored Workbench view rectangle. Owner records also contain
visibility; public records omit it. Saving/renaming/updating/reordering/deleting
destinations uses completed draft operations and undo. No screenshot or artwork
copy is stored. Camera travel uses the existing controller and Back history,
with zero extra padding for saved views so repeated visits do not zoom out.
Different viewport shapes fit the saved region around the same centre.
Optional Follow group retains framing relative to a stable member anchor (or
the group's authored stack location). Moving the group translates the view;
resizing members does not automatically refit it. Missing groups or anchors
fall back to the saved region with a reconnect message in the owner editor.
Following never opens the group's spread presentation or rearranges content.
Public projection excludes private destinations and links to unavailable or
private groups/members, and clears an omitted landing destination. Restoration
preserves unpublished local entries as private and rejects capacity overflow.
The chosen public starting view runs on visitor entry unless an explicit artwork
entry target takes precedence. Old documents without an Index keep their entry.

The authored work area is outlined against a darker exterior. A fresh
workspace without saved preferences starts without the global guide; existing
guide preferences remain unchanged. Free camera travel still reaches old
outlying artwork. Area appearance never changes document geometry.

Workbench destination navigation starts with explicit **Focus selection** and
**Back** controls shared by owner and Visitor. Focus frames the selected live
module instances using their logical geometry and a centred rectangle above
the measured bottom camera controls (including creation-toolbar clearance).
Floating instruments never shift the destination to one side. The selection
count sits above the rail without affecting its wrapping, so clearing selection
on arrival does not change that centre. Camera scale remains
between 25% and 200%; the work area does not clamp travel. Focus changes only the camera; it does
not group, move, resize, remount or save modules. Selection clears on arrival so
the content can be used. Back restores the preceding camera and surviving
selection, then returns keyboard focus to that selection or the Workbench.
Return viewport measurements exclude selection-driven toolbar wrapping so
restoring selection cannot shift the saved camera position. Destination fitting
reserves the currently visible bottom controls, without avoiding floating windows.
The session keeps at most 50 return contexts and clears them on Workbench
disposal, profile replacement, Preview suspension or Reset view.
Navigation decisions and return contexts are separate from the cancellable
460 ms camera animation, which uses the existing inspection easing. Reduced
motion travels immediately. New navigation replaces the active animation.
The animation clock starts when the first callback is actually ready to paint,
not at an older frame timestamp from before preparation. Preparation latency
must not consume the gentle beginning of the journey (2026-10-19). Subsequent
frames retain the shared camera clock, easing and cancellation rules.
Pointer or keyboard editing, manual camera input, viewport changes,
inspection locks, window blur and hidden-document transitions stop it at its
current position. Missing or changed destination geometry invalidates pending
travel. Interrupted Back remains available until the return completes.
For ordinary camera journeys, late module registration renews the live surface
projection on the same travel clock while the destination remains valid. It does
not add history or restart a journey cancelled by input, inspection or disposal.
Geometry-specific group morphs retain their existing cancellation boundary.
Pure camera zoom travel uses paused native scale/translation effects on the
already prepared module surfaces. The existing camera clock samples their
progress; they never run independently of the logical camera or input geometry.
Every effect is cancelled when its projection ends, including interruption and
disposal. Constant-scale pan/coasting retain shared physical-pixel translation;
group morphs retain their per-module geometry path. This avoids rewriting every
module's CSS transform on every Focus frame without changing travel duration,
easing, native artwork resolution or saved layout. The grid resolves its colour
when that input changes and reuses its dot-row canvas allocation; the zoom
readout changes its text only when the displayed percentage changes.
Focus still prepares and paints the whole live Workbench, whereas artwork Lift
prepares one artwork. A first zoom can incur browser rasterization work even
when React does not render per frame; measure first-use and repeated journeys
separately before claiming that all stutter is eliminated.
Escape first retains existing editor, inspector, gesture and selection behavior;
with none of those active, it returns to the preceding Workbench view. Image
and Display inspection keep their own input lock and source-return behavior.
On 2026-10-19 the founder extended the Focus shortcut: plain **F** focuses the
current Workbench selection, or the live module holding keyboard focus after
ordinary click activation. A single Image needs no marquee or Shift-selection.
Pressing F again at that destination, or on the Workbench after arrival, uses
the existing Back action to restore the preceding view. This also works after
double-click or Enter Focus and during an unfinished journey. Explicit selection
or keyboard focus on a different module requests that new destination; each
return consumes only one existing history entry. Back restores the originating
module's keyboard focus when there was no group selection, so F can focus it
again. The toolbar Focus button and double-click remain direct, idempotent Focus
commands. No separate zoom mode or persistent state is introduced. Typing, IME
composition, modifiers, menus, dialogs, captured pointer gestures and inspection
locks retain their own keys; holding F cannot restart or interrupt the journey.
Image artwork single-click activation now selects its active tools without
camera travel (2026-10-19). Double-click or keyboard Enter focuses its
module rather than opening Lift. Ordinary Display artwork inspection requests focus the owning
Display; authoring selection and metadata selection retain their existing paths.
Owner and Visitor share this behavior, including Hand's stationary Image click
and double-click. Single-click does not wait for a double-click timer; it activates
immediately and the native second click requests Focus. Completed or cancelled
Image drags retain their release-click suppression, including a second click.
Focus and artwork inspection coexist as distinct actions. Plain **I** and the
module's visible Inspect control inspect the current Image side or selected/focused
Display artwork. Image uses Lift. Display follows the placement's authored
In place/Lift choice (clarified by the founder on 2026-10-16). Image and Display contextual artwork tools expose the same action;
quiet Image controls and the Display header keep it reachable for Visitor/touch.
The Workbench routes I to one selected or active live module; multi-module
selection, typing, modifiers, composition, menus, dialogs and active gestures
do not open inspection. Each module owns eligibility, current artwork and media
readiness. Registrations retire with the module, and closed/hidden targets reject
inspection. No global renderer or second camera is introduced.
Explicit Display Inspect uses the existing viewer's authored-mode resolution;
it no longer overrides the choice with Lift. Owner, Preview and Visitor use the
same rule. Missing inspectionMode retains the existing Lift default. Choosing a
mode only saves that setting; the magnifier, header Inspect control or I opens
inspection. Escape returns to the same camera and crop; Back then
uses the existing Focus history to return to the overview. Inspection never adds
a camera-history entry or rewrites saved geometry. Escape during an Image move
or resize belongs to that gesture and cannot also consume Workbench Back.
The existing explicit Enlarge Display action and inspection inside that enlarged
surface remain available. Standalone renderers without a Workbench retain their
inspection fallback. This is a current UX trial, not removal of the inspection
renderer. No preference, schema, authored geometry or publication data changes.
Back/Escape retain the existing return history. Dragging and wheel ownership
remain unchanged. Named Workbench groups extend this same navigation path with
temporary spreading and item reading, as specified in their section above.
Existing Workbench fields carry Text window sizes through publication and restore;
no schema, storage key, default or old-data interpretation changes. Previously
saved article scales remain readable. Explicitly setting Text size resets the
article scale to one, removing any earlier group magnification so the chosen
size applies directly; opening or resizing a window does not rewrite its article.
Workbench wheel zoom (accepted 2026-09-22) always scales the whole module view,
independently of selection, between 25% and 200%, including positions, spacing and
rendered text. Text retains its original wrapping area; the entire output shrinks.
Only Ctrl + wheel zooms the Workbench, continuously around the cursor, on empty
space and over modules. Unmodified wheel and Cmd + wheel do not zoom it.
The world point beneath the cursor stays fixed. There are no plus/minus zoom
buttons or Workbench zoom keyboard shortcuts.
Selection corner handles remain a separate group-scale operation.
Dock, shortcuts, Identity and companion tools retain their normal size.
Companion tools (including Layers, Artwork tools and Text tools) stay in screen
coordinates during camera pan and zoom; their manual dragging remains independent.
Text, Layers and Artwork info offer resize targets on all four edges
and corners, centred on their visible edge marks. The opposite edge stays fixed;
Escape restores the complete starting frame. Owner Text resizing saves through
the existing module resize transaction and supports draft Undo/Redo. Companion
window sizing remains temporary UI state and stays reachable after viewport resize.
This is session-only view state, shared by owner and Visitor rendering, never
captured as authored geometry or publication data. The percentage reset control
and Ctrl/Cmd + 0 restore camera zoom to 100% around the centre of the current
visible Workbench (excluding the dock), retaining the world point at that centre.
They preserve module positions and individual/group scale transforms. Reset view resets only
camera pan and likewise preserves the composition. Display has no
independent wheel zoom, maximize/restore, or immersive fullscreen mode. Article
scrolling retains its existing behavior.
Shared module boundaries use matching physical-pixel edges at fractional zoom,
without changing the text's wrapping area or authored dimensions. Native content
zoom paints text at its target size; rounding the visible frame never rewrites
the authored layout. Companion-window viewport constraints do not cap a scaled
composition surface.

- The maker chooses which modules and Grids enter the public snapshot. Private
  modules and private Grids are omitted from that document, not merely hidden
  by the interface. Draft work can remain private while other work is published.
- Explicit Publish updates the public configuration as a snapshot. Later local
  edits do not change the existing publication.
- The maker authors the public starting arrangement: window positions and
  sizes, shortcuts, and which modules start open. Arriving with all modules
  closed is valid. These authored public choices must be distinguished from
  private editor preferences and temporary window state.
- Visitors may move, resize, open, and close available module windows and use
  the interactive controls a module exposes. Those changes are session-local;
  they do not alter the creator's draft or publication. Reload restores the
  published starting configuration. Inspection can include source metadata
  without exposing the author's Layers or Library workspace.
- Direct entry to the Workbench and to a published module is accepted
  direction. An identity module could provide a directly linked visiting card
  from which the visitor explores the rest of the published Workbench.
- Background, alignment-grid settings, and shortcut snapping remain local
  editor preferences in the current implementation. Publishing a desktop does
  not authorize serializing all workspace preferences. Which appearance
  settings become explicit public choices remains to be specified.

The current v9 document and private draft support an optional `workbench`
starting configuration for the implemented Display and Identity modules.
Prepare Publication explicitly captures and saves their open state and window
geometry, plus the Display name and shortcut position, visibility and artwork.
Module content remains in the existing Grid and Identity envelopes. Identity
height follows its content. Visitor interactions remain session-local.

Preview and Prepare Publication share a pure Workbench presentation capture.
It combines current module reports, saved arrangements, and existing defaults;
only current draft modules contribute layouts or unresolved-artwork errors.
The Workbench session owns saving that capture and Identity configuration.
Display authoring sessions, including the original Display, project and merge
only their module content through the shared profile draft store. The original
Display's root storage envelope is retained for compatibility.

Space + primary-pointer drag anywhere on the Workbench pans the view freely in
both axes, including over Image, Display artwork, Text, shortcuts and resize
handles. While Space is held, the Workbench claims the gesture before module
selection, movement, cropping, resizing or Grid navigation; releasing a pan
cannot open an image or activate the underlying control. The grab cursor marks
this temporary mode across the Workbench. Space typed into an active editor or
text field retains its normal meaning. Content modules and their shortcuts move together;
Shift + wheel pans horizontally (wheel down moves the view right, content left);
ordinary wheel pans vertically over the background and module content, including
Image, Display and fitting or paged Text. Native readers with actual overflow
on the requested axis retain their own scrolling, including at their ends;
tool lists retain native scrolling too. Merely clipping artwork or paginating
Text does not capture wheel input. Native horizontal wheel
input (wheel tilt or trackpad deltaX) pans horizontally, without a middle
button gesture. Both axes can move together on a trackpad.
Ctrl + wheel retains zoom priority when both modifiers are held.
The background colour, dock and viewport menus remain fixed. The alignment grid
follows camera pan and scale, and snapping uses that same projected lattice. Display
Grid navigation and editing retain their own input when Space is not held. The pan
is temporary per mounted Workbench, shared by owner and Visitor, and never
changes saved windows, draft content or publication. Reset view restores the
starting camera offset. Ctrl/Cmd+0 changes only zoom around the current view,
retaining module movement and scale transforms. An authored initial camera or
spawn point remains deferred; this does not change Reset view's destination.
Release, cancellation, focus loss, Preview suspension and disposal end the
gesture. This change retains the current visual design.
Image and Display Lift inspection dimming follows the artwork's shared animation
progress in both directions, including interrupted opening and reduced motion.

The adjustable canvas defaults to 2,000 by 4,000 at world position (0, 0).
Its origin and four boundaries can change without translating the content.
Content windows, instruments and movable shortcuts can leave the visible viewport;
existing content uses the independent finite editing bounds. Initial placement
and the alignment grid use the canvas bounds with an eight-pixel inset, reduced
when the canvas is too small for that inset. Panning
or zooming beyond them reveals the darker exterior. Resize handles appear only while Canvas size is open.
Canvas size also exposes Width and Height in pixels. Apply or Enter saves both
dimensions as one undoable resize, retaining the canvas origin and artwork
geometry. Typing is temporary; closing discards unfinished input. Invalid values
leave saved work unchanged. Saved edits and drag previews replace stale field
input through the existing canvas state; no additional persisted size is stored.
Reset view is always visible in the Workbench controls. It resets the temporary
pan, not the saved arrangement. Browser resizing and reload never pull saved
positions back into the viewport. Existing Display/Image viewport size fitting
remain separate from window placement.
The broader v9 storage redesign remains deferred. Optional canvas left/top fields
travel through the existing presentation, publication and restore paths, without
a new document version or storage key. Canvas origin changes do not rewrite module positions.
The work area is not a full-size render target and adds no module instances.

The owner's local arrangement also survives reload independently of publication.
A profile-scoped `inscape:workbench:layout:v1` record stores module geometry,
open state and shortcuts, selected Display Grid, lock and shared tool state,
and Text Read/Write state. It contains no module content. Existing
drafts fall back to their saved Workbench or runtime defaults; deleted module
IDs are ignored. A changed saved Workbench configuration invalidates the local
record. Unreadable records are retained until the owner explicitly saves the
current layout; failed writes are reported with a retry action. Optional
`views['workbench:tools']` retains shared Layers and Artwork info open state,
window geometry and the explicit Display target. The authorized cleanup on
23 October removed the obsolete per-Display instrument conversion. Current
shared tool records remain supported; historical records are not deleted.
The single Text tool's open state belongs to profile-local editor preferences
(`textOpen`). An unset preference falls back to an available writing article;
an explicit open or closed preference takes precedence. Its active module uses
the existing shared tool target, with a valid saved Text target restored before
the initial-article fallback. Per-article view records retain only Read/Write
mode; the obsolete per-Text `settings` conversion has been removed. Reading
does not rewrite the stored layout. No draft/publication schema or storage key changes.
Optional shared Display `appearance` open state and window geometry use the
same profile-local tool record as Layers and Metadata; omission means closed.

Failed Text edits are retained in a profile/module-scoped, in-memory page-session
recovery buffer. Workbench draft stores reconnect to their profile's buffer after
internal navigation or account changes; disposing an editor or Workbench does not
discard it. Other profiles cannot read or clear that recovery. Confirmed saves
remove recovered edits; opening or enabling an editor does not itself save. Recovery
blocks preview, publication preparation, draft undo and conflicting Display
operations until saved. A leave-page warning remains active even while the affected
Workbench is absent. The
buffer is not durable across a forced reload when storage cannot save.

Preview preparation has a visible loading/cancel state and accepts only the latest
request for the same profile, draft generation and Workbench presentation. Changed
input requires opening Preview again; cancellation or disposal ignores late results.
Preview suspends every owner Display through the same module input, independently
of focus. Display stops playback and momentum while retaining the temporary camera
position; returning from Preview does not resume playback automatically.

Existing documents without this configuration load in the shared Display window
with runtime defaults; a subsequent preparation can save the new configuration.
The publication version and ERC725Y pointer key remain unchanged. A publication
still requires a new verified content hash and URI and a separate wallet action.
Multiple Display instances are implemented through an optional `displays` array.
The original Display retains its root content envelope and existing storage key;
additional Displays have stable IDs and their own Grids, appearance and format.
All instances commit through one profile draft store. Selection, inspection,
playback and composition lock are scoped to an instance. Module connections
remain accepted direction, not an implemented capability.

The retained experimental implementation bounds a Workbench to eight Displays.
Its former right-click Add route created an additional private Display; that
ordinary creation route is removed by the 16 October decision. A retained
instance's context menu can include it in the next publication. Public projection omits private instances and private Grids.
The original Display requires a public Grid while it exists. An empty root
`grids` array represents its absence in draft v4 and document v9; additional
Display records still require Grids. Older nonempty documents retain their
existing interpretation, and no storage key changes. The experimental creation
operation recreates the original Display when absent before allocating another
instance; ordinary Add does not expose that operation.
`workbench.displays` retains additional window and shortcut arrangements when
Prepare Publication captures the Workbench. Closing minimizes to the shortcut;
it does not delete content. Visitor window changes remain session-local.
Owner shortcuts offer right-click Delete for every created Display
and mini app. Deletion removes authored module content and its saved
arrangement through one undoable draft operation. A desktop with no created
modules is valid and survives reload and publication. Identity remains accessible
through Profile; removing modules does not delete Library assets or change an
existing publication. The Workbench owns its alignment grid independently of
Display presence.
Optional arrays do not rewrite older documents on read. Publications using them
require the updated strict reader and a newly verified hash and URI.

## Minting direction

The founder wants both visitors minting from a creator's collection and creator
issuance tools. Visitor minting is the first step. It uses the visiting buyer's
wallet authority, independently of the viewed creator's authoring permissions.
The initial interaction preview is a local simulation; live sale terms,
supported contracts and holder-editable character settings remain to be defined.

## Hosted mini apps

The Workbench can host existing web mini apps by external HTTPS URL, with
connection support through the official LUKSO UP Provider client protocol.
Adding another app does not require a domain entry in code or deployment
configuration. This is a URL-based module; INSCAPE owns its window and
connection lifecycle while the remote application owns its creative behavior,
content, and storage. It does not add an arbitrary-code module SDK.

Right click Add → Mini App creates a private instance. Settings saves its name,
URL, and explicit inclusion in publication through the existing profile draft
store. Up to four instances are supported. Closing destroys the running frame
and leaves a shortcut; removing the instance is a separate settings action.
Owner and Visitor use the same window and host. Movement and resizing are
temporary until Prepare Publication captures the starting arrangement.

Optional `miniApps` fields extend draft v4 and public document v9; optional
`workbench.miniApps` stores their starting windows. Public projection omits
private apps and their windows. Older documents remain readable without writes.
Restoring a publication retains noncolliding local apps and their window
arrangements as private. An over-limit restoration fails without truncation.
Published URLs reference live websites, whose contents can change independently
of the INSCAPE snapshot. App-internal settings are not captured by INSCAPE.

The viewed Universal Profile is public context, distinct from the connected
visitor's account. Connect App grants only that instance access to the existing
wallet authority; wallet actions still require the wallet's approval. Grants
are never saved, published, or shared across instances. Account/provider/chain
changes, closure, reload, and preview suspension revoke them. Microphone
delegation starts off and is controlled per app, with browser permission still
required. Preview suspension also ends that delegation.

The founder approved general HTTPS hosting on 2026-09-13. Production permits
HTTPS frames; each bridge still binds connection messages and optional microphone
delegation to its own app's exact origin and window. There is no app domain list.
Private localhost drafts remain readable and run only during development.
Embedding headers, supported wallet methods, and ancestor permission policies
determine compatibility; working on Universal Everything is not a guarantee
that every app works unchanged here. Grid/LSP28 import and synchronization,
app-to-app audio sharing, and a marketplace are not implemented by this host.
See [mini app hosting](MINI_APP_HOSTING.md) for the boundaries and checks.

### Self-contained HTML artwork (2026-10-14)

**Founder clarification (2026-10-25):** this artwork mode was an experiment, not
an intended artwork workflow to carry into the Desktop design. The founder uses
SVG for that case. The description below records existing implementation; this
clarification does not itself remove code or saved records.

The founder requested a floating Nomad HTML artwork with its animation and
hideable controls embedded in the file. Mini App settings now offer Transparent
HTML artwork through optional `surface: 'artwork'`. Missing fields preserve
ordinary Mini App behavior; draft v4 and public v9 use the same optional field.
Artwork shares Mini App records, lifecycle, undo and publication rules. Since
the authorized 21 October correction, its window uses the existing Workbench
canvas projection: authored position and size survive zoom, pan, switching and
reload. The HTML document keeps its authored viewport size while its pixels
scale with the camera; window controls overlay it instead of consuming artwork
height. Ordinary Mini Apps retain their screen-window behavior. Owner and
visitor share this rendering component; the dedicated geometry regression uses
the owner fixture, not a separate visitor-route performance measurement.
Its frame is transparent and sandboxed with scripts only, with no wallet bridge,
same-origin access, microphone delegation, forms, popups or top navigation.
The file owns animation and controls; the Workbench does not interpret cloth or
character parts. Closing, preview suspension and going offscreen dispose its
document. Window controls remain available on hover, keyboard focus and touch.
The frame is still rectangular for input; alpha does not forward clicks through
to other modules. This adds URL-based HTML hosting, not an NFT import pipeline
or local file-upload system. External hosting must permit embedding.

The initial Nomad trial retains its SVG source in the HTML and prepares textures
once for the existing WebGL mesh animation. It is not a live SVG filter renderer;
detail remains bounded by texture resolution. Local artwork URLs run only in
development, stay private, and cannot enter a published document. Files under
public/artwork-experiments are excluded from production builds. Publication of
an artwork requires a separately hosted public HTTPS URL and explicit action.

## Removed artwork presentation panel

On 2026-09-21 the founder removed the entire artwork Frame and mat panel:
mats, artwork frames, backing colour and the Transparency override. Artwork
always retains its source transparency. No authored mats require preservation.
Controls, presets, inset geometry and decorative rendering are removed.
Grid backgrounds, Display window appearance and Text appearance are independent
and remain available. In place / Lift remains a separate inspection choice.

Older writers emitted unused presentation fields automatically. The read boundary
accepts the unused mat default and former frame, backing and transparency fields,
then omits them from validated draft content. New saves and publications omit them.
Published readers retain the exact old fields for canonical-byte and hash checks;
renderers ignore them. Restoring a publication removes them at the draft boundary.
There is no storage-key change or draft reset; reading does not rewrite storage.

## Display Module

**Experimental implementation reference.** This section retains Display
behavior and its tests for isolated experiments. It is subordinate to
[Display experimental status](#display-experimental-status-2026-10-16); Stage,
Grids, Layers and instrument detail do not authorize ordinary Display creation.

The Grids menu offers Duplicate Grid for ordinary scenes in the active Display.
It appends and selects a private copy named after the source, with a unique
copy suffix. Artwork, embedded Text, placement geometry, media choices, crop,
transforms, locks, labels and groups are retained; Grid, placement and group IDs
are independent. The copy is one undoable draft operation. Failed persistence,
stale input or the 24-Grid limit leaves the draft and selection unchanged.
World Cover is excluded. Appending preserves existing scene-linked Text section
indices; standalone Text articles and passages remain independently authored.
Existing drafts and public documents require no schema or storage-key changes.

Display supports authored text layers within a Grid. Text layers share placement
geometry, ordering, selection, movement, resizing, duplication, locking and undo
with artwork. Layers lists the text and opens its separate Text tools companion;
it does not contain a second text editor. Rich text uses the same article model
and renderer as standalone Text; existing plain text layers remain readable and
upgrade when edited. Text retains its background/frame choices and follows the
Grid and Display scale. Resizing
the text box changes its wrapping area; font size is an explicit text setting.
Owner and Visitor use the same text renderer. Text has no Library asset,
creator attribution, artwork inspection or crop controls.
An explicit `kind: text` placement extends draft v4 and public v9 documents;
existing artwork placements remain unchanged. Private Grids and placements
remain excluded from publication. Existing document and storage keys stay valid.

Metadata now has one shared Workbench output window, exposed as Artwork info.
Opening it enables artwork + markers across Displays; selecting a marker or
artwork updates that window without lifting, dimming or moving the scene.
Closing it removes the markers and metadata output. There are no independent
metadata foldouts. Artwork inspection remains a separate temporary interaction.
Unlocked owners may adjust marker offsets; these remain mounted-Grid session
state and are not authored or published. Visitors cannot move markers.
Metadata continues to use existing asset projections, with no second source
of artwork facts. Edition labels still require sourced artwork-level facts.

Layers offers one custom Gutter value in canvas units and Apply to all for the
current scene. It preserves image sizes and directional ordering, including
staggered layouts. Neighbours are identified by overlapping projections on the
opposite axis; matching top edges are not required. Each axis is spaced from
its leading neighbours, retaining positions for images without predecessors.
The same target gap applies horizontally and vertically. Multiple constraints
may leave larger gaps; image sizes are never changed to force exact spacing.
Locked or editor-hidden images disable the action. Overlapping image bounds,
or arrangements where spacing would introduce a conflicting neighbour, are
rejected atomically rather than flattened or partially moved.
The gap is rounded to existing one-ninth-unit geometry precision. All moves are
validated and saved in one undoable operation through the Display session.
Only resulting placement coordinates persist; there is no new draft schema,
automatic reflow, drag snapping or publication field. Existing drafts remain
unchanged until the owner applies the operation.

`Display Module` is the product-facing term. Existing `PresentationBoard` and
`presentationBoard*` implementation identifiers and persistence keys remain
internal compatibility names during this migration; do not broadly rename them.

- Accepted direction (2026-09-28): the owner can choose a Display's canvas width
  and height before composing and change them later, including custom aspect
  ratios. Changing canvas dimensions preserves existing placement coordinates,
  sizes, crops, transforms and text-box geometry across its Grids. It changes
  the clipping boundary; the artist rearranges the composition manually. There
  is no automatic stretching, scaling, repositioning or reflow to fit the new
  canvas. Content beyond the boundary remains in the draft. Canvas dimensions
  belong to Display content; Workbench viewing scale remains separate.
  All Grids in an instance continue to share its canvas dimensions.
  Implemented on 2026-09-29: independent whole-number width and height from
  1 to 512 canvas units, matching the coordinate units used by layers.
  Landscape (32×18) and Portrait (18×32) remain presets. Format → Custom size
  submits both dimensions as one undoable operation; Cancel/Escape changes
  nothing, and failed saving keeps the form open and the saved draft unchanged.
  Old forms cannot overwrite dimensions changed since opening.
  Window resizing remains proportional to the authored canvas; Workbench zoom
  remains viewing state. All Grids in that Display share the new boundary.
  Existing geometry and reduced artboard-ratio fields carry the dimensions in
  draft v4 and public v9, without new storage keys, migrations or rewritten reads.
  Existing saved Displays retain their geometry until explicitly edited, and
  published work changes only on explicit publication. Documents with custom
  dimensions require this updated reader; older strict readers reject them.
  Display window validation accepts narrow fitted frames without changing the
  minimum saved sizes of Text, Identity or Mini Apps.
  The profile's World Cover remains landscape.
- New public snapshots omit fully outside placements and retain valid groups
  among the remaining members. Intersecting placements retain their geometry
  and are clipped by the shared renderer; their underlying media is still public.
  This projection never removes content from the draft or rewrites old publications.
- The Display Module may move freely on the Workbench without changing published
  composition coordinates.
- Pan and zoom are camera/view state. They never resize assets, mutate the Grid,
  or alter published geometry.
- Support a fitted overview and sufficiently strong zoom for precise editing.
- Display uses one Stage projection. Corner resize changes its saved window size;
  Workbench Ctrl-wheel zoom changes the Workbench viewing scale. Independent
  Display wheel enlargement, editable maximize/restore and immersive fullscreen are removed.
  Artwork inspect, Grid navigation, composition editing and minimize-to-shortcut
  remain. Removed modes were temporary, so old saved compositions and window
  geometry remain readable without a storage migration or reset.
- **Enlarge Display** temporarily lifts the live Display into a fitted inspection
  view for owners and visitors. It reuses the Image/artwork lift's 460 ms easing
  and Workbench input lock; reduced motion opens and returns immediately.
  The Stage renders at the enlarged resolution, with the same mounted artwork
  documents. This is temporary projection, never saved window or composition geometry.
  Normal Grid navigation, Stage swiping and contained artwork inspection
  remain usable. Composition editing, drop placement and window manipulation are
  unavailable until return; the owner's saved composition lock is unchanged.
  The same window button switches to Restore Display and returns to the original
  window. Enlargement adds no dimming, modal overlay or separate navigation controls.
  Clicking outside also restores it; clicking or swiping inside never restores
  the window, including a swipe released outside its bounds. Escape closes a nested
  artwork inspection first, then the enlarged Display. Focus and
  Workbench input return after the closing animation, including interrupted opens.
- Display's window, Stage and artwork use shared paint boundaries at the
  Workbench scale. This rounding is derived screen geometry, never an edit to
  the saved composition. Owner, Visitor and Display inspect use the same native
  image-source opening for crop, rotation and mirroring. Media retain their
  original transparency and animation. Browsers without `object-view-box`
  retain the prior image clipping path; its fractional-edge limitations remain
  outside the verified Chromium rendering path.
- Ordered Grid navigation wraps from last to first and first to last, in the
  editor and public presentation. A single Grid does not swipe to itself; the
  World Cover remains outside the editor's scene sequence.
- Dragging the Display Stage swipes between Grids directly in Visitor mode and
  when the owner's Display composition is locked. Unlocked authoring keeps
  ordinary dragging for editing and uses the Grids menu to select a scene.
  Space-drag always belongs to the Workbench camera, including over the Stage.
  The Grid follows the pointer directly. Release chooses an exact Grid seam from
  its position and velocity and lands there in one bounded motion, without spring
  motion, overshoot or a separate final snap. A held release lands on the nearest
  seam. Taking hold interrupts the landing immediately and retains
  the position. Manual movement and Play Grids share one temporary camera position;
  crossing a Grid boundary changes the selected Grid without interrupting travel.
  Reduced motion omits momentum and retains discrete Grid selection on release.
- An explicitly paused or interrupted camera may remain between Grids while the owner edits the selected
  Grid through Layers or directly on its visible artwork. The adjacent Grid is
  a preview, not a second editing target. Layer coordinates and selection handles
  follow the selected Grid's displayed position. Active dragging, coasting and
  Play Grids suspend editing; resting at an offset does not. Unlock stops motion
  while retaining that position. Opening Layers and cropping do not align the
  camera or change authored geometry. Lock continues to protect composition edits.
- The Display context menu offers Play Grids when more than one Grid exists.
  While playing, its toolbar exposes Pause; otherwise no playback icon appears. Playback
  slides continuously through the ordered Grids at 12 seconds per Grid and wraps without a dwell.
  Pause retains progress; Stage interaction returns to manual control. Playback
  does not change the draft schema or publication. Reduced motion uses discrete
  Grid changes instead of sliding.
- Owner, Preview and Visitor use the same contained Display artwork inspection,
  keyboard artwork navigation and Metadata instrument. The former full-screen
  visitor artwork/dossier presentation is retired, including for old publications.
  Visitors retain window interaction, Grid playback and Metadata inspection, with
  no Layers tab, placement tools or composition Lock. Metadata uses one shared,
  bounded Workbench window. Published creator attribution
  and source details remain available. These interactions are session-local and
  never write an owner draft or rewrite publication bytes.
- **Inspect: In place | Lift** appears in the contextual inspection row above
  the creation toolbar for one selected artwork. It applies to the selected, unlocked placement
  and remains independent of crop controls.
  The choice is saved as optional `inspectionMode`
  (`IN_PLACE` or `LIFT`) in drafts and public placements. Existing drafts and
  publications without it now default to Lift; explicit IN_PLACE choices remain
  respected. This is a read-time default change, with no saved document rewrite.
  No image or geometry is copied
  into the saved setting. Visitors follow the authored choice. Lift to centre
  enlarges the artwork within the Stage using its original media proportions,
  dims the other artwork, and returns it on close without changing the scene.
  Lift opening and return share the same 460 ms duration and gentle easing.
- Focus in place keeps the composition and camera fixed. The selected
  artwork stays visible, layers behind it dim, and foreground layers fade away;
  closing restores the scene. Pointer picking follows visible image pixels,
  passing through transparent areas to artwork underneath. Visible artwork
  remains selectable. While a transparency mask is unavailable, rectangular
  picking remains available. Alt-click cycling and its Stage tooltip are removed.
  Keyboard and Layers selection remain explicit. These are temporary Display
  interactions shared by owner and visitor, not saved placement mutations.
  During focus, clicking anywhere within the Stage, including on the selected
  artwork, closes inspection through the same restore path as Escape. That
  click does not activate underlying artwork. Metadata and title-bar controls
  retain their own interactions. Stage artwork never displays a rectangular
  focus outline, including after keyboard interaction or focus restoration.
  Keyboard activation and focus indicators on interface controls remain available.
  Selecting artwork does not add an image-edge halo; editing and crop handles
  remain available. Authored Display grain stays visible over artwork during
  artwork inspection, using the same module surface effect.
  Opening and closing inspection preserve the current Grid camera position;
  temporary inspection suspends navigation without resetting the retained rail.
  Image and Display inspection also suspend Workbench pan, zoom and movement or
  resizing of their source module until the return finishes. Closing or disposing
  an inspector releases its temporary input lock. Native scrolling in independent
  readers and tool windows remains available; no camera or saved-layout mutation
  is used to enter or leave inspection.
- Do not implement the Display Module as an HTML iframe. Use one application context with
  an isolated, clipped viewport and camera transform.
- The Workbench hosts one shared Layers window and one shared Artwork info
  window. Both are independently movable and resizable, with no reserved sidecar
  space or changes to Display geometry. Both start closed.
- Layers follows the explicitly active Display and its current Grid. Its content
  and actions still belong to that Display session. Metadata follows the selected
  artwork in the targeted Display; its title identifies Display, Grid and artwork.
  A missing or minimized target hides its window; Metadata also stays hidden
  without one valid artwork selection. A valid empty Grid can expose its Layers
  list and creation controls. Tools never show another Display's content as a
  fallback and do not own or duplicate authored content.
- Display appearance also uses one shared window, opened through the Display's
  Appearance command. Selecting another open, unlocked Display replaces its
  controls in place. Closed, locked or unavailable targets hide the window; they
  never leave the previous Display editable through it.
- Owner tool state survives reload in the profile-local layout record; visitor
  Metadata state stays session-local. The obsolete sidecar conversion was removed
  by the authorized cleanup on 23 October; current shared windows remain supported.
  Unavailable targets retain their tool's open preference and window geometry,
  so a valid target can restore it without creating an empty inspector first.
  The existing Metadata command can enable in-scene selection cues before an
  artwork is selected; its window appears when that selection supplies content.
- Workbench and Display context menus expose Tools → Layers / Metadata; Visitor
  exposes Metadata only. Display menu actions explicitly target that Display.
  A keyboard-accessible Tools launcher in the owner and Visitor docks provides
  the same shared tools, retaining the current target. Owner Layers also offers
  Artwork info for the selected artwork.
- The ordinary Display toolbar contains composition Lock (owner only) and
  minimize. Layers, Metadata, Play and the Inspect label/counter/arrows are
  absent. Active artwork inspection adds only Return to composition; Escape
  and existing arrow-key artwork navigation remain available.
- The shared Display toolbar is quiet until the pointer approaches its top
  edge or keyboard focus enters it. Touch exposes a Show/Hide controls button.
  Hovering over the artwork alone does not reveal the toolbar.
- Layer rows and Stage placements share one selection model. The list exposes
  the active Grid's render order from front to back; reordering rows changes
  placement z-order. Placement lock, visibility, removal, and other accepted
  row actions remain synchronized with the Stage and obey the composition
  Lock.
- The Layers eye toggle temporarily hides a placement in the editing Stage only.
  Keep its row available to show it again. This is session-local Workbench state:
  it resets on reload, never changes the draft schema or public/private visibility,
  and does not hide the placement from Preview or publication.
- Layers presents its thumbnail list first, in front-to-back order, followed by
  properties for the current selection. Artwork-only controls are absent for
  Text. Composition spacing is a separate collapsible section. Existing scoped
  controller actions remain authoritative; reorganizing controls adds no stored
  content, schema or publication fields.
- The owner Workbench hosts one movable contextual artwork-tools dock,
  independent of the Layers window. Modules supply their own controls and
  actions for the current selection; the host owns no artwork or editing state.
  Display supplies rotate, horizontal/vertical mirror, duplicate, stack order,
  crop. Text selections omit image-only actions. Composition and
  placement locks still apply. Closing Layers leaves these tools available.
  Crop temporarily replaces the dock controls while Layers remains
  a separate list/properties window. Changing target cancels unfinished crop
  input; minimized, suspended and inspecting Displays offer no
  authoring dock. The dock can move by pointer or focused-header arrow keys.
  Its position is session-local; this introduces no saved-content or public
  document fields. Visitor has no authoring dock. Other modules can supply
  their own content through the same module-neutral host when integrated.
- Long metadata scrolls inside the shared bounded window. Shared tool positions
  and selection targets are Workbench view state, never published composition
  state. Visitor Metadata has no authoring actions or Layers window.
- The Display title bar identifies its presentation. The official publishing
  identity is available in the Identity Module header; authored presentation
  names must not be treated as official profile metadata.
- The composition Lock is local, profile-scoped Workbench state. While active,
  it prevents placement, movement, resize, crop, transform, reorder, removal,
  and other authored-geometry mutations without blocking selection or artwork
  inspection. It is never part of the published document.

## Identity and authored personas

Identity can minimize to a movable circular crop of its existing portrait and
background. The same cloud canvas remains mounted and animating, respecting
reduced motion and visibility. Click restores the retained window; the circle's
context menu offers Open Identity, Small/Medium/Large, Circle/Rounded square,
Close and owner-only
Disconnect. Minimizing is disabled during an unsaved edit. The owner's Workbench
context menu opens or restores Identity independently of the dock. Shortcut size,
shape, position and window/minimized/closed state are optional local preferences under `inscape:identity-shortcut:`
plus the profile address, never draft or publication content. Missing preferences
use a medium circle at the upper right and the existing starting open state;
older size/position-only records remain readable without resetting them.
Rounded square uses the shared module corner radius. Visitors use temporary state only.
Close removes the module from view and releases the renderer. Existing publications and
drafts retain their schemas and content.

- The identity strip is trusted publication chrome, not artistic Stage content.
- It is derived from the official Universal Profile identity and authority.
- Authored content cannot replace or impersonate that publication anchor.
- The strip may collapse and remains an overlay rather than reserving layout space. Its state
  never changes Stage geometry.
- A Grid may present any fictional persona, biography, role-play identity,
  text, NFT, image, animation, or later supported primitive. That content is a
  composition, not the publishing identity.
- Do not rebuild official profile metadata as a mandatory conventional profile
  page. Official identity is the anchor; the Stage is the playground.

## Cover, entry, and Discover

- Identity's title bar shows the official avatar and profile name, followed by
  `#` and the first four hexadecimal address characters after `0x`. The full
  address is available on hover/focus, with an explicit copy action and a
  diagonal link to the official Universal Everything profile. This header is
  separate from authored Identity artwork and aliases. The redundant INSCAPE
  IDENTITY caption, self-link, and permanent Library-drop banner are omitted.
  The Display Module title bar shows its existing shortcut/presentation name;
  renaming that shortcut also updates the title, using one name state.
  Copy, source and QR controls use the same muted icon weight. QR sharing
  generates the full address locally, on demand, with a declared dependency;
  it performs no upload, wallet action or publication.
  The large Identity portrait renders SVG media as an isolated document with
  scripts enabled, so artwork can read public events and animate itself.
  The frame has no same-origin, wallet, popup or parent-navigation grant.
  Its URL remains the official LSP3 image URL or the authored Library artwork's
  selected media URL; no local substitution or profile-data rewrite occurs.
  Extensionless URLs use their response media type.
  Raster avatars and unresolved media types retain ordinary image rendering.
  SVG source is fetched with a size limit, validated, and sent to the isolated
  artwork document host. This avoids inheriting a gateway's network prohibition.
  Only the public RPC origins `https://rpc.mainnet.lukso.network` and
  `https://42.rpc.thirdweb.com` are allowed to receive artwork connections.
  External scripts and general network access remain disabled. The host response
  owns this narrow policy; the main application's script policy is unchanged.
  Header and shortcut thumbnails remain images, and minimizing or closing
  Identity removes the executable artwork document.
  The dock's account menu uses the official profile name and avatar as well;
  the authored title and artwork belong to the Identity presentation.
  QR sharing reuses the shared window chrome and opens beside its trigger,
  following that trigger while open and staying within viewport bounds.
  Its scan surface is still and high-contrast, with softly rounded modules.
  It currently encodes the address; switching to a public INSCAPE profile URL
  is deferred until that public destination is settled.

- Identity establishes the approved shared bevel window chrome: a thin edge and inner highlight,
  a one-pixel content gutter, and a filled close control. One module-owned cloud
  renderer spans the body and title bar; the title bar and detail extension
  overlay 65%-opaque surfaces while text and controls remain opaque. Detail
  dividers are internal only and fade over 16px into an 8px outer inset.
  The shared shell owns this opt-in style through `chrome="bevel"` and an explicit
  `menuSurface`. `workbenchWindowChrome.css` owns the edge, overlay, selector and
  raised-control tokens and their light/dark theme values. Controls use the shared
  window-cap class, including the recessed pressed state and keyboard focus.
  Identity owns its content layout, artwork, editor and divider geometry.
  This is the reference for subsequent window migration; other instruments retain
  their existing chrome until migrated and visually verified. The shared window
  accepts the supplied background; shader settings and lifecycle remain owned
  by Identity. Styling choices are not persisted profile data.

- Display adopts the same bevel tokens for its outer frame, title-bar controls,
  inspection controls and independent instrument windows. Opening tools leaves
  Stage dimensions, artwork crop and saved compositions unchanged. Tool windows
  receive the module theme explicitly.
  Owner and Visitor share this treatment, including the two-pixel tab selector,
  reduced grain, thin content boundary and light-theme control shadows.

  The current Display frame experiment removes the title bar's layout space.
  A compact control group overlays the upper-right Stage. The controls use plain
  icons with hover feedback, keyboard focus and an active underline instead of
  raised circles. One shared 65%-opaque backing maintains contrast over light and
  dark artwork;
  the remaining top strip stays draggable and keyboard movable. The Display name
  is available on hover, with a minimize control. Stage aspect ratio
  and authored geometry remain unchanged; older windows retain their saved width
  and position without a data migration. Attached/overlay/detached instrument
  behaviour is retained while the standalone frame is evaluated.
  Display's artwork clip meets the outer one-pixel stroke without an extra
  content gutter; its inner radius is the outer radius minus that stroke.
  Its outer stroke omits inset highlights to avoid bright spots along the
  antialiased corners. Identity and instrument windows retain their bevels.

- Identity starts compact. A centered chevron reveals its INSCAPE extension
  with a selectable 2–5 column detail layout. A section can be marked Wide to
  span two available columns. Sections retain authored order and wrap to fewer
  columns according to the card's width, without shrinking the text. Optional
  `card.columns` and field `wide` settings use the existing Save/Cancel and
  publication path. Older cards without these settings retain two columns and
  their existing final full-width section; no saved content is rewritten on read.
  Identity's extension sits
  below the official profile section. Expansion preserves the window's top
  edge, grows only as needed, and uses contained scrolling at viewport bounds.
  Expand/collapse is temporary window state, including for visitors.
  The upper section keeps the official name, with an optional authored title
  above it. The custom title keeps its original small condensed technical font;
  username typography is unchanged. Tags form a separate, spaced group below
  the biography. Subtitle support is removed from the interface and card data
  model. The local draft loader discards the removed subtitle property from
  drafts written by the previous editor, then validates the remaining data.
  Other content is preserved; the next successful save writes the cleaned draft.
  An authored biography replaces the official bio
  in this artistic presentation when provided; otherwise the official bio is
  used. The official title-bar identity remains unchanged. Visible official
  and additional tags and profile links belong in this upper section.
  Profile links use icons with hover/focus labels and accessible names;
  unknown sites use the shared globe icon. Repeated platforms remain separate
  links, distinguished by those labels.
  The official-avatar fallback is small and uses a plain theme surface.
  Explicitly chosen Library artwork retains the larger artistic presentation.
  Cards without saved background settings retain their existing defaults:
  official avatars use plain, and INSCAPE artwork uses clouds. Choosing
  artwork is not evidence that its image has transparency.
  The chevron overlays the hero directly, without a separate full-width bar.
  One chevron click reveals all nonempty fields directly. There is no second
  category-expansion step or summary row. Existing category strings remain
  intact in saved data but do not add a navigation step to the card.
  An owner-only gear beside Close enables editing directly in the hero and
  field cells, with a + Add cell alongside the existing cells. Save and Cancel
  are in the title bar. Appearance controls remain a secondary inline section.
  Title, biography, tags, artwork,
  background and fields save atomically through the authoring session,
  with stale-write and storage-failure checks. Save and Cancel restore the
  reading view and focus to the gear. Visitors have no edit command.
  Dropping Library artwork enters the same temporary edit session. Its
  keyboard-accessible selector and reset are available inside the editor;
  Save commits the preview and Cancel restores the saved artwork with the rest
  of the card. Artwork participates in the same stale-write checks.
  No redundant artwork or technical-address section appears in reading mode.
  Identity height follows measured content, with no manual height-resize handle.
  Title-bar movement remains available. Long content scrolls within viewport
  bounds. Other instruments retain their existing resizing behavior.
  The cloud pattern is anchored to the card's top edge and width, so expanding
  the card reveals more of the same running shader instead of rescaling it.
  Makers may additionally name, order and remove free information fields with
  text or list content. These use one shared responsive layout, not a second
  canvas editor. Empty fields are omitted from the visible and public card.

- Identity background and free fields use the optional, declarative
  `identityPresentation.card` envelope (version 1), shared by draft-v4 and
  public-v9 validation. Absence remains valid and does not trigger a write or
  change old publication bytes. Explicit Save records the selection even if
  it matches the previous default. Both publication restoration paths retain
  the envelope. New documents containing it require the updated reader;
  older deployed strict readers do not understand this optional extension.
  The host delegates validation to the Identity domain instead of interpreting
  shader behavior. Unsupported types, versions and properties are rejected.
  Background choices are Plain (theme surface) and Clouds, with theme or hex
  cloud color and speed from 0 to 2. Zero is still; reduced motion remains still
  at every setting. Editing previews locally; Save persists and Cancel restores.
  Shader implementation stays in the renderer, never in the document.
  Free fields have stable IDs, labels up to 60 characters, and either text up
  to 2,000 characters or up to 16 list items of 160 characters each. At most 16
  fields are accepted. Publication trims values and omits empty fields/items
  without changing the owner's draft. These are authored descriptions, not
  verified facts or official profile metadata. Visitors receive the published
  settings and fields without authoring commands. No shader marketplace,
  third-party code loading or arbitrary field layout is implemented here.
  Optional field category (60 characters) retains the same envelope.
  Old documents without categories remain valid and are
  not rewritten on read; documents using them need this updated strict reader.
  One cloud canvas spans the hero and extension. The lower reading surface uses
  90% theme-surface opacity while text remains opaque. Renderer resolution stays
  bounded, with a lower cap on narrow screens; this is not a guarantee of mobile
  frame rate. Hidden/offscreen, reduced-motion and disposal behavior still apply.

- Account controls remain available from Profile on the owner's Workbench,
  independently of any authored Identity Module. Explicit Disconnect from the
  owner's Workbench or its Discover panel opens signed-out Discover. Disconnect
  while visiting a public presentation preserves that visitor destination.
- Discover is the shared navigation label for the publication directory.
  An authored Identity Module may present custom biography and fields alongside
  artwork; these are distinct from official Universal Profile metadata and
  account controls. Its implementation and publication format remain to be scoped.
  The Identity Module will replace the existing dossier rather than add a second
  profile presentation. Its window uses the shared rounded module chrome; the
  old dossier's overlay styling is not its visual baseline.
  The replacement opens from Profile as a non-modal, movable window that fits
  its content in owner and visitor views. It reads the existing projected
  identity data; window interaction is session-local and does not write a draft
  or publication. Closing returns focus to Profile. Authored
  shortcuts and starting arrangements, and direct module links remain separate
  work; this replacement does not add a module-instance publication schema.

- Identity content follows the founder's artwork-and-story reference, within
  the shared rounded module window. A module-owned animated cloud shader sits
  behind the portrait; reduced motion renders a still frame. It does not copy
  the old dossier's horizontal menus. Library images can replace the Identity
  portrait without changing official Universal Profile metadata. The existing
  profile-scoped avatar setting retains the asset ID and optional selected
  image resource. Older drafts without that optional resource remain valid.
  Saving uses the existing authoring authority; the module does not publish.
  The existing public avatar asset envelope carries the selected image without
  a new avatar schema. The optional card envelope described above carries
  free fields and background settings; source facts must not stand in for
  invented personal fields.
  The default cloud palette responds to the existing light/dark surface tokens.
  Creator-authored shader aesthetics are also an accepted future direction:
  visual styles and animated materials may be authored and monetized as part
  of the founder's creative offering. Theme adaptation is a default, not a
  requirement that all artistic shaders look alike. Shader behavior belongs
  to the module, not the Workbench host. Third-party packaging, paid access,
  and execution of third-party shader code remain unspecified and unimplemented.

- The INSCAPE Founder designation is product-owned, separate from authored
  roles and official LSP3 metadata. It is assigned to residentzero's mainnet
  profile `0x001048331cd14cef40dd5da644a738e7324fe691`. The Identity projection
  shows it only for that address with a resolved mainnet chain fact. Editing a
  title, biography or field cannot grant it; it is not serialized in
  the creator-authored card. It grants no wallet or authoring authority.

- Desktop profile links enter the reception through Startveil. On 2026-10-10
  the founder clarified that its bento is another host for the same modules as
  canvas. Display Grids remain scenes inside their Display; they are never
  independent reception cards or pages in a combined Workbench reader.
  The first implementation reuses one public Display session in both hosts,
  including authored Stage proportions, placed Text/artwork, swipe motion,
  autoplay/pause, keyboard navigation, metadata and artwork inspection. Canvas
  retains its window/camera/lift host. The bento provides a bounded Stage and
  compact controls using the creation toolbar's tactile material. Controls
  overlay the lower edge inside the Display surface and reserve no gap below
  it. The reception omits an app-wide navigation header, editorial
  heading and footer. Image cards show the artwork without a type/title
  caption bar; their accessible names and in-stage opening remain available.
  On 2026-10-11 the founder replaced the tall About tile and wrapping overview
  with one centred, bounded frame on the existing ash surround. A compact
  nameplate, shared Identity address/copy/QR controls and Canvas link sit above
  it. The nameplate is presentation; routes remain address-based. The upper
  portion reuses the canvas Identity card body, including its authored portrait,
  background shader, official name, authored introduction, links and fields.
  Its window, shortcut and authoring controls remain with the canvas host.
  The lower portion is a horizontally draggable artwork carousel. Portraits
  occupy tall cells and landscape previews occupy stacked cells; complete live
  Displays and linked Text remain modules, after the independent Images.
  More artwork expands upward over the profile; More info reveals the existing
  Identity fields downward into the strip's space. These modes are exclusive,
  preserve the outer frame, and leave module sessions mounted. Covered content
  is inert. Mouse dragging coasts using the existing bounded velocity/decay;
  touch uses native scrolling. Buttons and arrow keys provide equivalent access.
  Dragging suppresses accidental inspection, respects Display scene gestures,
  and cancels on interruption, closure or disposal. Reduced motion skips coasting
  and section transitions. Expansion, scrolling and side selection are temporary.
  On 2026-10-11 the founder additionally requested a larger card, compact
  chevron controls with hover descriptions, a grounded portrait and naturally
  sized profile fields without a visible inner scrollbar. The artwork sheet
  slides across the complete inner card over 460 ms; its cells and artwork
  retain their final dimensions throughout. The shader remains behind a
  translucent, blurred sheet backing; the artwork itself stays sharp. This is
  an explicit reception-only exception to the no-backdrop-filter chrome rule.
  Preserve retained SVG Lift stacking and the card's fixed outer clip.
  The verified owner can explicitly enter Edit reception to choose/reorder
  public modules and frame each Image side independently for this surface.
  These edits use the existing profile draft store and undo history. Optional
  `reception: { version: 1, items: [...] }` stores ordered public module IDs;
  optional Image-side `receptionCrop` uses the existing normalized crop shape.
  Missing fields preserve older documents' automatic selection and full-image
  previews. An explicit empty selection stays empty. Publication filters stale
  or private module IDs; no artwork assets are copied. Canvas crops, original
  media and orientation remain authoritative and unchanged. Explicit links to
  other public modules still work regardless of reception selection.
  Scene-linked standalone Text shares the canvas reading surface and follows
  the connected Display's live motion, including page-break sections and
  per-Grid passages. Display remains the sole navigation authority; Text never
  writes playback state. Write/Read changes retain the editor session. Further
  composition authoring and layout customization are later work.
  Image/article readers are scoped to their selected module.
  The complete reception bento is one persistent, bounded presentation stage.
  The current resting composition determines its responsive outer rectangle.
  Image and independent Text cards expand from their own position in a layer
  inside that rectangle and close back into the same card. Opening, closing
  and their animation never move or grow the stage or surrounding page.
  The underlying module sessions stay mounted; unrelated card navigation does
  not reset Display or its scene-linked Text. Expanded images initially reveal
  the full source, with authored orientation retained and a temporary contain
  fit after reserving controls, padding and a separately scrolling detail panel.
  Solo Image inspection uses the same readiness-gated 460 ms artwork Lift and
  return curve as the canvas. Only artwork travels; the bounded viewer, toolbar
  and metadata retain their layout. The card and inspector share the retained
  SVG document and temporary side selection. Interrupted opening returns from
  the current pose, and reduced motion completes without animation.
  This does not change a saved crop or allow scrolling into another module.
  Later complete compositions will share the same stage, with full-size layers
  revealed by clipping. Composition authoring, transitions between arrangements,
  module-wide Display expansion and any GSAP migration are separate work.
  The ordinary reception reads only the verified publication, with no draft or
  inventory reads. The explicit owner editor is loaded on demand, reads only
  that owner's draft, labels its preview as Draft and saves crops/selection
  locally. Visitors receive them through the existing explicit Workbench
  publication action; opening or leaving reception never publishes. Display
  media retains a bounded scene neighborhood, and offscreen
  autoplay pauses its work. A profile URL retains its view address; canvas=1
  enters the canvas. Module/grid targets resolve against published content and
  select the actual Display scene in either host. Missing targets recover to
  the overview with an explanation. Back/Forward and Profile overview retain
  explicit destinations. reception=1 explicitly requests the public view even
  for a connected owner; it grants no authority or draft access. The owner's
  Profile menu offers View my reception through this explicit route, keeping
  the wallet connected. Back to my Workbench returns the verified owner from
  their reception or public canvas to editing; it is also available when that
  publication is loading, missing or unavailable. These actions read the
  publication without editing or publishing the private draft. The phone
  entrance remains unchanged by this desktop reception pass.
  Direct canvas links enter their destination without an extra Enter button. The bare INSCAPE URL retains the public
  Explore/Connect entrance. Its featured world is explicitly selected as
  `0xf3C189819Fd5b042f692983bFbFD57ab607ee709`, independent of directory ordering.
- Startveil remains visible until the destination interface or its recovery
  surface has mounted. A short reveal then hands over interaction and keyboard
  focus. Optional artwork media loads progressively; boot or resident timers
  must not stand in for destination readiness. Returning visits shorten the
  reveal and reduced-motion entry skips it.

- A **Cover Grid** is an existing public Grid selected as the source of the
  Discover snapshot.
- An **Entry Grid** is an existing public Grid selected as the first interactive
  scene in the current Display Module presentation. This does not require every
  future public Workbench visit to open a Display Module automatically.
- Cover and Entry default to the same Grid but may be selected independently.
- Private Grids cannot be Cover or Entry. A public snapshot must never leak a
  private Grid.
- Generate the cover snapshot from the canonical Stage at publication time and
  bind it to that publication revision. Draft edits must not silently change a
  published Discover card.
- Discover renders the lightweight snapshot plus trusted identity chrome. It
  does not mount many live owner renderers.
- Opening a world visually expands the card while the published document loads.
  The snapshot is the poster/loading state; the interactive renderer replaces
  it in the same bounded presentation area when ready.

The entry and card transition above retain the existing presentation baseline.
Discover's eventual presentation of published Workbenches is not yet designed.
Do not infer a final Discover layout from the current screen. The desktop
overview and direct canvas/module/Grid entry behavior are specified above;
the initial overview does not introduce a saved curation or layout schema.

## Editing, public inspection, and publication

- After a successful publication receipt and matching public read-back, show a
  clear confirmation with links to the public reception and transaction. This
  temporary application-session notice survives the owner's profile refresh
  until dismissed, and clears when leaving that owner's context. Upload-only,
  pending, failed or unmatched transactions must not display publication success.
- On 19 October 2026 the founder explicitly chose publication upload access for
  everyone with a valid Universal Profile, within the service's upload limits.
  No invitation or operator-maintained profile list is required. The server
  checks mainnet profile interfaces and a fresh, document-bound profile signature
  before reserving per-profile and site-wide quotas. These are account/authority
  checks, not proof of a unique person. Hosted secrets and service availability
  remain operational prerequisites. Upload authorization and the later on-chain
  Publish action stay separate; browsing and preparing do not request signatures.
- On 30 October 2026 the founder requested publication from the development
  editor as well as deployed editors, without changing origin and losing access
  to the current local draft. Loopback Vite pages use the existing hosted preview
  upload service; deployed builds continue to use their own publication function.
  The function permits exact localhost/127.0.0.1/IPv6-loopback origins through
  a bounded CORS policy. Permits and signatures remain bound to the originating
  page, profile and snapshot; wallet checks, canonical bytes, quotas, CID
  verification and explicit on-chain confirmation remain required. Credentials
  stay on the service. This does not synchronize localStorage between origins.
  Publication reconciles overlapping current-canvas and reference-reader asset
  inventories by canonical identity before strict document validation, so using
  the same NFT across canvases does not create a duplicate-record blocker.
- The Library retains one canonical record and initially one cover tile per token.
  Its circular image-count button expands or folds that NFT's supported attached
  images directly in the browsing grid, labelled with their source NFT. Each NFT
  expands independently, so standalone poses can remain visible while a layered
  character stays folded. Folded attachments are not mounted or loaded by the grid.
  Expansion is temporary profile-scoped browsing state, retained across filters
  and closing the Library, and reset on reload or profile change. Resolution variants
  of one image remain one choice. Choosing an image does not create a new token
  identity or change Library category membership. Navigation counts count source
  records, not their image tiles. Library category drops remain available during asset drags;
  the Library fades and lets asset drops reach Displays behind its content area,
  while its category sidebar remains a drop target. Metadata refresh must keep cover URLs and image
  choices consistent without changing holding or creator authority.
- An image chosen for placement belongs to that placement. Preserve its resource
  and dimensions through draft persistence, Preview, and public projection,
  alongside the original token identity and provenance. Different placements
  of the same token may use different images.
  Library attachment discovery accepts a .svg resource path declared as
  application/xml or text/xml, including charset parameters. It retains the
  original URL and declared type; unrelated XML documents remain excluded.
  Existing cached records refresh through the ordinary metadata loader without
  a storage-key change or a draft rewrite. Resolution variants remain one image;
  accepted attachments have no separate per-token count cap.
  Library thumbnails accept SVG attachments served with a generic XML media
  type: after an image decode failure, a bounded fetch validates the SVG and
  creates an inert image preview with the correct media type. Preview object
  URLs are temporary and revoked on disposal; placement retains the original
  resource URL. Library thumbnails do not execute artwork scripts.
- Owner editing and public inspection must not silently replace or rearrange
  the application dock.
- The earlier Display-led aspiration to replace full-application Preview is
  an experimental direction, not current behavior. Existing Preview remains
  authoritative. Any future in-place public-inspection replacement requires
  its own accepted scope and verification of private-content exclusion.
- Keep public/private projection explicit. Only public canonical content may
  enter a publication document or snapshot.
- The current canonical v9 document, profile-scoped private draft, external
  wallet authority, IPFS validation, and visitor recovery boundaries remain in
  force until an explicit, tested migration replaces them.

## Visual language

For Reception, overview, composition presentation and global navigation, follow
the current focus and presentation scope above. A new overall visual example is
pending. Preserve the existing surfaces until a scoped replacement is accepted;
the rules below govern composition tools and shared controls.

The implementation reference is [INSCAPE design system](design-system/README.md).
It maps these accepted decisions to the existing production tokens, components,
patterns and checks. It is derived guidance; this contract remains the sole
product-direction authority. The local reference opens at `/design-system.html`.

Module selection outlines and resize marks follow explicit activation by click
or keyboard focus, never pointer hover. Selecting another module clears the
previous module's activation outline; empty Workbench space clears activation.
Image, Text and Shape share this behavior. Unselected resize targets cannot
intercept pointer input; keyboard access remains available. Module action strips
keep their existing reveal behavior, separate from selection bounds.
Image, Text, Shape and tool-window resize targets surround the visible corner
or midpoint, so grabbing that mark always starts the corresponding resize.
Display window corner targets also straddle their real corners and retain a
28-screen-pixel hit area through camera zoom. Workbench group
and Display artwork handles retain their centred geometry. Keyboard focus fills
the small handle mark; the larger transparent hit target never gains an outline.
Image, Text, Shape and tool-window handle marks align their painted origins to
physical pixels independently of the hit target and authored frame. This avoids
half-pixel midpoint marks at odd canvas sizes without changing saved geometry.

Selected artwork uses 28-pixel resize targets with contrasting corner marks.
Single selections also have midpoint handles: left/right changes width only;
top/bottom changes height only. Corners retain Shift-proportional dragging.
Layers Selection exposes Width and Height in canvas units (1–512, quantized to
ninths); Enter or leaving the field commits one undoable resize, anchored at the
top left. Invalid sizes do not change saved work. Text resizing reflows its content.
For artwork, side handles and numeric sizes enable free scaling of the media,
including its transparent margins and existing crop. Optional placement
`mediaFrameRatio` retains the original fitting-frame ratio; omission preserves
existing draft-v4/public-v9 rendering without rewriting old data. The field
travels through publication, restoration and duplication; it is placement data,
not a change to the source asset or metadata. Owner and public renderers share
the same fitting calculation. Fit/Cover restore native proportions by clearing
this optional reference; Centre retains it. Group selections retain corner handles.
Targets stay inside the visible Display, including artwork extending beyond it;
their offset from the authored corner is retained by the drag gesture. While
selection handles are visible, window corner targets yield pointer interaction;
Escape clears selection to resize the window. Shift preserves proportions for
single and grouped resizing; Alt uses the existing ninth-cell precision.
Layers offers Fit inside Display, Cover Display and Centre for one unlocked
artwork. Fit/Cover use source proportions (including quarter-turn orientation),
centre the placement, and retain crop, source and other content settings. These
are single undoable geometry edits, with no new saved layout constraint or schema.

Display and Text own optional authored `appearance.edges`: four corner radii in
clockwise order from top left (0–64 pixels), a shadow switch, and grain strength
(0–1). Display also accepts optional `appearance.frame`; Text retains its existing
frame setting. Omitted fields preserve existing appearance without a data rewrite.
Square adjoining corners and rounded outer corners allow modules to read together.
Grain is optional and independent of interface noise and texture in source artwork.
These settings survive publication, restore and Text transfer into Display.

Display background and Grid controls live in the targeted Display's Appearance
window, and beside dimensions in the Custom size creation/editing form. The form
saves size and appearance together as one undoable operation; Cancel changes
nothing. Display-specific controls no longer live in general Workbench Settings.
Background accepts the existing surface presets or a custom six-digit hex colour.
Snap to grid and Show grid are independent checkboxes. Hiding a Grid retains its
Lines/Dots style and spacing; disabling snapping uses the existing ninth-unit
placement precision without changing the visible lattice or moving content.
These settings apply to all scenes of that Display and do not change Workbench
background, snapping or guides. Optional Display appearance fields are
`backgroundColor` (hex or null for the surface preset), `guideVisible` and
`snapToGrid`. Existing draft-v4/public-v9 documents without these fields keep
their original surface, guideMode visibility and enabled snapping, with no data
rewrite. Existing `guideMode: NONE` stays hidden until Show grid is enabled.
New settings survive save, undo, reload, public projection and restore; readers
must support these optional fields to open newly authored documents using them.

Workbench owns module-edge snapping and the local gap preference (0–128 pixels).
While moving or resizing, temporary guides identify the applied module edge,
visible Workbench grid line, or spacing bracket. Flush joins highlight their seam.
Guides reflect the final bounded window, disappear when the interaction ends,
and never enter saved layouts or publication. Module edges capture within 10
screen pixels and retain their target until pulled beyond 18 screen pixels;
Alt immediately releases snapping and its guides. Grid guides use the visible
Workbench lattice (24 work pixels by default, editable from 8–512 in Settings)
projected through camera pan and zoom, including
when a module is temporarily scaled.
Settings calls the existing gap preference “Space between modules” and shows
a two-window spacing preview. Existing preference keys and values are retained.
An enabled local patch takes priority under the moving top-left anchor, or
resizing corner. The frontmost patch wins overlaps; a small boundary hysteresis
prevents flicker. Selected patches cannot snap their own moving selection.
Outside patches, nearby module edges can take priority over the global grid;
their capture distance is capped relative to projected cell size at low zoom. Zero gap permits flush joins. Alt bypasses both kinds of snapping;
The independent Workbench editing bounds still win. Display resize retains its ratio and opposite corner.
Only open content windows participate; instruments, shortcuts, enlarged inspection
windows and other Workbenches are excluded. Changing preferences does not rearrange
windows. Publication captures the resulting layout through its existing flow;
snapping preferences remain local and Visitor movement remains temporary.

Workbench Grid snapping uses the active patch or configured global spacing
through the shared movement and resize host, including owner content windows
and Display shortcuts. A highlighted patch identifies the active local lattice.
Workbench selection, movement and group-resize gestures capture their pointer
on the host and release it on completion. Lost capture, blur or a hidden document
cancels temporary state. Input showing that the mouse has already been released
clears a stale gesture instead of leaving pan and zoom blocked. This lifecycle
belongs to the Workbench and does not change authored module content.
Alt bypasses window snapping temporarily; focused window headers support arrow
keys. The independent Workbench editing limits take priority at their outer edges. The existing profile-local
`shortcutSnap` preference remains the storage owner, now labelled Grid snapping;
older values retain their meaning for shortcuts and also control these windows.
Toggling snapping or changing guide visibility does not rearrange existing
windows. Text snaps its moving edges. Display projects pointer movement onto its
fixed Stage ratio, retaining the opposite corner. Outside local patches, an eligible module edge on either axis
takes priority over the horizontal global-grid candidate; the other dimension
follows the ratio. Artwork placement inside Display retains its own rules.
Visitor window movement remains free and does not acquire owner preferences.

INSCAPE is technical, spatial, and deliberately bounded. Its accepted tactile
interface reference below guides new chrome work; artwork remains the focus.

### Simplified toolbar direction (2026-10-14)

The founder requested a smaller, flatter toolbar with rectangular buttons and
a clear selected control, replacing the raised/recessed visual emphasis. Buttons
use 5 px corner radii; the surrounding bar uses 9 px (5 px plus its 4 px inset),
derived from the same preview tokens at wide and narrow widths. Popup fields
and menu rows also use 5 px radii inside 9 px containers. Their 1 px border plus
3 px padding matches the toolbar's 4 px inset. Carbon
and Mist are the two theme directions. The founder corrected the reference on
2026-10-15: Carbon previews dark controls and Mist light controls, including
Library and text menus. Interface Lucide icons use one 1.5-screen-pixel stroke,
independent of glyph size; navigation icons share an 18 px size. Artwork SVG
strokes remain authored content. In the design-system reference, the active creation tool uses an
inverted fill; open panels use a softer fill with a small state mark. Neutral
accents replace orange throughout the reference, and search focus uses a quiet
neutral border, retaining a system-colour focus outline in forced colours. Reference
popups omit redundant title and close rows: Shapes and Add start with choices,
and Actions uses a full-width search field without a divider. Nested levels
retain a Back row; the popup retains its accessible name, trigger-toggle,
outside dismissal, Escape and focus return. This minimal presentation is enabled
in Overview and Components. Add belongs inside the same toolbar with matching
spacing. Both sections reuse the real toolbar and one scoped preview recipe.
Foundations documents the refined geometry and neutral focus; Build with it owns
the design principles. The overview contains the toolbar, theme choices and a
short preview caption. Components keeps retained production windows collapsed
as migration references. The review follow-up makes selected labels expand for
enlarged text, strengthens Mist supporting text in the reference, and separates
Agreed, Needs review and In the app labels. A flat Properties shell and a
two-theme button state sheet are proposals for review, not accepted production
migrations. Properties reuses the existing shell and native controls, with local
example values, close/reopen focus return and field validation. The founder subsequently requested complete Properties coverage: Image, Display artwork and Shape retain their existing controls in separate reference specimens, including crop, selection/grouping, locked/empty states, Grid and retained Texture. Reference adapters reuse shared controls and compare their inventories against running production fixtures; they do not replace module editing or saving logic. Production controls, theme selectors and stored surface IDs retain their
current behavior pending review and migration. The founder's Properties review
removes the redundant visible Fit label and permanent borders around action-row
icons. Solid selected Fit/Inspect choices have no underline; native fields use
neutral, centered dropdowns and finer number-stepper chevrons. Grain uses a compact
row with a shorter slider, preserving usable input targets. These refinements
remain scoped to the reference. The tactile description below
documents that existing implementation, not the requested future toolbar style.

### First production styling migration (2026-10-16)

The founder authorized a controlled migration beginning with the creation toolbar
and its Shapes, Actions and Add menus. This supersedes the older creation-bar
geometry and tactile treatment below for this component only. The application
and reference now use the same WorkbenchToolbar markup and workbenchToolbar.css:
36 px desktop targets, 44 px narrow/coarse targets, 5 px keys, a 4 px inset and
9 px shells. Persistent tools use an inverted fill and an expanding desktop label;
open panels use a softer fill and state mark. The menus are headerless with a
full-width search and a keyboard-accessible Back row for nested choices.

workflowFlat.css provides the shared flat material through explicit
data-workflow-finish="flat" opt-in. inscapeTokens.css owns its geometry and icon
values; referenceTokens.css aliases them. Carbon is dark, Mist is light, and
older light surface IDs retain light chrome without changing saved values.
Icons use a 1.5 px non-scaling stroke. Existing tool commands, owner adapters,
keyboard shortcuts, creation behavior, saved preferences and data boundaries
remain authoritative. Workbench retains its dock-relative positioning and
measured camera/menu clearance. The reference owns only its demonstration
placement and bounded popup height. Other production instruments remain on
their existing treatment until separately migrated.

### Camera styling migration (2026-10-16)

The next scoped migration applies the approved flat material to the shared
Workbench camera rail and its owner-only canvas-size popover. Owner and Visitor
reuse the same component and existing navigation handlers. Carbon/Mist, 5 px
controls, 9 px shells, 36/44 px targets and 1.5 px interface strokes reuse the
foundation tokens and workflowFlat.css. The two rails align at their lower edge
on wide screens; measured wrapping and companion-window clearance remain live.
Groups/Index windows, the app dock and artwork resize handles retain their owners.

The canvas popover uses the existing measured toolViewportBottom to bound its
height above the rail, with native internal scrolling on short screens. This
fixes its prior off-screen overflow without introducing another measurement
observer, camera state, saved field or navigation implementation. Canvas resize
and Fit remain explicit owner actions; styling does not execute those actions.

### Context action-bar migration (2026-10-16)

The owner Workbench hosts two compact flat rows above the creation toolbar:
inspection/placement first, then selection actions. Display supplies its existing
In place/Lift and Fit/Cover/Centre controls; Image supplies Fit inside/Fill canvas;
Shape supplies only its existing selection actions. Crop temporarily replaces
the inspection row with its existing controls and hides the selection row.

ContextToolbarProvider still chooses the active module. Each module supplies
its controls through ContextToolContent portals and retains its callbacks,
validation, save/undo and access boundaries. Properties retains dimensions and
module fields; the old action grids are removed from that window. Text retains
its separate inspector. No action, storage field or persistence owner is added.

Production and workspace reference use contextToolbar.css for row geometry,
foundation tokens and workflowFlat.css for material. The existing toolbar
measurement now covers the full stack. Rows scroll horizontally when needed;
arrow keys and Home/End reveal enabled controls without intercepting sliders.
On short viewports the stack uses the existing zero-offset position so camera
controls stay on screen. The rest of Properties, dock and camera commands are
outside this component migration.

### Navigator and Keeper screen utilities (2026-10-23)

The founder approved the Navigator/minimap implementation beside Keeper.
Navigator starts to Keeper's left at lower right, above the measured bottom
controls. Each remains an independently movable screen window; camera travel
never moves them. Their positions survive Workbench switches within the current
profile editor session; the Library and editor-preferences refinement below now retains them across reloads. Width and available height adapt to
small screens, with internal scrolling on very low viewports. Keeper settings
open above the pair or beside them where space permits.

Navigator uses the reference Carbon/Mist flat window and contains only a
composition minimap, Home and a 25–200% zoom slider with percentage. These replace
the former bottom Home/zoom controls. Back, Focus, canvas and group commands stay
in the bottom rail. Home returns to the origin at 100%. Zoom anchors to the
current usable view centre. The existing camera controller owns these actions,
inspection locks and navigation history; Navigator owns no second camera.

The viewport frame drags live without jumping when grabbed inside. Clicking
outside centres there. Arrow keys pan; Escape, capture loss and focus loss
cancel a drag and restore its starting camera. Pointer focus has no extra ring;
keyboard focus remains visible. The map includes the canvas, current view and
visible outside artwork, and holds its projection fixed during a drag.

Modules expose read-only miniature inputs from their existing live state.
Image sides/crop, Display placements, Shape appearance, article content, frames,
layer order and editor visibility feed the projection. Miniatures never mount
an editor, interactive SVG runtime or mini-app. Unsupported/missing media retain
a frame. Keeper and tools are not composition objects. Camera painting updates
the projection and viewport frame without reconstructing the media tree. The
reference and app share Navigator controls and pointer/keyboard logic.

This adds no persisted document fields or migrations. Sidebar, camera index and
exploration-world development remain outside this change. The local verification
and its limits are recorded in [Navigator evidence](audits/2026-10-23/navigator.md).

### Workspace sidebar migration (2026-10-23)

**Founder sidebar refinement (2026-10-24):** the supplied screenshot supersedes
the initial wordmark-as-navigation interpretation. A compact header contains the
supplied Inscape wordmark and circular logo; the logo is the collapse/expand
button, replacing the bottom toggle. The supplied wordmark is converted to SVG
outlines using its original font. Workbench, Grids, Activity and Library form the
main list; Discover, Preview and Publish follow directly below a divider. Remove
the old identity card and Workspace, Artwork, Explore and Share headings. The
sidebar fits its content instead of stretching to a fixed height or pushing the
footer down; overflow remains bounded and scrollable. Utility actions and the
Library category host retain their existing behavior. Application and design
reference share this presentation.

The founder approved continuing with the design-system sidebar after Navigator.
The owner workspace now uses the reference's flat Carbon/Mist sidebar in place
of the old bottom application bar. Workbench, Display-scoped Grids, Library,
Discover, Activity, Preview, Publish, Profile, Docs and Settings call their
existing actions. This adds no destination or publication authority. Creation
tools and the Workbench selector remain independent.

Reference and application share the navigation presentation. The sidebar folds
and hosts the existing Library category tree when
expanded on desktop. Collapsed and narrow layouts return that same tree to
Library. Browsing state is still owned by Library. Collapse state follows local
Workbench changes and, under the editor-preferences refinement below, reloads. The existing
hide/show preference remains available through the Workbench context menu.

The founder subsequently removed Filter navigation as unnecessary for this
short menu. Neither the application nor the reference filters navigation labels.
Library retains its separate artwork search.

On narrow screens the folded navigation becomes a horizontally scrollable icon
strip. At phone width and low height it becomes one reopen button beside the
Workbench selector. Destination panels, floating tools and Keeper settings
respect the available screen area. An explicitly opened destination appears
above editing utilities; the sidebar remains reachable. None of these changes
move authored objects or change the camera. During artwork inspection both the
sidebar and Workbench selector yield to the existing inspection lock, leaving
the return button reachable. Hidden owner preview also hides the sidebar.
The sidebar retains its hidden presentation during Preview/inspection so closing
Preview can restore the same navigation trigger; hidden navigation is excluded
from accessibility and does not reserve tool space. Embedded Discover and
screen-space companion windows respect the existing sidebar clearance. Phone
Discover search uses its own row. See [panel regression verification](audits/2026-10-23/panel-regressions.md).

No document fields, migrations, dependency additions, camera-index or
exploration-world features are introduced. Library's wider panel styling and
the existing destination windows are not redesigned by this migration.
See [sidebar verification](audits/2026-10-23/sidebar.md) for local evidence and
remaining verification limits.

### Artwork info joins the shared tool dock (2026-10-23)

The founder requested restoring access to artwork metadata and adding it to
the shared tabs, with the option to detach it. **Implemented locally:** Info
joins Layers, Transform, Color, Image, Shape and FX. It uses the same flat
Carbon/Mist shell, invisible resize targets, detachable/stackable panes and
profile-local dock layout (persistence refined below). This supersedes the older independent owner Metadata
window described above. Visitor keeps its independent read-only metadata host.

Artwork info in the toolbar and the existing Display Metadata command open the
same Info tab. The dock alone owns owner visibility and geometry; modules keep
the existing content registration and explicit active target. Image now supplies
the canonical source facts for its visible side, even when the source image
cannot load. Side changes update the content. Shape, multi-selection and empty
Workbench states show a selection hint rather than stale Image information.
Display continues to supply its selected artwork through its existing controller.

The reference and app share the metadata presentation: artwork title, collection,
description, creators, attributes and expandable Source details. Unknown facts
remain unknown; creator source/scope stays distinct from holding or authority.
Reading metadata, docking and navigating sides do not author data or add Undo
history. No new document fields, migrations, publication or wallet actions are
introduced. On cramped screens an active dock is above Navigator/Keeper and
scrolls within the available area; closing it restores access to those utilities.
Explicit toolbar menus appear above the sidebar and floating tools.

See [Info verification](audits/2026-10-23/artwork-info.md) for local evidence.

### Library and editor preferences (2026-10-23)

The founder approved the Library migration and explicitly requested retaining
Library settings and the arrangement of tool tabs/windows after leaving or
restarting. This supersedes earlier session-only limits for these preferences.

**Accepted behavior.** Library and the reference share flat Carbon/Mist card,
rail, search, filter and sort styling. Existing asset sources, relationships,
category operations, drag targets and module-owned interpretation remain intact.
Controls remain reachable below navigation on narrow and low screens.

A single profile-local editor-preferences store, separate from authored documents
and per-composition geometry, automatically retains Library search, collection
filter, relationship/category view, sorting, thumbnail size, label visibility,
sidebar width, panel width and collapsed category sections. It retains the full
shared-dock arrangement (groups, pane order, active tabs, proportions, hidden
tabs and window frames), independent Text frame/open state/section, Navigator
and Keeper dock positions, and explicit sidebar folding. Workbenches in that
profile share these preferences. Reload restores them; a smaller viewport clamps
rendered windows to reachable bounds. A restored dock is not automatically
raised above Navigator/Keeper until explicitly activated.

Storage is local to the browser and profile, not wallet/cloud synchronization.
The reference remains disposable. Selection, Undo, camera state, transient
attachment expansion and dialogs are not added to these preferences. Keeper
settings still use their existing automatic placement; Display appearance and
other destination windows retain their existing owners.

Writes are briefly batched and flushed before the originating editor releases
its lease, on immediate unmount and on normal reload. Invalid stored records
are retained, failed writes are shown with an explicit retry, and an external
change cannot be silently overwritten. This introduces no authored document
fields, migration, publication or additional dependency. Earlier per-composition
Text-tool visibility restoration is removed in favour of this one preference.
See [Library and preference verification](audits/2026-10-23/library-preferences.md).

**Library curation refinement (2026-10-29):** The founder chose an explicit
opening category. **Open Library here** in a category's menu stores that choice
in the existing profile-local editor preferences. Reopening or reloading starts
there with hiding search and relationship filters cleared; deleting the chosen
category falls back to All. Without a chosen category, existing browsing
preferences apply. Known category references load independently of the full
inventory. Owned, Created and collection browsing advances in requested pages;
visible and selected tokens drive bounded metadata work. Partial inventory
counts, search and sorting describe loaded assets. Choosing an individual image
for a category, through its context menu or by dragging, retains that image's
URL alongside the source asset ID. The category shows only the chosen images;
multiple images from one source remain independently removable. This local
organization does not rewrite token metadata, creator attribution or ownership.
An existing whole-asset entry can be narrowed by adding the desired image;
the earlier discarded image choice cannot be reconstructed. See
[implementation and behavioral evidence](audits/2026-10-29/library-demand/README.md).

### Settings and keyboard selection finishing (2026-10-23)

**Accepted behavior.** Settings uses the shared flat Carbon/Mist material,
titlebar, close control and field geometry. Its existing Activity, Workbench,
Interface and backup sections scroll below a fixed titlebar, within the sidebar's
reserved screen area. It remains a sidebar destination. This does not introduce
new settings or move it into the shared dock. Signal preferences, local Workbench
preferences, authored interface appearance and backup/recovery retain their
existing owners and storage boundaries. Shared selector popups choose available
space above or below their trigger and close if their origin scrolls or resizes.

**Workbench preference recovery (2026-10-24):** local grid, snapping, module gap,
chrome, lock, sidebar visibility and background preferences now report failed
reads/writes. Current choices remain active during a write failure and across
composition switches in the same profile. Explicitly saving the current preferences
retries persistence; unreadable or externally changed records are retained until
that explicit action. The two existing preference owners share persistence mechanics
while retaining their keys, formats and separate contents. Preference and layout
recovery actions share one notice container so simultaneous errors do not cover
each other's buttons. Composition documents, publication and ordinary UI styling
remain unchanged by this refinement.

Ordinary artwork focus retains module outline activation. Explicit Shift+Enter
selection keeps that first artwork and then toggles membership; visiting another
candidate with keyboard focus no longer replaces the explicit group. No new
selection state or history is introduced. Closing a dock tab preserves a newer
focus choice outside that dock, including during inspection.
See [Settings finishing verification](audits/2026-10-23/settings-finishing.md).

### Activity window finishing (2026-10-23)

**Accepted behavior.** recent Activity and full history
use the shared flat Carbon/Mist panel material and titlebar. Filters sit above a
bounded scrolling list; history search and the bottom actions stay reachable.
The recent view retains its five-event limit and category filters. Full history
retains search, Unread/category filters, mark-all-read and refresh. Closing history
or pressing Escape returns to recent Activity; closing again returns to the
sidebar trigger. Keyboard opening focuses search; pointer opening adds no
automatic input focus ring. A newer focus choice survives returning from history.

The signal store remains the sole owner of event data and persisted read state.
The old history action labelled "Open" only marked an event as read; it is now
labelled "Mark as read". Read events show a check and "Read". Unread events retain
a narrow edge mark. No event-detail destination, wallet action or new data source
is introduced. Loading, partial data, empty/filter-empty, refresh failure and
failed local writes remain distinct; refresh retains existing rows. No authored
document, camera or Undo state is changed by these Activity operations.
See [Activity finishing verification](audits/2026-10-23/activity-finishing.md).

### Discover finishing (2026-10-23)

Discover now uses the shared flat Carbon/Mist material, thin edges, control
radii and typography. The owner panel receives the existing editor theme;
standalone public entry defaults to Mist. The shared portal retains its
wordmark return, search, published cards, bounded result batches and account
actions. Narrow screens give search its own row. Cards keep their full
preview and identity strip while results scroll beneath the stationary header
and pagination. Search uses a quiet focus border; keyboard controls and forced
colors retain visible focus. Escape closes an open account menu first.

The discovery controller, publication resolver and application navigation remain
the data and route owners. No saved document fields, preferences or publication
behavior are added. The existing canonical cover renderer remains in use;
unused noncanonical fitting observers and their styling have been removed.
This migrates the current directory chrome, not the future presentation of
multiple published Workbenches. See [implementation and checks](audits/2026-10-23/discover-finishing.md).

### Remaining Workbench window finishing (2026-10-23)

The founder authorized continuing through the remaining existing window chrome
without stopping after each surface. Publish, its confirmed result, Docs, Profile
and the retained Grids panel share `WorkbenchDestinationPanel`, the existing
flat Carbon/Mist material and titlebar/control tokens. Content scrolls inside the
window; Publish keeps its action below the scroll area. The owner host supplies
its existing sidebar clearance. The confirmation retains the originating theme
through the owner refresh; it is still shown only after confirmed publication.

Groups and Index retain their existing movable `WorkbenchWindow` and domain
controllers with flat chrome, fields and invisible Index resize targets. Opening
these tools keeps them above floating utilities. Their explicit screen boundary
allows useful content height on short screens; authored camera anchoring, group
geometry and destination semantics are unchanged. Docs describes the current
Image/Text/Shape workflow, shared tools and local preference saving.

No new document fields, migration, wallet action or publication route is added.
The redundant older panel styles are removed. Focus writing and authored Identity,
Reception and world presentations are outside this finishing round. Evidence:
[window finishing](audits/2026-10-23/remaining-window-finishing.md).

### Shared creative workspace direction (2026-10-14)

**Status updated 2026-10-19.** The founder selected this existing workspace
reference as the intended design for the next composition workflow, including
shared dockable/hideable tools. The [new clarification](#workbench-composition-direction-2026-10-19)
adds Workbench artwork layering and Layers removal. The dated details below
retain reference behavior and limits; they do not claim a completed migration.

The founder requested an Affinity-familiar organization in the design-system
preview: one compact panel with Color, Layers, Shape, Image, Display, Transform
and FX tabs, retaining Text authoring as well. Shared settings follow the visible
selection; selecting an object does not silently change the active tab. Module
tabs retain their specific settings. A selection-action bar sits close above the
creation bar, with a related inspection/placement bar for eligible content.
Navigator/minimap and zoom belong at lower right, alongside the existing Keeper
dock pattern. Keep the approved Carbon/Mist materials, icons and 5/9 px geometry.

The founder clarified the intended eventual panel behavior: each tool tab can
be detached into its own panel and joined into a tab group again, with multiple
groups visible together. The reference screenshot shows Color above Layers and
Transform in another group. The current all-in-one preview is one possible
configuration, not a permanent restriction or a requirement to keep Layers
separate. Detaching/regrouping and hiding tools are accepted direction,
reconfirmed on 19 October, but are not implemented by this reference.

The founder prefers identifying the selection through the canvas and Layers.
The tabbed panel starts directly with its tabs, without an extra object-name
header or nonfunctional drag grip. Navigator and Keeper retain their compact
identifying titles; locked selection still has an explanation in the tools.

The reference Navigator supports live navigation while holding and dragging
its view frame, using the same temporary preview camera state as zoom and
keyboard navigation. This remains a design-system interaction preview.

The reference Color tab uses one colour selector: a hue ring surrounding a centred
equilateral triangle for mixing that hue with white and black. Both support live
pointer dragging and keyboard input. An editable hex field accepts three or six
digits; invalid values do not change the selection. The native browser colour
popup is removed from this tab. The swatch is a preview, not a second picker.
Opacity and precise saturation/lightness fields edit the same selected colour.
This remains reference-only; existing module/article appearance owns the value.
The 21 October Image exclusion above also governs migration of this preview:
generic example colour fields do not authorize Image colour editing.

The reference composition stays on the canvas while changing inspector tabs.
Artwork silhouettes, layer geometry and order come from the same composition
renderer throughout. Selected Display text is edited in its own frame using
the existing article editor; rendered text retains its authored formatting.
Color follows the editor's selected words or insertion point. The plain-text
article title has its existing independent title colour; no rich-title schema
is introduced. With no active text range/cursor, the default text colour remains
available and is labelled as such. A wheel gesture preserves mixed text marks
on cancel and commits as one undoable editor operation.

Layer dragging shows a line above or below the target row. The actual insertion
matches that edge; groups move together and cannot be split by a drop. Overflow
in the reference canvas and tool panel scrolls, with page scrolling available
at the edge. These fixes remain scoped to disposable design-system examples.

Layer-row removal in the reference uses an inline confirmation: clicking the
trash icon replaces the same row with a question at the start, a cancel icon
and a confirmation checkmark in the trash icon's original position. The row
keeps its height; multiple removal states the number of affected layers.
Cancel or Escape restores the normal row and keyboard focus.

The original 14 October scope was reference exploration. The 19 October
clarification now selects this workspace design for subsequent implementation;
this documentation update does not perform that migration. The preview still
uses disposable example objects; existing Properties specimens remain as
control-coverage references. The eyedropper, shared FX
including blur, Navigator behavior and side-management presentation still need
review. Fit/Cover are the current example choices; an additional Fill command
needs a distinct agreed purpose. Library, publishing, account and settings stay
separate. No saved content, application state or access boundaries change.

The founder requested a navigation-sidebar exploration in the same prototype
(2026-10-15), replacing the proposed global navigation dock. The sidebar carries
Workbench, Display-scoped Grids and Library navigation; creation tools and the
inspector remain independent. Library reuses its existing category tree beside
the asset browser without duplicating browsing state. Collapse and reopening
preserve the selected artwork, inspector tab, camera and Library filters.
Narrow containers stack the panels. Account, discovery and sharing destinations
are shown as unavailable in this reference; this does not authorize routing,
publication or a production dock migration.

### Tactile interface reference (2026-10-09)

**Retained reference, partly superseded.** The dated production migrations above
replace this treatment only for their named components. Unmigrated instruments
retain their existing treatment; this section does not revert the flat toolbar,
camera or context action bars.

The founder selected dark neumorphism for the creation toolbar and accepted it
as the reference for subsequent interface work. The visual reference is
https://www.pinterest.com/pin/156711262029400027/ (original share:
https://pin.it/6DMS4XcSc). Interpret its compact, physical controls: softly raised
keys, recessed active surfaces, thin lit rims and restrained depth. Preserve
INSCAPE's spatial hierarchy and density. The subsequent annotated creation-bar
refinement below specifies its typography and geometry.

The first implementation covers the owner creation toolbar and its Actions,
Add and Shapes popups. It is deliberately dark even on a light Workbench or
with a light window theme. Existing appearance preferences and saved artwork
are unchanged. Other surfaces retain their current rendering until explicitly
migrated; this reference does not authorize a simultaneous application redesign.

On 2026-10-12 the founder approved the following owner-tool consolidation:
- Properties combines the former artwork action bar and the selection properties
  previously housed under Layers. Display artwork, standalone Image and Shape
  supply their own context-specific controls; their actions and storage remain
  module-owned. Layer-order icons share the top action grid without a separate
  group or divider. Exact dimensions are available through a collapsed
  Dimensions disclosure; authored resize handles remain the primary sizing tool.
- Layers remains a structural list with composition spacing. Artwork info and
  Library remain separate surfaces. Properties, Layers, Artwork info and Display
  appearance use fixed-width, movable tool windows with content-driven height,
  bounded internal scrolling and no resize handles.
- Text remains a separate, complete inspector with all editor functions. The
  subsequent refinement described in Text authoring replaces the confusing two
  navigation rows with directly available formatting and named disclosures. Its
  material and icons align with creation; editor and save/recovery ownership stay
  outside Properties.
- Keeper settings open from an icon on the Keeper dock, independently of the
  current artwork or Text selection. Release/return and conversations remain
  Keeper-owned. Its settings window has no resize handles.
  On 2026-10-22 the founder explicitly chose the Keeper dock from the workspace
  design-system reference for its visual migration. The live dock now shares
  the reference's artwork-slot component and flat Carbon/Mist material, at
  176 by 188 pixels with a compact Keeper titlebar and existing settings icon.
  Its independent settings window uses the same flat material, thin separators
  and fields as the other migrated windows. It remains movable, content-fitted
  and internally scrollable. Navigation clearance and window ordering keep its
  close button reachable on narrow screens. The founder then explicitly removed
  Keeper's canvas attachment: the dock is a movable screen tool, initially at
  lower right above the existing bottom controls. Zooming, panning, canvas
  selection and groups must not move, scale or hide it. The same profile-level
  Keeper records and settings accompany local Workbench switches. Dock position
  is shared within that profile's current editor session across those switches;
  reload returns to the default corner. Neither dock nor settings placement is
  authored composition geometry. Navigator now shares this corner under the 23 October screen-utility contract above. Library drop,
  movement, size, release/return, conversation and publication remain
  Keeper-owned. This does not add Keeper habitats or put Keeper in the shared
  Layers/Transform/Color dock. See
  [visual implementation evidence](audits/2026-10-22/keeper-dock-style.md) and
  [screen-placement correction](audits/2026-10-22/keeper-screen-position.md).
- The camera rail uses compact icons beside the creation toolbar on wide screens
  and above it on narrow screens. Both rails bound tool-window height. Library
  and the owner Tools launcher are removed from the global app dock because
  creation already provides those routes; general navigation stays in the dock.
These migrated surfaces reuse workflowTactile.css for material and control
states. workbenchToolChrome.css owns shared tool-window geometry. Superseded
per-panel material and detached-selection styles are removed at their source.

Companion-tool refinement keeps Text's existing editor density. The explicit
`workbench-tool-window` sizing class shares control and header dimensions for
Properties, Layers, Artwork info, Display appearance and Keeper settings;
Keeper's dock uses the same icon target. Coarse pointers and widths at or below
520 pixels use 44-pixel action/header targets and 16-pixel field text. Six-action
Properties grids form two equal rows there. Camera controls use 40-pixel targets,
44 on narrow/coarse layouts. Size only Lucide icons, not arbitrary module SVGs,
and use component classes rather than accessible names as style selectors.

The outer companion surface is the only scroll owner. Layers and Shape content
must not introduce a second scroll region. Content fitting measures titlebar,
borders and padding independently of the current frame height so a previously
hidden Properties window fits correctly on first opening. Tool windows retain
no resize handles; authored artwork handles are unaffected. The isolated
`browser-tests/tool-chrome-fixture.html` provides disposable Layers, Shape,
Image and Keeper scenes for wide/narrow visual checks without user storage.

The founder refined the creation bar through browser annotations on 2026-10-09
and selected the compact icon-only layout at every viewport width on 2026-10-10.
The bar fits its contents, with minimum height 54, shell radius 35, border 1 pixel,
padding 5 on every side, column gap 3 and row gap 0, with space-evenly alignment.
The final padding annotation supersedes the intermediate 10-pixel setting.
Creation-bar button radii are 30 pixels for Select, 20 for Hand and 25 for Text,
Shapes, Artwork, Layers, Info, Actions and Add. Full square input targets retain
no inline padding. Tool names remain available through accessible labels and
native tooltips. These are bar-specific geometry tokens; popup shells, utility
buttons and command rows retain their own geometry.

The bar uses locally bundled **Inter Variable**, with Arial and sans-serif
fallbacks, through `--font-creation-toolbar`. Other interface typography and
the toolbar popups retain their existing fonts. The font face remains centralized
in `inscapeTokens.css` and loads only when used; no remote font request is needed.
The font and SIL license live in `public/assets/fonts/Inter`.
The full variable face, license and provenance add 357,042 bytes to packaged
public assets. The production font allowlist requires these exact files, and
the public-asset budget accounts for this measured addition with the previous
headroom retained (rounded up by less than 3 kB); JavaScript budgets are unchanged.

The icon bar uses content width at every viewport size, capped to the available
viewport. At 520 pixels and below it retains the two centred rows with an
8-pixel row gap so touch targets and outer focus rings remain separated. The
5-pixel padding and annotated shell/button radii apply at every width. Height is
a minimum: coarse-pointer controls grow the single row to 56 pixels, and wrapping
grows it further. The owner toolbar is raised 75 pixels above its prior dock-relative
position at every viewport size; this is the final spacing annotation, superseding
150 pixels. Workbench owns the shared offset in its layout CSS. The toolbar wrapper
uses it for positioning, menu height accounts for it, and the camera controls keep
their existing clearance above the toolbar. The gap remains usable Workbench space.

Material ownership and reuse:

- `workflowTactile.css` is the authoritative material and button-state recipe.
  Import it and opt a surface into `data-workflow-material="tactile"`.
  Add `workflow-tactile-control` to native buttons; use its `--quiet` modifier
  for command rows. Do not copy the shadows or introduce another palette.
- `--tactile-*` variables name surface, ink, muted/disabled ink, accent, rim,
  edge, raised/hover/well fills, shell/raised/inset shadows, radii and motion.
  Base colours reuse `inscapeTokens.css`; the warm amber accent reuses
  `--color-focus`. Component geometry belongs to component CSS.
- The toolbar owns `--toolbar-*` dimensions, spacing and shell radii in
  `workbenchToolbar.css`. Creation cursors/hints/previews belong to
  `workbenchCreation.css`; the shared vertical offset and camera-control clearance
  belong to `workbenchView.css`. A ResizeObserver measures the actual toolbar height
  into `--workbench-toolbar-clearance`, including touch/wrapped layouts.
  It is temporary layout information, cleaned up when the toolbar is hidden.

Interaction and visual grammar:

- Resting keys are raised subtly by a top highlight and short lower shadow.
  Light comes from above/left. Shell depth is stronger than control depth.
  Command rows stay quiet until interaction so the menu remains readable.
- Hover lightens an available key. Pointer press recesses it without changing
  bounds. Selected/open creation-bar tools remain recessed on hover, with amber
  ink and no underline; inset material supplies the second visual cue. Shared
  command rows retain their existing selection marks.
  Use existing `aria-pressed` / `aria-expanded` state, not duplicate CSS state.
  The Shapes trigger also reflects the existing active creation tool.
- Keyboard focus adds a separate two-pixel ring outside the control. It remains
  distinct from selection; padding contains it within bars and scroll regions.
  Disabled controls are quiet and cannot acquire hover/press depth.
- Minimum control size is 40 screen pixels, 44 for coarse pointers. Accessible
  icon controls apply at every width; at 520 pixels and below the five creation
  keys and four inspection/action keys form two centred rows.
  Changes to tool count must revisit this grouping and its layout checks.
- Popups stay inside the viewport and scroll internally. Search uses a recessed
  field with a full focus ring. Touch search uses 16-pixel type. Keep native
  keyboard navigation, focus return, accessible names and disabled reasons.
- No blur, backdrop filters, image textures, continuously animated lighting or
  layout-moving pressed effects. The only transition is brief ink colour;
  reduced motion removes it. Forced colours use system colours, visible borders,
  focus rings and system-highlight fills on active creation-bar buttons even
  when shadows/gradients disappear. Shared command rows retain selection marks.

Before adopting this reference elsewhere, inspect the component's actual purpose
and reuse these material/control recipes while retaining its layout and ownership.
Verify wide/narrow and touch layouts, default/hover/pressed/selected/focus/disabled
states, reduced motion, forced colours, popup overflow and readable contrast on
both dark and light surroundings. The production toolbar, not a detached mock,
is the reference. Its browser checks are in
`browser-tests/workbench-toolbar.browser.mjs` and its isolated fixture is
`browser-tests/workbench-toolbar-fixture.html`.

### Typography

- The creation bar uses **Inter Variable** as explicitly approved in the
  tactile reference. This is scoped to that bar, not a global font migration.
- Use **Inscape Sora** for primary navigation, headings, controls, body copy,
  human-facing labels, and concise identity labels. Normal UI weights are
  approximately 400–500; heavier weight requires an established reference.
- Use **Inscape IBM Plex Sans Condensed** for technical data, addresses, codes,
  microcopy, measurements, state labels, publication details, dense secondary
  copy, Library rails, metadata, and supporting descriptions.
- The INSCAPE wordmark remains the existing SVG and does not require a brand
  font.
- Do not introduce a new font, generic fallback styling, arbitrary all-caps, or
  unrelated weights when an established role exists.

### Geometry and surfaces

- The Display Module and its creative instruments retain the current restrained
  rounded, textured window chrome, as confirmed by the founder. Concentrate that
  tactile treatment around the instruments; Library, menus, and the application
  dock retain their flatter structural surfaces and existing selector grammar.
- Reuse the shared window-chrome tokens, grain treatment, window controls, and
  existing detached-window shell for compatible module windows. Keep content
  layout and Stage-specific clipping separate; do not copy a module's chrome
  into a new stylesheet merely to recreate the same appearance.
- Outside the accepted tactile interface reference, existing geometry is square and structural: zero corner radius,
  one-pixel borders, contiguous faceplates, clipped overflow, and deliberate
  alignment. Circular geometry is reserved for avatars, identity marks, status
  indicators, and controls that are already circular.
- Use the active `--workflow-*`, `--lattice-menu-*`, and established surface
  tokens. Do not add a parallel palette for one screen.
- Retain the established carbon, graphite, slate, ash, mist, and paper surface
  family. Artwork and authored Grid appearance may vary; application chrome
  remains coherent.
- Shadows communicate a genuinely elevated Display Module, window, menu, or modal. They
  remain restrained and must not turn every bounded region into a floating card.
- Spacing follows structural rails, cells, borders, and neighbouring production
  components. Avoid large empty padding used only to make a UI appear modern.

### Selection and interaction

- Outside the tactile controls described above, active navigation and selected commands use the established high-contrast
  edge-selector grammar: horizontal on horizontal rails and vertical on
  vertical lists. Do not rely on an unrelated fill colour alone.
- Hover, focus, pressed, selected, disabled, and loading states must occupy the
  complete interactive hit area and must not shift layout.
- Keyboard focus remains clearly visible. Controls retain usable hit targets
  even when their visual label is compact.
- Scrollable content must be constrained by its owning window or panel. It must
  not escape above, below, or sideways across the application shell.

### Grid and alignment

- A visible Grid must correspond to real layout, snapping, measurement, or
  navigation geometry. Never add a Grid as detached background decoration.
- The Workbench alignment Grid may be hidden independently from shortcut
  snapping. The Display Module Grid and its authored snapping remain separate,
  publishable Stage appearance and geometry.
- Headers, rails, cards, Display Modules, windows, and controls align to the same active
  structural coordinates wherever their relationship is visible.
- The Display Module boundary must remain visually unmistakable at every
  zoom level and viewport size.
- Zoom changes inspection scale, not document geometry. Visual chrome must not
  accidentally scale as authored Stage content.

### Responsive and cross-mode validation

- Wide and narrow layouts must preserve hierarchy and access, not merely shrink
  the desktop composition.
- Owner, Visitor, Discover, public presentation, loading, empty, and error states
  must look like one system.
- Before accepting visual work, compare screenshots at representative wide and
  narrow viewports and check alignment, overflow, clipping, scroll boundaries,
  typography, active selectors, and input focus.
- Do not declare a visual change complete solely because CSS compiles or one
  viewport appears correct.

## Scope discipline

- The independent-module host and public Workbench are accepted direction.
  They do not authorize implementing every proposed animation, audio,
  headtracking, or identity module immediately.
- Monetization, third-party module distribution, collaborative editing,
  connection protocols, module-version upgrades, and responsive public-layout
  rules remain open implementation or product decisions. Preserve room for
  experiments without treating every possibility as a committed feature.
- Implement migrations in narrow replace-and-verify slices.
- Delete old presentation code only after its accepted replacement is live and
  regression-covered.
- Preserve rollback points and user-owned files.

## Active operational safety

- Public IPFS content is public and permanent.
- A successful IPFS upload is not an on-chain publication.
- Never retry an ambiguous wallet action after a transaction hash exists.
- Keep Pinata credentials server-side and outside all `VITE_*` variables.
- Validate canonical bytes, size, CID, profile, chain, and wallet authority at
  their existing fail-closed boundaries.
- Retain provenance and relationship scope for all LUKSO-derived facts.
- Recheck official LUKSO sources live before changing standards-facing behavior.
- Do not run `npm audit fix --force`, downgrade `@lukso/up-modal`, or introduce
  untested overrides to conceal inherited dependency findings.

### Dependency checkpoint (2026-09-08)

The September versions, audit counts, budget recalibration and test totals are
historical evidence in the [consolidation archive](audits/2026-10-30/contract-consolidation/history.md).
Use the current lockfile and fresh verification for maintenance or release.
