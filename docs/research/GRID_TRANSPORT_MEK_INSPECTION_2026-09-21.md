# Grid transport: MEK reference inspection

Investigation evidence, not product authority. The Display seam defect remains
open. Earlier timing improvements are not acceptance evidence for its removal.

## Public reference inspected

- https://www.mek.gallery/
- Public runtime inspected: https://framerusercontent.com/sites/1uthgitDYZSQzO7fP4EHto/framer.B8civ-8g.mjs
- Supporting mechanism documentation: https://motion.dev/docs/motion-value

Inspected the rendered homepage in Edge at 1440 x 1000 and its publicly delivered
JavaScript. There are two large image tickers with three originals each and a
lower ticker with seven originals. The runtime identifies its implementation as
Ticker/TickerItem. The track is a flex list with a transform; item geometry is
measured separately. Continuous offset and wrapped offset use Motion values.
Offscreen items derive a displacement of one list length from that offset.
The implementation can create additional groups when the viewport requires them.
The observed desktop lists did not need additional groups.

Autoplay advances the offset in a frame callback. Drag uses the same offset
path and has inertia on release. This is not evidence of an animation running
independently of JavaScript. Saying that INSCAPE uses the main thread therefore
does not by itself explain the difference.

In an instrumented real mouse drag from x=500 to x=-6500, the first list wrapped
and its first items acquired a one-list-length transform. A MutationObserver on
the three lists observed no child additions/removals; all original nodes stayed
connected. A React DevTools hook recorded two root commits over the whole
interaction, not zero. This was not a universal performance guarantee or a
frame-by-frame visual acceptance test. Images use responsive sources; the
actual loaded resolutions differed from the original asset dimensions.

Temporary inspection artifacts are under `.browser-test-runtime/mek-*` (ignored).
They include the DOM description, before/after screenshots, and drag observations.

## Difference from Display at the time of inspection

INSCAPE already paints pixel progress outside React and retains visible Grid
surfaces. Those properties are not new remedies to import from the reference.
However, `useGridPlayback.advance` calls both `setSwipe` and `onAdvance` on each
whole-Grid crossing. The owner path updates controller selection and renders the
Workbench; the Canvas changes interaction ownership and its prepared neighborhood.
The deferred neighborhood can also mount far Grid content at the handoff.
`startTransition` schedules this work but does not remove it or make a React
commit interruptible. Visitor similarly changes active Grid and neighborhood.

Earlier local changes removed repeated document cloning/validation and began
separating media content from interaction shells. They have not established that
the user's reported hitch is gone. The last media extraction was not yet verified
when the user stopped that optimization approach; it must not be reported as a fix.

## Next engineering direction

Establish a transport boundary where crossing and wrapping prepared Grid surfaces
does not require reconstructing their content. The temporary camera owns position
and physical recycling; editor selection observes it without controlling that
motion. Preserve the contract's single camera for drag, coast and Play, immediate
takeover, resting offsets, and correct editing target. Do not flatten away layers
or silently preload every Grid and original-resolution asset to imitate a small
gallery. Preparation and media lifetime must remain bounded for real compositions.

First prove the transport with populated layered Grids across ordinary crossings,
both wrap directions, reversals, Pause/resume, and grabbing momentum. Capture the
visible result and correlate stalls with actual crossing/render work. A test pass
or a lower timing number does not close the defect. Then replace the old crossing
path, rather than retaining a second competing implementation.

No INSCAPE implementation was changed during this reference inspection. No commit,
push or deployment was performed.

## Subsequent transport rework and visual evidence

The user's important clarification was drag **and release**, with a brief stop
most visible while momentum decelerates across a seam. Instrumented coasting did
not show a cancellation command or a positional reset at the crossing. The old
camera nevertheless depended on the editor thread delivering every visual step;
Grid selection and prepared-content work competed with that delivery.

`gridCameraTransport` now gives the browser one native transform trajectory for
the entire coast or continuous Play run. Grid selection samples that animation's
clock. It does not restart it at a boundary. Grabbing, pausing, suspension and
disposal sample and cancel that same owner. Scene-linked Text follows its clock.
Manual held dragging remains direct. The release curve retains bounded travel
and its initial velocity, decreases monotonically and reaches zero continuously,
without the former velocity cutoff. Reduced motion remains discrete.

The rail now contains at most five physical appearances, with immutable authored
Grid data behind them. A short loop can show the same Grid on both sides without
moving one visible DOM node to the opposite edge. Incoming appearances retain
their slots and media on arrival; only distant preparation is replenished.
There is still one editable selected Grid. No draft schema or storage key changed.

A controlled JavaScript-driven reference using the same release curve stopped
presenting advancing artwork when the editor thread was deliberately blocked.
The native version continued presenting advancing artwork during that block.
This comparison isolates the transport dependency; it is not a recording of the
user's exact composition or an assertion about every possible cause of stutter.

The durable `grid-coast-continuity.browser.mjs` test records actual browser PNG
frames while blocking the editor for 300 ms across a slow seam crossing. Its
sixteen cases cover coast and Play, two and six Grids, owner and Visitor, and
1440/390 px viewports, with five real artwork layers per Grid and seven independent
Image modules. All sixteen keep presenting distinct, forward-moving positions.
The opaque artwork backing stays covered throughout the blocked crossing,
including the two-Grid loop. This verifies continued visible movement and scene
readiness, rather than accepting a smaller JavaScript timing spike.

The full motion interaction test also passes: pause at an offset, slow release,
momentum crossing, immediate takeover, reversal, four-Grid Play wrap, reduced
motion, unchanged saved draft and retained independent Image reading position.
Temporary recordings and measurement JSON remain under `.browser-test-runtime`.

Selection/navigation and far content preparation still render through React.
They are observers of automatic visual motion, not its frame clock. Arbitrarily
long thread starvation can exhaust any bounded prepared neighborhood; this work
does not claim immunity to browser/GPU stalls, media failures or every hardware
configuration. No dependency, flattened substitute composition or all-Grid
preload was introduced. Work remains local and uncommitted.

## Reopened after user observation

The user subsequently reported the hitch as **exactly unchanged**. The controlled
blocked-thread test therefore must not be treated as acceptance of the reported
defect. The issue is open. Their page is `http://127.0.0.1:5194/`.
On inspection no server was reachable at that address; the user also confirmed
it had become unavailable. The current workspace was started there, and HTTP
responses for both the native camera and its playback caller were verified.
Whether the previously open page used this implementation remains unproven.
Fresh-page confirmation is required before attributing the unchanged behavior
to either stale code or the current transport. No additional motion change was
made on that assumption.

After reloading, the user first did not see the hitch, then observed it again.
The problem is therefore still present with the current version; stale code is
not an established explanation. The user's browser is Chrome, whereas the prior
recorded-frame tests used Edge. A temporary local-only development server now
accepts F8-marked timing captures from the user's actual page. This instrumentation
is under the ignored `.browser-test-runtime` directory and makes no further
motion or document change. Browser observations, rather than another synthetic
test pass, must determine the next correction.
