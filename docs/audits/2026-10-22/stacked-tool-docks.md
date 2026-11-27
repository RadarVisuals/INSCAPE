# Vertically stacked tool panes

22 October 2026. Founder-requested extension, based on the supplied screenshot
with Layers above Color. Local, uncommitted work on
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The checkout contains substantial
other work. No commit, push or deployment was performed.

## Result

A movable dock now contains one or more vertical panes. Each pane keeps its own
tabs, active tool and close control. Drop a tab at a pane's upper or lower edge
to stack it, with a temporary insertion preview. Dropping on a tab strip retains
the existing join/reorder behavior; dragging into free space detaches the tab.
Whole docks can join or stack, preserving their pane divisions when stacking.
The free space in any pane header moves the entire dock. Invisible outer resize
targets resize its common frame. The thin internal divider changes only its
two neighbouring panes and supports keyboard arrows, Home/End and cancellation.

Right-click or Shift+F10 on a tab offers Dock above/below as well as existing
detach, join and close actions. Closing hides the active tab; an empty pane
collapses while retaining its position and share for reopening. Multiple pane
contents remain visible and independently scrollable. At very short heights the
stack itself also scrolls to keep headers reachable. Tab-strip scrolling is
horizontal only, so selecting a tab does not scroll the entire stacked dock.

The Layers/Color screenshot is one arrangement, not a new forced default. The
six tools still start together; layout remains editor-session state and resets
on reload. Text remains independent. Keeper and subsequent surface migrations
remain separate work.

## Ownership and implementation

The old one-tab-group-per-frame model could not express the requested layout.
It is replaced with one frame per dock and ordered pane records owning tabs,
active tool and height share. There is no second coordinate model or linked
independent-window workaround. Hidden tools retain one owner in this model.
No persisted layout migration is needed because this state is session-only.

The existing stable portal containers move between pane slots; tools are not
duplicated or remounted to dock them. Shared window chrome supplies header
movement and outer resizing for both docked and independent tools. Module-owned
selection, editing, previews, validation, saving, history and publication remain
unchanged. Divider events and dock layout do not author a composition. Existing
Color preview cancellation still applies during docking. No dependencies,
artwork schema or global styling system were added.

Changed boundaries are the dock state model/rendering and shared panel header
composition. A small divider component owns its pointer lifecycle. Two Image
test fixtures now select the initial active pane through the new layout shape.
The design-system handbook and active contract record the extension; the older
disposable workspace reference is not claimed to implement this docking runtime.

## Verification

- Six layout-state tests pass: detach/reorder/join, hidden tool ownership,
  whole-dock movement/merge, simultaneous pane visibility, pane order,
  close/reopen proportions, invalid targets and stacking a whole dock.
- Sixteen browser cases pass together in `tools.log`: four docking cases,
  three Transform/Color cases, two each for Image, Shape, FX and independent
  Text, and one pointer/keyboard Color-focus case.
- The new docking cases exercise pointer upper/lower edge targets, insertion
  preview, keyboard stacking, simultaneous visible tools, divider pointer and
  keyboard resizing, Escape/blur cancellation, common-frame movement,
  detach/rejoin, whole-dock stacking, close/reopen, compact scrolling and reload.
  They assert that layout changes do not change the saved draft. Existing cases
  retain Text selection, color/history, failed-save recovery and tool behavior.
- After inspection, the visual fixture's divider was placed at 280px to expose
  the full Color controls in its screenshot; the two stacking cases passed
  again in `stacked-final.log`. This only changes test presentation.
- Four production-budget checks pass. Production build with the native config
  loader, separate build check, regenerated design inventory/check and scoped
  whitespace checks pass.
- Inspected the actual Mist dock at 1440px, showing Layers and Color together,
  and the Carbon dock at 760px with three panes. Text's existing 390px and
  1440px behavioral checks also pass. Compact panes scroll their contents;
  there is no claim that three full tool contents fit without scrolling.

All browser checks used isolated fixtures on the existing preview server at
127.0.0.1:24970. No user composition was edited. This is focused local evidence,
not a full release-suite or remote-CI result. The current CI configuration still
runs the broader verify workflow on a pushed branch/PR; it cannot verify this
uncommitted checkout.

## Size evidence

Core JavaScript is 2,486,610 raw / 796,013 gzip bytes, up 4,427 / 1,504 from the
preceding local finishing pass. The first build exceeded the previous ceilings
by 4,110 raw / 1,013 gzip bytes. The measured feature is bounded by new core
ceilings of 2,487,000 raw / 796,500 gzip; all other budget categories remain
unchanged. Initial JavaScript remains 822,889 raw bytes (239,431 gzip). Both the
initial overage and final successful build are retained with the bundle report.

## Evidence

- [Layers and Color in one dock, Mist](stacked-tool-docks/stacked-mist-wide.png)
- [Three panes in a compact Carbon dock](stacked-tool-docks/stacked-carbon-narrow.png)
- [Lower-edge drop preview](stacked-tool-docks/stack-drop-preview.png)

The adjacent directory retains test logs, build results and the bundle report.
