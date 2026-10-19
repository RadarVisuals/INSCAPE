# Components and patterns

The [registry](../../design-system/registry.js) maps every system category to production source and an evidence entry point. Its underlying inventory statuses mean **Production** or **Retained**, both displayed as **In the app**. The separate design-decision list uses **Agreed** and **Needs review** for the new direction. They do not imply an accessibility certification. This reference introduces no second component package.

## Reference previews

Components starts with the reference-only creative workspace: eight shared tabs,
contextual inspection and selection bars beside the existing creation toolbar,
and Navigator/Keeper placement studies. Example objects own their local values;
tabs and camera state are separate. Selecting a different object preserves the
open tab. Duplicate/delete/reset, transform, crop, colour/opacity, grain/blur and
Navigator zoom/pan can be tried without persistence. Its view frame can be
dragged live with mouse, pen or touch. Grabbing inside retains the grab offset;
pressing elsewhere centres the view there. Pointer capture continues tracking
outside the map. Release keeps the view; Escape, cancellation, lost capture or
window blur restores the starting view. Arrow keys and reset remain available. Existing Properties controls
remain in a disclosure directly below for coverage comparisons. This is not a
claim that every production setting has migrated into the shared panel.

Accepted future direction: tool tabs can detach into independent panels and
rejoin configurable tab groups. Several groups may be visible at once, allowing
Layers to stay open alongside Color or Transform. The current combined panel
is one preview configuration; detachable/regroupable behavior is not implemented.
The reference is still reviewing each tool before that layout migration.

The eyedropper and Keeper inhabitant remain unconnected layout references.
Text now reuses the real editor and inspector with local example articles, as
detailed below. Library browsing and organization now have a separate preview.
Real side assets, saved/published integration and tool docking still need their
own reviewed migration. Layers now has a disposable Display composition
with multiple selection and composition spacing, as detailed below. Fit and Cover are previewed; no duplicate Fill behavior is invented.
The panel stacks below the example canvas when the available component width is
820 px or less, with scrollable keyboard-accessible tabs and wrapped toolbars.


Overview uses `CreationToolbarExample`; Components uses `WorkspacePreview`. Both share the real creation toolbar and the scoped flat material in `design-system/referenceMaterial.css`, using geometry from `referenceTokens.css`. They reuse WorkbenchToolbar with `minimalPopups`, independent local tool/panel state and callbacks limited to local example state. Flat control states use the same material overrides. PropertiesPreview reuses the shared shell, ArtworkTransformTools, PlacementSizeControls and ModuleGrainControl. Reference-only adapters reproduce the Image, Display artwork and Shape control inventories, with local values and focus recovery. The preview style and the two-theme state sheet are marked Needs review. The bevel window remains collapsed as an existing-app reference. The APIs below describe production implementation.

Properties action rows use unboxed icons with hover and keyboard-focus feedback.
Mutually exclusive Fit and Inspect choices use an inverted fill without an
additional underline. Image keeps its accessible “Image fit” group name while
omitting the redundant visible Fit label. Fields use 5 px corners; the native
select picker uses the same 9 px shell and 4 px total inset as other menus.
Dropdown text is vertically centered and selection follows the neutral theme.
The compact Grain row combines its label, a track no wider than 96 px, and its
percentage, retaining the existing 32/44 px input target at desktop/narrow widths.

These remain native controls. [Customizable select](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select)
styles progressively enhance supported browsers; unsupported browsers retain their
native picker. The WebKit/Blink number-stepper treatment redraws its chevrons
without replacing its pointer, keyboard, validation or form behavior. Other
engines retain their native stepper. Forced colours keep system colours visible.
All changes are scoped to Properties previews, pending production migration.

### Layers review preview

The workspace Layers tab now covers the active Display/Grid list: front-to-back
thumbnails, selection and clearing, multiple selection, atomic group selection,
group/ungroup, editor visibility, locking, four order actions, drag ordering,
confirmed removal, Add text/Edit Text and composition spacing. Group membership
is indicated on the original flat rows; grouping never changes the layer order
or invents a new folder hierarchy. Text cannot enter artwork groups. Hidden
layers are deselected; hidden/locked layers cannot be selected from the list.
Visibility remains editor-only and does not change publication inclusion.

The review selector outside the tools offers Composition, Spacing study,
Long list (24 layers), Empty Display and Read-only examples. Multiple selection
can use Shift-click or the explicit button for touch. Arrow keys and Home/End
move between eligible layer buttons; Enter selects. Clicking a row trash control replaces that same row with a removal question,
a Cancel icon and a confirmation checkmark in the original trash position.
The row keeps its height, and multiple removal states the affected count.
Removal focuses Cancel; Escape or Cancel restores the row and trash focus.
Toolbar removal outside Layers retains its contextual confirmation. Row actions are unboxed,
and the selected row uses a quiet fill and leading mark.

The preview imports the production group helpers and single-layer availability
checks. Composition spacing feeds disposable, quantized bounds into the real
pure gutter validator; overlapping layouts, groups, locks and hidden layers
are rejected rather than silently rearranged. The spacing study provides a
valid arrangement to try. These adapters have no session/store/persistence.

This is a visual and interaction reference, not the production Layers editor.
Layer duplication, drag order and multi-selection operate on sample values.
Shared selection actions are illustrated; group-bound transforms, undo, real
asset loading and saving still belong to the existing Display implementation.
Individual Color/Transform/FX fields request a single selection rather than
pretending to support mixed-value editing. The retained Properties specimens
and production fixture links remain available for coverage comparison.

### Text review preview

The Text tab hosts the existing ArticleEditor and TextTools through the shared
tools provider. It includes selection formatting and mixed/reset numeric values,
paragraph spacing/alignment, links, undo/redo, outline and find/replace, Focus
writing, document defaults, title styles, columns/padding, background/edges,
selected artwork controls and validated article backup import/export. Insert
page break is a direct action below the formatting controls, before disclosures;
it uses the existing cursor, article node and undo history.

The example selector provides Display text, a standalone article, an illustrated
article, empty content and a read-only article. Article state has one owner in
the disposable workspace; shared Color and Grain edit that same appearance.
Each editor keeps its own selection/history across tool tabs and object changes.
Focus writing relocates the same editor and explicitly reports that example
changes are not saved. Changing the Text example or resetting the workspace
deliberately starts a fresh editor. Duplicate articles edit independently.

The preview creates no draft store, storage writes, network artwork requests or
publication operations. The illustrated sample is a local SVG. Backup download
and import affect only this local example. Display connection, moving between
modules and Read as pages remain disabled references requiring a real host.
The Layers artwork is a plain-text projection for composition; rich editing is
shown in the dedicated Text canvas. Production text rendering/pagination and
saved module integration remain owned by their existing implementations.

One scroll region contains the Text tools, with the shared tabs outside it.
The actual editor is loaded on first Text selection. Styles remain scoped to
the design-system preview. The shared editor's page-break placement and optional
Focus writing status/class props are the only production component changes;
existing callers retain their default saved-status wording and visual style.

### Library review preview

The artwork icon opens a separate Library over the left side of the example
Workbench. The canvas and tools keep their positions and selection. The preview
uses OwnerSystemWorkflowLibraryWorkspace, its presenter, browsing hook, menus,
image decoding and category-drag behavior. Flat styles are scoped to this
reference; the production drawer's material and placement behavior are retained.

Coverage includes All Assets / Owned / Created / Unsorted, collection browsing,
category sections, search, collection filters, sorting, labels, card size,
multiple selection, independent attachment expansion, category membership,
category/section creation and renaming, inline deletion confirmation and section
deletion that retains its categories. The real category domain functions update
one in-memory example workspace. Category dragging and context menus are active.
Sidebar resizing retains the existing pointer behavior within the bounded layout;
the app's outer drawer resize is omitted from this embedded reference.

Closing preserves search, filters, selection, image expansion and organization.
Reset workspace restores the example content and browsing preferences. Explicit
preferences and image-cache inputs isolate the sample from the app's module-level
defaults; existing callers keep those defaults. The real editor/draft store,
profile resolver, chain clients and library persistence are never instantiated.
All preview artwork is local SVG and relationship labels are sample data.

The example selector also offers loading, empty, unavailable, retained-results
and created-source failure states. Retry restores the available example. This
sample covers browsing and organization; assets are non-placeable, and actual
module placement, publication and saved organization remain in the production
fixtures. No new Library feature or production styling migration is claimed.

The review exposed two small existing UI defects: generic asset loading now
says Loading assets, and the rename form initializes category/section names
from its actual target. The legacy rename dialog type remains supported.

## Reuse decision

Start with an existing complete component when its purpose matches. If only the visual treatment is shared, reuse its material recipe and native HTML. Add a new abstraction only when concrete consumers share behavior as well as appearance. Module-specific logic stays module-specific.

### Current production tactile button

Import `workflowTactile.css`, provide the material scope, then give a native button `workflow-tactile-control`. Add `workflow-tactile-control--quiet` for command rows. The consuming component supplies size, layout and shape within the accepted recipe.

```jsx
<div data-workflow-material="tactile">
  <button type="button" className="workflow-tactile-control"
    aria-pressed={enabled} onClick={onToggle}>
    Snap to grid
  </button>
</div>
```

Use `aria-pressed` for a toggle, `aria-expanded` for an open disclosure/popup, and `aria-selected` only for a real selection widget. Do not add `aria-selected` to an ordinary action merely to obtain a style. The existing `data-active` hook supports contextual creation state; it does not replace accessible state where one applies.

| State | Current production material and behavior |
| --- | --- |
| Default | Raised fill, thin edge, short depth |
| Hover | Lightens on hover-capable pointers; disabled keys excluded |
| Press | Recesses without changing hit bounds |
| Selected/open | Recessed fill and warm ink; persists while hovered |
| Keyboard focus | Separate 2 px outer ring; independent of selection |
| Disabled | Native disabled behavior, quiet ink, no hover/press depth |
| Loading | Component-owned busy state and truthful status; material alone does not implement it |
| Reduced motion | Tactile transition removed |
| Forced colours | System colours and visible marks/borders replace material cues |

Shared selected controls retain a mark. Creation-bar selected keys intentionally omit the underline because recessed material is their second visual cue; they have a forced-colour highlight treatment. Do not apply that exception to all command rows.

### Native fields and disclosure

`workbenchToolChrome.css` styles native fields inside `data-window-chrome="tactile"`. A `workbench-tool-window` opts a companion into the shared density. Labels remain explicit; placeholders are examples, not names. Use native `select`, checkbox, range and `details/summary` where they meet the interaction need.

Formatting state, mixed values, incomplete numeric input and commits are not CSS responsibilities. Reuse the relevant module's existing input/controller. `TextTypographyInput.jsx`, for example, preserves incomplete input locally, commits valid edits, supports mixed/reset values and restores the originating state on Escape. Do not reuse it for another domain without matching those semantics.

Disclosures organize secondary controls. Closing one must not destroy an editor's history or silently reset authored settings. Use a real disclosure label such as “Dimensions”, “Background and edges” or “Writing tools”.

### Artwork transform controls

`ArtworkTransformTools` accepts `disabled` and `onTransform`. It emits `ROTATE`, `MIRROR_HORIZONTAL` or `MIRROR_VERTICAL`. Its caller supplies the actual target and operation. Display and Image continue to own crop, transform validation, undo and saving. The component does not discover a target through global DOM selection.

### Creation toolbar

`WorkbenchToolbar` is presentational: current tool, Library state, inspector eligibility and command trees arrive as props. It owns popup state, search and local focus navigation.

| Input | Meaning |
| --- | --- |
| `activeTool`, `onToolChange` | Current host tool and explicit selection action |
| `libraryOpen`, `onOpenLibrary` | Library availability/state owned by the host |
| `actions`, `addCommands`, `shapeCommands` | Command trees with id, label, icon, optional children, disabled reason, selection and callback |
| `layers`, `info` | `{ enabled, open, reason, onToggle }` for the current inspector context |
| `hidden` | Hide the toolbar and end its popup state |
| `actionRequest` | Existing request mechanism for opening Actions |
| `before` | Module-owned contextual bars hosted directly above creation |

Search includes nested commands and their parent context. Disabled commands show a meaningful reason. Arrow keys and Home/End move through eligible commands; Escape closes and returns focus. Popup opening, outside interaction and disposal clean up listeners. The production toolbar currently retains its native Tab stops alongside arrow navigation; do not describe it as a fully implemented one-tab-stop roving toolbar without further work.

Toolbar measurement covers the complete stack and supplies temporary `--workbench-toolbar-clearance` and width to the host. The host owns the dock-relative offset and camera placement. Fixed guesses must not replace that measurement.

### Window shell and host

`OwnerSystemWorkflowDetachedWindow` is the shared presentation shell. Its important inputs are `chrome`, `menuSurface`, `title`/`titleContent`, `controls`, `children`, optional `background`, classes, styles and supplied pointer/resize elements. It forwards its root ref. It does not own save operations or window gestures.

`WorkbenchWindow` in `DisplayInstrumentWindow.jsx` supplies host geometry and lifecycle. A module explicitly supplies an authored resize target when appropriate. Companion tools use their established fixed-width, content-fitting configuration and no resize handles. Use the same existing host for movement, bounded fitting and focus; do not create another draggable-window implementation in a new tool.

One outer companion surface owns vertical scrolling. Avoid nested scroll containers for Layers, Shape settings or Text subsections. Height measurement includes titlebar, border and padding and reserves the measured bottom controls. Changing the viewport must not resize the artwork.

### Selection, Properties, Layers and Artwork info

Properties is one contextual window for module fields and dimensions. `ContextActionBars` hosts inspection/placement and selection rows immediately above creation. `ContextToolContent` accepts `inspection`, `actions` and property children; its portals preserve the original module owners and callbacks. Display supplies In place/Lift, placement and selection actions; Image supplies fit/crop and image actions; Shape supplies its existing selection actions. Crop temporarily replaces the inspection row and hides selection actions. Text keeps its separate inspector.

`contextToolbar.css` supplies the same row geometry to production and the workspace reference. The production stack inherits the shared flat finish. Rows use native horizontal overflow, 36/44 px targets and 18 px icons with 1.5 px physical strokes. Arrow keys and Home/End move among enabled buttons; sliders retain native keys. The existing toolbar observer measures the whole stack for popup, camera and companion-window clearance. No parallel save, history or viewport state was introduced.

The reference's Properties selector presents the complete control inventory for each of those contexts:

| Context | Controls and conditional examples |
| --- | --- |
| Image | Inspect; Rotate and both Mirrors; Crop; Duplicate; Fit inside / Fill canvas; Width / Height / Set size; Library drop Add side / Replace side; Remove side; publication inclusion. Examples include artwork, empty Image, a side turn and the module limit. Crop exposes zoom, Native fit, Cancel and Done. |
| Display artwork | Inspect; transforms; Duplicate; four layer-order actions; Crop; exact dimensions in canvas units; In place / Lift; Artwork info; Fit inside Display / Cover Display / Centre. Multiple and grouped selections expose Group/Ungroup; locked selection disables editing; Text selection retains its five actions, dimensions and Edit Text; no selection has an explicit empty example. |
| Shape | Duplicate, four order actions and Delete; shape picker; Name; Colour; Opacity; exact dimensions, Apply size and Make square; Show shape and publication inclusion. Rectangle has Grain; Grid has Snap, spacing and line width; retained Texture has noise strength/scale. The duplication limit is represented. |

These are interface specimens, not another editor. Fields and control state are local. Inspect, Artwork info, Edit Text and artwork transformations describe their actions without rendering or saving artwork. Reset restores disposable values. Theme changes and close/reopen preserve the active sample; switching example state deliberately starts a fresh sample. Each variant links to its current production fixture and owning source.

Production Properties markup is still coupled to its module session. The reference does not extract or replace those modules. The browser parity check opens the running Image, Display and Shape fixtures and compares button/field names and numeric ranges with the specimens, including the empty Image's disabled controls. Shared helpers stay imported directly; the reference adapters must be reviewed when a module's controls change.

Layers is the structural view of the active Display's current Grid, in front-to-back order. It shares selection with the Stage. Temporary editor visibility is not public/private visibility. Artwork info follows the selected source projection and does not become an alternative metadata store. Missing, closed or invalid targets hide tools instead of selecting unrelated content.

Selection activation comes from click or keyboard focus, not hover. Hover can reveal quiet action strips without selecting the module. Resize marks and their larger screen-space hit targets remain separate. Gesture cancellation and commits go through existing host/module boundaries.

## Module patterns

| Surface | Visual and interaction contract | Data/behavior owner |
| --- | --- | --- |
| Display | Clipped Stage, multiple Grids, quiet overlay controls, independent tools | Display session and renderer |
| Image | Borderless source media, one artwork per side, quiet Next/close/Inspect, explicit activation bounds | Image module and shared media renderer |
| Text | Same article across Write, Read, Visitor and Display; separate formatting tool | Article/editor session |
| Shape | Background rectangle/grid patch with authored colour, opacity and grain | Shape content; host supplies geometry |
| Identity | Trusted identity header plus authored presentation, theme-aware bevel | Identity projection/session; host supplies window |
| Keeper | Dock and independent tactile settings; artwork behavior remains local | Keeper |
| Mini App | Shared host window around an isolated external application | Host connection/lifecycle; remote app content |
| HTML artwork | Transparent isolated frame with quiet host controls | HTML document animation; host lifecycle |
| Workbench Index | Screen-sized navigation instrument with saved destinations | Index configuration and camera controller |
| Reception | Same public modules inside a bounded presentation stage | Reception host and shared module sessions |

Authored Display/Text edges and grain are not interface chrome. Image remains free of added texture, shadows or radius. Artwork documents do not inherit control styling. Mini apps' internal interfaces cannot be standardized through parent CSS.

## Workflow recipes

### Compose and save

Library supplies a canonical asset/resource. A compatible module interprets the drop, authored geometry and content. The existing store commits one completed operation and its undo step. A failed save leaves recoverable work visible and does not announce success. An interface rearrangement never duplicates or migrates content as a side effect.

### Focus, inspect and return

Focus frames the selected module through the camera controller. Inspect reveals the selected artwork through its existing renderer. They are distinct actions. Escape first belongs to the nearest active modal, inspector, gesture or selection before it consumes camera Back. Temporary view state does not enter authored geometry or publication data.

### Window and tool lifecycle

Open with the correct target, retain the originating content/session, fit the tool within the available viewport, and return focus on closure. Retargeting must end obsolete gestures. Module closure, Preview suspension and disposal retire registrations, timers and listeners. Do not invent a global shared editor because multiple windows look alike.

### Public presentation

Owner, Visitor, reception and inspection share module rendering. Visitors may use exposed reading, side navigation, playback and temporary window interactions. They cannot write the maker's draft. Private material is absent from public data, not merely hidden with CSS. A theme choice grants no capability.

### Publication and recovery

Keep local save, publication preparation, upload and confirmed publication visually distinct. Existing publication components retain their authority and validation. A visual button component never performs a wallet action on its own. Loading, successful empty, unavailable, stale and failed reads need different messages and applicable recovery actions.

## Composition templates

These are arrangements of existing components, not additional implementations:

| Template | Assemble |
| --- | --- |
| Owner Workbench | Existing host + content modules + creation/camera controls + targeted companion tools + navigation dock |
| Visitor canvas | Shared module renderers + public navigation/inspection + temporary session interaction |
| Reception | Existing bounded reception host + Identity body + ordered public module presentation |
| Focus writing | Existing article/editor in native modal + save/recovery status + return action |
| Recovery surface | Current boundary state + source/context + a meaningful retry or navigation action |

Do not treat the catalogue's documentation cards, navigation sidebar or hero as new product components.

### Reference Color selector

The Color tab has one inline hue ring and a centred equilateral white/hue/black
triangle. It replaces the native browser colour popup; the swatch is display-only.
The ring and triangle update live while dragging with mouse, pen or touch.
Pointer capture retains the chosen instrument outside its bounds. Escape, cancelled
capture, blur and retargeting cancel the originating gesture. Arrow keys work on
both controls; Home/End select hue endpoints or white/black respectively.

The editable Hex field accepts 6 digits live, and 3-digit shorthand on Enter/blur,
with or without #. Invalid input stays visible with an error and never changes
the artwork; Escape restores the current code. Hue survives white, grey and black.
Saturation/lightness and opacity remain precise alternatives for keyboard users.
Locked/read-only selections cannot change through any of these controls.

colourModel.js owns colour conversion, ring/triangle coordinates, projection and
palette rendering. colourPreview.jsx owns this input's temporary gesture/draft
state; workspace/selected article appearance still owns the resulting hex.
colourPreview.css replaces the old decorative rules in workspacePreview.css.
No eyedropper or other new colour service is introduced.


### Composition continuity and text colour (2026-10-15)

WorkspacePreview owns the example objects and canvas context. Inspector tabs
only select controls; LayerScene renders the same Display layers across tabs.
TextPreview retains each editor's DOM/history when its presentation host changes.
The Color adapter reads the existing editor range and applies textStyle marks,
or the existing titleColor/default colour fields. It does not store a second
article. Mark-only gesture previews preserve earlier typing history and restore
the captured range on cancellation. The plain article title remains one style.

Layers show an insertion line at the actual front-to-back list boundary, including
group boundaries. The workspace viewport and inspector own native overflow;
their boundaries allow scrolling to continue on the reference page.


### Navigation sidebar study (2026-10-15)

`navigationPreview.jsx/css` supplies the reference workspace navigation and
responsive shell. WorkspacePreview owns Library visibility and sidebar collapse;
the existing Library workspace still owns browsing, filters and selection.
LibraryWorkspace and LibraryPresenter accept an optional `navigationHost` DOM
target. The same category tree is portalled into that host, and asset-to-category
drag hit testing uses its bounds. The production default remains the existing
inline navigation and resize handle. No routes, storage, schemas or placement
features were added. Account/discovery/sharing entries are explicitly unavailable.
