# Library and editor preferences — 23 October 2026

Local, uncommitted work in `remediation-2026-10-19-shared-checkpoint/work`,
branch `codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. Existing changes were preserved.
No commit, push, publication or deployment. Current verification workflow was
inspected; no remote CI result represents this dirty tree.

## Requested behaviour

Library now shares the reference's flat Carbon/Mist chrome. One profile-local
editor-preferences store persists Library browsing/display choices, full dock
groups and panes, hidden tabs, active tabs, proportions and window frames.
Text retains its independent frame/open state/section. Navigator, Keeper dock
positions and explicit sidebar folding are retained too. These preferences
follow Workbench switches and reloads in this browser.

Library saves search, collection/relationship/category view, sorting, thumbnail
size, labels, navigation and panel widths, and collapsed category sections.
Expanded attachments and dialogs remain temporary. This adds no composition
content, document migration, camera persistence, Undo operation or publication.
Keeper settings retain their existing automatic placement; Display appearance
and other destination windows retain their existing owners.

## Responsibility changes

Previously the keyed Workbench owned the dock, so switching or reloading
recreated it. Library mixed local hook state and a process-global mutable
preference object. The profile editor now owns one validated preferences store;
controls subscribe to its section snapshots. Docks use the existing pure layout
reducer through that store, without a second synchronized dock state. The global
Library preference object and per-composition Text-tool visibility restoration
were removed. Preview-media caching remains separate from preferences.

The key is `inscape:editor-preferences:v1:<normalized-profile>`. Writes are
batched for 120 ms, with explicit flush before the originating editor releases
its lease, on unmount and normal unload. The page-cache test exposed an ordering
bug: a normal pagehide callback ran after access was released. The lease now
has a scoped before-release subscription; callbacks cannot authorize later
writes. A stale editor remains unable to write after a new editor starts.

Invalid/unreadable records are retained until explicit retry. Quota failures
and conflicting external changes are visible; retry writes the current settings.
No silent successful-save status. The error/retry notice now stays above the
Library. The reference uses local disposable state instead of this store.

`libraryWorkspace.css` supplies shared cards, rail, focus and controls.
Reference-only container geometry stays in `libraryPreview.css`. Superseded
production two-row rail overrides were removed. Narrow Library placement uses
the navigation host's reserved top, keeping Owned/Created and bottom controls
reachable instead of behind the icon strip. Automatic responsive folding does
not overwrite the user's explicit sidebar preference.

## Current verification

- **56 browser tests passed** in the final acceptance run: editor preferences,
  design-system Library, dock interactions, sidebar, article tools, Library
  keyboard filtering, Library storage and drop lifecycle. See `acceptance.log`.
- **37 focused unit/build-boundary tests passed**: preferences, dock reducer,
  local composition layout, Text target, editor lease and production build rules.
- **10 design-system tests passed**; generated inventory and check passed.
- Production build and `build:check` passed. Owner and wallet runtimes remain
  outside the initial entry.
- Visual evidence covers Carbon/Mist at 1440×900, 390×900 and 390×520, with
  populated disposable compositions. Reference Library checks cover both themes
  and narrow screens. Screenshots were inspected for clipping and reachable
  controls. Tests hit-test search, size, close, Owned and Created, as well as
  scrolling/keyboard/filter paths.

Reload tests exercise Library close/reopen, Workbench change, detached Info,
stacked Color, hidden Image, resized/moved frames, Text, Navigator and Keeper;
serialized authored drafts remain equal during preference-only operations.
Immediate unmount and page-cache departure save the final pending change.
Failed writes retain live values, retry succeeds and reload recovers them.
Unit tests check profile isolation, invalid data, external changes and stale
callbacks. No cross-device synchronization or arbitrary performance claim.

## Build measurement

Final initial JS: **823,024 raw / 239,469 gzip bytes**.
Final core JS: **2,517,858 raw / 808,495 gzip bytes**.
Prior Info evidence: 2,511,618 / 806,397 core bytes; this addition is
**6,240 raw / 2,098 gzip bytes**. The first build exceeded the previous core
ceiling. The core-only allowance is bounded at **2,519,500 / 809,500**, increased
by 4,500 / 2,500 bytes; initial-entry, owner, wallet, CSS and asset limits are
unchanged. See the saved build logs and bundle report. Standard Vite large-chunk
advice remains; the explicit production budget check passes.

## Additional finding and limits

**Follow-up:** the selection issue below is resolved in the subsequent
[Settings finishing round](settings-finishing.md). The original finding remains
here as the result of this earlier run.

An additional `workbench-layout-reload` run passes Visitor temporary geometry
but fails the owner group-movement scenario: Shift+Enter on two Images produces
no selection group. Diagnostic repetition also finds zero selection groups on
the initial mount, before any preference reload. The test and its selection
implementation were left unchanged; temporary diagnostic edits were removed.
This is an unresolved broader selection check, not a claimed full green release.
See `persistence.log` and `layout-diagnostic.log`. Its exact pre-task baseline
was not independently reconstructed. Full `npm test`, the release checkpoint,
production-browser startup and remote CI were not run in this round.

Evidence: [folder](library-preferences-evidence/),
[wide Mist](library-preferences-evidence/library-mist-1440-900.png),
[narrow Carbon](library-preferences-evidence/library-carbon-390-900.png),
[low Mist](library-preferences-evidence/library-mist-390-520.png).
