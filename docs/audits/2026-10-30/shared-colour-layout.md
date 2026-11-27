# Shared Color layout and sampling

30 October 2026. Local change on `codex/profile-work-index-2026-10-30`.
The founder requested the supplied Affinity panel arrangement for the shared
Workbench/Reception color wheel, excluding Stroke, Swatches and the opacity
dropdown. The accepted direction is recorded in the active contract's shared
Transform / Color section. No commit, push or deployment was performed.

## Implementation

`ColourControls` now owns the pipette, current-color indicator, lower-left H/S/L
readouts and lower-right hex entry. The former opt-in flags, separate heading
swatch and editable Saturation/Lightness inputs were removed. `NumberField`
remains because other design-reference controls still use it.

`CommittedColourControls` continues to own the preview/commit boundary, including
the conversion between the slider's percentage and authored opacity from 0 to 1.
Its separate numeric opacity field was replaced with the shared `ColourOpacity`
range control. Dragging previews, release commits once, and Escape, blur,
disable or disposal cancels. Continued pointer movement after Escape stays
cancelled until the next gesture. Opacity is shown only for targets that already
support it; no authored schema or new image-color operation was added.

Shape and Text provide explicit profile/module/target scope to the existing
screen-sampling lifecycle. Text selections retain their existing editor undo
path. The low-level design preview also uses the same pipette and layout;
its text-color gesture is kept separate from its ephemeral opacity changes.
Shared tool CSS no longer treats ranges as text fields. No parallel picker,
new dependency, authored-state store or additional settings were introduced.

## Verification

- 16 color-model and Shape tests passed.
- 25 distinct browser cases passed across shared tools, sampling, keyboard
  focus, Reception settings/styling, tool docking and the design color reference.
  Sampling results were stubbed: these verify integration, cancellation,
  fallback, target binding and undo, not the operating system's native picker.
- The new Workbench case checks Shape and Text sampling, stale-result rejection,
  H/S/L values, opacity preview/commit, one-step undo, keyboard use and Escape
  followed by continued dragging. It passed again after the final cancel guard.
- Wide/narrow screenshots were inspected. Small tool panes retain scrolling;
  the change does not resize the user's saved tool windows.
- Lint and diff whitespace checks passed. Production build and budget checks
  used the separate `output/shared-colour-build` directory.

Evidence: `output/shared-colour/shared-color-layout.png`, the narrow counterpart,
Reception screenshots under `output/shared-colour/reception`, and
`output/shared-colour/build.log`.

The design color test's old empty-localStorage expectation was corrected to
allow the already-existing `inscape:interface-theme` preference; it still checks
that color exploration writes no authored artwork. Unrelated design-lab and
the earlier Library changes in this checkout were preserved.
