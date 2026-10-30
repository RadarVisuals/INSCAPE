# Reception editor simplification — 28 October 2026

Implemented locally by the lead agent and two delegated agents after the founder
approved the discussed cleanup. Display creation and redesigning canvas-link
authoring were explicitly excluded. No commit, push, deployment, wallet action
or profile publication occurred in this round.

## Delivered behavior

- Empty start: Image from Library, New Text and Add cell; no automatic selection.
- Modeless Library uses the existing shared ToolPanel with move, resize, keyboard
  controls and private saved window bounds. It stays open through repeated
  placement, selection, cropping and undo. Explicit selection is required for
  click placement; dragging captures its receiving cell. Auto crop is retained.
- One Delete cell action removes the whole cell and unreferenced Reception
  records, for every content type. The last deletion leaves a blank cell. Undo
  restores the operation. Source Library assets, linked canvas sources and
  header logo references are preserved.
- A dedicated handle reorders full cell identities/content/appearance through
  the existing layout positions with preview, cancellation, keyboard access and
  one completed save. Mobile order stays independent. Selected cells use a
  restrained outline; keyboard focus remains visible; outside clicks deselect.
- Removed cell dots, Saved content, Join cells, content swapping, builtin profile
  content choices and Reception's shared-profile editor. Replacements clean up
  orphaned records within their existing undo operation. Existing public
  profile-block rendering remains; this cleanup does not erase saved documents.
- Grid settings contains corners, gaps, padding and background with live preview.
  The optional validated `surface` survives save/history/public round trips;
  per-cell surfaces override it. Recovery has a separate control.
- Header name/logo editing is reached from the header. Logo choices show the
  same image as the actual header. Appearance separates temporary current view
  and the visitor default. Workbench profile editing is independent.

## Dependencies and actual simplification

Reception retains its canonical rectangular layout and existing profile-scoped
store, editing lease, completed-operation history and public projection. There
is no second layout/history state. Temporary previews are generation-bound.
The cell gesture adapter still uses Workbench's pointer controller; only cell
reordering supplies the stable workspace as its capture host, because moving
the handle's DOM node otherwise loses pointer capture. Escape, pointercancel
and stale generations remain cancellation boundaries.

Library retains the shared LibraryWorkspace's browsing, decoding, source
identity and drop lifecycle. Reception supplies explicit targets and window
preferences. Its former full-workspace overlay and inert background are gone.
The shared selection button has a default-true capability input; Workbench
behavior is unchanged. No-target double clicks return before decoding.

Superseded move/merge/unused-record commands and ReceptionProfileEditor were
removed. The existing linked renderer and Edit link remain, without new Display
creation or a new coupling between cell editing and canvas authoring.

## Verification

All commands ran in the application checkout. Test and build logs in this folder
are from this round. The final code passed:

| Check | Result | Evidence |
| --- | --- | --- |
| Full `npm test` | 1493 passed, no failures/skips | `unit-final.log` |
| Editor browser suite | 22 passed | `editor-browser.log`, [cell report](cells-verification.md) |
| Settings, boundaries, styling, linked rendering | 19 passed | `integration-browser.log` |
| Reception shared controls / floating Library | 12 passed | [Library report](library-verification.md) |
| Shared Workbench Library lifecycle and resizing | 24 passed | [Library report](library-verification.md) |
| Lint | 518 source files; same 88 recorded hook observations | `lint.log` |
| Type contracts | 17 invalid calls and 3 production mutations rejected | `typecheck.log` |
| Production build and budgets | passed without increasing budgets | `build.log`, `build-check.log`, `bundle-report.json` |

There are **77 distinct focused browser cases**. Screenshots cover 1920×1080
desktop plus narrow widths; editor regressions also cover 2560, 1440, 800, 640,
390 and 320 pixels. Actual mouse and Chromium CDP touch drags exercise preview,
cancellation and commit. The generated design inventory was refreshed and its
checks pass in the full unit suite. Scoped diff whitespace checks passed.

Initial JavaScript is **830,710 bytes**; aggregate core JavaScript is **2,674,924
bytes raw / 876,084 gzip**, within the existing 2,676,000 / 879,000 limits.
The core budget remains close; this is a size check, not a performance claim.

During development, tests found and repaired lost pointer capture after DOM
reordering, outside-click deselection from Library chrome, implicit first-cell
placement, inherited-colour mismatches and clipped Library category labels.
Old tests that required removed menus/retention were updated to the new behavior.
One early concurrent run timed out on mobile viewer focus return; the complete
linked suite and final combined run passed after edits settled. Its cause was
not independently established; no timeout or assertion was relaxed for it.

## Review captures

- [Empty start — 1920×1080](screenshots/blank-1920x1080.png)
- [Floating Library — 1920×1080](screenshots/library-1920x1080.png)
- [Empty start — 390×844](screenshots/blank-390x844.png)
- [Floating Library — 390×1000](screenshots/library-390x1000.png)

Disposable local authoring entry:
`http://127.0.0.1:5197/browser-tests/reception-editor-fixture.html?session=reception-revamp-review`
It uses the actual editor with isolated sample storage/Library sources; it is
not the published site or a signed owner profile.

## State and remaining limits

Branch: `codex/static-reception-bento-2026-10-26`; HEAD at inspection:
`4a0251647234c0757847078ec34f0865425f6857`. The checkout already held extensive
uncommitted work, preserved throughout. `source-snapshot.json` fingerprints the
relevant final files; it is not a claim that HEAD contains them.

Remote PR #5 remained draft/open at
`3cfd6cf5da12218938d7706268ebd10bed890966`; its Netlify preview status was success
when checked. That remote result does not validate or contain these local edits.

Moving a cell adopts its destination slot's dimensions. Deleting normal
split-created layouts expands adjacent partitions; an uncommon non-slicing
layout with no local rectangular absorption is repacked in reading order.
Library is bounded to the Reception workspace. On narrow screens, open tools
can overlap and can be moved, resized or closed independently.

The complete browser release catalog and physical Safari/iPhone testing were
not run. No hosted deployment or signed public read-back is claimed.
