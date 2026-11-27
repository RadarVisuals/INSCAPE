# Panel regression repairs — 23 October 2026

Local application checkout: `remediation-2026-10-19-shared-checkpoint/work`,
branch `codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. Substantial earlier changes are
preserved. This round is uncommitted, unpushed and undeployed. The verification
workflow was inspected; remote CI does not cover this dirty checkout.

## Findings behind the three reported failures

1. The inspection test still used double-click to inspect. The accepted behavior
   is Focus on double-click/Enter, Inspect on I or the explicit Inspect control.
   A real additional bug appeared when testing I after a pointer selection:
   Display's movement handler prevents native pointer focus, leaving the sidebar
   focused. The canvas now explicitly focuses the picked artwork, retaining its
   existing pointer-focus marker and no extra mouse outline. The module still
   owns selection, media readiness and inspection; no camera/store was added.
2. The Layers test targeted the old `Selection and layers inspector` label.
   This is the experimental Display inspector, not the shared Workbench Layers
   dock. Its current label is `Layers inspector`; authoring tools are suspended
   during inspection. The corrected test verifies that its window arrangement
   and exact Grid rows return afterwards. No Layers behavior was changed.
3. Discover's fixture imported untimestamped repository modules on a warm Vite
   server, modifying separate instances from those mounted by the app. The
   fixture now uses the loaded module URLs, including Vite timestamps. The three
   expected worlds resolve and search correctly through the actual portal and
   controller. Review media are served locally and unrelated external services
   are blocked, avoiding network timing as a panel-lifecycle dependency.

The original Activity-round failures were not proven to predate that round.
Initial reruns against live external services timed out; the isolated probe and
offline fixture identify the causes above without claiming an earlier baseline.

## Related repairs exposed by the checks

- Embedded Discover's return button was covered by the sidebar. It now respects
  the existing navigation insets; on phone widths search gets a full second row.
  Standalone Discover is unchanged. This is a reachability fix, not the upcoming
  Discover design-system migration.
- The existing generic floating-window host now uses the same left navigation
  clearance for screen-space tools, including Display appearance. It already
  used top/bottom clearance. Placement, resizing and control avoidance use that
  boundary; authored canvas coordinates remain independent. The duplicate bounds
  literal in control avoidance was replaced with the host's existing bounds.
- Sidebar was being destroyed during Preview, invalidating its return-focus
  target. Its presentation now stays mounted with native `hidden` while Preview
  or inspection owns the screen. It is absent from visual and accessible
  navigation, supplies no Library host or navigation clearance, and returns the
  same trigger afterwards. Explicit Hide sidebar still unmounts it. The existing
  Preview controller retains focus ownership; no fallback focus store was added.

## Test maintenance

The complete panel/lifecycle files now use current Info/Settings/Library controls
and current I inspection. Narrow crop assertions check each reachable control
through the intentionally scrolling action row rather than demanding its entire
content fit at once. Focus tests now send separate native focus/key actions;
the previous synchronous synthetic focus-plus-key sequence skipped React's
activation update. Group tests explicitly establish the two-member selection.

The wider context-menu check also assumed a right-click through the new sidebar
and the removed Add Display menu. It now exercises keyboard menu access, ordinary
Add Image, submenu traversal, hide/reopen persistence and narrow bounds. A second
Display is seeded only in the isolated fixture through its existing domain
operation, retaining the scoped format checks without restoring ordinary Add
Display. No production menu or parked-product scope was changed.

## Verification

- **45 distinct browser tests passed on their final runs**: 4 panel lifecycle,
  5 phase-three workflows, 4 Focus, 4 inspection keyboard, 1 inspection lock
  (8 owner/visitor × Image/Display × viewport scenarios), 9 sidebar, 13 Activity,
  4 Discover/Activity recovery and 1 context-menu script.
- **19 focused unit tests passed** for discovery state, publication resolution
  state, window geometry and recovery-control avoidance.
- **10 design-system tests passed**; generated inventory and check passed.
- Production build and `build:check` passed without changing any budget.
  Initial JavaScript: **823,024 raw / 239,466 gzip bytes**; core JavaScript:
  **2,519,313 raw / 808,854 gzip bytes**. Standard large-chunk advice remains.
- Screenshots inspected at wide, narrow and low dimensions, including Carbon
  and Mist sidebar contexts. Checks cover actual pointer hit targets, scrolling,
  keyboard focus, inspection return, unchanged source nodes, authored writes,
  camera and persisted content. The Discover portal itself retains its previous
  Mist presentation until its separately planned styling round.

Evidence: [panel-regressions-evidence](panel-regressions-evidence/).
`final-browser.log` records 25 passes and two Focus test-fixture failures; the
subsequent `focus-final.log` records all four Focus cases passing.
`related-final.log` records 17 passes and the outdated context-menu test;
`menu-final.log` records that corrected script passing. Counts above replace
failed attempts, not sum repeated runs. Earlier diagnostic logs are retained.

Full `npm test`, release verification and production-browser startup were not
run. No live chain, wallet, upload, publication or deployment was exercised.
These checks are not a claim that the complete release suite is green.
