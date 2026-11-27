# Evidence index — technical cleanup

Final scope and limitations are recorded in [the audit](../technical-cleanup.md).

Acceptance evidence:

- `unit-final.log`, `design-system-tests.log`, `design-system-check.log`.
- `build-final.log`, `build-check.log`, `bundle-report-final.json`.
- `browser-final.log`, `reference-browser.log`, `destination-integration.log`.
- `identity-baseline.log`, `tools-baseline.log`, `reference-baseline.log`,
  `destination-baseline.log`: corresponding failures against the exact source
  snapshot from the beginning of this cleanup, served separately.
- `browser-baseline-comparison.json`: matching failure names for all 16 cases.
- `neutral-before/`, `neutral-after/`: 48 screenshots per version and measured
  DOM/style/geometry data, including the actual custom Identity component.
- `settled-before/`, `settled-after/`: eight repetitions after waiting for
  lazy canvas modules. `parity-settled-summary.json` explains residual pixels.
- `style-and-identity-hashes.json`: all retained CSS and Identity sources are
  identical to the start; only unused `displayMetadataCard.css` was removed.
- `changes-from-start.json`, `source-audit-final.json`: bounded source cleanup.

Diagnostic and superseded evidence, **not final acceptance**:

- `before/`, `after-first/`, `preserved/`, `identity-before/`, `capture-first.log`,
  `capture-preserved.log`, `library-focus-before.log`, `removed-selectors.json`.
  These belong to the discarded CSS cleanup attempt or incomplete captures.
  All production changes from that attempt were restored to the start snapshot
  before the final bounded cleanup; `restored-to-start.json` records this.
  In particular, `removed-selectors.json` does not describe the final change.
- `unit-baseline.log`: five original unit/build-boundary failures.
- `build.log`: sandbox configuration-read failure, superseded by `build-final.log`.
- `reference-baseline-environment.log`: wrong test-origin configuration;
  superseded by the corrected `reference-baseline.log`.

Browser evidence is deliberately not labelled all-green: 157 of 173 current
checks passed, and all 16 failures were also reproduced against the start.
Baseline reruns are additional diagnostic checks, not added to that total.
