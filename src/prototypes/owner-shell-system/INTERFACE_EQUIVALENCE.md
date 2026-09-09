# Owner shell system equivalence map

This prototype is session-only and isolated from the established owner-shell source.

| Family | Interfaces | Shared prototype primitives |
| --- | --- | --- |
| Workspace windows | Library, Discover, Activity History | `__workspace-window`, workspace shadow, viewport inset, dock clearance, shared panel motion |
| Browsers | Library, Discover | sidebar row/state rules, compact hover-label anchoring, card typography, workspace rail |
| Local rails | Library, Discover, Activity, Table | `__local-rail`, rail height, separators, selected/hover/focus states, contained horizontal scrolling |
| Utility panels | Profile, Activity, Table, Settings, Inspector | panel surface, strong border, compact shadow, shared motion language |
| Popovers | Collection, role, and sort menus | `__select-popover`, row geometry, selected/hover/focus states, compact shadow |
| Global dock | Identity, Activity, Discover, Table, Library, Preview, Upload, Settings | one-row responsive geometry and common icon/control states |
| Authoring controls | Selection, crop, frame and mat | shared field border hierarchy, control typography, action rows |
| Immersive presentation | Artwork focus viewer, identity dossier | intentionally independent immersive geometry and retained return transitions |

Intentional differences remain: Table is centered; Settings retains its right-side placement; Profile uses an 18px narrow-screen left inset; Activity follows its dock trigger; workspace windows use an 18px viewport inset; immersive viewers do not adopt workspace-window geometry.
