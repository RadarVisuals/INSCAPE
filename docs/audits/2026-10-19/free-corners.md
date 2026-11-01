# Free Image and Shape corners — 19 October 2026

The earlier repair implemented the wrong interaction: a corner scaled width
and height together, even when the pointer moved only horizontally or vertically.
The founder clarified that all four corners must independently widen/shorten and
raise/lower the Image bounds. The source artwork must remain undistorted.
This decision supersedes the proportional-Image-corner interpretation in the
two preceding audit entries. The founder confirmed the corrected local behavior.

Each Image corner now moves two independent edges. Horizontal input changes
width only; vertical input changes height only; arbitrary diagonal input can
increase one dimension and decrease the other. The opposite corner stays fixed.
Snapping skips an untouched axis, and each dimension retains its own size and
Workbench limits. Single-Image selection delegates to the same Image geometry;
the Workbench still owns temporary selection frames and atomic commits.
Multi-module groups retain their existing proportional scaling.

Resizing no longer silently changes Fit inside to Fill canvas. Both preview
and commit retain each side's fit/crop choice, crop focus/zoom, source and
rotation/mirroring. The existing media renderer preserves the source ratio:
Fit inside shows the whole artwork with possible empty space, while Fill canvas
crops to cover the changed bounds. No media is stretched. The old automatic
resize-to-fill helper was removed rather than adding another fitting flag.
The authored-world-size and physical-pixel handle corrections remain.

The founder then reported that Shape corner dragging worked immediately after
creation but changed behavior afterwards. The regression test reproduces the
route switch: the native handle changes 288×288 to 300×288, then a vertical
selection drag incorrectly changes the width to 312.5. Single-Shape selection
now delegates to the same window resize calculation as its native handles.
The existing host retains snapping, area limits and saving; Shapes retain their
constraints. Grid resizing reveals complete rows/columns without changing cell
size, and keyboard steps use that same cell size. No alternate resize state or
new persistence format was added. Text and multi-module groups keep their
existing selection behavior.

## Evidence and limits

The [results and source hashes](free-corners/results.json) record:

- 192 small-Image pointer combinations across four corners, three zooms,
  horizontal/vertical/diagonal/mixed directions, growth/shrinkage and two
  viewport/DPR settings; the actual media projection retains its source ratio.
- 96 large-Image combinations, real storage hydration after reload, another
  resize after reload, viewport changes and Owner/Visitor parity.
- Preserved fit/crop/transforms, unsaved preview, no release jump, cancellation,
  failed-save recovery, undo/redo, and pointer/keyboard single-Image selection.
- 20 rectangle drags and 6 Grid drags across two viewports, repeat selection,
  undo/redo, reload and Grid keyboard resizing. The narrow fixture closes the
  covering Text module and moves Properties below the shape using real input;
  inspector occlusion is not mistaken for a geometry failure.
- 19 passing latest browser cases across the affected suites, 1240/1240 Node
  tests with no skips, production build and budgets (822709 initial JS bytes).
- Existing Image/Shape/Text/Display grip reachability, shared Image edges and
  Text/Display group resizing. The grip test first failed because it still
  expected proportional Image corners; that expectation now checks independent
  dimensions. The original failing log is retained.

This is targeted browser verification, not a fresh full browser-suite run.
Screenshots use synthetic media: [wide](free-corners/corner-horizontal-1440.png)
and [narrow](free-corners/corner-horizontal-390.png). The authenticated local
browser confirmed that the prior version really changed both dimensions; each
probe was undone and its original dimensions restored. After the correction
the founder replied “eindelijk”. No further changes to the user's composition
were made for testing. The real-browser measurements stay in the local audit;
these shared screenshots do not include the user's composition.
Shape captures: [wide](free-corners/shape-corners-1440.png) and
[narrow](free-corners/shape-corners-390.png). Shape behavior is verified in
isolated production-runtime fixtures; separate user confirmation is pending.

The active checkout was updated after comparing the touched files with the
previous checkpoint, with backups and byte verification. Hosted CI and Netlify
status are checked against the new commit separately. No wallet, upload or
publication was performed.
