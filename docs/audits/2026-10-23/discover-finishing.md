# Discover finishing — 23 October 2026

## Scope and checkout

Local, uncommitted work on `codex/audit-checkpoint-2026-10-19`, based on
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The checkout already contained
extensive earlier changes; they were retained. No push or deployment.
The founder authorized Discover as the next design-system migration.
Publication UI and the eventual Discover layout for multiple Workbenches remain separate work.

## Ownership and implementation

- `PublicEntryPortal` remains the shared owner/public presentation.
  `useProfileDiscoveryController` owns directory results, search and retry;
  `usePublishedProfile` and its resolution store own published documents;
  application navigation and the owner panel host own entry/return and focus return.
- The portal now uses the existing flat Carbon/Mist material and geometry tokens.
  The owner supplies its current menu theme explicitly. Public entry retains Mist
  as its default. Cards have a thin edge, quiet hover, readable publisher names
  and technical addresses, with no card shadows.
- Header/search, result batches and footer remain stationary around the scrolling
  card list. Narrow layouts give search a full row. Explicit content-sized grid
  rows prevent clipped publisher strips. The shared landing uses contained
  scrolling on low screens, so its existing entry actions stay reachable.
- Pointer opening does not autofocus search. Keyboard opening does.
  Search uses the design system's neutral border focus; other controls retain
  visible keyboard outlines, with explicit system focus in forced colors.
  Escape handles the account disclosure before the enclosing Discover panel.
  The prior account listener incorrectly also observed every window keydown.
- Existing Workbench input resets were overriding portal radii and touch target
  heights. Portal-scoped selectors now preserve the shared recipe in that host.
- Loading, no matches, an empty directory and directory failure have appropriate
  copy and status/alert semantics. Retry, pagination, search reset and account
  callbacks retain the existing actions.
- All WorldPreview calls already used the canonical cover. Removed its unused
  noncanonical fitting state, mutation/resize observers, transform CSS and unused
  discoveryStatus prop. The existing canonical renderer, authored media/crop and
  publication selection remain unchanged; this is not a new snapshot pipeline.
- No new dependencies, saved fields, migrations, camera/selection state, wallet
  implementation, permission decisions or publication behavior.

The design-system registry includes the production component, stylesheet and
browser evidence; generated inventory is current. Superseded source-string tests
that required old pixel values, Mist-only chrome and the unused fitting branch
were removed. Browser behavior and screenshot checks cover the new presentation.

## Verification

Latest results per suite (repeated runs are not added together):

- **28 focused browser cases passed:** 10 Discover styling/recovery/landing,
  9 Sidebar, 4 Discover/Activity recovery, 5 phase-3 lifecycle cases.
- **11 real-App startup scenarios passed** (12 TAP test nodes including their
  parent): direct/delayed entry, recovery/retry, selected featured publication,
  directory failure, unavailable feature, connected owner, delayed destination
  code, and failed owner/visitor renderer recovery.
- **19 focused unit tests passed** for portal boundaries, discovery state and
  application navigation.
- **10 design-system tests passed**, with inventory generation/check passing.
- Production build and `build:check` passed without increasing budgets:
  initial JavaScript **822,348 raw / 239,210 gzip bytes**; core JavaScript
  **2,517,218 raw / 808,076 gzip bytes**. Standard large-chunk advice remains.
  Initial raw JS is 676 bytes smaller and core raw JS 2,095 bytes smaller than
  the preceding panel-regressions checkpoint.

Screenshots inspected for Carbon/Mist at 1440×900, 390×844, 844×390 and 320×320,
plus actual Sidebar hosting at 1440×900, 390×900, 320×568 and 844×390, recovery,
forced colors and low-screen landing. The filled fixture uses existing local
artwork and validated publication builders, without live services. Checks cover
hit targets, contained scrolling, input size, focus modality/return, search,
result batching, card entry, retry, account actions and nested Escape.
Existing lifecycle checks retain unchanged draft and camera assertions.

## Test maintenance and evidence

The broader startup check initially failed against obsolete destinations:
it expected Published Grid navigation and the old presentation board, and gated
the old VisitorGridWorld import. Current public entry opens Reception through
ProfileOverview. Its wallet fixture also supplied a connected owner but allowed
the real unconnected-session disposal to clear that mock. Updated test locators
and import gates to the actual entry points, and made the fixture own its mocked
wallet disposal. Production wallet/navigation/startup code was not changed.
All startup cases then passed.

Early visual checks exposed a fixture with duplicated cover placement IDs and
an overstrict media wait after search/scroll changes. The validated fixture now
uses separate cover IDs and waits only for visible previews before capturing.
Those diagnostic failures are superseded by the final visual log.

Evidence: [discover-finishing-evidence](discover-finishing-evidence/).
`discover-visual-final.log` records the final 10 visual cases;
`discover-chrome-final.log` records those cases plus all 9 Sidebar cases.
The earlier `discover-final-browser.log` contains the passing 4 recovery and
5 phase-3 cases alongside six superseded fixture media-wait failures.
`discover-startup-final.log` records all startup scenarios passing.

The sandbox blocked Vite configuration loading during build and the self-hosted
startup test; their approved reruns outside the sandbox passed.
Full `npm test`, complete release verification and production-browser startup
were not run. No live wallet, chain, upload, publication or deployment was tested.
The local checks do not establish a new CI or deployed release result.
