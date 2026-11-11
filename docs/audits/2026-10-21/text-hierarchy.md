# Text hierarchy: formatting and article settings

Date: 2026-10-21. Local, uncommitted changes on
`codex/audit-checkpoint-2026-10-19`, HEAD `32d9418843d996afc2e5203afa4552a6cd2d459a`.
The checkout contains other work; this report covers only the Text hierarchy step.

## Accepted change

The founder approved two distinct areas in the independent Text window:
Tekst opmaken and Artikel instellen. The existing English interface uses
**Format text** and **Article settings**. Focus writing is explicitly deferred;
its button, dialog, editing and return behavior remain unchanged.

One persistent tab row replaces the long undifferentiated list. Format text
identifies the cursor or selected text and groups Character, Paragraph and
Writing tools. Character controls include font, size, inline marks and tracking;
paragraph controls include paragraph style, alignment, lists and block spacing.
Article settings identifies whole-article scope and groups Default typography,
Layout and Manage article. Secondary disclosures use a lighter treatment than
group headings; heading/caption defaults are visibly nested under typography.
The duplicated selection/article font controls are now in separate scopes.
Colour and frame dimensions stay in the shared Color and Transform tools.

Tabs remain reachable while scrolling, support arrows/Home/End, and reset the
body scroll when switched. The shell, invisible resize targets and one scrolling
body are retained. The design-system reference renders the same production UI.

## Ownership and cleanup

The shared provider owns only the active UI section. Both panel contents remain
mounted: the existing module-owned editor, selection, history, save/recovery and
backup callbacks keep their identity and authority. Tab navigation does not save
content. Ctrl+F reveals Format text before focusing search, including after
returning from Focus writing. The obsolete outer Writing tools disclosure and
Default text style disclosure were removed, along with their toggle handling;
the useful inner Outline and heading/caption disclosures remain.

This does not redesign the editor model, add tools or change publication/storage
schemas. The existing portal/source relationship remains intact.

## Verification

- Full `npm test`: **1310 passed**.
- Native-config production build and `npm run build:check`: **passed**.
- `npm run design-system:check`: **passed**.
- App Text coverage: **14 distinct cases passed across the initial run and
  focused rerun**. The initial run passed 10; four assertions/test navigation
  steps were updated for separate tabs and normalized editor document attributes,
  then all four passed. See `app.log` and `scopes-final.log`.
- Shared tools, recovery, viewport and docking coverage: **11 distinct cases
  passed**. Ten passed together; the remaining test was updated to enter Format
  text before clicking Bold and passed separately. See `shared.log` and
  `shared-final.log`.
- Design-system Text coverage: **3/3 passed** in `reference-final.log`, including
  read-only, selected artwork, backup, article independence, search and Focus writing.
- The new `text-hierarchy` suite is included in the normal browser runner.
- Focused diff whitespace checks passed. No remote CI, release, upload or
  deployment was performed; the existing local server was reused.

The new two-viewport checks verify selection retention, navigation without draft
writes, default changes preserving inline overrides, inline Undo preserving
article defaults, retained editor identity, keyboard tabs, reachable sticky tabs,
Ctrl+F from Article settings, Focus writing return and no horizontal overflow.
Screenshots were inspected in Mist at 1440px and Carbon at 390px, in both app and
reference. Tests use isolated fixtures rather than the founder's composition.

An additional general reference workspace-locking test failed while locating a
layer named `Artwork`, before opening Text. That path was not changed or resolved
by this task; this report does not claim the entire reference/release suite is
green. Its output remains in `reference.log`.

## Bundle boundary

Native core JavaScript measured **2,480,549 raw / 793,955 gzip bytes**, compared
with **2,478,555 / 793,458** before the hierarchy step: +1,994 raw / +497 gzip.
Initial JavaScript remains **822,889 raw / 239,434 gzip bytes**. The first build
exceeded the former core raw ceiling by 549 bytes. The core ceilings are now
**2,482,000 raw / 795,000 gzip**, increases of 2,000 / 500 bytes; the gzip margin
also covers the alternate-output production test graph. All other ceilings stay
unchanged. Both production build paths pass. No broader performance claim is made.

## Screenshots and logs

- [Format text, wide](text-hierarchy/format-mist-1440.png)
- [Article settings, wide](text-hierarchy/article-mist-1440.png)
- [Format text, narrow](text-hierarchy/format-carbon-390.png)
- [Article settings, narrow](text-hierarchy/article-carbon-390.png)
- [Reference: formatting](text-hierarchy/reference-format-mist-1440.png)
- [Reference: article settings](text-hierarchy/reference-article-mist-1440.png)
- [Production bundle report](text-hierarchy/bundle-report.json)

The adjacent evidence directory contains the complete logs and narrow reference
screenshots. The earlier Text shell report remains a separate historical step.
