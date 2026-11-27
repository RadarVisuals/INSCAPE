# Static Reception implementation

Implemented locally, 26 October 2026. Starting source: `d095d063854d2f00bd01b4f25700af30afef8162`.
Implementation branch: `codex/static-reception-bento-2026-10-26`.
The remote handoff and preview branches were checked directly; PR #5 remains on
`codex/audit-checkpoint-2026-10-19` at `3cfd6cf`. No deployment or publication is part of this task.
The pre-existing code-quality-progress.json change and untracked evidence are retained.
Tests use disposable storage. No real browser draft is opened or rewritten.

## Completed responsibility disposition

| Existing owner | Disposition and replacement owner | Behavioral evidence |
| --- | --- | --- |
| useOwnerWorkbenchLibrary | Extracted to `library/useProfileLibrary`; the Workbench adapter supplies only its reference inventory. `ProfileLibraryPicker` uses the existing browser workspace, presenter and rail. | Direct Reception Library selection and Workbench image-drop regression |
| ImageArtwork | Reused renderer; implicit Workbench focus lookup replaced by explicit callbacks from both hosts. No second SVG pipeline. | Raster/SVG retry and retained Workbench focus |
| ImageWorkbench / imageLibrarySide | Reused source resolution and crop mathematics; Reception owns its placement and operations. No thumbnail substitution. | Direct selection, cancellation, original source |
| TextTools / ArticleEditor / ArticleView | Extracted shared `TextToolsContent`, explicit host appearance, and one collection-aware text save/conflict service. Workbench retains window/box controls; Reception owns its outer surface. | Formatting, native content flow, failure/retry, article-tools/filled-Workbench/linked-frames regression |
| ColourControls / CommittedColourControls | Reused with explicit selected target and temporary preview. | Existing color contracts and shared Text/Reception rendering |
| ProfileOverview / profileOverview.css | Fixed markup, grid areas and superseded breakpoints removed. One `ReceptionCanvas` and navigation serve editor preview and public view. Exploration and visitor-return consumers retained. | Owner/public parity, route/focus and geometry screenshots |
| receptionPresentation | Replaced selection-only representation by strict v2 rectangular partition, canonical Image/Text collections, mobile references and branding. No legacy adapter. Dead Image `receptionCrop` field removed. | Invalid topology, content scope, projection and round trip |
| systemWorkflowDraftStore / collection | Extended the canonical owner with a Reception capability scope and history key; no canvas operations, hidden canvas or new storage key. | Save failure, history, generation/lease isolation, reload/backup revocation |
| v9 builder/validation/reconciliation, canvasPublication | Integrated eligible placed Reception content and logo under shared publication selection. | Private/unplaced exclusion, partial publication and restoration |
| Reception fixtures / registry | Removed `bounded-stage.browser.mjs`, `bounded-stage-review.html` and historical suite entry. Updated Reception/routing/startup/Keeper fixtures and design-system descriptions/inventory. Registered the new editor suite in release checks. | Browser catalog, maintained release selection and design-system checks |

Retained names have live purposes: `reception-card.browser.mjs` is the maintained
six-case public Reception suite, with current renderer assertions.
`profileOverview.css` retains exploration/Keeper and visitor-return styles.
`PublishedDisplayModule` still prevents unrelated Reception navigation from
resetting Display. Workbench grids, Grid Shape, Display scenes and the Aerra
gallery are independent features. There is no alternate old/new Reception path.

## Opening and using it

Open **Profile → Edit Reception** in the owner Workbench, or **Edit Reception** on
the owner's published About page. This opens a separate editor over the same
canonical draft without a Workbench camera/window runtime. **Done** returns to
the originating view; **Canvases** opens the existing overview/gallery. Owner
return is part of the real navigation footprint, rather than an overlay.

A blank Reception has one empty region. Split it, add an original Image through
Library, create Text directly, or place canonical profile/introduction/links/
details content. Dividers support pointer, arrow keys and numeric percentages.
Move/swap has a pointer grip and keyboard-accessible commands. Any adjacent
rectangular union can merge, including former non-siblings. Filled merges
require a content choice; removing a placement retains its record for reuse.

Regions own padding, alignment and surface color; Text tools own article
formatting. Image controls reuse fit/fill and crop coordinates. Global radius,
gutter and padding are independent. Branding supports a name, Reception Image
logo and saved default theme. Visitor theme changes are temporary. Branding
retains a link to the verified Universal Profile and is not identity authority.

**Mobile layout** controls ordering, full/half-row width and minimum height over
the same content. Desktop changes preserve surviving mobile overrides. Both
cells in a paired first row reserve the actual navigation footprint. **Preview**
uses the public projection, excluding private/unplaced content. Completed edits
save locally. Publication uses the existing Workbench shared profile-details
action; private backup includes Reception and retained content.

## Reference inspection

Read the required contract sections, creative intent and complete handoff.
Inspected all four bento captures including the founder close-up. Live Hanssen
About was opened, switched to light and scrolled: navigation/portrait retain
their footprint while the right column scrolls. The top navigation cutout has
a continuous concave join; ordinary rounded rectangles cannot reproduce it.

## Checks

The final outcome is **implemented and production checks passed, with no green
full release-gate claim**. [Machine-readable summary](verification-summary.json)
records the exact evidence. Lint, typecheck and all **1,466 unit tests passed**.
Across all **96 release browser suites**, **486 of 491 cases passed**; 93 suites
passed completely. The five failures in the remaining three suites also
reproduce on the unchanged handoff commit `d095d06`:

| Existing failing suite | Failure reproduced before this implementation | Baseline evidence |
| --- | --- | --- |
| `editor-preferences` (2 cases) | At 844×390 in Carbon and Mist, the preference-save error notice covers the Library opener. | `.verification/baseline-after-restart/editor-preferences.log` |
| `mini-apps` (1 case) | The fixture cannot prepare publication because it has not established a verified published-document state. | `.verification/baseline-after-restart/mini-apps.log` |
| `local-workbenches` (2 cases) | Tests still expect publication to be unavailable for multiple Workbenches, although the preceding implementation supports selected canvas publication. | `.verification/baseline-local-workbenches/local-workbenches.log` |

The baseline comparisons served the original `src` and browser fixture files
from Git through an isolated Vite server/cache, with unchanged dependencies and
tests. They did not reset or edit the working checkout. These existing issues
remain outside this bounded Reception implementation; no assertion or production
restriction was weakened to obtain a pass.

The complete `npm run verify` attempt in `.verification/static-reception-release-2/`
was interrupted when the Codex session stopped. Its stale `running` field is not
completion evidence. The initial successful checks and subsequent browser runs
all used working-source SHA-256
`fd1fd34f9308b24e9dbeebde102090bb74291ce16c9f3e53b5a3837c3a76c1a6`.
`.verification/static-reception-after-restart-browser/` completed the remaining
56 pending/interrupted suites, including **Reception 12/12**. A final isolated
repeat in `.verification/reception-final-load-recheck/` passed Keeper **3/3** and
startup **16/16**, resolving the earlier load-timeout results. Earlier failures,
process interruptions and the initial inconclusive baseline attempts remain in
their original logs; the summary explicitly identifies later results.

`.verification/static-reception-production/verification.json` passed all five
remaining production steps on that same source: LUKSO standards **5/5**, token
inventory, production build, build budgets and production startup **1/1**. Its
artifact SHA-256 is
`425c37d3a43ebbd5618a08924b53877c0d0a85b588860d5ad4eb0998ef3c88dc`.
The production report is a five-step continuation, not a substitute full-gate
pass. Only this audit README and its result summary were finalized afterwards;
the summary also records a digest of the tested non-documentation inputs.

Focused evidence retained locally:

- `browser-third/results.json`: 31 passing cases covering Reception, Library/
  Image, Text tools/linked frames and Keeper.
- `browser-final/results.json`: the earlier 11 Reception cases passed. The
  maintained suite now has 12 cases, including paired mobile navigation.
- `.verification/reception-navigation-check/results.json`: 38 passing cases
  across owner routing (5), startup (16), public Reception (6) and the then-current
  editor suite (11).
- `.verification/reception-extra-review/results.json`: 768×1024 and 844×390
  touch/reduced-motion checks passed, including local-save reload and temporary
  visitor theme without draft writes.
- Earlier failures are preserved: initial `unit.log` fixture/inventory
  mismatches were corrected; `.verification/static-reception-2026-10-26/`
  stopped on the stale exact budget fixture, subsequently corrected.
  `.verification/static-reception-final/` passed all 1,466 unit tests before its
  browser tree was deliberately stopped to repair paired mobile text beneath
  navigation. Its failed status is not a release pass.
  The next `static-reception-release` run was interrupted during final staging
  to remove trailing whitespace in the two new browser fixtures; subsequent
  checks use the stable source without those formatting issues.

Inspected production-component screenshots with real Text and original artwork
at 320, 390, 640, 768, 800, 1440 and 2560 pixels, plus 844×390 landscape. Both
themes, zero/default/maximum radius, long branding and transparent SVG were
checked. Earlier inspection caught unreadable inherited Text on temporary light
appearance, a large-corner intersection and the paired mobile issue; all were
corrected before the final checks. The silhouette clips surface and media together
with a measured SVG path, without page-colored patches.

The optional editor measured about 57 kB raw / 25 kB gzip. The aggregate core
JavaScript allowance was explicitly recalibrated to 2,650,000 raw / 866,000 gzip
bytes from the measured integrated build. Initial-load, owner-interaction,
wallet, CSS and public-asset budgets were retained. Final measurements are in
`dist/bundle-report.json` and the production build-budget log: core JavaScript
is 2,642,508 raw / 862,642 gzip bytes. Actual fresh entry at both 1440 and 390 px
loads 827,084 JavaScript bytes and acquires no owner or wallet runtime. Two existing
ArticleEditor lint-debt fingerprints changed due to explicit host props; their
unchanged lifecycle effects were rechecked against Text browser regressions.
No new lint exemption or dependency was added.

Metadata was checked against current official
[LSP3](https://docs.lukso.tech/standards/metadata/lsp3-profile-metadata/) and
[LSP4](https://docs.lukso.tech/standards/tokens/LSP4-Digital-Asset-Metadata/).
Source/provenance, publishing UP authority and Display links remain distinct.
No live transaction or publication was used for verification.

## Deliberate limits

Maximum 32 regions and 16 Image plus 16 Text records, including retained content.
Stored geometry uses 10,000 integer units with a 2% minimum extent; editor split/
resize additionally requires 96 usable pixels. Desktop height is 480–2400 px;
mobile minimum height is 80–1200 px. Defaults: 900 px desktop height, 20 px radius,
8 px gutter, 24 px padding and 320 px mobile minimum height. Maximum radius,
gutter and padding: 160/64/128 px. Mobile Text grows with content; desktop
overflow scrolls inside its region. Images retain fit/fill. No Display,
animation, Shapes/FX, Text frame-flow or independent tablet breakpoint is added.

Verified in installed Chromium on Windows. Safari/WebKit and Firefox were not
available; this is not cross-browser certification. Existing fixtures exercise
publication with mocks; no real wallet or external publication was exercised.
Shared editing still depends on the canonical profile store, identity view model
and existing media/Text runtimes. This was a bounded extraction, not a whole-app
rewrite.

## Git and recovery state

The directly queried remote handoff branch was `d095d06`. PR #5's branch remains
at `3cfd6cf5da12218938d7706268ebd10bed890966`; its Netlify preview status was
success while GitHub Verify Inscape was cancelled. Neither proves this
implementation is deployed. Retained remote checkpoint:
`checkpoint/pre-bento-2026-10-26`, annotated tag object
`0f82190a8a0bef9a57abb5ee2e7c9176864b4a9c`.

The local implementation commit contains only task-owned paths. The
pre-existing `docs/audits/2026-10-23/code-quality-progress.json` change, unrelated
untracked evidence and separate E: checkout are preserved. The protected
continuation handoff was not read, changed or staged. Tests use disposable
storage; no real browser draft was opened, cleared or rewritten. The final
release report records a dirty checkout honestly because local audit material
and the unrelated user change remain.
