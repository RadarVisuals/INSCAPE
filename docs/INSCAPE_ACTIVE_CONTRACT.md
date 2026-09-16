# INSCAPE active contract

Status: sole active product-direction document
Established: 2026-08-28
Product clarification: 2026-09-06 — public Workbench and independent modules
Rollback baseline before the documentation reset: `64458ac`

## Mirror animation module

Mirror is an independent Workbench module fed by an image selected from Library.
Its Pixi runtime owns reflection, clipping, scale, position, in-plane rotation,
automation and render-resource cleanup. INSCAPE owns Library resolution, profile
authority, module placement and persistence. The standalone demo uses that same
runtime; there is no iframe or second animation implementation.

The profile draft optionally carries `animations`. Each Mirror record stores one
resolved source asset, validated settings and host presentation separately.
Modules start private; only explicitly public modules with an image enter the
optional v9 `animations` publication field. Existing documents without this field
remain valid. Visitor uses the same renderer with playback and metadata, without
authoring controls or draft writes. Helper grids and playback time are temporary.
The initial implementation allows four Mirror modules and loads Pixi on demand.

## Mobile entrance and Index

The isolated mobile prototype establishes a two-sided artwork-led entrance.
Tapping the front reveals the profile metadata on its reverse; tapping the
reverse returns to the front. Every turn continues in the same direction.
Works is a separate action on the reverse, with a compact preview of the first
authored entries. There is no extra About dialog. The reverse presents the existing
Identity bio, tags, links and nonempty authored fields. The founder approved
profile and publication integration on 2026-09-12. The original standalone
projects remain preserved as visual and interaction references.

The integrated Mobile module owns one presentation per profile. Owner opens its
portrait editor through Workbench Add. Editing happens directly on its output;
Layers and Settings occupy a separate, movable companion window that can close
and reopen but does not dock into the portrait. Display retains its existing
attached/detached behaviour and its frame feature is outside this change.
Mobile authoring uses the existing profile
draft store and publication action, with no separate metadata or storage owner.
The optional draft `mobile` field starts private. Explicit inclusion projects a
validated presentation into the optional v9 publication `mobile` field.
Version 1 remains readable without changing its appearance. The next authored
edit upgrades it to version 2, adding neutral rotation and mirror settings for
the three fixed roles. Editor open/close does not upgrade content.
Older drafts and publications without Mobile remain valid; restoring a document
without Mobile preserves any local Mobile composition as private.

The standard design canvas is 1080 by 1920 (9:16). Foreground artwork, alpha mask
and controls share that canvas and fit without viewport cropping. The background
fills the screen and may crop. Standard Library compositions fit horizontally
centred and bottom-aligned, so taller screens add background above the composition,
not a strip below its artwork. Existing saved coordinates, masks and scales stay
unchanged; this rendering correction applies to existing drafts and publications
without rewriting them. Deliberate artwork scaling, positioning and cover-fit
cropping still apply. The custom Steyra depth study retains its centred canvas.
The editor provides the resolution, a downloadable
SVG guide. Placement snaps invisibly to 12 design-pixel increments; no snapping
grid is drawn. Background, artwork and mask
come from Library; image fit, scale, position, background colour and an optional
thin mask border are authored settings. Identity and functional icons can move,
but their text and meaning remain owned by INSCAPE and the profile. The official
username appears on the front. The reverse matches Desktop Identity: the authored
title appears as a small uppercase label above the prominent official username,
omitted when identical to the username. A title never replaces the
official username in Mobile.

Mobile has three fixed image roles, not an arbitrary layer stack. Each supports
quarter-turn rotation and horizontal/vertical mirroring. Artwork can move and
scale inside the mask, with contain/cover crop settings. Duplicate, frame and
layer stacking-order controls are not included. The window shell and transform
buttons are shared with Display; each module retains its own state and actions.
Locking and hiding elements are temporary editor aids. Edit mode selects and
manipulates content; Preview restores visitor interactions. Gallery headings and
introductory copy are edited in place and tiles reorder directly. Collection
names matching a work's fallback name are not repeated as tile captions.

Draft asset references retain stable asset IDs and media selection. Publication
resolves the selected assets using the existing canonical metadata projection;
published metadata is a snapshot refreshed by explicit publication. There is no
second title, description or attribution editor. Missing sources must remain
unavailable rather than becoming fabricated content or successful empty reads.

Owner preview and Mobile Visitor use the same renderer. Phone visitors enter the
Mobile presentation without loading the desktop Workbench; desktop visitors do
not load the Mobile renderer or editor. A profile without a published Mobile
presentation has an explicit unavailable state and an optional desktop action.
Theme persists across the card, Index and viewer. The founder's Steyra renderer
and separate Through the Eye / seven-layer experiment are curated custom work,
not a default template for other profiles. Executable imported themes, LSP8
template packaging, paid accounts and a general shader editor are deferred.

The active standalone mobile preview is `Mobile/INSCAPE final/inscape-profile-card`.
Its entrance flips to a flat profile reverse, with a separate Index action that
opens the staggered image tiles. The entrance eye is not a navigation target;
tapping it flips the card like the rest of the artwork. Through the Eye and the
seven-layer interaction remain in the artwork viewer for The world inside.
The entrance retains the depth study's recessed animated Steyra and inward
foreground wordmark and identity. Its eye journey and room-wall metadata remain
separate experiments in `Mobile/inscape-profile-card/depth-study`; the active
preview uses the flat profile reverse instead.

Index is an explicitly authored table of contents, not a wallet inventory.
The maker chooses published destinations and their order inside INSCAPE.
Entries have a title, an optional cover derived from existing content unless
overridden, and a destination to a work, composition or experience. Unsupported
mobile destinations require an explicit desktop treatment rather than a
silently broken embedded desktop. The integrated first format supports explicitly
chosen Library images, reordered in the Mobile editor, with an authored Index
heading and introduction. Its staggered tiles open the shared image viewer;
counts and navigation order are derived from the selected entries. Additional
destination types must be explicitly supported before they can be authored.

The prototype prepares read-only presentation fields and distinguishes
unconnected content from successfully loaded empty content. Its hardcoded
gallery and bio are not public profile data. The existing Through the Eye
portal and seven-layer hold-to-separate experiment remain available together
as an explicitly identified experiment, outside the published Index entries.

## Authoring undo

Completed profile-draft edits share one chronological undo/redo history across
Display instances, Identity, Mirror and Mobile. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z
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

INSCAPE is an artist's online desktop: one environment for composing,
experiencing, and publishing artwork through independent creative modules.
It begins with the founder's own artistic practice and also accommodates other
makers. Human Underneath is the founder's artistic world, not a required theme
or content model for everyone using INSCAPE.

The hierarchy is:

1. **INSCAPE Workbench** — the containing desktop and experimental workspace.
2. **Module instance** — an independently configured creative application on
   that desktop. Multiple instances of the same type are accepted direction.
3. **Display Module** — a module type for composing assets across Grids.
4. **Stage and Grids** — the Display Module's clipped visual output and scenes.
5. **Assets and authored primitives** — material interpreted by a module.

One Workbench per Universal Profile is the current product direction. Multiple
Workbenches per profile remain unproven and are not a requirement.

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
  Display Format belongs to that Display's canvas, title-bar and shortcut menus.
  The open Display's menu also offers Close module (minimize to its shortcut)
  and Delete module through the existing undoable deletion action.
  Add → Display Module offers Horizontal (16:9) and Vertical (9:16) when
  creating an instance; its Format menu remains available for later changes.
  New Displays start with clean shortcut artwork and names, using a 960×540
  horizontal or 405×720 vertical window constrained to the available Workbench.
  Recreating a deleted primary Display starts a fresh presentation; existing
  saved presentations retain their dimensions. Shortcut fallbacks are scoped
  to the Display instance. Add and Format share the same orientation defaults.
  Format changes preserve the window's size relative to those defaults, so an
  unresized horizontal Display becomes the same size as Add → Vertical.
  Viewport bounds still apply; existing saved windows are not rewritten on read.
  Metadata remains a Display instrument and is not an Add-menu module.
  Library stays anchored to the Workbench's left edge above ordinary module
  windows and shortcuts. Its existing drag-to-hide behavior exposes drop targets.
  Opening or resizing it never reserves space or shifts modules or shortcuts,
  including on narrow screens. Dock visibility does not close Library or change
  the open panel. Workbench and Display context menus open the same shared
  Library without changing the active module or Grid.
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

## Public Workbench and visitor interaction

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
The existing authoring session remains the sole path for saving that capture.

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

The first implementation bounds a Workbench to eight Displays. Right click Add
creates an additional private Display; its context menu can include it in the
next publication. Public projection omits private instances and private Grids.
The original Display requires a public Grid while it exists. An empty root
`grids` array represents its absence in draft v4 and document v9; additional
Display records still require Grids. Older nonempty documents retain their
existing interpretation, and no storage key changes. Add recreates the original
Display when absent before allocating another instance.
`workbench.displays` retains additional window and shortcut arrangements when
Prepare Publication captures the Workbench. Closing minimizes to the shortcut;
it does not delete content. Visitor window changes remain session-local.
Owner shortcuts offer right-click Delete for every created Display, Mirror,
Mobile and mini app. Deletion removes authored module content and its saved
arrangement through one undoable draft operation. A desktop with no created
modules is valid and survives reload and publication. Identity remains accessible
through Profile; removing modules does not delete Library assets or change an
existing publication. The Workbench owns its alignment grid independently of
Display presence.
Optional arrays do not rewrite older documents on read. Publications using them
require the updated strict reader and a newly verified hash and URI.

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

## Display Module

The September 16 inspection-cue experiment adds hover/focus cues and a compact
metadata foldout inside Display, shared by Owner, Preview and Visitor. Cue
activation follows the placement's existing In place/Lift choice. In place
retains its scene cue; Lift has a separate cue relative to the fitted enlarged
artwork, initially near its upper-right edge. Unlocked owners can drag or
keyboard-adjust that enlarged-view cue without moving the thumbnail cue or
the artwork. Each view retains its own opening-direction preference.
Closing metadata leaves the artwork inspected and a + to reopen the foldout.
Clicking the Stage returns the artwork; Escape closes the foldout first and
the artwork on a second press. Metadata visibility belongs to the temporary
inspection session and resets on close, navigation or scope change.
The foldout is testing a theme-tinted glass surface: a 60% panel tint over
backdrop blur, subtle theme-derived edges, opaque text and bounded internal
scrolling. Unsupported or reduced-transparency views use a solid theme panel.
This material experiment is specific to the artwork foldout. The existing Metadata
instrument remains independently available during this experiment; cue clicks
do not open, close, attach or move it. The foldout reuses existing metadata
projections and fields, introducing no second metadata source.

The artwork foldout has a description-first Info view with expandable long
copy and compact creator attribution. The entire foldout uses Sora, including
attributes, source details and settings. Info, Attributes and Details use a compact
top icon rail with accessible names and tooltips. The active cue becomes the
minus inside that rail and collapses only metadata; there is no duplicate close
control or external minus while the foldout is open. The minus uses the edge
nearest its cue: right for a left-opening foldout, left for a right-opening one.
The plus and minus share their SVG geometry, control size and centre. The card
grows around that centre, with its header below the content when it needs to open
upward. Width/direction adapt at Display edges instead of displacing the cue.
Lift still uses its separate enlarged-artwork anchor when entering inspection.
Icons brighten on hover/selection without square fills or an active underline;
keyboard focus remains outlined. Unlocked owners can drag the minus or empty
header space in both Lift and In place, using the same cue-anchor gesture.
Automatic opening direction stays fixed until the foldout closes so dragging
does not flip it. Technical identifiers live in Details and owner cue controls
use a settings view that replaces the body; a content icon returns to that
section. Content scrolls within the available Display height.
This presentation does not replace or redesign the attached/detached sidecar.
Edition or circulation labels require sourced artwork-level facts; a distinct
token ID alone is not evidence of a unique edition.

Unlocked owners can move cues within placement bounds plus a modest margin,
use arrow keys to adjust, Home to reset, and choose a preferred left/right
opening direction. These experimental offsets and preferences live only in
the mounted Grid session and reset on Grid change, closure or reload. They are
not yet authored/published settings. Visitors cannot move them. Deciding what
the foldout replaces and persisting cue placement follows interaction review.


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

- Each Display has a Landscape (16:9, 32 by 18 coordinates) or Portrait
  (9:16, 18 by 32 coordinates) Stage. All Grids in an instance share its format.
  The owner chooses the format through that Display's context menu. Resizing
  preserves it. Format changes preserve placement coordinates and sizes; the
  artist rearranges content for the changed clipping boundary. Existing Displays
  remain landscape until explicitly changed. Arbitrary aspect ratios remain
  outside current scope. The profile's World Cover remains landscape.
- Content outside the Stage boundary is clipped and is not published.
- The Display Module may move freely on the Workbench without changing published
  composition coordinates.
- Pan and zoom are camera/view state. They never resize assets, mutate the Grid,
  or alter published geometry.
- Support a fitted overview and sufficiently strong zoom for precise editing.
- Scrolling over the Stage resizes the Display window around its centre within
  window bounds. Scrolling over instruments retains their own scrolling.
  After reaching maximum size, a separate upward scroll enters an immersive
  browser-area Stage view, with Workbench and instruments hidden and plain black
  letterboxing to preserve the authored Stage ratio. Scroll down, Escape, or the revealed Exit control
  restores the prior window. Immersive geometry is temporary and never captured
  as the published window arrangement. Owner and Visitor share this behavior.
- Ordered Grid navigation wraps from last to first and first to last, in the
  editor and public presentation. A single Grid does not swipe to itself; the
  World Cover remains outside the editor's scene sequence.
- Dragging the Display Stage swipes between Grids directly in Visitor mode and
  when the owner's Display composition is locked. Unlocked authoring retains
  Space-drag navigation so ordinary dragging remains available for editing.
- The Display Module title bar offers local Play/Pause before Layers. Playback
  slides continuously through the ordered Grids and wraps without a dwell.
  Pause retains progress; Stage interaction returns to manual control. Playback
  does not change the draft schema or publication. Reduced motion uses discrete
  Grid changes instead of sliding.
- Owner, Preview and Visitor use the same contained Display artwork inspection,
  title-bar artwork navigation and Metadata instrument. The former full-screen
  visitor artwork/dossier presentation is retired, including for old publications.
  Visitors retain window interaction, Grid playback and Metadata inspection, with
  no Layers tab, placement tools or composition Lock. Metadata can attach, overlay
  or detach through the same bounded instrument shell. Published creator attribution
  and source details remain available. These interactions are session-local and
  never write an owner draft or rewrite publication bytes.
- An always-visible **Inspect: In place | Lift** selector above the Layers list
  applies immediately to the single selected, unlocked placement. It remains
  disabled without an editable selection and is not nested in Frame and mat.
  The choice is saved as optional `inspectionMode`
  (`IN_PLACE` or `LIFT`) in drafts and public placements. Existing drafts and
  publications without it now default to Lift; explicit IN_PLACE choices remain
  respected. This is a read-time default change, with no saved document rewrite.
  No image or geometry is copied
  into the saved setting. Visitors follow the authored choice. Lift to centre
  enlarges the artwork within the Stage using its original media proportions,
  dims the other artwork, and returns it on close without changing the scene.
- Focus in place keeps the composition and camera fixed. The selected
  artwork stays visible, layers behind it dim, and foreground layers fade away;
  closing restores the scene. Pointer picking follows visible image pixels,
  passing through transparent areas to artwork underneath. Visible backing and
  mats remain selectable. While a transparency mask is unavailable, rectangular
  picking remains available. Alt-click cycling and its Stage tooltip are removed.
  Keyboard and Layers selection remain explicit. These are temporary Display
  interactions shared by owner and visitor, not saved placement mutations.
  During focus, clicking anywhere within the Stage, including on the selected
  artwork, closes inspection through the same restore path as Escape. That
  click does not activate underlying artwork. Metadata and title-bar controls
  retain their own interactions. Stage artwork never displays a rectangular
  focus outline, including after keyboard interaction or focus restoration.
  Keyboard activation and focus indicators on interface controls remain available.
- Do not implement the Display Module as an HTML iframe. Use one application context with
  an isolated, clipped viewport and camera transform.
- The Display Module owns the instruments required to author and inspect its
  composition. Ownership is independent from presentation: an instrument may
  be attached to the module, temporarily overlay its non-published viewport,
  detach onto the Workbench, or close. Instrument chrome never becomes Stage
  content and is never published.
- Use a stable directional grammar for attached instruments: the left side is
  for authoring and scene structure; the right side is for Metadata, provenance,
  and narrative inspection. This describes orientation and control logic; it
  must not force two full-width sidecars around the 16:9 Stage.
- The Display Module must offer a compact projection that uses at most one
  full-width attached utility bay. Layers and Metadata may switch as tabs or
  share that bay as a vertically divided, resizable stack, while a compact
  authoring rail may remain on the opposite edge. Either section may collapse
  or temporarily take the full bay. This compact projection is an option, not
  a mandate that every viewport or workflow use the same arrangement.
- Do not require two permanently attached full-width sidecars. On sufficiently
  wide Workbenches they may be available as a user-selected arrangement. When
  width is constrained, keep both instruments available through the shared
  bay, a bounded overlay, or a detached Workbench window.
- Responsive layouts must preserve a useful Stage width. If an attached bay
  would make the module exceed its Workbench bounds or reduce the Stage below
  its usable threshold, that instrument changes to overlay or detached
  presentation; the canonical Stage geometry does not reflow.
- **Layers is a Display Module instrument**, scoped to that module's active
  Grid. It is not a global document-agnostic Workbench dock. Layers may attach
  in the shared utility bay, open from a compact authoring rail, overlay the
  module viewport as a bounded floating panel, detach onto the Workbench, or
  close, but a single Layers instance must never be mounted in two places at
  once.
- Layer rows and Stage placements share one selection model. The list exposes
  the active Grid's render order from front to back; reordering rows changes
  placement z-order. Placement lock, visibility, removal, and other accepted
  row actions remain synchronized with the Stage and obey the composition
  Lock.
- The Layers eye toggle temporarily hides a placement in the editing Stage only.
  Keep its row available to show it again. This is session-local Workbench state:
  it resets on reload, never changes the draft schema or public/private visibility,
  and does not hide the placement from Preview or publication.
- Placement tools belong with Layers as one authoring instrument. Its compact
  toolbar may sit above or below the layer list according to available space.
  The Display Module title bar should expose the instrument and composition
  controls needed to find or toggle that workspace, but must not become the
  full editing toolbar.
- **The existing Metadata inspector is singular per Display Module**. It may attach on the
  module's right in the shared utility bay, overlay the module viewport as a
  bounded reading panel, detach onto the Workbench, or close, but must never be
  mounted in two places at once. Attached and overlay presentations must cap
  their usable height and contain long metadata with internal scrolling rather
  than enlarging or obscuring the application shell without bound.
- A future standalone Metadata module's scope and relationship to this
  inspector remain open. The current Add-menu name alone does not settle that
  design or authorize removing the working inspector.
- Detached Layers and Metadata remain viewport-bounded and must identify the
  Display Module and active Grid or selection they currently inspect. Their
  detached position is Workbench view state, not published composition state.
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
- The strip may collapse and may hide in an explicit immersive view. Its state
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
  inspection controls and attached, overlay and detached instrument panels.
  The frame continues to expand around the attached bay through Display's
  existing geometry; Stage dimensions, artwork crop and saved compositions are
  independent of this chrome. Detached panels receive the module theme explicitly.
  Owner and Visitor share this treatment, including the two-pixel tab selector,
  reduced grain, thin content boundary and light-theme control shadows.

  The current Display frame experiment removes the title bar's layout space.
  A compact control group overlays the upper-right Stage. The controls use plain
  icons with hover feedback, keyboard focus and an active underline instead of
  raised circles. One shared 65%-opaque backing maintains contrast over light and
  dark artwork;
  the remaining top strip stays draggable and keyboard movable. The Display name
  is available on hover, with maximize/restore before minimize. Stage aspect ratio
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

- Direct world links enter the targeted world automatically through Startveil,
  without a separate Enter button. The bare INSCAPE URL retains the public
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
Do not infer a final Discover layout from the current screen. Exact module-link
URLs, optional Grid links, and their interaction with the maker's starting
arrangement remain to be specified when implementing public Workbench entry.

## Editing, public inspection, and publication

- The Library retains one entry per token while exposing its available image
  representations and attached images through an image chooser. Resolution
  variants of one image remain one choice. Choosing an image does not create a
  new token identity or change Library category membership.
- An image chosen for placement belongs to that placement. Preserve its resource
  and dimensions through draft persistence, Preview, and public projection,
  alongside the original token identity and provenance. Different placements
  of the same token may use different images.
- Owner editing and public inspection must not silently replace or rearrange
  the application dock.
- The canonical Display Module should make a separate full-application Preview mode
  unnecessary. A future public-inspection state may hide authoring controls and
  private content without changing route or workspace context.
- Keep public/private projection explicit. Only public canonical content may
  enter a publication document or snapshot.
- The current canonical v9 document, profile-scoped private draft, external
  wallet authority, IPFS validation, and visitor recovery boundaries remain in
  force until an explicit, tested migration replaces them.

## Visual language

INSCAPE is flat, technical, spatial, and deliberately bounded. It must not drift
into generic dashboard, marketplace, or AI-generated interface styling.

### Typography

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
- Default interface geometry is square and structural: zero corner radius,
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

- Active navigation and selected commands use the established high-contrast
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

The Identity QR addition declares the already locked `qrcode-generator@1.5.2`
directly; no package versions or transitive package entries changed. Its code
loads when the QR is opened. Existing origin: `@lukso/up-modal` through
`@lukso/web-components` and `qr-code-styling`.

A live `npm audit --json` reported 93 advisories (10 low, 61 moderate,
19 high, 3 critical). This is a dependency inventory, not a demonstrated
browser exploit or a security clearance. The critical entries are `form-data`,
`request` and `tar`. A confirmed path runs from `@lukso/up-modal` through LUKSO
contract packages, `solidity-bytes-utils`, `@truffle/hdwallet-provider` and
legacy Web3 utilities. Vite also has a direct high-severity advisory.
The local Node 18.20.7 emits engine warnings for existing dependencies
requiring newer Node versions. These findings predate the QR declaration.

Before a release, perform a focused dependency maintenance slice: align the
Node/toolchain version, assess current supported Vite and LUKSO package
updates, trace affected runtime paths, and verify wallet and publication
boundaries after any upgrade. Do not combine blind dependency upgrades with
Identity layout work or claim build success resolves these advisories.

The subsequent local maintenance check updated Vite 5.4.21 to 6.4.3 and
esbuild 0.21.5 to 0.25.12. Lockfile comparison found no runtime package
version changes. The audit now reports 91 findings (10 low, 60 moderate,
18 high, 3 critical); the inherited wallet-chain findings remain unresolved.
The configured registry still reports `@lukso/up-modal@0.21.11` and
`@lukso/web-components@1.207.0` as latest (rechecked September 8).
This is a targeted remediation, not a claim that Vite 6 is the newest major
or that the application has received security clearance.

Vite 6's changed bundling exceeds the former standalone-wallet budget with
the same application inputs. The measured Windows output is 4,545,415 raw /
1,208,418 gzip bytes. Only that lazy group's limits were recalibrated to
4,600,000 / 1,225,000; initial/core limits and isolation checks are unchanged.
The migration retains Vite's defaults rather than adding compatibility
switches. See the [official Vite 6 migration notes](https://v6.vite.dev/guide/migration#advanced).
Node 24.20.0 LTS is now installed and selected explicitly for local checks and
the development server. `.node-version` pins it for project tooling; the
package engine range is `>=24.20.0 <25`. The global Windows NVM link can still
select Node 18, so a normal terminal is not automatically migrated. Use the
session-only instructions in `NETLIFY_PUBLIC_IPFS_PUBLICATION.md`. No deployment
runtime has been changed or verified remotely.

The September 8 targeted lockfile update retains all existing wallet/LUKSO
versions and updates PostCSS, nanoid, DOMPurify and the Browserslist data chain.
A broad `npm audit fix` trial unexpectedly downgraded transitive packages; it
was reverted before the final clean installation. No downgrade, force option,
or override remains. `npm ci` succeeds under Node 24 with no engine warnings.
The current audit is **87 findings: 10 low, 59 moderate, 15 high, 3 critical**.

The emitted Rollup module inventory and a bundled esbuild import graph of
`netlify/functions/pin-profile-document.mjs` were checked against the affected
installed paths in that audit. The critical `form-data`, `request` and `tar`
paths are absent from both outputs; no high-severity affected paths were found
there either. Eleven flagged parent LUKSO packages are present in the browser
(including contract ABI modules), but have no direct advisory in this audit:
their findings are inherited from dependencies outside the emitted graph.
Axios remains pinned to 1.16.0 by `@coinbase/cdp-sdk`; its affected path was
also absent from these outputs. This bounds the inspected runtime exposure,
not installation/supply-chain risk or every possible exploit. Keep the
inherited findings visible and revisit upstream package releases before release.

Local verification repeated under Node 24 after the targeted updates:
756 Node tests, seven Identity browser
cases, five LUKSO standards checks, production build and build check passed.
The built wallet chunk imported in an isolated browser without creating a
wallet session; live wallet connection/signing remains untested here.
Identity was visually checked at 390 and 1440 pixels. The targeted review
confirmed shared card validation, profile-scoped authoring callbacks and
module-owned shader cleanup; no new abstraction or layout layer was needed.
The Identity browser harness now resolves React through Vite's module IDs
instead of assuming the optimizer's physical cache path.
The Vite watcher also excludes `.browser-test-runtime` and
`.browser-test-profile`: watching Windows-locked Chromium cookie files caused
an observed EBUSY development-server crash during the first Node 24 browser run.
The browser suite and full tests/build passed after that narrowly scoped fix.
