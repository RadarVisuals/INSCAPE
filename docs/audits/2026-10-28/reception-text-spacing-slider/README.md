# Reception Text spacing slider

Final founder direction on 28 October: one Content spacing slider, new Text at
24px, and an adjacent Apply to all checkbox that starts off. This control is
only for Text; images use crop. It supersedes the preceding preset/inheritance
clarification.

## Implementation

- Removed the preset buttons and global Default content spacing slider.
- New Text is initialized with 24px. A Text cell without an explicit inset uses
  24px in the shared editor/reader renderer, independently of the grid field.
  An explicit saved inset, including zero, remains editable.
- The checkbox is temporary editor scope, not saved content. Opening the panel
  starts with it off. Checking it applies the current value immediately to all
  native Reception Text cells, then subsequent slider moves use the same scope.
- Preview, cancellation and commit reuse ReceptionRange and the existing
  generation guard, save error handling and undo store. One shared spacing
  commit handler owns single-cell and batch saves; no second persistence path.
- Image cells expose neither spacing control nor checkbox, render without
  content padding, and new image placement sets zero padding. Applying Text
  spacing never mutates image cell or source/crop records.

The old top-level padding field remains in the saved document format for other
existing presentation content. This scoped UI change does not migrate document
schemas or redesign canvas-linked content authoring.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Editor browser suite | 25 passed | `editor-browser.log` |
| Final spacing cases after shared-handler cleanup | 3 passed (included above) | `spacing-final.log` |
| Settings, boundaries and styling browsers | 14 passed | `integration-browser.log` |
| Focused content/history/public round-trip units | 13 passed | `unit-focused.log` |
| Lint | 518 files; same 88 recorded hook observations | `lint.log` |
| Type contracts | Passed; 17 invalid calls and 3 mutations rejected | `typecheck.log` |
| Production build and existing budgets | Passed | `build.log`, `build-check.log`, `bundle-report.json` |

Initial JavaScript remains 830,710 bytes. Aggregate core JavaScript is 2,675,987
raw / 876,368 gzip against unchanged limits of 2,676,000 / 879,000. Early builds
exceeded the raw limit by 45, then 9 and 2 bytes. Removing an unnecessary control
remount/key and sharing the spacing commit handler kept the final build within
the existing budget; no budget was raised. Headroom remains extremely small.
`source-snapshot.json` fingerprints the final relevant source and browser test.

The mixed-content browser test contains two Text cells and an image. It verifies
unchecked selection-only changes, immediate all-Text application, mouse preview
without saving, Escape cancellation, one commit/undo/redo, switching back to a
single cell, unchanged image data, reset on reopen/selection, reader parity and
reload. Empty new Text is inspected at 1920×1080 and 390×844.

- [Default 24px / unchecked, desktop](new-text-spacing-1920.png)
- [Default 24px / unchecked, narrow](new-text-spacing-390.png)
- [All Text selected, image unchanged](all-text-spacing-1920.png)

The full browser release catalog, full unit suite and physical Safari testing
were not repeated for this follow-up. This is local, uncommitted work on
`codex/static-reception-bento-2026-10-26`, HEAD
`4a0251647234c0757847078ec34f0865425f6857`, preserving the existing dirty checkout.
No push, deployment or signed publication was performed.
