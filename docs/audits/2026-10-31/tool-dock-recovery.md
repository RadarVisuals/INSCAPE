# Tool dock recovery after removing a stacked pane

31 October 2026. Local changes on `codex/profile-work-index-2026-10-30`,
based on `d181c5496dcb53786cf9f2d10038e1e7e7eda3e2`. No commit, push or
deployment was performed. Earlier Library/Color work and unrelated design-lab
changes in this checkout remain intact.

## Reproduction and repair

Stack Color or FX below Layers, enlarge the dock, move the divider, then close
or detach the lower pane. Layers previously retained its fractional height,
leaving its actions above an empty area that resizing could not eliminate.
Dragging the lower tab also put the preview above the cursor and transferred
the whole stack's height to the detached window.

`WorkbenchToolDocks` now normalizes the visible pane shares when rendering.
CSS flex-grow values whose sum is below one otherwise leave unused space.
Saved proportions remain owned by the existing dock state, so reopening a
closed pane restores its split without changing authored artwork.

Both pointer and menu detachment now measure the selected pane, including the
outer frame border, instead of inheriting the entire dock's height. Pointer
offsets are relative to that pane's header. Whole-dock movement keeps its
existing frame behavior. This replaces the incorrect geometry calculations
in the shared host; no Layers-specific styling or duplicate layout state was
introduced. User-resizable window sizes and their minimum bounds remain.

## Verification

- All three new browser regressions failed against the previous implementation:
  remaining Layers height, lower Color drag anchoring, and lower FX anchoring.
- All 11 docking/shared-tool browser cases passed after the repair, including
  closing/reopening, pointer/menu detachment, actual bottom-edge resizing,
  tab rejoining, reload, keyboard docking, narrow scrolling and authored-state
  preservation.
- All 21 dock-state, preferences and window-geometry unit tests passed.
- Lint passed, with the existing 87 recorded hook-dependency observations.
- Production build and build budgets passed using `output/dock-recovery/build`
  (801569 initial JavaScript bytes). Scoped whitespace checks passed.
- Inspected the Layers screenshot after detaching and resizing: the actions
  meet the lower edge and the list scrolls inside the shortened frame.

Browser checks used the local server on port 5217 with an isolated fixture
profile and browser context. They did not rearrange the user's live workspace.
Evidence is under `output/dock-recovery/before` and `output/dock-recovery/after`;
build output is recorded in `output/dock-recovery/build.log`.
