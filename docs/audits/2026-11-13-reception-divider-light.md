# Reception divider light — 2026-11-13

The founder placed the light source on the header's bottom separation line in
their annotated screenshot, with Down, Up and Both directions. Down is the
accepted default. The orange shapes indicate illumination, not opaque artwork.

## Implementation and boundaries

- `ReceptionHeader` now owns the shared `ReceptionAtmosphere` position. Its
  source sits on the actual bottom border, including when Preview controls wrap.
  The previous page-top instances, fixed top offset and nondirectional shadow
  are removed. No header measurement, new observer, timer or animation is added.
- Up/down paint uses static CSS gradients behind the content. The page bounds
  clip paint; the existing content scrolling remains independent. Outer grid
  rails moved from the old page atmosphere wrapper to page pseudo-elements.
- The shared Bento Page/Preview appearance controls offer Down / Up / Both.
  Optional `lighting.direction` is validated with the same Reception document.
  Existing saved lighting without that field renders Down without a draft write.
  A direction change uses the existing store, history, failure and authority
  boundaries; no second save route or publication action was introduced.
- Preview forwards its temporary appearance to the shared header, preserving
  color/strength gesture previews. The settings sample uses the same renderer
  anchored to its miniature header divider. Zero strength still switches off
  both the source and glow.
- Production changes: 30 additions / 18 deletions across eight existing files.
  No dependency added, budget raised, or unrelated cell editing work replaced.
  Tests/docs are separate from those counts. The public v2 renderer remains an
  actual consumer of the older compact header; this change targets native v3.

## Verification

- 122 focused Node tests pass across Bento, document, editor scope and publication.
  All three directions are checked for atomic save, Undo/Redo, failed storage,
  invalid values, reopen, layout regeneration and retained cell/canvas geometry.
  Full public document validation and backup preserve the direction.
- Browser assertions were updated for the header-owned light, divider alignment
  after width changes, directional paint, Undo/Redo, reload and public rendering.
  The runner stopped before tests: Windows process-ownership inspection via
  `Get-CimInstance` is denied. No automated browser pass is claimed.
- Direct browser verification used an isolated local draft: Up, Both, Down,
  Undo/Redo and reload retained the selected direction and strength. Public
  rendering has the same source and no Preview controls. At wide, 900 and 320 px
  Preview widths, source y equals header bottom minus its 1 px border; no page
  horizontal overflow. The actual user's composition was not edited.
- `npm run build` remains blocked by the Windows esbuild configloader. The native
  configloader compiles but the bundle guard reports core JS 2,755,374 against
  2,744,000 bytes (+11,374). `build:check` confirms the failure. This is the whole
  concurrently edited checkout, not an isolated byte delta for this change.
- Changed source was compared with start-of-task snapshots. Removed wrapper/
  grid selectors and old page-level light queries have no remaining consumers.
  No commit, push, deployment, upload, wallet or signature action was performed.

Evidence: `.verification/reception-divider-light-2026-11-13/` contains initial
source snapshots and the unit, browser, build and budget logs. Screenshot
`result.jpg` is an isolated test preview. This is a local reviewable change;
automated browser and release verification remain blocked as described above.
