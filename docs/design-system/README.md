# INSCAPE design system

Version 1.0.0 · established 2026-10-14

INSCAPE's design system makes its existing interface understandable, reusable and verifiable. It joins the production tokens, material recipes, components, interaction patterns, content rules and contribution process in one reference.

The product is an artist's online desktop. The interface gives people precise instruments for arranging and experiencing independent artwork. A coherent interface must preserve the artwork's identity, transparency, proportions, authorship and freedom of expression.

## Authority and scope

The [active contract](../INSCAPE_ACTIVE_CONTRACT.md) remains the sole product-direction authority. [Creative intent](../INSCAPE_CREATIVE_INTENT.md) explains the product's meaning. This handbook documents their implementation; it does not replace them or approve new features. The code describes what currently runs. Accessibility criteria describe what must be verified, not a certification of every existing surface.

This release establishes the complete reference structure for the current product: foundations, material families, component inventory, workflow patterns, accessibility, language, ownership, maintenance and verification. It preserves the existing production UI. It is not a claim that every local CSS value has been converted into a shared token or that every retained surface has been migrated to tactile controls.

## Reference direction, 2026-10-14

The founder requested a smaller, flatter toolbar and reduced the theme direction to Carbon and Mist. Overview and Components preview that treatment on the existing WorkbenchToolbar component, with rectangular buttons using 5 px corners and a 9 px outer bar radius (5 px plus the 4 px inset), matching 5 px fields/menu rows inside 9 px popups with the same 4 px inset, an inverted active tool, quieter open-panel fills with a small state mark, Add inside the same toolbar with matching spacing, and two rows of 44-pixel targets on narrow screens. Carbon previews dark chrome and Mist light chrome, including Library and text menus. The reference uses neutral accents; search focus is a quiet neutral border, with system focus retained in forced colours. The shared toolbar uses minimal popup presentation: no title/close rows, full-width Actions search without a divider, and a Back row for nested menus. Its CSS is shared by the reference and application. Components demonstrates flat control states, complete Image, Display artwork and Shape Properties specimens with conditional states and a two-theme state sheet. The retained bevel shell remains collapsed as a migration reference. Build with it separates Agreed, Needs review and In the app. Source links open a read-only source viewer instead of loading test files as application scripts. Principles live in Build with it; the overview contains only the toolbar, themes and a brief preview caption. The creation toolbar, camera rail and their menus now use the approved shared material in the application (2026-10-16); other production instruments retain their existing treatment. All preview actions remain in memory. Production theme choices, saved values and authored surfaces have not been migrated in this review pass.

## Start here

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
6. **Change follows evidence.** Start from production references, exercise real states, and retain compatibility with saved work.

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
