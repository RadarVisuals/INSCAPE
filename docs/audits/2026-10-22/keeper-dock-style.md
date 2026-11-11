# Keeper dock from the design-system workspace

The founder's subsequent [screen-placement correction](keeper-screen-position.md)
supersedes this initial pass's retained canvas placement. The visual reference
and shared artwork-slot implementation remain current.

22 October 2026. Local, uncommitted work on
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The checkout already contains substantial
uncommitted work, including the earlier tool-window migrations and exploration
trial. This report covers this bounded Keeper visual migration, not that entire
diff. Nothing was committed, pushed or deployed.

## Result and ownership

The founder explicitly selected the Keeper dock **from the design system**.
The actual workspace reference was inspected before implementation. Its compact
176 by 188 pixel frame, Keeper header and dashed empty artwork slot are the
source. `KeeperDockContent` now renders the artwork slot in both the reference
and runtime; the reference-only placement note stays in the reference. The
existing settings button, loaded artwork, Release, Return and Retry actions
remain connected to Keeper.

The dock and its independent settings use the shared flat Carbon/Mist material,
thin separators and control geometry. Settings retain their existing controls,
content fitting, internal scrolling, keyboard movement, Escape and focus return.
Pointer opening does not outline the header. Neither surface adds resize handles.

Keeper still owns drops, asynchronous-result invalidation, movement, dialogue,
publication and save/recovery. The existing Workbench window still owns gestures
and fitting. The dock retains authored canvas placement; settings placement is
temporary editor state. This is not a migration into the shared tool-tab dock.
No habitat, AI, Navigator or sidebar feature was added.

The visual reuse removes the separate preview artwork-slot recipe. Flat chrome
is an explicit option on the existing window host rather than a second movement
implementation. Navigation is passed to Keeper as the existing element reference
and handled by the host's existing avoidance function. The larger dock exposed
two concrete placement dependencies: narrow Workbench navigation now leaves
enough width, and the exploration trial derives its dock offset from the shared
dock dimensions instead of old small-dock constants. Settings stack above ordinary
tool panes while leaving navigation reachable. These are placement repairs, not
a broader navigation or persistence redesign.

## Verification and limits

- Nine Keeper state tests pass.
- Twelve unique Keeper browser cases pass across the focused runs: three basic
  drop/save/recovery cases, three dialogue cases, three exploration/shared-Keeper
  cases, one swim-tuning case, and two new wide/narrow reference-parity cases.
- The new cases compare the real reference material and artwork-slot geometry,
  exercise settings movement, save, scrolling, closing, focus recovery and
  keyboard reopening, and verify that window arrangement does not change the
  draft. They run at 1440px Mist and 390px Carbon without user storage.
- Initial runs exposed artwork-slot box-sizing and navigation/window overlaps.
  Those were fixed and the affected cases rerun successfully. The existing swim
  test also needed to open the separate settings window explicitly at initial
  load and reload; its save/failure/Undo assertions were retained.
- Eighteen production-build checks pass, including the alternate-output build.
  Native production build, separate build check, generated design inventory
  check and scoped whitespace checks pass.
- Inspected wide Mist, narrow Carbon, reference-slot and loaded-artwork tuning
  screenshots. The narrow settings body scrolls above the existing camera rail.
  The final tuning image confirms that roaming artwork no longer covers settings.

An additional, broader `shared-display-tools.browser.mjs` run is **not green**:
it reaches the retained Display appearance window and its target switching,
then fails at line 88 while reading `appearances.appearance.edges.grain`
(`edges` is undefined). That Display data assertion was not changed in this
Keeper task; its full behavior remains unverified by this run. The failure log
is retained. This is focused local evidence, not a full release-suite or remote
CI result. The configured CI workflow cannot validate uncommitted files.

## Build size

The final native build measures 2,487,119 raw / 796,161 gzip core JavaScript bytes
(+509 raw / +148 gzip versus the preceding stacked-dock report). Initial
JavaScript is 822,889 raw / 239,434 gzip bytes. The alternate-output build
measured 796,773 gzip bytes, exceeding the prior 796,500-byte ceiling. Core
ceilings increase by 500 bytes each to 2,487,500 raw / 797,000 gzip. Other
categories retain their limits. Initial failed logs and final successful build
evidence are preserved.

## Evidence

- [Mist dock and settings](keeper-dock-style/pointer-mist-1440.png)
- [Carbon settings on a narrow screen](keeper-dock-style/pointer-carbon-390.png)
- [Lower settings actions remain reachable](keeper-dock-style/settings-actions-carbon-390.png)
- [Loaded artwork and swim tuning](keeper-dock-style/keeper-tuning-narrow.png)
- [Actual workspace reference](keeper-dock-style/reference-mist-1440.png)

The adjacent directory contains the logs, inspected images and final bundle
report. The preview server remains available at `http://127.0.0.1:24970/`.
