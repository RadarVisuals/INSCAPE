# Large Image corner resize — 19 October 2026

The initial corner repair was incomplete. Small Images reacted to horizontal,
vertical and diagonal dragging, but per-Image viewport fitting canceled the
visible proportional growth of large Images. Selection resizing also inherited
viewport-dependent maxima. Refreshing the current preview did not remove this
logic; the user was receiving the current deployment.

Image frames now use their authored world dimensions directly. Workbench camera
zoom/focus alone determines their screen scale. The redundant fit calculation
and viewport-derived resize caps were removed from rendering, registration,
pointer/keyboard geometry and selection targets. The existing 32–4096 size and
Workbench area limits remain. Opposite corners, snapping, fit/crop choices,
source identity, transforms and the existing commit/undo boundary are retained.
There is no new persistence field or migration. Previously auto-fitted large
Images will look larger at the same zoom; their stored sizes are not rewritten.

The narrow test also exposed a Properties-window layout loop. A fractional
recovery-control edge repeatedly requested the already-current logical frame.
Returning the same value inside a state updater did not stop the layout cycle.
The guard now prevents scheduling that redundant update in the first place.
The retained [diagnostic](image-world-size/properties-loop-before.json) records
the repeated identical requests and the React error.

## Verification

See [results and source hashes](image-world-size/results.json). The new maintained
browser suite exercises 96 real pointer drags: four corners, horizontal/vertical/
diagonal movement, grow/shrink, portrait/landscape frames, and 1440/390 px at DPR
1/1.25. The original implementation failed both viewport cases. After repair,
both pass, including preview without writes, fixed opposite corner, no release
jump, preserved source/crop/transforms and one-step undo.

The same cases cover selection resize, a real page reload with storage hydration,
another resize after reload, browser width/height changes without geometry
rewrites, and Owner/Visitor parity. The fixture moves the actual Properties
window clear of the handles and verifies pointer hit targets; it does not hide
UI or invoke resize handlers directly. Reviewed screenshots:
[wide](image-world-size/large-after-reload-1440.png),
[narrow](image-world-size/large-after-reload-390.png).

Latest results across the affected browser runs total **36/36 passing cases**,
including existing proportional corners, Image fit/interactions/focus/duplicate,
pixel marks, shared joins, F toggle, focus startup and context tools. This is an
aggregate of the recorded runs, not a fresh complete browser-suite pass. One
Display Escape-focus assertion failed in the first context-tools run (8/9);
the unchanged isolated rerun passed 9/9. Both logs are retained. The cause of
that intermittent failure is not established, and no assertion was weakened.

The complete packaged Node suite passes **1239/1239**, with no skips. Production
build and budgets pass; initial JavaScript remains **822709 decoded bytes**.
The 16 changed source/test/contract files were compared against the previous
checkpoint before applying them to the active checkout, backed up and verified.
No unrelated working files were changed.

These checks use synthetic artwork and isolated Chromium storage. This repair
does not test the user's authenticated composition, perform publication, or make
a new performance claim. Hosted CI and the matching Netlify deployment are
verified separately from this local evidence.
