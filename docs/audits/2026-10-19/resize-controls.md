# Resize controls — 19 October 2026

The founder chose proportional corner resizing: the Image frame and artwork
keep their ratio together, with no Shift modifier. Horizontal, vertical and
diagonal drags all work; the opposite corner stays fixed. Side handles continue
to edit one frame dimension. Whole-pixel authored dimensions can round by half
a pixel; source media still uses its aspect-preserving projection.

The live preview inspection also established a separate paint issue. At DPR 1,
a selected Image at 90% measured 173 × 260 CSS pixels. Its top/bottom midpoint
marks began at x = 1361.5, while corner marks were on whole pixels. The outer
border itself was already pixel-aligned. This was evidence for correcting mark
alignment, not a general finding that all perceived jaggedness was explained.

## Changes and ownership

- The existing window-geometry helper aligns only painted mark origins to
  physical pixels. Visible marks remain 8 × 8 CSS pixels and pointer targets
  remain 28 × 28. Image, Text, Shape and tool windows use their actual DPR.
- Image's existing resize calculation scales both dimensions from the stronger
  relative pointer axis and snaps its driving edge, within size and area limits.
  Workbench selection resizing shares that pointer calculation instead of
  projecting movement onto the diagonal. Workbench still owns selection,
  bounds and navigation; Image still owns its authored dimensions and fitting.
- Proportional resize keeps the existing Fit inside/crop choice. A changed
  canvas ratio still fills a formerly fitted side. Source identity, transforms
  and authored crop focus/zoom remain unchanged.
- Existing preview, commit, cancel, save-failure and undo boundaries are reused.
  No persistence schema, dependency, wallet or publication path was introduced.

## Evidence

See [machine-readable results](resize-controls/results.json). Retained baseline
logs distinguish actual failures from updated expectations:

| Check | Before | After |
| --- | --- | --- |
| Physical mark alignment at DPR 1, 1.25, 1.5, 2 | 0/4 | 4/4 |
| Proportional Image corner browser suite, 1440/390 px | 0/2 | 2/2 |
| Existing grip reachability, Image/Shape/Text/Display | — | 2/2 |
| Keyboard focus and Image interaction | — | 3/3 |
| Text/Display group resize, shared joins, DPR 1/1.25/2 | — | 6/6 |
| Fit choice, side/grid resize, selection and Visitor | stale grid target failed on both versions | 1/1 after fixture correction |
| Complete packaged Node suite | — | 1239/1239, no skips |
| Production build and budgets | — | passed; 822709 initial JS bytes |

The corner suite exercises 144 drags: four corners, horizontal/vertical/diagonal
movement, growing/shrinking, three zoom levels, and two viewport/DPR settings.
It checks preview without a write, the fixed opposite corner, source aspect,
unchanged fit/crop/identity, no release jump, one-step undo/redo, cancellation,
storage failure, keyboard input, independent side resize and selection handles.
The pixel suite measures 384 marks across three module types and four zooms.
The two new suites and the reconciled fitting suite join the maintained runner.

One Node expectation previously allowed a square to become a rectangle at the
Workbench boundary. It now checks proportional corner limiting and separately
checks that the side handle can reach the width boundary. The older manual
fitting fixture requested a grid point outside the current Workbench/viewport;
it failed identically on the original source. Its target is now inside both
bounds, and it opens the current Dimensions disclosure before numeric editing.
No production boundary was widened to satisfy that test.

Visual checks inspected the [wide](resize-controls/corner-horizontal-1440.png)
and [narrow](resize-controls/corner-horizontal-390.png) owner states, plus the
pixel-alignment captures. These use synthetic artwork and isolated browser
storage. The user's saved composition was not resized. This does not establish
perfect antialiasing at every possible browser zoom/DPR, or test real wallet
publication. No performance improvement is claimed.

The 1239 count is from the packaged checkpoint checkout. The earlier 1245 count
in the checkpoint README describes the pre-packaging local tree, including
development-only material omitted from this branch. They are separate runs.

Local build/test evidence is distinct from hosted CI and Netlify deployment
status. The draft PR and preview retain their existing release boundaries.
