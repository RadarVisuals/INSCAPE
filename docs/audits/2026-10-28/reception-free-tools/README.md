# Reception free tools and Text entry correction

Local follow-up to the founder's 28 October review. This supersedes the earlier
revamp's workspace-bounded tool behavior. No commit, push, deployment or signed
profile publication was performed.

## Observed problems and changes

The Library's nested workspace painted above the outer resize handles. Earlier
keyboard resizing tests did not catch this: a real edge hit returned the Library
content rather than the handle. A second failing test reproduced tools being
clamped inside the centered Reception window (`before.log`).

Reception now hosts its tool windows beside the centered window, under the same
editor and theme. They can cross every modal edge; only the editor viewport
bounds them. New windows start below the header, while later user movement can
place them anywhere. Clicking an overlapping tool brings it forward. The Library
workspace has a local stacking context below its outer resize handles.

Window geometry and drop receivers now have distinct bounds: the outer editor
owns tool positioning; the grid workspace owns cell discovery and captured drop
targets. The existing shared ToolPanel gesture implementation, private preference
store, content generation checks and undo/save paths remain authoritative.
A separate agent reviewed these boundaries without finding a concrete new issue.

Text had a shrink-to-fit content wrapper: an empty title reduced the entire body
to about 62px. Real Text cells now fill their available inner width in both editor
and reader. New Text receives 24px spacing if its effective spacing would be zero;
nonzero authored spacing is retained and remains adjustable. Existing Text data
is not rewritten. The same ArticleEditor still owns typing, formatting and save.
Narrow-cell toolbars remain a single scrollable row so wrapping buttons cannot
cover the New Text action. See the [Text evidence](../reception-editor-revamp/text-followup/README.md).

## Verification

| Check | Final result | Evidence |
| --- | --- | --- |
| Complete unit suite | 1493 passed, no failures/skips | `unit.log` |
| Tool, settings, boundaries and styling browsers | 29 passed | `browser-final.log` |
| Editor browsers including new Text | 24 passed | `../reception-editor-revamp/text-followup/editor-browser-full.log` |
| Lint | 518 files; same 88 recorded hook observations | `lint.log` |
| Type contracts | Passed; 17 invalid calls and 3 mutations rejected | `typecheck.log` |
| Production build and existing budgets | Passed | `build.log`, `build-check.log`, `bundle-report.json` |

There are 53 distinct focused browser cases. Initial JavaScript remains 830,710
bytes; core JavaScript is 2,675,602 raw / 876,120 gzip against unchanged limits
of 2,676,000 / 879,000. The raw core budget remains close. The design inventory
was regenerated and passed its checks in the full unit run.

Final source hashes are recorded in `source-snapshot.json`. Browser
coverage includes real mouse edge/corner resizing, all eight resize hit targets,
dragging every tool beyond the modal, closing/reopening, overlapping window
activation, placement from outside the modal, and narrow viewport clamping.
Text coverage includes a true empty cell, zero grid spacing, custom spacing,
wide/narrow wrapping, reader/preview parity and reload persistence.

Earlier integration attempts exposed default tools covering Header/Done; initial
positions were corrected and the existing transitions retained. Later concurrent
runs encountered page-load/reader-startup timeouts. The retained concurrent log
records one such failure; final sequential verification runs with unchanged
timeouts and assertions. No browser timeout was raised to hide a failure.

## Review and state

- [Free tools, 1920×1080](screenshots/tools-outside-1920.png)
- [Free tools, 2560×1440](screenshots/tools-outside-2560.png)
- [New Text, 1920×1080](../reception-editor-revamp/text-followup/new-text-empty-1920.png)
- [Filled Text, 1920×1080](../reception-editor-revamp/text-followup/new-text-filled-1920.png)

Branch `codex/static-reception-bento-2026-10-26`, inspected HEAD
`4a0251647234c0757847078ec34f0865425f6857`. The extensive pre-existing dirty tree
was preserved. PR #5 diagnostics still report remote head
`3cfd6cf5da12218938d7706268ebd10bed890966`: Netlify preview success, source/test/build
checks cancelled. Those remote results neither contain nor validate these edits.

The active review fixture can be refreshed to load the local changes. These are
browser-contained tools, not native OS windows. Full browser release catalog and
physical Safari/iPhone testing were not performed.
