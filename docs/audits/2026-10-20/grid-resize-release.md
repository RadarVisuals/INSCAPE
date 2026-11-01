# Grid resize release — 20 October 2026

The founder reports the owner Workbench crashing immediately on releasing a
Shape → Grid resize handle. The actual preview #5 console reports React error
185 (maximum update depth), with the application frame at the group scene's
`setHiddenModuleIds` layout effect. The reported release was
`575702012dec10d11b81b2d4b32e247c6275ea82`.

## Change and limits

The group scene now compares presentation transforms, hidden module IDs and
selection before dispatching state updates. An unchanged scene no longer queues
updaters merely to return their previous value while resize work is committing.
The empty group list is stable across renders. Group visibility remains owned
by the scene; geometry and saves retain their existing module/store boundaries.
No resize math, aspect-ratio behavior, persistence schema or wallet flow changed.

**The founder retested preview #5 after release 06ac24a and confirmed on
20 October: “ja ik crash niet meer woohoo”.** The reported scenario is closed
on that direct user evidence. The agent did not independently repeat the same
composition. The original crash did not reproduce in isolated baseline trials,
so the full root cause remains unconfirmed. The code is a targeted guard at the
observed failure site, not a deterministic baseline reproduction.

## Local verification

- All 1263 Node tests passed, with zero failures or skips.
- Eleven browser cases passed across six suites: production Grid release,
  Shape corners at 1440/390 px, owner groups, compact stacks, published groups,
  and Workbench recovery.
- The final production Grid test was repeated with actual interface fonts:
  32 pointer releases including small unchanged-cell drags, four selected
  corners and fractional zoom, followed by Undo, Redo and reload. It uses
  disposable storage, five empty Image modules and two Text modules.
  Saved dimensions are checked; the browser reports no page errors.
- Production build and budgets passed: 822884 initial JavaScript bytes.
- The previous hosted Arrival recovery timeout also passed locally here;
  its intermittent hosted cause has not been established.

The new browser suite is in the maintained CI selection. These local results
do not imply that a new hosted CI run has completed. No wallet, publication or
private user composition was altered by these isolated tests.

[Verification and source hashes](grid-resize-release/verification.json),
[production test log](grid-resize-release/production-resize.log),
[saved resize sequence](grid-resize-release/resize-sequence.json),
[Node log](grid-resize-release/node.log),
[build budget](grid-resize-release/build-budget.log).
