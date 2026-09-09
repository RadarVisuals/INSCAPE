# Rendered inconsistency ledger

Measured from the pre-refactor Brave/Playwright matrix in `/tmp/owner-shell-coherence/*-before` on 2026-08-14. The established and successor geometry matched before this coherence pass.

| Screenshot/state | Element | Current computed value | Expected shared value | Visual family | Token or primitive |
| --- | --- | --- | --- | --- | --- |
| All widths / Library and Discover | Workspace bounds | `top/left 18px`, bottom clearance `70px` | Preserve and express once | Workspace windows | `--prototype-window-inset`, `--prototype-dock-height` |
| All widths / Activity History | Workspace bounds | `top/left 18px`, bottom `70px` | Same as Library and Discover | Workspace windows | workspace inset and dock calculation |
| All widths / compact Activity, Table, Settings, Inspector | Bottom clearance | `64px` | Dock `52px` + panel gap `12px` | Utility panels | `--prototype-dock-to-panel-clearance` |
| Library and Discover | Sidebar navigation row | Library `36px`; Discover `36px` | `38px` shared row rhythm | Browsers | `--prototype-sidebar-row-height` |
| Library/Discover/Table/Activity | Bottom rail | `38px` literals and mixed grid declarations | `38px` from one semantic decision | Local rails | `--prototype-rail-height`, `__local-rail` |
| Settings, Profile, Inspector | Panel shadow | Settings `10px 12px 30px / .24`; Profile `10px 12px 30px / .18`; Inspector `7px 8px 20px / .16` | Compact shadow `0 12px 30px / .18` | Utility panels | `--prototype-shadow-compact` |
| Selection/crop/frame-and-mat | Panel padding | Crop `12px`; presentation `10px`; layers `8px` | Authoring `12px`; content `10px` | Authoring controls | `--prototype-panel-padding`, `--prototype-content-padding` |
| Crop/frame-and-mat/Settings | Standard controls | `32px` literal | `32px` shared height | Authoring controls | `--prototype-control-height` |
| Selection/Table/Profile controls | Hover surface | mixture of `--lattice-menu-hover` and `--prototype-hover` | one prototype hover state | Utility panels and rails | `--prototype-hover` |
| All panels/popovers | Border, muted and emphasis colors | repeated Lattice variable references | prototype-local semantic aliases retaining the same computed colors | All system families | `--prototype-border*`, `--prototype-muted`, `--prototype-emphasis` |
| Focus states | Focus outline | repeated `1px solid` literals | one visible focus ring | Dock, rails, popovers | `--prototype-focus-ring` |
| Discover groups | Recessed heading surface | repeated `color-mix(...)` | one recessed surface | Browsers | `--prototype-recessed` |

The identity dossier and artwork viewer keep their immersive geometry. Table remains centered. Settings remains right-aligned. Profile keeps its narrow-screen 18px left inset. Compact Activity continues to follow the Activity dock trigger.
