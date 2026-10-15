# Verification record

Reference version 1.0.0 · 2026-10-14 · local working tree

## Delivered scope

- Research synthesis covering 19 primary references.
- Handbook covering foundations, components, patterns, accessibility, content, maintenance and adoption.
- Interactive development reference using production CSS, the real creation toolbar, shared detached shell and artwork transform controls.
- Registry of 27 components/patterns with source ownership and evidence entry points.
- Generated inventory of 55 production CSS files: 452 scoped declarations and 267 distinct custom-property names.
- Inventory generator, stale-inventory check and behavioral browser checks.
- A discoverability link in the active contract. Its product authority remains unchanged.

The initial reference pass did not change a production component or stylesheet. Later dated notes record the optional toolbar presentation added during review. Existing user changes were preserved. No draft/publication schema, storage key, authored geometry, wallet behavior or media runtime was changed. The reference stays outside the production bundle.

## Checks actually run

| Check | Result |
| --- | --- |
| `npm run design-system:check` | Pass; generated data matches production CSS and registered source/evidence paths exist |
| `npm run test:design-system` | 2 passed |
| `browser-tests/design-system.browser.mjs` | 5 passed |
| Production toolbar + companion viewport browser suites | 12 passed after the two harness corrections below |
| `npm run build` | Pass; production budgets and runtime-isolation checks passed |
| `npm run build:check` | Pass; 822,422 initial JavaScript bytes |
| Full `node --test` / `npm test` command body | 1,196 passed, 1 failed out of 1,197 |
| Production manifest inspection | No design-system entry included |
| Whitespace check on added system/package files | Pass |

The full-suite failure is in `src/text/article.test.js:159`, “Text creation saves its requested Workbench position atomically and retains old default placement”. Current code returns `left: 1272`; the test expects `1300.5`. The Text implementation and that test were not edited in this work. This is an outstanding current-working-tree failure, so the whole application suite is not reported as green.

The production browser harness needed two narrow corrections: the companion test now honors the existing `INSCAPE_BROWSER_EXECUTABLE` environment convention, and the toolbar contrast measurement targets the toolbar rather than every tactile surface. Neither correction changes application behavior.

## Browser and visual evidence

The reference was exercised at 1440×1000, 390×844 and 320×720. Checks cover all seven reference sections, horizontal overflow, navigation focus, token searches and their empty result, selected/disabled control behavior, popup keyboard navigation/focus return, theme separation, native fields, example window focus recovery, reduced motion and forced colours. The examples create no local-storage records.

Production toolbar checks cover 1576×1244, 1440×900, 961×900, 960×900, 520×800, 390×844 touch, 320×568 touch and 844×390 touch. Companion checks cover 1440, 700 and 390 px widths with viewport/dock changes. The toolbar suite measured conservative tactile text contrast against its brightest material stop:

| Role | Measured ratio |
| --- | --- |
| Tactile primary ink | 9.12:1 |
| Tactile secondary ink | 5.67:1 |
| Tactile active ink | 5.24:1 |

Those measurements do not establish non-text boundary contrast or every theme's text contrast.

Screenshots were inspected for the wide overview/foundations, narrow components, forced-colour components, wide production toolbar, narrow production Actions menu and narrow companion tools. Files remain in `.browser-test-runtime/design-system/`; production fixture captures remain in `.browser-test-runtime/`. Logs there are ignored local artifacts rather than committed evidence assets.

## Environment and limits

Checks used the installed Chrome executable and bundled Node 24.19.0 on Windows. The repository requests Node 24.20.0; that exact binary was not available in the inspected runtime paths. Builds and tests completed with the bundled runtime, but exact-version validation remains unproven. The shell's default Node was 18.20.7 and was not used for the final full/build/browser runs.

No screen-reader audit, Firefox/WebKit run, representative user study, exhaustive application contrast audit or whole-product 200% text-resize audit was performed. The build retains its existing large-chunk warning while passing its explicit budgets.

The architecture was made easier to discover and check; it was not rewritten. Existing style ownership, module state and lazy runtime boundaries remain in place. Local style overrides, contextual accessibility concerns and the dock's code/contract difference are documented in the handbook.

All changes remain local and uncommitted. Nothing was pushed, deployed or published.

## Overview review pass, 2026-10-14

The overview now previews a flat toolbar using the unchanged production component and icons. Preview themes are Carbon and Mist. The live application and stored surface settings were not changed.

The five design-system browser checks and two inventory checks passed again. Screenshots were inspected at 1440, 390 and 320 px, including Mist and forced colours. Direct browser inspection confirmed nine shadow-free controls, a 44 px desktop bar, 44-by-44 px narrow targets, working tool selection, action search, Escape focus return, Add feedback, reduced motion and no localStorage writes. The selected Add fill and immediate system-colour feedback were corrected during that inspection. Production build and full application tests were not repeated for this development-only change. The runtime limitation above still applies.

The subsequent overview refinement inverts the toolbar on Carbon, retains dark controls on Mist, distinguishes the active tool from open panels, and replaces the orange search ring with a neutral focus border. All five existing browser checks passed. Fresh browser pages at 1714 and 390 px verified both themes with Library, Layers, Info and Actions open, equal 4 px outer insets, the 9 px search radius, action search, Escape focus return, reduced motion, forced-colour focus and no stored state. Screenshots of both themes and widths were inspected. These changes remain scoped to the overview.

The minimal-popup pass adds an optional presentation to WorkbenchToolbar, enabled only by the overview. Shapes and Add omit title/close rows; Actions uses a full-width search field without a divider. Nested menus expose Back with pointer and keyboard navigation. Add now sits inside the same toolbar shell. A dedicated browser regression covers these interactions at 1440 and 390 px, including dismissal, accessible popup names, parent navigation, focus return and equal shell insets. All 15 reference/production-toolbar browser checks and both inventory tests passed. The production build and build:check passed; existing dependency annotation, mixed-import and large-chunk warnings remain. The full application suite was not rerun. Screenshots of the overview, Shapes, Actions and Align were inspected. The production toolbar retains its default presentation; no live consumer enables minimalPopups. All changes remain local and uncommitted.

The corner-alignment refinement standardizes overview buttons, search fields and menu rows at 5 px, with 9 px outer containers and a measured 4 px inset (including the popup border). All six reference browser checks passed. Direct inspection at 1714 and 390 px confirmed matching left/top/right insets, hover shapes and sufficient keyboard-focus clearance, including forced colours. This supersedes the earlier 9 px search-field radius; production styling is unchanged.

## Reference consistency pass, 2026-10-14

Overview now contains the toolbar, two theme choices and one brief preview caption. Its statistics and callout were removed; the six principles moved to Build with it as a compact list. Decorative callout bars were removed across the reference. Foundations shows neutral keyboard focus, matching inverse Carbon/Mist instrument samples, and the 5 px control / 4 px inset / 9 px shell geometry.

Overview and Components now share CreationToolbarExample and the same flat CSS recipe. Components demonstrates shadow-free controls and the minimal toolbar menus, with retained production windows collapsed as migration references. The generic control toggle no longer shares state with the toolbar's Layers panel. Production components, CSS and persisted content were not changed by this pass. Production inventory remains explicitly labelled and preserves the current production values.

All six design-system browser checks passed at 1440, 390 and 320 px, including all-section neutral focus, reference navigation, keyboard/forced-colour/reduced-motion behavior, native-field focus recovery and no localStorage writes. The popup regression now exercises both Overview and Components at wide and narrow widths. Both inventory tests and the inventory freshness check passed. Additional browser measurements and inspected screenshots at 1440 and 390 px confirmed Carbon/Mist inversion, 5/9 px geometry, balanced 4 px popup insets, quiet search focus and independent example state. Production build and full application tests were not repeated for this development-reference-only change. The existing runtime and full-suite limitations above remain. Changes are local and uncommitted.

## Review follow-up and proposals, 2026-10-14

The confirmed reference defects are repaired: Mist supporting text uses a stronger
foreground, selected toolbar labels can grow at 200% text size, source-link targets
are larger, and registered files open as readable source rather than executing
browser tests. Source imports are lazy, limited by the registry, and resolve through
Vite before loading; failed reads expose a working retry and unknown paths stay
explicitly unavailable.

Build with it now distinguishes Agreed, Needs review and In the app. The flat
Properties/fields preview and Carbon/Mist button state sheet remain Needs review.
Properties reuses the existing detached shell and transform controls. Example
values stay in memory, survive theme changes and close/reopen, and reset explicitly.
Invalid dimensions retain the entered value with an associated explanation.
Focus returns to Reopen after closing and to Name when reopening. The compact
window title is retained because this is an independent window, not a toolbar menu.

Verification completed for this pass:

- All 8 design-system browser checks passed, including all seven sections at
  1440, 390 and 320 px; popup navigation/dismissal; reference state isolation;
  enlarged selected-label containment; source viewing and retry; and Properties
  field editing, validation, theme switching, reset and focus recovery.
- Both inventory tests and the inventory freshness check passed. Production
  token inventory remains unchanged.
- All 72 registered source-viewer destinations were opened and their displayed
  text compared with the corresponding file. All matched, including HTML fixtures.
- Automated axe checks reported no WCAG A/AA violations in Components at 1440,
  390 and 320 px in both themes, including a visible field error. Foundations and
  Implementation also had no reported violations at 1440 and 320 px in both themes.
- Properties/state screenshots were inspected at wide and narrow widths, together
  with enlarged toolbar text and Windows forced-colour rendering. The new stage's
  grid uses a shrinkable column so its window stays inside a 320 px viewport.
  Fields retain 5 px corners, no inset shadow, and 44 px targets on narrow/coarse layouts.

Automated checks are not a screen-reader audit or a complete accessibility
certification. Text-enlargement verification in this pass targets the reported
toolbar label, not every application surface. Production build and full app tests
were not repeated for these development-reference changes. The earlier Node
version limitation and unrelated full-suite failure still apply. No production
component, stylesheet, storage or authored content changed in this pass. Work
remains local and uncommitted; nothing was published.

## Complete Properties reference, 2026-10-14

The generic Name/Opacity sample was replaced with Image, Display artwork and Shape
specimens, preserving each panel's actual controls. Fourteen selectable examples
cover content, empty/locked/multiple/grouped/text selection, side turning, module
limits, Rectangle, Grid and retained Texture. Crop controls and Display dimension
validation provide additional interactive states. Examples reuse the existing
DetachedWindow, ArtworkTransformTools, PlacementSizeControls and ModuleGrainControl.
Reference-only adapters handle disposable values; no module, application storage,
wallet, publication or production stylesheet was changed.

All 10 reference browser checks passed after the replacement. One additional
parity check passed against the running production Image, Display and Shape
fixtures: button and field inventories and numeric ranges match; the empty Image's
disabled controls match as well. This totals 11 passing browser checks, with
editing, crop cancellation/completion/focus return, fit selection, close/reopen,
theme persistence, grouping, locked/text/empty states, shape ordering/deletion,
Grid sizing, retained Texture and reset covered. The inventory freshness check
and its two tests also passed.

Automated axe scans reported no violations across 18 base-panel combinations
(three panels, both themes, 1440/390/320 px) and 34 narrow conditional-state scans
(14 examples, crop in Image/Display, and Display size errors, in both themes).
Those scans also found no horizontal overflow. Screenshots were inspected for
all three panels at representative wide/narrow sizes, crop and forced colours.
Evidence is stored in the local design-system-properties artifact directory.

The control inventory comparison prevents another omission but does not establish
equivalence of the reference's simplified editing simulation with module saving,
artwork rendering or undo. Full app/build checks were not repeated because the
delivered changes are reference-only. Earlier environment and full-suite limits
remain applicable. Everything is local and uncommitted.


## Properties visual annotations, 2026-10-14

All thirteen annotations are addressed in the reference stylesheet and Image
sample: the Fit label, selected-state markers, native dropdown alignment and
neutral selection, trash-icon centering, unboxed action rows, number steppers
and the compact Grain row. Production files remain unchanged by this pass.

All 11 existing reference browser checks passed, including production control
inventory parity; both inventory tests and the freshness check passed. Additional
checks covered all three panels in Carbon and Mist at 1391, 390 and 320 px:
keyboard dropdown selection and Escape focus return, numeric keyboard/pointer
stepping, Grain keyboard input, selection marks, icon alignment and overflow.
All 18 combinations passed scoped axe WCAG A/AA checks. Representative panel,
open-picker and forced-colour screenshots were inspected. Local artifacts are
in the chat workspace's properties-refinement directory.

Browser verification used Chrome 155. Customizable select and native-stepper
enhancements have native fallbacks; other engines and screen readers were not
tested in this pass. Narrow/coarse layouts retain the existing 44 px control
height and three-column action rows; no viewport-specific annotation coordinates
were copied. No production build was needed for this reference-only change.
Work is saved locally and remains uncommitted and unpublished.

## Shared creative workspace preview (2026-10-14)

- Components now hosts an Affinity-inspired layout study with eight shared tabs,
  contextual inspection/selection bars and the existing real creation toolbar.
- The earlier Properties specimens remain in an expandable coverage reference.
- Local sample values, tab choice and preview camera state are separate. The
  prototype has no draft, publication or preference writes.
- Browser checks: 14/14 passed (11 retained reference checks plus 3 workspace
  checks). Includes selection scope, lock/unlock, duplicate/delete/reset,
  crop cancellation and focus return, numeric editing, colour/opacity/blur,
  keyboard tabs, Navigator and preservation of the production control inventory.
- Visual inspection: Carbon and Mist at 1440, 390 and 320 px; initial layout
  also checked at 1714 px. No horizontal page overflow. The panel stacks below
  the canvas at a component width of 820 px; tabs scroll and toolbars wrap.
- axe-core: no violations in the scoped workspace for Color, Layers, Transform
  and Image tabs in either theme at 1440 px. This is targeted automated evidence,
  not whole-application accessibility certification.
- Inventory check and both inventory tests passed: 55 CSS files, 452 declarations,
  267 distinct custom-property names.
- Runtime used: Chrome 155 and Node 24.19.0. Production build/full application
  suite were not rerun: no production component or stylesheet changed in this pass.
  Node remains below the repository requested 24.20 minimum.

Limitations: eyedropper, composition gutter and Keeper inhabitant are layout
references. The preview is not a finished module editor: real side assets,
complete Text authoring, multi-selection, drag/docking and production migration
remain for review. Shared effects and Navigator are proposals. Work is local
and uncommitted; nothing was deployed.


## Layers workspace refinement (2026-10-14)

The reference-only workspace Layers tab now demonstrates thumbnails and the
existing Display layer controls in the flat treatment. Grouping preserves the
visible stacking order, group visibility/locking apply atomically, and removal
has confirmation with cancellation/focus return. Composition spacing uses the
existing pure validator with quantized disposable geometry. Added review states
cover a valid spacing study, 24 layers, empty Display and read-only controls.
No production component, stylesheet, store or authored content changed here.

- Browser coverage: all 17 checks passed across the retained reference suite
  (11) and the expanded workspace suite (6). The final workspace run passed all
  six after correcting the sample-to-canvas coordinate quantization.
- New checks exercise multiple/group selection, lock/visibility, group order
  preservation, order actions and drag, confirmation/Escape/focus, empty/Add text,
  spacing validation/success, read-only controls, keyboard list navigation and
  touch multiple selection. Existing sample counts are derived from the example
  selector rather than fixed to the earlier five objects.
- Both themes fit at 1440, 390 and 320 px without horizontal page overflow.
  Screenshots were inspected for the grouped composition at 1440/320 px; selected
  row text keeps the theme foreground instead of inheriting inverse button ink.
- Scoped axe WCAG A/AA scans found no violations in 16 combinations: both themes,
  1440/320 px and grouped composition, empty, long-list and read-only examples.
  This does not replace screen-reader or cross-browser testing.
- Inventory freshness and both inventory tests passed. Production inventory
  remains 55 CSS files, 452 declarations and 267 custom-property names.
- Evidence: the chat workspace's layers-review directory. Chrome 155 and
  Node 24.19.0; the previously documented Node minimum mismatch remains.

The prior workspace note about unconnected gutter/multiple selection is
superseded for these local Layers examples. Full Text tools, Library, real asset
and saved/published output, group-bound transform semantics and detachable panel
groups remain outside this pass. No production build or full app suite was
rerun for reference-only files. Everything remains local and uncommitted.


## Inline layer removal refinement (2026-10-14)

The row trash action now replaces its own row with the removal question,
Cancel and a checkmark at the trash position. The pending removal remains owned
by WorkspacePreview, with explicit target IDs and the originating row; the
Layers component only renders it and recovers focus after restoring the row.
Toolbar removal from other tabs retains the existing contextual confirmation.

All six workspace browser checks passed, including grouped removal, Escape,
restored trash focus and toolbar deletion from Color. The regression verifies
that confirmation occupies the original row/control position without changing
list height. Additional checks passed in Carbon/Mist at 1440, 390 and 320 px:
pointer cancellation, unchanged row height, matching trash/check positions,
no horizontal overflow and no scoped axe WCAG A/AA violations. Wide Carbon and
narrow Mist screenshots were inspected. Evidence is in layers-inline-review
in the chat workspace. No production files or saved data changed; no production
build was needed. Changes remain local and uncommitted.


## Live Navigator dragging (2026-10-14)

Navigator now updates the existing temporary preview view during pointer drags.
The map owns only the active gesture and starting position; WorkspacePreview
remains the single owner of view/zoom. Pointer capture preserves dragging outside
the map, and grabbing within the view frame preserves the grab offset. Release
keeps the current view. Escape, pointer cancellation, lost capture, window blur
or document hiding cancels; disposal removes listeners and releases capture.
Touch-action and grab cursors are scoped to the map. No authored geometry,
production camera/controller, persistence or access boundary changed.

The six retained workspace browser checks passed, followed by the new focused
Navigator regression: seven checks in total. The new check covers Carbon/Mist
at 1440, 390 and 320 px, live canvas movement before release, frame-grab offset,
click-to-centre, capture outside bounds, release, Escape, lost capture, window
blur, secondary mouse exclusion, keyboard/zoom preservation, no localStorage
writes and no horizontal overflow. Chrome touch dispatch additionally verifies
live movement and pointer cancellation at 390 px. Wide and narrow screenshots
were captured during dragging and inspected. Evidence is in the chat workspace's
navigator-drag-review directory. Changes are local and uncommitted; no production
build was needed for this reference-only refinement.


## Text workspace review and direct page break (2026-10-15)

The Text preview now hosts the actual ArticleEditor/TextTools with disposable
articles. The workspace owns article state; each mounted editor owns selection
and undo. Shared Color/Grain target the same article appearance. The earlier
Text string-only stub is removed. Example resets explicitly replace editor
history; ordinary tab/selection changes and Focus writing preserve it. Fresh
Layers samples cannot reuse the IDs of retained standalone article examples.

Insert page break moved from Writing tools to the direct formatting area. It
uses the existing article node and insertion command. Focus writing accepts
optional status/class props so this example never claims that work was saved;
production callers retain their defaults. No production styling migration,
schema, draft store or saved-data changes were introduced.

- All 26 affected browser checks passed: 11 retained design-system checks,
  10 workspace checks and 5 production Focus writing checks. The final new
  independent-article regression passed after correcting its duplicate-button
  locator; the other nine workspace checks passed on the same implementation.
- Text coverage includes formatting, selection/history across tabs and targets,
  safe links, find/replace, Focus writing identity/focus/status, shared colour,
  page-break insertion/undo/redo, title/default/layout/edge controls, numeric
  Escape restoration, illustrated artwork editing, backup validation/export/
  import, read-only/empty states, independent duplicates and workspace reset.
  All local preview checks assert no localStorage writes or page errors.
- Carbon and Mist were inspected at 1440, 390 and 320 px, including expanded
  controls and Focus writing. A small colour-reset icon/range overflow was
  corrected. Final checks show zero horizontal tool/page overflow in all six
  combinations and zero scoped axe WCAG A/AA violations with disclosures open.
  This does not claim cross-browser or screen-reader verification.
- Production build and build:check passed; initial JS budget was 822422 bytes.
  Inventory freshness and both inventory tests passed: 55 CSS files,
  452 declarations and 267 custom-property names. No full application suite ran.
- Runtime: Chrome 155, Node 24.19.0. The Focus writing harness now accepts
  INSCAPE_BROWSER_EXECUTABLE because its default Edge executable is unavailable
  here. The repository requests Node >=24.20; that existing mismatch remains.
  Evidence is in the chat workspace's text-review directory.

The prior statement that complete Text controls were absent is superseded for
this reference. Display connections, moving Text between modules and Read as
pages are disabled host-dependent references. The Layers scene projects plain
text for composition; the Text canvas demonstrates rich editing. Real saved/
published integration, Library and detachable panel groups remain separate work.
Changes are saved locally, uncommitted and unpublished.


## Library reference review (2026-10-15)

The artwork-library button now opens the real Library workspace against local
sample assets and in-memory category organization. The reference retains the
production presenter, menus, browsing state and category-drag controller. It
supplies isolated preferences/decoded-image records and uses the real pure
category domain functions. The earlier informational Library placeholder is
removed. Closing retains browsing state; Reset workspace resets it. Placement
and saved/published integration are explicitly outside this sample.

Scoped CSS applies the flat Carbon/Mist treatment, 5/9 px controls/shells and
neutral focus. The embedded drawer stays within its Workbench without moving
the canvas or tools. It uses separate scrolling navigation/results areas and
a wrapping bottom control rail. The app's outer drawer resize is omitted here.
Original Properties specimens and all other workspace tools remain available.

Production changes are bounded to optional preference/cache injection with
existing defaults, correct category/section rename initialization (including
legacy rename compatibility), and an accurate generic Loading assets label.
No schema, store, profile resolution, holding/creator interpretation, module
placement, wallet, publication or production stylesheet changed.

- Browser checks: 26 passed (11 retained design-system checks, 10 workspace
  checks, 3 new Library reference checks and 2 existing Library loading/storage
  checks). The Library checks were repeated successfully after cache/preference
  isolation was introduced. Browser harnesses accept the installed Chrome via
  INSCAPE_BROWSER_EXECUTABLE while retaining their prior default executable.
- Covered search, collection filters, sorting, labels, card size, collection
  entry/return, image expansion with canonical counts, closing/focus return,
  category creation/rename, keyboard membership menus, asset-to-category drag,
  section deletion retaining categories, cancelled inline deletion, empty and
  loading/error/retained states, recovery, no canvas retargeting and clean reset.
  Reference checks verify no storage writes, remote requests or page errors.
- All 10 browser-model/category-domain unit tests and both inventory tests
  passed. Inventory freshness passed: 55 CSS files, 452 declarations and
  267 custom-property names. test:browser:design-system includes the new suite.
- Visual inspection and measurements covered Carbon/Mist at 1440, 390 and
  320 px. Final drawer/page overflow is zero, including the filter popup.
  Scoped axe WCAG A/AA scans found no violations in the six Library layouts
  and six open filter menus. Wide/narrow screenshots and menu screenshots
  were inspected. No screen-reader or other-engine certification is claimed.
- The final production build and build:check passed (822422 initial JS bytes).
  Chrome 155 / Node 24.19.0 were used; the existing Node >=24.20 requirement
  mismatch remains. The full application test suite was not run.

Evidence is in the chat workspace's library-review directory. Work is local,
uncommitted and unpublished. Library browsing/organization coverage supersedes
the earlier missing-Library note; actual saved module placement and docking
remain with the existing production implementations and future review.

## Reference code consolidation, 2026-10-15

- Shared preview geometry, type sizes and input targets now have one owner in
  referenceTokens.css. The scoped flat material lives in referenceMaterial.css.
  Repeated appended rules in the workspace, Library and Text sheets were merged;
  source files were expanded into readable JSX and CSS. Portal corners inherit
  the same radius tokens. Production and authored artwork values are unchanged.
- Workspace selection and example content retain one owner. Navigator, colour,
  per-selection panels, numeric controls and sample artwork are separate components
  receiving explicit values/actions; real Library and Text components remain reused.
- Numeric drafts now synchronize external changes during rendering, preventing
  a stale value from being painted after Rotate. Existing incomplete-value/blur
  recovery and independent selection behavior remain covered.
- Inventory includes all 62 production/reference CSS files: 559 declarations,
  285 distinct custom-property names. These counts include runtime variables and
  overrides, not just shared design tokens. Reference roles are labelled separately.
- The maintained design-system:build command replaces the temporary exporter.
  Explicit local/hosted reference modules replace source-text rewrites. The static
  export rejects raw imports, reads no environment files, and includes only the
  compiled UI, isolated fixtures, inventory and referenced public assets.
- All four inventory/build guard tests passed. The local 24-case browser run
  passed 23 initially; its source-retry harness was corrected to match raw URLs
  with Vite cache timestamps. The affected source, token and workspace cases then
  passed their focused rerun. The final static build passed all 23 applicable
  browser cases; the combined local source-viewer/contrast case is excluded there
  because raw source access is deliberately unavailable (covered locally).
- Eight workspace/Library screenshots (Carbon/Mist, 1440/390 px) are byte-identical
  before/after consolidation. Element geometry and computed styles also match.
  Static export smoke checks found no console errors, failed HTTP responses,
  page overflow or source/document links. No raw source, maps or internal docs
  are present in its dist output.
- Production build and build:check passed; initial JS remains 822422 bytes.
  The existing large-chunk warnings remain. Chrome 155 and Node 24.19.0 were used;
  the repository's Node >=24.20 requirement remains an environment mismatch.
  Full application tests and additional browser engines were not run.

Evidence: design-system-cleanup-review in the chat workspace. Application source
changes remain local and uncommitted; the separate existing private visual Site
receives the generated preview. This is code consolidation of the reference,
not a production styling migration or a completed future panel-docking system.


## Interactive reference colour selector, 2026-10-15

- The Color tab now owns one inline hue-ring/white-hue-black triangle picker.
  Triangle paint, hit testing and selection marker share the same centred
  equilateral geometry. The native colour-input popup is replaced by an editable
  Hex field, with three/six-digit validation and optional hash prefix.
- Pointer capture supports live mouse, pen and touch gestures. Cancellation,
  lost capture, blur, hidden-document and unmount restore the originating
  selection. Keyboard controls, locked selections and hue memory at neutral
  colours are covered. The reference's selected-object hex remains canonical;
  the picker retains only interaction precision and otherwise undefined hue.
- All eight colour-model, inventory and build-guard unit tests passed. All 13
  focused colour/workspace browser checks passed against both the local Vite
  reference and its final static export. Retained Text, Layers and Navigator
  behavior remains covered by the workspace suite.
- Screenshots and geometry checks cover Carbon/Mist at 1440, 390 and 320 px,
  including touch dragging and keyboard/forced-colours focus. Wide and narrow
  screenshots were visually inspected. No cross-engine or screen-reader
  certification is claimed.
- The maintained static export succeeded. Inventory is current: 63 CSS files,
  559 declarations and 285 custom-property names. The existing bundle-size
  warning remains. Chrome 155 and Node 24.19.0 were used; the existing Node
  >=24.20 repository requirement mismatch remains.
- Changes are confined to the design-system reference, its tests and docs.
  No production source or stylesheet changed; the full application suite and
  production build were not repeated for this reference-only change.

Evidence: colour-picker/review, colour-picker/export-review and their browser
logs in the chat workspace. The separate existing private Site receives only
the compiled preview and approved fixtures/assets from the maintained exporter.


## Composition continuity and contextual colour, 2026-10-15

- Inspector tabs no longer select the canvas renderer. A selected Display layer
  stays in the same composition, with its silhouette, transform, opacity and order.
  Grain paint follows the same shape geometry. Independent Image/Shape/Display
  specimens retain their existing rendering and settings.
- Selected Display text uses the existing ArticleEditor inside its own frame;
  ArticleView renders unselected text with its inline formatting. Each editor DOM
  and history remain mounted when its display host changes. Color follows the
  current editor selection/cursor, or the existing whole-title colour field.
  Mark-only previews cancel exactly and commit as one undo step without erasing
  earlier colour/typing history. No rich-title schema or saved data changed.
- Drag rows now expose before/after insertion lines at the actual row/group
  boundary. Group ordering, invalid IDs and locked layers have explicit coverage.
  Canvas zoom overflow and the inspector use native scrolling; page scrolling
  continues at the tool boundary. A 100% composition fits the narrow canvas.
- Nine colour/inventory/export-guard/layer-order unit tests passed. All 20
  affected browser cases passed on the final static export: four new interaction
  cases, ten retained workspace cases, three Color and three Library cases.
  The same affected boundaries were exercised locally during implementation.
  Updated retained expectations now select a layer explicitly instead of relying
  on the removed tab-driven canvas switch, and assert selected marks rather than
  document-wide colour changes.
- Visual screenshots cover both themes at 1440 and 390 px, including the layer
  insertion line. Scroll checks additionally cover 320 px. Narrow 100% fitting,
  200% overflow, horizontal/vertical wheel scrolling and tool-to-page chaining
  passed. Existing mouse, keyboard, touch, locked/read-only, cancellation, Text
  history, Navigator and Library checks passed without page errors or persistence.
- The maintained private static export succeeded; inventory freshness passed
  (63 CSS files, 559 declarations, 285 names). Existing bundle-size warnings
  remain. Chrome 155 / Node 24.19.0 were used, with the existing Node >=24.20
  repository requirement mismatch. Other browser engines/screen readers were
  not certified. Production files were not edited, so the production build and
  complete application suite were not repeated for this reference-only change.

Evidence: workspace-fixes/export-final.log, workspace-fixes/export-review and
the local review logs in the chat workspace. Application reference edits remain
local and uncommitted; only the generated artifact checkout is pushed to the
existing owner-private Site, with the previous export privacy boundary retained.


### Overlapping added text correction (2026-10-15)

Inspection of the affected open preview found separate New Text layers sharing
the original Text layer's frame; the original article was not a stale editor
copy. Add text now chooses a free vertical text slot within the fixed example,
and reports lack of room instead of stacking another frame over existing text.
The Text tool retains the selected text layer. The composition editor suppresses
the writing prompt and uses its normal line height when empty. Article data,
the production editor, and standalone writing behavior are unchanged.

The new browser regression fails on the previous static export at overlapping
frame bounds and passes after the correction. It covers two added frames,
retained tool selection, replacing the original, deleting through keyboard
selection/Backspace, and absence of the empty prompt at 1440 and 390 px.
All 18 workspace/interaction/Color browser cases passed on the final static
export; nine inventory/export/layer/colour unit tests passed. Screenshots in
the chat workspace's text-overlay-export-review cover both frame states.
No production source changed. App edits remain local/uncommitted; the generated
visual artifact is published through the existing owner-private Site workflow.


### Navigation-sidebar prototype (2026-10-15)

The existing creative workspace now contains a collapsible app-navigation study.
Library uses one category tree, portalled through an optional navigationHost;
the same Library state and commands own filters, selections and organization.
The default production inline tree and resize handle remain the fallback.

All 22 workspace, Library, interaction and colour browser tests passed against
the final compiled export. The added sidebar case checks a single category tree,
filter/selection retention, close focus recovery and unchanged camera, zoom,
selected layer and inspector tab through collapse/reopen. Existing organization
checks exercise membership dragging to the separately hosted category tree.
Both themes and 1440/390/320 px layouts were covered. Desktop, expanded Library,
collapsed sidebar and narrow screenshots were inspected in the chat workspace's
sidebar-integration review directories. Nine inventory/export/model unit tests,
production build and build:check passed. Build retained dependency/chunk warnings.

Only compiled visual assets are published to the existing owner-private Site.
Application source and documentation changes remain local and uncommitted.
This is a layout study; production navigation migration, real app destinations,
asset placement from the local examples and detachable panels are not completed.


### Icon weight and theme correction (2026-10-15)

Carbon now uses dark chrome and Mist light chrome throughout the reference,
including native control colour schemes and Library/text portal menu mapping.
Lucide glyphs share a 1.5 px non-scaling stroke; navigation icons use an 18 px
size. Artwork SVGs are excluded. No production component, data or state changed.
Computed browser styles confirmed both palette directions and consistent strokes
across the visible navigation, Library and toolbar icons. Both theme screenshots,
collapsed sidebar and narrow screenshots were visually inspected.

Fourteen browser cases passed on the compiled export. The remaining source-viewer
case expects raw development source links, intentionally excluded from this
export; rerunning that case on the local reference passed. Four inventory/export
unit checks and the visual export build passed. The compiled visual artifact is
published to the existing private Site; app edits remain local and uncommitted.
