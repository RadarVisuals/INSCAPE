# Activity finishing — 23 October 2026

Local work in `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The checkout has substantial prior
changes. This round is saved locally, not committed, pushed or deployed.
The current verification workflow was inspected; remote CI is not evidence for
these uncommitted changes.

## Implementation

Recent Activity and full history now reuse the flat Carbon/Mist panel shell,
header and close control. Filters, search and bottom actions remain reachable
while event rows scroll. Narrow layouts use the same content and controls with
44-pixel targets. Duplicate recent/history row markup and old Activity CSS were
replaced; dedicated styles no longer compete with old sidebar/narrow overrides.

The existing signal hook/store still owns events, refresh, profile scoping and
read-marker persistence. Filters/search remain component state. No new store,
authored fields, migration, network source or wallet action was introduced.
The old history "Open" button only called markRead; its label now says what it
does. Read rows show a check and Read, unread rows a narrow edge mark and action.
Storage rejection leaves the row unread. Loading and refresh keep their status
visible, while existing rows survive refresh; errors and partial results remain
distinct from an empty/filter-empty list.

History opening by keyboard focuses search; pointer opening does not create an
automatic input focus outline. Escape returns to recent Activity and then the
sidebar. Focus return is scheduled only after actually leaving history, cancelled
on disposal, and does not override a newer user focus choice. The existing
sidebar already supplies its visible collapse button as return target on the
smallest screens; the new tests exercise that path.

## Evidence

- **13 Activity browser tests passed**: Carbon/Mist at 1440×900, 390×900,
  320×568 and 844×390; bounds/material/control hit tests; filtering/search;
  real signal-store read persistence and rejection/retry; reload; empty/loading/
  partial/error states; refresh; normal/reduced-motion focus; forced colours;
  unchanged authored draft, camera and Undo behavior. The disposable fixture
  holds external refresh locally; it does not claim a live chain integration run.
- **26 additional browser tests passed** for recovery, panel lifecycle,
  Settings, Activity overlay reachability and sidebar. **Two broader tests
  failed** after their Activity checks or before reaching current Layers:
  `owner-system-workflow-panels` times out opening artwork inspection via the
  older double-click path, and waiting for the former Selection and layers
  inspector. Their pre-task baseline was not independently reconstructed.
- The updated `phase3-completion` case passes its Profile and Activity portions,
  including narrow history and focus return, then **fails waiting for its third
  Discover fixture result**. This unrelated fixture/current-discovery issue
  remains open; the full test is not reported as passing.
- **15 focused unit tests passed** for Activity timestamps and existing signal
  storage/read/settings persistence; **10 design-system tests passed**, with
  regenerated inventory and successful check.
- Production build and `build:check` passed without budget changes. Initial JS:
  **823,024 raw / 239,471 gzip bytes**; core JS:
  **2,519,293 raw / 808,930 gzip bytes**. Standard Vite large-chunk advice remains.

Screenshots were inspected across the themes, wide/narrow/low layouts and
forced colours. Evidence is in [activity-finishing-evidence](activity-finishing-evidence/).
The broader failures above are retained there, alongside successful focused
checks. Full `npm test`, release verification and production-browser startup were
not run. This is an Activity presentation update, not a fully green release.

Follow-up: the three reported broader failures were investigated and repaired
in [panel regression repairs](panel-regressions.md), including related focus and
sidebar-clearance defects and outdated test expectations. That report contains
the newer verification evidence and its limits.
