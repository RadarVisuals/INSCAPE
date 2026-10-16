# Foundations

The reference previews the refined Carbon/Mist direction; the production inventory below records the current implementation separately. Exact declarations and contextual overrides are available in the [token explorer](../../design-system.html#tokens). The explorer is a development-server page; source links remain usable directly in the repository.

## Token architecture

There are four practical levels. Keep the existing names so current consumers remain compatible.

| Level | Examples | Ownership |
| --- | --- | --- |
| Global foundation | `--color-focus`, `--font-interface`, `--space-2`, `--duration-fast` | `inscapeTokens.css` |
| Semantic context | `--workflow-ink`, `--workflow-panel`, `--lattice-menu-line` | Workflow and menu theme CSS |
| Material | `--tactile-raised`, `--tactile-well`, `--workflow-window-overlay` | Tactile and bevel recipes |
| Component geometry | `--toolbar-target`, `--tool-icon-target`, `--detached-window-width` | Toolbar, tool and window CSS |

Runtime variables such as `--workbench-toolbar-clearance` and camera projection values describe measured layout or temporary state. They are not palette or spacing choices. Do not replace their owning measurement/controller with a fixed design token.

Compatibility aliases such as `--bg-color`, `--text-main`, `--hu-focus` and `--font-sans` remain valid for current consumers. Prefer the meaningful canonical role for new code. Remove an alias only after inspecting every consumer and testing the affected surfaces.

The generated inventory includes all custom-property definitions in `src/**/*.css`, their order within each file, parent selectors and at-rules, references and source checksum. It does not determine the final cascade across import order or resolve a value outside its DOM context. Use browser computed styles for that. It is a CSS inventory, not a DTCG interchange document. CSS gradients, `color-mix`, system colours and runtime geometry retain their original expressions.

## Reference geometry and focus

`src/inscapeTokens.css` owns the shared flat geometry. `design-system/referenceTokens.css` aliases it and adds preview-only type sizes; `workflowFlat.css` owns the explicitly opted-in material shared by the production creation toolbar and reference instruments. `reference.css` owns reference page layout. `workbenchToolbar.css` owns the toolbar and menu recipe; `toolbarPreview.css` only places it in the demonstration. Properties and control states retain their preview adapters. Controls, fields and menu rows use `--control-radius: 5px`. Their 4 px inset derives `--control-shell-radius: 9px`; popup borders count toward the inset. Creation targets are 36 px desktop and 44 px at widths ≤520 px or with coarse pointers.

Carbon uses dark instruments and Mist light instruments. The active tool uses an inverted fill; secondary selection uses a softer fill and a state mark. Reference-wide keyboard focus uses neutral ink, with system Highlight in forced colours. Search retains a quiet neutral focus border. Mist supporting copy uses 66% dark ink in the reference so small text remains readable. Selected toolbar labels may grow beyond their normal 82 px minimum. Properties is a review proposal using 5 px field corners, a 9 px shell, and 12 px inner form padding for reading space; its close control retains the 4 px edge inset. Properties remains a reference proposal. Stored theme IDs are unchanged by the toolbar migration.

## Production colour inventory

The global family is near-black with warm neutral ink and a restrained warm interaction accent. The structural family also supplies lighter surroundings.

| Role | Current value | Intended use |
| --- | --- | --- |
| `--color-world` | `#030405` | Application backing |
| `--color-surface` | `#070808` | Base surface |
| `--color-surface-elevated` | `#101212` | Elevated structural surface |
| `--color-surface-subtle` | `#191b1b` | Tactile material base |
| `--color-text-primary` | `#ebece7` | Main ink on global dark surfaces |
| `--color-text-warm` | `#eeebdf` | Tactile primary ink |
| `--color-focus` | `#f3a078` | Keyboard focus and tactile active ink |
| `--color-success` | `#8ebf94` | Confirmed success with explicit text |
| `--color-destructive` | `#ef8d78` | Destructive/failure emphasis with explicit text |
| `--color-accent-interface` | `#e87945` | Existing interface accent; not a substitute for focus |

Use `--workflow-*` inside themed workflow surfaces and `--tactile-*` inside tactile surfaces. Global dark ink roles are not appropriate substitutes for theme-aware light-surface ink.

Muted, faint, disabled and border tokens contain alpha. Their contrast depends on the surface behind them. Faint and disabled values must not become ordinary instructions or essential values. A decorative rim can be subtle; the only visible indication of an interactive field or selected state cannot rely on a low-contrast rim alone. Measure required boundaries in context.

## Theme contexts

The current design-system preview offers **Carbon** and **Mist**. Overview and Components share the founder's simplified toolbar direction; the production theme family below remains available for existing surfaces and saved content until a separate implementation pass.

`latticeMenuSurface.css` owns carbon, graphite, slate, ash, mist and paper menu themes. Set the existing `data-lattice-menu-surface` and `data-menu-surface` attributes at the actual scope. These map panel, ink, muted, faint, lines and selected roles together.

Do not combine an ink from one theme with a panel from another. Semi-transparent surfaces also require a known underlying surface. The menu panel values are distinct from similarly named authored Workbench/Stage surface presets.

The migrated creation toolbar uses dark Carbon and light Mist chrome; legacy ash/paper IDs also map to its light material. Other production tactile tools remain dark on all six surroundings. This is one fixed material context, not a broken light-theme implementation. Bevel windows adapt to their supplied menu surface. Reception's authored content and its ash surround retain their own existing boundaries.

## Typography

All interface fonts are bundled locally. `inscapeTokens.css` owns the three `@font-face` declarations.

| Role | Token / family | Use |
| --- | --- | --- |
| Human interface | `--font-interface`, `--font-body` / Inscape Sora | Navigation, titles, controls, primary labels, body copy |
| Technical and dense | `--font-technical` / Inscape IBM Plex Sans Condensed | Measurements, addresses, metadata, state details, Library rails |
| Creation bar | `--font-creation-toolbar` / Inter Variable | The creation bar only; its popups retain normal workflow roles |
| Wordmark | Existing SVG | Brand mark; never typeset a substitute |

Prefer the complete `--workflow-type-*` or `--lattice-window-type-*` font recipe over independently selecting font, weight, size and leading. Current workflow roles include display 28/1.08, title 18/1.15, section 15/1.2, body 14/1.5, control 11/1.2 and technical 10/1.35. Compact type describes the current product, not a universal legibility target. Assess real reading conditions, zoom and long text.

Normal controls generally use 400–500 weight. Existing display/title/section roles use 600. Technical face assets currently supply regular weight; do not request unsupported weights as if they were bundled. Avoid arbitrary uppercase or added tracking; retain established labels where their contract calls for them.

Authored articles may use their separately approved font list and explicit type settings. Interface typography must not overwrite article fonts, line breaks, tracking, title styles or column flow.

## Production spacing and density

Global spacing is 4, 8, 12, 16, 20 and 24 px through `--space-1` … `--space-6`. Existing structural recipes also use local 6/10 px gaps, 10/12 px padding and deliberate border offsets. Use those local values where they express a real alignment. Do not force every pixel onto the global scale.

| Context | Existing target or geometry |
| --- | --- |
| Creation key | 36 px; 44 px narrow/coarse pointer |
| Creation shell | Minimum 44 px high, 4 px padding, 2 px column gap, radius 9 px |
| Creation keys | 5 px radius; active Select/Hand/Text label expands on desktop |
| Creation at ≤520 px | Five keys then four, centred rows, 4 px row gap |
| Companion control / header icon | 32 px desktop; 44 px narrow/coarse |
| Companion action key | 40 px desktop; 44 px narrow/coarse |
| Companion narrow/coarse titlebar | 52 px; fields use 16 px text |
| Camera action | 40 px, 44 px narrow/coarse |
| Authored resize target | 28 screen px; visible mark can be smaller |
| Retained bevel cap | 26 px; review touch access in its actual context |

The generic 28/34/38 px `--control-height-*` variables describe retained components. They do not override newer creation or companion density. Text's inspector retains its own dense layout and touch rules. Never shrink a touch target just because its icon is 16 or 18 px.

The Workbench's 24-work-pixel default grid, Display canvas units and article text pixels belong to composition geometry. They do not derive from this interface spacing scale.

## Shape, material and elevation

The following interface families coexist during migration:

| Family | Surface grammar | Use |
| --- | --- | --- |
| Structural | Square edges, one-pixel lines, contiguous rails, directional selectors | Library, structural menus and retained system panels |
| Bevel | Thin edge/highlight, theme-aware overlay and raised caps | Identity and compatible shared windows |
| Flat | Neutral Carbon/Mist fills, inverted active tools, 5/9 px geometry | Creation toolbar and its menus |
| Dark tactile | Raised keys, recessed active wells, thin rims, restrained shadows | Properties, Layers, Artwork info, appearance, Text tools and Keeper settings |

Observed implementation difference: the current application dock also opts into tactile material and quiet controls while retaining its structural rail layout. The active contract still describes the dock's retained structural baseline. This reference records the difference; it does not silently amend accepted product direction or migrate the dock again.

For the migrated toolbar, import `workflowFlat.css` after the native-control recipe and add `data-workflow-finish="flat"` on its material surface. Its palette and radii reuse foundation tokens. Other components do not acquire that finish implicitly.

The retained tactile recipe is `workflowTactile.css`; opt in with `data-workflow-material="tactile"`. It alone owns the material palette, gradient fills and raised/inset shadows. Component CSS owns geometry. Shell depth is stronger than control depth. Quiet command rows have no resting shadow.

Tactile press does not move bounds. Retained bevel caps currently translate by one pixel; that is an existing local recipe, not permission to apply moving press effects to tactile controls.

Grain belongs only where accepted. Tactile tools do not acquire an image noise texture. Authored Display/Text/Shape grain is independent data. Image media stays flat, borderless and alpha-preserving. Reception's blurred sheet is an explicit local exception, not a reusable glass effect.

## Iconography and media

Use the existing tree-shakable Lucide icons. The creation toolbar uses 18 px icons with a 1.5-screen-pixel non-scaling stroke. Retained tactile action icons generally render at 18 px with 1.6 stroke; overlay/window contexts retain their established 16/17 px and stroke recipes. Size `.lucide` or an explicit component class, never all SVG artwork in a module.

Names describe actions: “Rotate”, “Mirror horizontal”, “Inspect artwork”, “Close Text tools”. Decorative icons are hidden from assistive technology. The control supplies its name. A tooltip supplements that name rather than replacing it.

Keep artwork source resolution, transparency, animation and metadata under the existing media runtime. No token should force all assets into square or opaque cards.

## Motion

Global UI timing is fast 120 ms, UI 180 ms, slow 340 ms with the existing standard curve. Workflow panel entry/exit has its own 180/140 ms recipe. Tactile feedback changes ink over 120 ms and becomes immediate under reduced motion.

Camera Focus, artwork Lift and reception transitions retain their 460 ms controllers. Image turns retain 600 ms. These are module/navigation behaviors with readiness, interruption, disposal and input-lock rules. Do not replace them with a CSS-wide animation utility or assume changing `--duration-ui` changes them all.

Respect reduced motion in each owner. Never add continuously animated chrome, lighting or decorative grids. A progress animation cannot substitute for a real loading state or readiness signal.

## Layers and responsive layout

Global layers include world 5, interface 20, HUD 70, window 170, menu 310, dialog 320 and entry veil 1000. Those numbers apply within the application's stacking architecture. Local Workbench layers and window order remain explicit local decisions. Inspect stacking contexts before changing a z-index.

Screen-space tools retain input size through camera zoom. Canonical artwork proportions and shared physical-pixel edges remain controlled by the Workbench projection. Narrow layouts wrap/reposition controls and bound scrolling; they do not rewrite authored dimensions or rearrange a published composition.

Validate actual thresholds, including 521/520 px, and both pointer types. The reference catalogue reflows as documentation; its responsive layout is not a new product layout template.


Reference interface icons share `--ds-icon-stroke: 1.5px` with non-scaling
strokes so compact glyphs retain the same visible line weight. Navigation icons
use `--ds-icon-size: 18px`; disclosure arrows retain their smaller size. This
rule targets Lucide interface icons, including portal menus, never artwork SVGs.
