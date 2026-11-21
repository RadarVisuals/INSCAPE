# Compact Bento finish — 5 November 2026

Scope: the existing Reception Bento settings panel in the real Editor, in both
device-wide themes. Baseline: `08b4a7b`. The initial styling slice and subsequent
live-review changes below are local; this is not a release-verification record.

## Implementation

- Keep WorkbenchToolPanel/ToolPanel for placement, docking, resizing and focus.
  Keep the existing Reception actions, proposal state, previews and Apply flow.
- Add the accepted Editor palette to the existing theme-token owner. Bento opts
  into it through the shared flat material; existing button states remain in
  workflowTactile.css. Unmigrated tools keep their previous default values.
- Replace Bento's stacked numeric labels and bare inputs with compact labelled
  rows and inset fields. Keep native number inputs, their accessible names,
  limits, keyboard operation and explicit Apply actions. Controls are 28 px on
  desktop with 11 px Sora. Existing coarse-pointer target sizing is retained.
- Replace the old local field, border and preview colours in receptionBento.css;
  do not stack another overriding stylesheet on top. Move general usage tips
  into a native disclosure; retain save/preview and scope explanations inline.
- Restore the separate six-icon alignment row in the compact Figcraft reference.
  Object alignment and positioning content inside a cell are separate concepts.
  No new alignment behavior or inactive placeholder buttons were added to Bento.

The shared host and persistence boundaries were adequate; no new state owner,
dependency, schema, history implementation or docking implementation was needed.
The initial five-file styling slice contained 110 added and 32 removed lines. The growth was
the two theme palettes, their shared material mapping and native field presentation.
Other tools intentionally retain their current material until a separate migration.

## Evidence and limits

- Inspected the running real editor in light and dark, with its 290 px saved dock
  and the existing floating panel. Checked Current grid, selected-cell settings
  and New layout through their existing controls; no layout was applied.
- Read the computed 11 px font and 28 px field-container geometry (26 px input
  inside its border). Inspected normal and smaller desktop rendering, focus and
  the contained scroll area with the persistent Apply footer.
- The temporary browser viewport override was removed after the founder noticed
  it affecting their open window. Confirmed the editor again occupies the full
  2844 CSS-pixel viewport at their existing 90% browser zoom. Light mode restored.
- `git diff --check` passed. No application test suite, build or budget check was
  run, following the founder's request during UI iteration. Saving, Undo and
  publication were not re-exercised in this styling pass.
- Browser screenshots and the updated reference renders are under the parent
  project's `exports/2026-11-05-bento-ui` and `exports/2026-11-05-ui-density-study`.
  They are supporting captures, not additional production assets.

## Subsequent live-review changes

- Remove New layout's introduction and radius field. Replace the count-only
  generator input and automatic row choice with explicit columns and rows;
  variants change proportions within those counts. The existing 16-cell capacity
  and content-aware size limits remain. Current authored rectangles are not
  regenerated until the user chooses Replace layout.
- Read the preview from the validated candidate instead of generating it twice.
  It now displays each retained cell's actual radius. Existing radii continue
  through the existing applyReceptionLayout preservation path.
- Replace the three full-width format buttons with a single labelled native
  selector, aligned with Size and Spacing. Remove the displaced format CSS.
- Remove the selected-cell fieldset, its separate Apply button and duplicate
  structure-action list. Move individual radius to Shape using PatternNumber
  and the existing editBento cellRadius action. Split/merge stays in the existing
  cell context menu. Remove the unused selectedId/structureActions panel props.
- Fold Add row below into one compact button. Its tooltip explains that it adds
  a full-width cell and grows the Bento height. General instructions remain in
  the closed help disclosure rather than expanding with selection.
- Prevent numeric-field Enter from submitting the form. Required geometry fields
  use native constraint validation; a blank optional radius is omitted from the
  saved patch and cancels that preview, preserving per-cell radii. Geometry errors
  now name Width, Height, Gap or Outer margin through one shared validator.

Existing generator and domain test fixtures were updated for explicit dimensions;
they were not executed. No test suite, build or bundle check was run, per the
founder's instruction. Diff and source references were inspected. The running
Editor's DOM showed the new Current grid selector, compact row action, removed
selection section and disabled Apply for an unchanged grid. The user navigated
away during the screenshot attempt, so that capture is not visual evidence of
the changed panel. No viewport, theme, document or layout was changed through
browser automation. New-layout application, persistence, Undo, radius editing
in Shape and narrower-window rendering remain unverified in this pass.

At this intermediate checkpoint, the production diff was 188 added and
113 removed lines, excluding tests, docs and reference artifacts. The follow-up
reduces net production size by three lines compared with the styling slice;
it reuses the existing generator, Shape numeric control, save and history owners.

## Direct controls and removal of remaining guidance

The founder subsequently rejected the remaining Apply flow in Current grid,
the help disclosure, the standalone bottom-row button and preview/save text.
This supersedes those intermediate choices above.

- Current grid now commits one setting through the existing Reception action:
  checkboxes and format choices immediately, numeric fields on blur or Enter.
  Gap and radius retain their temporary typing previews; Escape resets the field
  and preview. Blank optional radius preserves the current cell values. Invalid
  commits restore the saved field value and show the existing validation error.
- Remove the pending patch, whole-form Apply and generation-key remount. A
  successful numeric edit no longer replaces the whole inspector while the user
  is clicking the next control. Saving, history and failure handling stay with
  editBento; no second persistence or undo mechanism was introduced.
- Put the frame/inner-line checkboxes in one row. Delete the help disclosure,
  its styling and preview/save caption. Move row insertion to + Cell using the
  existing addCell/appendRow operations. Its choices describe the actual targets:
  right of the selected row, or below the Bento.
- Keep the New layout confirmation alongside the preview and variant controls
  in the scroll flow, rather than pinned to the bottom of a tall window.
- Reuse OwnerSystemWorkflowSelectMenu for Format and + Cell. Its Editor variant
  consumes the existing palette, compact row size and corner token in the shared
  menu recipe. The format trigger uses workflow-tactile-control; remove its
  duplicate appearance declarations. The real-browser inspection exposed the
  prior closed-trigger bug: the global system-workflow button reset won over
  the one-class local radius rule. Using the actual shared control recipe fixes
  that ownership mismatch without a specificity override.

Browser inspection observed the removed controls, side-by-side checkboxes,
and a 7 px computed radius on both the format trigger and its opened list. The
list opened and closed with Escape, preserving the document. A full screenshot
showed the compact Current grid controls and rounded open list, saved as
`exports/2026-11-05-bento-ui/bento-direct-controls-full.png` in the parent project;
cropped capture attempts were unusable while the founder moved/docked the panel.
No authored setting, viewport, theme
or saved layout was changed through browser automation. No application tests,
build or budget checks were run. Actual save/Undo transitions remain unverified.

The combined production diff now contains 237 added and 146 removed lines,
excluding tests, docs and reference artifacts. The shared menu gained a scoped
Editor variant and keyboard/focus support; the pending-form and guidance paths
were removed. No dependency was added. `git diff --check` passed.

## Content height and quieter dock controls

The founder accepted content-sized floating Bento height and manual dock-boundary
resizing. The shared ToolPanel now fits height while keeping the user's width,
caps height to the available viewport, and exposes horizontal resize handles in
this mode. Replace its unused contentSized width-and-height mode with this
height-only option; no consumers of the old mode remained. Remove Bento's initial
760-pixel height and floating 360-pixel minimum. The existing ResizeObserver keeps
drag/dock geometry aligned with rendered content without cancelling width drags.
WorkbenchToolPanel disables fitting when attached, preserving the dock's existing
frame and resize controller. There is no new layout persistence or resize engine.

Shared dock/undock buttons now use a muted 14-pixel icon with their existing click
target. Hover/focus restores full ink. Both shared icon rules consume the same
local size variable, avoiding a competing CSS override. Close icons are unchanged.

Live browser inspection at the founder's existing viewport observed Current grid
at 290 x 304 CSS pixels and New layout at 290 x 504, both with top=40. Switching
back restored the shorter content height with no internal overflow. Computed dock
icons were 14 pixels inside 28-pixel targets. Full screenshots are saved under the
parent project's exports/2026-11-05-bento-ui as bento-content-height-current.png
and bento-content-height-new.png. Only the task tabs were switched; no document,
viewport, zoom, theme or dock layout was changed by automation. Dock dragging and
short-viewport scroll containment were inspected in source, not exercised live.
No tests, build or bundle checks were run, as requested. Changes remain local.
