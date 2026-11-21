# Reception cell inspection — local implementation, 12 November 2026

Branch: `codex/profile-work-index-2026-10-30`. Starting HEAD:
`08b4a7b`. The checkout contains extensive existing changes. This work is local;
no commit, push, publication or deployment was performed.

## Implemented boundary

Native Reception viewing uses the authored gap at phone widths, including zero.
Visual assemblies fit their image/shape bounds while preserving relative geometry;
explicit mobile placements and member anchors retain their existing authority.
Text no longer grows preview cells through measured intrinsic height.

Contained reading text has bounded margins, complete-line clipping, a bottom fade
and Read more only on overflow. A per-cell Inspect action opens the same frameless
native dialog. Existing ImageArtwork/ReceptionImage and ArticleView render the
saved material. Desktop uses adjacent artwork and copy; phone reading stacks them.
The dialog owns scrolling, background dimming, Tab wrapping, Escape and returning
focus. No storage schema or save path changed. Document identity invalidates an
open inspection when the supplied document changes.

Removed the obsolete whole-document text-height observer and its superseded tests,
and removed the responsive minimum-height growth loop. The new observer only
measures excerpt overflow; it never changes cell geometry. Independent Text and
transformed decorative Text retain the existing rendering path. Rotated/mirrored
copy therefore remains inspectable through its cell, but does not receive the
new inline excerpt action. Historical v2 presentation remains unchanged.

## Verification

- 137 Reception unit tests passed, including no gaps at zero spacing, proportional
  layered artwork/shape overlays, complete content retention and bounded text.
- Lint passed with the existing 46 recorded hook observations; type contracts
  passed (40 invalid calls and nine production mutations rejected).
- The new release browser suite is registered in `scripts/browserSuites.json`.
  Its automated launch was attempted but the available Chromium executable failed
  with `spawn UNKNOWN`. This is not recorded as a passing automated browser run.
- Verified the real running dev application through the connected browser using
  the isolated fixture, with loaded artwork, at 390×844 and 1280×900: both entry
  actions, complete text, two retained visual layers, phone stacking, desktop
  columns, scrolling, Tab wrapping, Escape, close-button focus return, unchanged
  canvas geometry, no horizontal page overflow and no browser error logs.
- No real user draft was edited by the fixture. Existing authoring/history tests
  are included in the passing Reception unit suite. The full Editor browser suite
  and release-wide test suite were not rerun.

## Release blocker

Production compilation succeeds through chunk generation, but `npm run build`
and `npm run build:check` fail the unchanged aggregate raw-JavaScript ceiling:
2,750,245 bytes versus 2,744,000, an excess of 6,245 bytes. Other reported ceilings
pass. The managed environment required Vite's supported `--configLoader runner`
because its normal config bundler could not traverse a parent directory.

A separate in-memory reconstruction of this turn's preceding preview implementation
measured 2,743,998 raw bytes with the same release metadata and passed budgets;
this is a scoped diagnostic reconstruction, not a historical release artifact.
An additional compression pass was also measured and did not recover sufficient
space. No build settings, budget ceilings or chunk classifications were changed.
The feature is reviewable locally, but is not a release-ready checkpoint until
enough code can be removed or shared within an agreed follow-up slice.

### Follow-up: text wipe trial

The duplicate whole-cell reader was replaced earlier with a live-cell lift using
the editor's shared animation clock. The current text-only trial replaces the
rejected late opacity fade with complementary clip-path reveals. The original
full article retains its final reading width throughout travel; a temporary,
inert, aria-hidden text preview retains source wrapping and is removed on settle,
resize or disposal. Images and the cell are not cloned. No drift or text opacity
transition remains. Closing reverses the same reveal, including interrupted opens.
Scroll resets before closing geometry is captured. Hook callbacks now have explicit
stable dependencies. This trial adds temporary presentation DOM, not saved state.

Focused geometry/motion tests: 69 passed. Lint passed with the existing 46 recorded
observations. Visual acceptance is intentionally handed directly to the founder
for the requested fast iteration; this version has not been visually approved.
Work remains local and uncommitted. No deployment was performed.

### Follow-up: preview fade and bounded visual inspection

Founder feedback accepted the incoming text reveal. The outgoing text preview
now fades as one paragraph over the first 28% of progress instead of being
removed by a second moving cut. No tests were run after the founder requested
direct visual iteration.

Visual-only inspection now derives its maximum width from both the viewport
width and the available viewport height, using the live artwork group's aspect
ratio plus the existing responsive padding. It is centered on both axes and its
body does not scroll. Text-bearing inspection retains scrolling. The normal
fixed 1120px width ceiling and viewport margins remain. No tests or builds were
run for this follow-up; the founder will assess the local result.

The separately reported disappearance of a member after responsive reflow is
not resolved by this sizing change. Browser DOM access was blocked, so that
specific cause remains unconfirmed.

### Follow-up: progressive Bento wrapping

Replaced the intermediate all-cells stack with a read-only projection inferred
from the existing rectangle tiling. Horizontal runs flatten and wrap locally by
available reading width (220px per smallest peer); relative widths are retained.
Vertical subgroups remain atomic and rows share a trailing boundary without
changing the authored gutter. Non-slicing layouts and manual reading order use
ordered wrapping without inventing vertical groups. Full-width header/band
relationships are retained when inferred from slicing topology. A final short
row expands proportionally to its available width rather than leaving a hole.

Multi-cell Bentos now use saved phone placement below 440px; intermediate widths
continue progressive packing rather than forcing a full stack at 640px. Other
Reception documents retain their existing 640px rule. Image and text content
projection still belongs to the existing responsive member path. No persistence,
Editor geometry, Inspect animation, dependency or publication changes.

Added (but did not execute) a regression case for six horizontal units including
a vertical pair, gradual 5/4/3/2/1 wrapping, positive contained rectangles and
unchanged source data. No tests, builds or browser runs were performed at the
founder's request for direct visual iteration. This remains a local trial;
irregular layouts and breakpoint artwork visibility await founder review.

### Follow-up: shrinking slider range and invisible artwork

The founder supplied a 2518→320→1920 maximum reproduction and a first failure
around 1805px. The slider maximum previously followed its current value, losing
larger sizes while shrinking. ReceptionViewportControls now retains the largest
observed session width. Existing selected/measured widths can increase it; smaller
values cannot reduce it. Fit can seed the available width again after hot reload.

Native UI inspection (the extension DOM bridge remained blocked) confirmed that
the missing Cell 2 image still had a selectable layer inside its cell at 320px:
left 127.933, top 16, width 176.067, height 466.821, cell height 498.821. Thus the
private-filter hypothesis did not explain this missing layer. No saved geometry
or privacy setting was edited; the temporary placement panel was closed again.

SVG visibility now observes its HTML placement host rather than the changing SVG
paint viewport. Existing retention/preparation/disposal remains intact. Reception
also omits redundant parent clips for layers already fully within the cell's
rounded safe rectangle, and positions resting cell groups in CSS coordinates
instead of applying a second camera matrix/stacking context. Actual overhang and
corner clipping remain. These are rendering corrections, not removal of privacy
filtering or viewport culling.

During the founder's own resizing, subsequent native screenshots showed Keeper
and lower Nomad artwork painting again, plus both nameplates. Recovery of all six
images and the full 2518px round trip has not been confirmed. No automated tests,
builds or browser suites ran. Changes remain local, uncommitted and undeployed.

### Follow-up: SVG-specific presentation trial

The founder confirmed disappearance is specific to SVG after reload. Previous
visibility/clip adjustments did not fully resolve it. ReceptionImage now opts
into an HTML viewport in the existing ProjectedSvgArtwork renderer instead of
embedding ArtworkSvgDocument's iframe inside SVG foreignObject. The same matrix
maps the unchanged native-size isolated document onto its visible frame. Existing
loading, retention, sandbox, script/animation hosting and status recovery remain
shared. Pixel density derives from the HTML viewport scale and projection matrix.
Whole-cell Inspect continues to move the mounted image; its HTML path does not
register for the Editor's separate per-SVG lift mechanism. Editor rendering keeps
its original foreignObject path and original SVG visibility target.

No tests or builds ran. This is a scoped local renderer trial for founder review,
not a confirmed fix or a claim about the exact browser compositor failure.
