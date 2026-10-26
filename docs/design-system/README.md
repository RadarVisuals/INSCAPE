# INSCAPE design system

Version 1.0.0 · established 2026-10-14

INSCAPE's design system makes its existing interface understandable, reusable and verifiable. It joins the production tokens, material recipes, components, interaction patterns, content rules and contribution process in one reference.

The product is an artist's online desktop. The interface gives people precise instruments for arranging and experiencing independent artwork. A coherent interface must preserve the artwork's identity, transparency, proportions, authorship and freedom of expression.

## Authority and scope

The [active contract](../INSCAPE_ACTIVE_CONTRACT.md) remains the sole product-direction authority. [Creative intent](../INSCAPE_CREATIVE_INTENT.md) explains the product's meaning. This handbook documents their implementation; it does not replace them or approve new features. The code describes what currently runs. Accessibility criteria describe what must be verified, not a certification of every existing surface.

This release establishes the complete reference structure for the current product: foundations, material families, component inventory, workflow patterns, accessibility, language, ownership, maintenance and verification. It preserves the existing production UI. It is not a claim that every local CSS value has been converted into a shared token or that every retained surface has been migrated to tactile controls.

## Chosen workspace direction, 2026-10-19

The founder identifies the existing creative-workspace layout as the intended
design for the next composition workflow. Shared Layers, Color and the other
tools belong together, with panels that can detach, rejoin the dock or hide.
Standalone Workbench artwork needs deliberate layer ordering and removal via
Layers, replacing the artwork hover-close/minimize pattern. Display remains
experimental because choosing between it and solo Workbench Images made the
workflow confusing. Its return is undecided.

The first local production slice now has Workbench Layers, Transform, Color, Image, Shape and FX,
with each tab detachable and regroupable in movable docks. The remaining tool
migrations are incomplete. Dock layout is in-memory editor state, not saved
across reloads. See [current docking checks](../audits/2026-10-21/tool-docking.md).
The 22 October extension also stacks panes vertically in one movable frame,
with independent active tabs and a resizable divider. Pane edges stack tools;
tab strips join tabs. See [stacked-dock checks](../audits/2026-10-22/stacked-tool-docks.md).
Image retains its module-owned side/drop/publication controls; its action and
fit bars stay in place. See [Image migration checks](../audits/2026-10-21/image-tools.md).
Shape retains its name, pattern and publication controls;
Color, Transform and its toolbar actions stay separate. Narrow dock tab strips
scroll horizontally and reveal the selected tab. See
[Shape migration checks](../audits/2026-10-21/shape-tools.md).
Shape's Show shape and Grain strength controls were subsequently removed by
founder request. Layers owns visibility. After the founder approved Blur, FX now
provides Grain for the selected rectangle and Blur for Shape paint. It uses
module-owned previews, saving and Undo, with one completed edit per slider
gesture. See [FX checks](../audits/2026-10-21/fx-tools.md). Other module targets
remain outside this slice. The founder subsequently chose to keep Text separate:
its independent movable, resizable window now shares the Layers shell and flat
Carbon/Mist material. Colour and frame geometry remain in Color/Transform;
typography, paragraphs and article tools stay in Text. The workspace reference
uses that same independent window. See [Text window checks](../audits/2026-10-21/text-panel.md).
Its subsequent hierarchy refinement separates Format text from Article settings,
with explicit selection/whole-article scope and grouped controls. Focus writing
retains its existing behavior. See [hierarchy checks](../audits/2026-10-21/text-hierarchy.md).
The font-clarity refinement displays the actual selected/typing font and moves
article defaults behind Change default style, with explicit Default font/size
labels. See [font clarity checks](../audits/2026-10-21/text-font-clarity.md).
The 22 October finishing pass clarifies color defaults, Library-drop outcomes,
Shape selection and Layers group labels. The workspace reference also drops
stale Rotation/Show shape controls and matches the agreed Image Color and Shape
FX scope. See [tool-window finishing checks](../audits/2026-10-22/tool-window-polish.md).
Keeper now uses the workspace reference's compact flat dock and shared artwork
slot, with separate movable settings in the same material. The founder's follow-up
makes it a screen tool at lower right, independent of canvas zoom, pan and groups.
Keeper identity/settings follow Workbench switches. Dock positions now persist
per profile in this browser (2026-10-23 editor-preferences refinement). Library drops and release/return stay
Keeper-owned. The future minimap will share this corner.
See [Keeper dock checks](../audits/2026-10-22/keeper-dock-style.md).
The [screen-placement correction](../audits/2026-10-22/keeper-screen-position.md)
supersedes that first pass's canvas positioning.
Focus writing and saved window arrangement remain deferred.
The current workspace preview uses disposable values and a Display-scoped layer
adapter; that reference alone does not prove Workbench Image ordering, saved tool docking or
publication of artwork order. See the [authoritative clarification](../INSCAPE_ACTIVE_CONTRACT.md#workbench-composition-direction-2026-10-19).
The following dated section records earlier reference development; its old
workspace-review wording is superseded by this clarification. Individual
unimplemented capabilities still need defined scope and verification.

### Layers groups clarification, 2026-10-20

The founder chose Layers groups as contiguous composition blocks for Images,
Text and Shapes, with individually editable members. Existing Workbench groups
still implement navigation order, compact stacks and temporary spread layouts;
they are not already composition blocks and must not be silently converted.
See the [active decision](../INSCAPE_ACTIVE_CONTRACT.md#layers-composition-groups-decision-2026-10-20)
and [reconciliation proposal](../audits/2026-10-20/design-system-review.md#compositieblokken-en-bestaande-workbench-groepen).
This clarification changes documentation only.

### Multiple Workbenches clarification, 2026-10-20

The founder chose multiple named Workbenches as independent composition canvases,
with a profile overview and visitor switching between published Workbenches.
Layers and composition blocks belong to the active Workbench; Library source
material stays shared. Folder-like Workbench stacks are no longer a required
organizer in the new UI. Current references still demonstrate the single-canvas
implementation. See the [active decision](../INSCAPE_ACTIVE_CONTRACT.md#multiple-named-workbenches-direction-2026-10-20)
and [workflow proposal](../audits/2026-10-20/multiple-workbenches.md).

## Reference direction, 2026-10-14

The founder requested a smaller, flatter toolbar and reduced the theme direction to Carbon and Mist. Overview and Components preview that treatment on the existing WorkbenchToolbar component, with rectangular buttons using 5 px corners and a 9 px outer bar radius (5 px plus the 4 px inset), matching 5 px fields/menu rows inside 9 px popups with the same 4 px inset, an inverted active tool, quieter open-panel fills with a small state mark, Add inside the same toolbar with matching spacing, and two rows of 44-pixel targets on narrow screens. Carbon previews dark chrome and Mist light chrome, including Library and text menus. The reference uses neutral accents; search focus is a quiet neutral border, with system focus retained in forced colours. The shared toolbar uses minimal popup presentation: no title/close rows, full-width Actions search without a divider, and a Back row for nested menus. Its CSS is shared by the reference and application. Components demonstrates flat control states, complete Image, Display artwork and Shape Properties specimens with conditional states and a two-theme state sheet. The retained bevel shell remains collapsed as a migration reference. Build with it separates Agreed, Needs review and In the app. Source links open a read-only source viewer instead of loading test files as application scripts. Principles live in Build with it; the overview contains only the toolbar, themes and a brief preview caption. The creation toolbar, camera rail and their menus now use the approved shared material in the application (2026-10-16); other production instruments retain their existing treatment. All preview actions remain in memory. Production theme choices, saved values and authored surfaces have not been migrated in this review pass.

## Start here

For Reception, overview, composition presentation and shared navigation, use the
[Hanssen reference](../design-references/2026-10-25-hanssen/README.md), chosen on
25 October. Its page links and saved screenshots define the overall visual
direction. Desktop remains deferred. Read the active contract first; this
design-system workspace continues to document the existing composition tools.

The static Reception implementation now uses `src/reception/ReceptionCanvas.jsx`
for owner preview and public reading, with a separate `ReceptionEditor.jsx`.
Its partition, navigation clip and mobile flow own presentation geometry; the
Library, Image renderer, Text content controls and Color controls are shared
with Workbench. See the [implementation audit](../audits/2026-10-26/static-reception/README.md)
for the replacement disposition and actual verification evidence.

From the project root, using the Node version declared by the project:

```sh
npm run design-system
```

Vite opens `/design-system.html`. The reference includes live production toolbar and window components, Carbon and Mist surface previews, interactive control states, a searchable token explorer, component responsibilities and links to disposable full-workflow fixtures. It has no profile connection, wallet flow or draft store. Changes in its examples remain local to that page.

The reference is a development entry. It is outside `public/` and is not included in Vite's production entry list. It introduces no new production runtime. Do not add it to the public application bundle merely to make documentation available.

| Reference | Use it for |
| --- | --- |
| [Foundations](FOUNDATIONS.md) | Colour, typography, spacing, density, geometry, icons, motion, layers and themes |
| [Components and patterns](COMPONENTS.md) | Reuse APIs, state behavior, workflow and module boundaries |
| [Accessibility and content](ACCESSIBILITY.md) | Keyboard, touch, contrast, focus, motion, status and interface language |
| [Governance and adoption](GOVERNANCE.md) | Source ownership, contribution, migration, versioning and release checks |
| [Research](RESEARCH.md) | Primary sources and how their lessons apply to Inscape |
| [Verification](VERIFICATION.md) | Checks actually run for this version and known limits |
| [Component registry](../../design-system/registry.js) | Navigable mapping to production code and evidence |
| [Generated token inventory](../../design-system/tokens.generated.json) | Values, aliases, selector/media scopes, source lines and checksums |

## Principles

1. **Artwork leads.** Chrome supports making and reading. It cannot reinterpret authored content.
2. **Scope is visible.** The current Display, Grid, Image side or article determines which controls apply. A tool must identify that target.
3. **One fact has one owner.** CSS owns visual values; modules own creative behavior; the host owns windows and navigation. Secondary views derive from those facts.
4. **Interaction is legible.** Selection, focus, press, loading and disabled states remain distinguishable. Precision does not require tiny or hidden input targets.
5. **Experience is continuous.** Owner, Visitor, reception and inspection share module rendering. Different capabilities do not justify unrelated visual systems.
6. **Change follows evidence.** Start from production references and exercise real states. Preserve current content and recovery guarantees; follow the active contract's development-data policy instead of adding hypothetical legacy compatibility.

## System architecture

```text
Product direction                    INSCAPE_ACTIVE_CONTRACT.md
Product meaning                      INSCAPE_CREATIVE_INTENT.md
  ↓
Global foundation                    src/inscapeTokens.css
Structural themes                    latticeMenuSurface.css
Workflow roles and geometry          ownerSystemWorkflow.css
  ↓
Material                             workflowTactile.css / workbenchWindowChrome.css
Companion density                    workbenchToolChrome.css
Component geometry                   component-owned CSS
  ↓
Production components               native controls + existing React components
Module and workflow behavior         existing host/module controllers
  ↓
Reference and verification           design-system/ + browser-tests/ + this handbook
```

The reference reads the same CSS and imports the same presentational components. The inventory is generated from CSS; it is never imported by the production application. Editing its JSON does not change the UI.

## Typical change

Locate the existing component and its owning stylesheet. Inspect its state and persistence inputs. Reuse the appropriate material and semantic roles, preserve behavior, update the registry or guidance when the contract changes, regenerate the inventory, then verify in the component's real host.

```sh
npm run design-system:tokens
npm run design-system:check
npm run test:design-system
# Start a local server at port 5217 for the existing browser harness:
npm run dev -- --host 127.0.0.1 --port 5217 --strictPort
# In another terminal:
npm run test:browser:design-system
```

Set `INSCAPE_TEXT_ROOT` to test another local origin. `INSCAPE_BROWSER_EXECUTABLE` chooses an installed Chromium browser. Browser artifacts go to `.browser-test-runtime/design-system/` unless `INSCAPE_BROWSER_OUTPUT` is supplied.

## What stays outside the visual system

The reference does not own authored geometry, cropping, asset sources, article content, permission checks, saved schemas, wallet authority, publication or animation engines. It documents how their controls communicate. Introducing a visual primitive never grants it those responsibilities.

## Reference implementation and visual export

The reference uses React JavaScript and ordinary CSS. It introduces no Tailwind
or TypeScript migration. Shared geometry lives in `src/inscapeTokens.css`; `referenceTokens.css` aliases
it and adds preview-only values. `workflowFlat.css` supplies the opt-in flat
material to the real creation toolbar and reference instruments. Other app
surfaces keep their current material. `referenceMaterial.css` styles reference
icons outside those instruments. `reference.css` owns the reference page and documentation layout;
`workbenchToolbar.css` owns toolbar geometry, responsive states and menus for
both hosts. `toolbarPreview.css` contains only demonstration placement and popup
height. `propertiesPreview.css` and `controlStates.css` retain their preview recipes. The Library
column geometry belongs to `libraryPreview.css`; navigation owns its surrounding
workspace grid. Existing tokens supply repeated interface sizes without changing
authored example geometry. The token inventory includes production and reference CSS separately.
Portal menus and focus writing inherit the reference tokens from this entry
point, so their corners cannot drift away from the toolbar's 5/9 px relationship.

`WorkspacePreview` owns disposable selection, example content and camera state.
`selectionPanels.jsx`, `colourPreview.jsx`, `navigatorPreview.jsx` and
`previewControls.jsx` render bounded instruments through explicit inputs and
actions. Library and Text still reuse production components. Artwork values
remain sample content rather than interface tokens.

Build a standalone visual preview with:

```sh
npm run design-system:build
# Or target an existing Site with .openai/hosting.json declaring static.directory = dist:
npm run design-system:build -- --out-dir /absolute/path/to/site/dist
```

The default output is `dist-design-system/`, outside the application production
build. The build checks inventory freshness and replaces only that dedicated
output, or the verified generated directory of a declared Site. It selects
`referenceLinks.hosted.jsx` instead of `referenceLinks.local.jsx` through an
explicit Vite alias. No source-code replacement or regex editing is involved.
The export rejects raw-source modules and contains only compiled previews,
in-memory workflow fixtures, token inventory and referenced public assets.
Internal documents, environment files, source viewer and saved drafts are excluded.
`preview-manifest.json` records that boundary and the copied public assets.
The local development reference retains its source viewer and documentation links.

## Navigator and Keeper in the application

`NavigatorContent.jsx` and `navigator.css` own the shared map gesture, Home and
zoom controls used by the reference and the application. `navigatorPreview.jsx`
supplies disposable example geometry; `WorkbenchNavigator.jsx` projects the real
composition and calls the existing camera controller. The old reference-only
map/zoom recipes have been removed. Keeper continues to share `KeeperDockContent`.

In the app both windows start at lower right above the bottom controls, Navigator
to the left. They move independently and retain positions across
Workbenches and reloads in this browser. Very short screens scroll each window's content. Keeper settings
remain beside or above the pair. See the
[local verification record](../audits/2026-10-23/navigator.md) for screenshots,
interaction checks, content/performance evidence and production budgets.

## Sidebar in the application

`WorkspaceNavigation.jsx` and `workspaceNavigation.css` now supply both the
reference and owner sidebar. The founder removed the redundant navigation
filter from both hosts; Library's artwork search remains separate.
`OwnerSystemWorkflowSidebar` connects the existing
destinations, inspection lock and temporary screen clearances. The old bottom
application bar and its styling have been removed; creation tools remain
independent. Account/sharing controls remain disabled in the disposable
reference and use existing explicit actions in the application.

The expanded desktop sidebar hosts the existing Library tree through its
existing portal slot. Folding or switching to a narrow viewport returns the
tree to Library. There is still one browsing state. Narrow navigation scrolls
horizontally; a short phone viewport uses a single reopen button. Collapse state
survives Workbench switches and reloads as a profile-local browser preference. See
[sidebar checks and screenshots](../audits/2026-10-23/sidebar.md).

## Artwork info in the application

`OwnerSystemWorkflowMetadataContent` and `artworkInfo.css` supply one read-only
presentation for the reference, the owner Info tab and the Visitor window.
The title and collection lead, followed by description, creators and attributes;
technical provenance stays in Source details. Missing facts remain unknown.

Info is part of the shared owner tool dock, with the existing detach, stack,
rejoin, resize and close controls. Artwork info in the toolbar and Metadata in
the existing Display menu open that same tab. The dock owns owner visibility
and geometry; the existing module registry supplies content. Images register
the saved source asset for their visible side. Selecting a Shape, multiple
objects or an empty Workbench does not retain a previous Image's facts.
Visitor metadata keeps its independent read-only host.

No authored metadata, saved document fields or publication changes are added.
See [Info and filter-removal checks](../audits/2026-10-23/artwork-info.md).

## Library and saved editor arrangement

`libraryWorkspace.css` supplies the shared Carbon/Mist Library presentation.
`libraryPreview.css` retains reference hosting and preview geometry; old
production rail overrides have been removed. Library controls keep their current
actions and use reachable layouts below narrow navigation.

`editorPreferencesStore` owns profile-local Library preferences, shared dock
arrangement, Text frame/open/section, Navigator/Keeper dock positions and sidebar
folding. The browser stores this outside authored content, camera and Undo.
The design-system reference remains disposable. See the
[implementation and checks](../audits/2026-10-23/library-preferences.md).
