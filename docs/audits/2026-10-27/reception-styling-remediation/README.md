# Reception styling remediation — S1–S4

Date: 2026-10-27. Local work on `codex/static-reception-bento-2026-10-26`,
starting at `4a0251647234c0757847078ec34f0865425f6857` with earlier uncommitted
Reception work preserved. No commit, push, deployment or profile publication.

Scope: the founder approved fixing the four P2 findings from the
[independent re-audit](../reception-reaudit-styling/README.md). This is not a new
Reception design or a claim that the whole application's styling is finished.

## Changes

| Finding | Repair | Checked behavior |
| --- | --- | --- |
| S1 · authored profile font shrinks in Edit | Removed the control font from the editor window. Header, empty-cell actions and tool surfaces retain their own control font. | Filled introduction stays 16px / 27.2px in reader, Edit, Preview and Done. Profile tags, links and detail values retain their computed typography too. |
| S2 · nested touch controls remain small | Extracted `src/ui/toolControlSizing.css`, consumed by tool chrome, standalone tool panels and shared Identity content. Text's intrinsic size rules now consume the shared touch minimum. Included reset buttons, tabs, colour inputs and disclosures. Touch font/size controls stack to keep their contents readable. | 44px control targets and 16px text fields at 320/390px and a 1280px coarse pointer. Both Text tabs, expanded default/title controls, backup disclosure, Reception and Workbench checked. No horizontal Text-tool overflow. |
| S3 · Colour depends on Workbench CSS | Moved numeric-field layout and screen-reader instructions into Colour's own stylesheet; supplied existing-token fallbacks for swatch borders/radius/height. Removed the superseded Workbench rules and its local size override. | Two numeric columns, visually hidden but accessible keyboard instructions, styled swatch and touch-sized fields in both hosts. |
| S4 · Profile editor lacks style scope | Shared Identity components import `identityCardContent.css` and own a content scope. Field geometry, inline editing, action buttons and focus styling moved out of the module stylesheet. Generic tool field defaults use low-specificity selectors so intrinsic styles win independently of import order. | Dashed inline fields, themed controls, 32px desktop / 44px touch field actions, 16px touch inputs, cancel preservation and existing save/reorder checks. Workbench module placement, portrait and decoration remain in its host stylesheet. |

No save, publication, crop, Library, wallet or authority behavior was changed.
No Workbench runtime was introduced into the Reception reader. Existing
pre-production budgets remain unchanged.

## Verification

- New permanent suite: `node scripts/runBrowserTests.mjs reception-styling` —
  **6/6 passed**. Real application owner routes use synthetic local data and
  disposable test authority; no real wallet is acquired. Covers Carbon/Mist,
  320/390/1280/1440px, narrow fine pointer and wide coarse pointer, and both hosts.
- Built application: `INSCAPE_STYLING_PRODUCTION=1 node --test
  browser-tests/reception-styling.browser.mjs` — **4/4 Reception cases passed**;
  the two development-only Workbench fixture cases are intentionally skipped.
- Existing Reception boundaries **6/6**, Reception editor **17/17**, Reception
  card **6/6**, shared Workbench tools **3/3**, companion viewport **3/3**, Colour
  focus **1/1**, Text article tools **3/3**, Text panel **2/2**.
- Existing Identity module **6/7**. The crop cancellation failure is separate
  from S1–S4; see below. Existing owner-lattice-identity **1/1 on isolated rerun**
  after an initial startup timeout before the Workbench mounted.
- Production startup/import isolation **1/1**. Production build and
  `build:check` passed; initial JavaScript remains **831,250 bytes**.
- Lint and strict contract typecheck passed. No full release suite is claimed.
- Inspected the actual rendered wide Colour panel, narrow Text tools, narrow
  light Profile editor and wide Workbench Identity. Representative screenshots
  are in `evidence/`; tests keep their disposable artifacts outside this report.

The permanent suite checks both collapsed and expanded controls, not only the
outer tool header. It asserts rendered sizes and typography rather than CSS
source strings. The initial new tests caught the overly specific generic form
rule before it was corrected.

## Separate failure at the styling checkpoint

`identity-module` case “owner opens Identity, keeps it while using Library, and
closes without draft writes” timed out waiting for **Crop zoom** to detach
after moving focus to Identity. The same failure reproduced with these styling
changes removed by an in-memory Vite source overlay. No working files were
reverted for that comparison. The overlay uses HEAD for files clean before this
pass and reconstructs only this pass's changes in already-dirty stylesheets.
This is a comparison against the pre-styling behavior, not a clean-HEAD release
run. Both original test failure and comparison logs are retained.

The owner-lattice startup timeout did not reproduce in the comparison or the
isolated current-code rerun; keep that initial failure visible in the evidence.

## Boundaries and follow-up

S1–S4 are addressed. The re-audit's separate maintenance notes about eager Text
CSS and total editing-session load cost were not part of this correction.
The crop cancellation issue was outside the styling correction and is addressed
in the separately authorized follow-up below. This pass does not certify every
control elsewhere in the Workbench as touch-complete.

Prior dirty source, documents and audit evidence were retained, including the
unchanged SHA-256 of `docs/audits/2026-10-23/code-quality-progress.json`:
`8bf24f49f157fa2ddf6aa6880301a6ab4e301e7986e65f9391a86248affc479f`.

## Crop follow-up (2026-10-27)

The founder subsequently authorized the crop correction and further zooming out
for Reception images, explicitly allowing free space inside a cell.

Display's crop hook now cancels its temporary session when keyboard focus or a
pointer enters another module, including Identity. Identity deliberately does
not change artwork selection; it still knows nothing about crop. Cancellation
does not commit the preview or intercept the destination action. The existing
hook owns listener and drag cleanup; no new module-selection state was added.

Reception's canonical image crop accepts zoom from 0.1 to 4 times fill scale.
The shared pure projection centers axes smaller than their cell and retains pan
on overflowing axes. Reception opts into the lower validation limit; Workbench
Image, Display and overview crop authoring retain their existing limits. The
same stored crop feeds editing, reading and publication, with no second framing
record or host-specific renderer. The two fitting presets remain available.

Verification on the current dirty checkout:

- 38 focused unit tests passed, including geometry, history, reload, public
  projection/restore, invalid crop rejection and unchanged Workbench limits.
- Identity 7/7, Display crop lifecycle 15/15, owner crop 2/2, Image fit 2/2.
- Reception editor 20/20, including desktop/mobile underfill after Done and
  reload, slider preview/commit, and the separate SVG projection route.
- Lint, typecheck, production build and budget check passed; initial production
  JavaScript remains 831250 bytes. No whole-suite/release claim is made.
- Inspected desktop and mobile screenshots. Earlier new-test failures were an
  ambiguous Finish crop selector; the test now targets the Image framing panel.

Follow-up browser logs, production build output and screenshots are retained in
`evidence/crop-followup/`. Changes remain local; no commit, push or deployment
was performed. Cell deletion was only discussed: the existing Join with neighbor
action merges cells; Remove from cell only clears their content.
