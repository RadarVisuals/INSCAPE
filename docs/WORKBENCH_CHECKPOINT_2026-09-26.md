# Workbench rendering checkpoint — 2026-09-26

This records implemented work and verification limits. It is not a release
approval or a replacement for `INSCAPE_ACTIVE_CONTRACT.md`.

Branch: `checkpoint/workbench-rendering-2026-09-26`, based on `c468865`.
Code commits: `f479dbc` (prepared baseline) and `41f6429` (subsequent corrections).

## Saved work

The first commit preserves the existing prepared baseline: Workbench camera,
pan/snapping and selection sizing; Image crop and geometry; shared isolated SVG
artwork; Display projection/inspection; Library media handling; Text unlinking;
and associated tests and contract changes.

The second commit records the subsequent corrections:

- Image, Text and Display use shared physical-pixel outer endpoints.
- Standalone Text owns its background/frame on the outer window. Display text,
  artwork and controls consume the Stage projection in their appropriate units.
- Lift no longer uses the redundant media `will-change` hint or starts a second
  CSS fade after returning. Inspection blocks camera and source-window gestures
  until return completes.
- Group resizing keeps Text coordinates continuous through preview and commit,
  as Display already does. Previously, integer Text sizing could save a gap
  between adjoining Text and Display modules. Existing saved spacing is preserved;
  an older unwanted gap needs an explicit re-snap.

The development-only **Meet Grid-naad** measurement tool remains available at the
user's request. It is read-only and excluded from the production application.
Its v3 report includes Text/Display joins and frame styling as well as artwork
and Grid boundaries. A zero DOM gap does not prove opaque rendered coverage.

## Open issues

1. **Intermittent seam during Grid sliding.** The user reported a line, probably
   between two Grids, and subsequently could not reproduce it. The 16:08:09 UTC
   measurement shows adjacent Grid slots meeting at x=2028.4888916015625, zero
   geometric gap, DPR 1, zoom 0.8187307593244015, Stage 785 by 442. A controlled
   comparison using opaque artwork did not reproduce the line. Cause unresolved;
   no speculative Display-rendering patch was added for this report.
2. **Inspection after interrupted Grid coast.** In an Owner reproduction,
   double-clicking near the end of a Grid transition stops the camera before the
   new Grid becomes selected. The mostly visible incoming Grid stays inert and
   cannot be inspected until navigation resumes. A completed transition allows
   inspection. This interaction between input takeover, camera offset and Grid
   selection is reproduced but not repaired; the user's exact trigger is unconfirmed.

An earlier Image/Image report was traced to partially transparent edge pixels in
the supplied artwork. The user confirmed the seam disappeared with another image.
That finding is specific to that source and does not explain every later seam.

## Verification already performed

- The full Node suite passed 917 tests during the preceding inspection follow-up.
  It was not rerun after the final Text group-resize correction.
- After that correction, 24 focused Node tests passed: Workbench projection,
  Display geometry/foundation and Workbench presentation validation.
- The Text/Display browser regression passed for primary and additional Display
  at DPR 1, 1.25 and 2. It checks all corner anchors, drag preview/release, Escape,
  Undo/Redo, saved-data remount, unchanged article content, zoom, fractional pan,
  wide/narrow viewports and actual pixel coverage. The test failed on the old
  behavior with Text right=364 and Display left=365.
- Earlier focused browser runs covered Lift return pixels, inspection input
  locking, Image/Display interaction, module boundaries, SVG media and Text tools.
  These runs cover their recorded cases, not all artwork or every animation frame.
- `npm run build` and `npm run build:check` passed after the production changes.
  Existing dependency annotation and chunk-size notices remain.
- Whitespace checks passed before creating the checkpoint commits.

Previously documented browser failures were not rerun for this checkpoint:
group-resize minimum-size expectations,
Visitor Text wrapping expectations, narrow-viewport artwork handles and Text
window containment. Three Display-cues cases also target superseded controls.
These were documented during prior investigation and are not marked repaired here.

## Scope and local evidence

No dependency, draft schema or storage-key change was introduced by the latest
seam/inspection refinements. Image still requires whole-pixel content dimensions;
the Text/Display checks do not establish every mixed Image-selection join.

The detailed local evidence remains under:

- `output/seam-implementation-2026-09-26/`
- `output/inspection-followup-2026-09-26/`
- `output/grid-inspection-followup-2026-09-26/`
- `output/text-display-seam-2026-09-26/`

Those scratch scripts, screenshots and raw reports are intentionally not part of
this Git checkpoint. Unrelated exports, recovery material, prototype directories
and untracked notes also remain local. The checkpoint contains the application
changes, relevant regression tests, retained measurement tool and this summary.
