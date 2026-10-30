# Gallery hover reveal and combined navigation

Local, uncommitted changes on `codex/audit-checkpoint-2026-10-19`, based on
`6d7d428d91e2dce5629ccea7b48c345faabaec59`. The checkout already contains the
earlier overview, presentation and crop changes. No commit, push or deployment.

## Requested result and boundary

The founder approved hover-revealed titles/actions, removal of the standalone
grid information panel, Aerra's plain translucent material, and one bottom
Inscape menu combining navigation and view controls.

The disappearing image came from the general button-hover selector winning
over the tile's transparent open button. That rule now excludes the open button.
The composition remains mounted and visible beneath a 30% black scrim.
Titles and small Edit/Crop/Information actions reveal on hover and keyboard
focus. Touch first reveals, then opens with a second tap or View.
Information shows the saved introduction and Edit details within the tile.
Crop opens the existing crop form directly. Empty thumbnails omit the old
placeholder paragraph so it cannot overlap the reveal.

The combined bottom menu contains the existing profile identity, About and
Canvases actions, List/Grid/Wrap and New Workbench. It closes on outside press,
Escape or departure; Escape restores its trigger. There is no gallery header
or reserved footer. List retains its existing preview/details layout.

Aerra's category control was inspected in the live reference: dark
`rgba(12,14,15,.5)`, 10px backdrop blur, 6px corners and a quiet shadow.
The overview/viewer share that material without the prior gradient or rim.
Transparent artwork keeps the authored canvas surface.

Responsibility changes are limited to presentation: the redundant grid
`inspecting` panel state/path was removed, and existing forms receive direct
tile actions. The collection store still owns names, introductions and crops.
Menu open state and touch reveal state are temporary. Browsing does not activate
or save a Workbench; only Edit activates the existing editor.

## Current evidence

- [Browser results](browser-final/results.json): 9/9 passing, 46.804 seconds.
  Covers hover without opaque occlusion, bounded long titles, menu dismissal,
  one finite keyboard collection through wrapped copies, touch reveal/open,
  direct forms, failed writes, crop persistence/reset, presentation metadata,
  retained gallery position and editor activation.
- [Lint](lint.log): passes, 479 files, 92 pre-existing recorded observations.
- [Contracts](typecheck.log): passes, including 17 invalid calls and 3 production
  mutations rejected.
- [Design inventory](tokens.log) regenerated/checked; [tests](design-tests.log)
  10/10 passing.
- [Production build](build-final.log) and [output check](build-check.log) pass.
  [Build tests](build-tests-final.log) 19/19 passing, including alternate outDir.
  The first sandboxed build-test attempt could not read Vite configuration;
  the permitted run completed successfully.
- [Measured bundle report](bundle-report.json): initial JS 825,979 raw /
  239,899 gzip; aggregate core JS 2,561,559 raw / 826,474 gzip.
  The first build exceeded the aggregate raw ceiling by 555 bytes. Its allowance
  changed from 2,561,000 to 2,563,000 for this menu/reveal addition. All other
  limits, including initial-load, owner-static and aggregate gzip, are unchanged.

Visual inspection included 2560px, 1440px, 390px and 320px widths, long names,
touch and empty compositions. Screenshots use isolated test compositions:

- [Hover reveal](browser-final/workbench-overview/gallery-hover.png)
- [Combined menu](browser-final/workbench-overview/gallery-menu.png)
- [Narrow menu](browser-final/workbench-overview/gallery-menu-320.png)
- [Touch actions on an empty canvas](browser-final/workbench-overview/grid-touch-details.png)

An intermediate keyboard check caught focus loss caused by hiding the reveal
container with CSS visibility. It now uses opacity with gated pointer events:
actions remain in the finite keyboard sequence, and focus reveals them.

## CI, deployment and limits

Read-only GitHub checks for the current committed HEAD returned a successful
Netlify `netlify/enterinscape/deploy-preview` status and a cancelled
`Verify Inscape` run 40045584067. Those results do not cover these local edits.
This change was verified with local checks above; it is not a release checkpoint
and the full repository test suite was not run.

Public multi-canvas publication, Reception/Articles/Desktop rollout and existing
read-only preview limitations remain outside this change. The owner overview
continues using the existing projection rather than starting live mini apps.
