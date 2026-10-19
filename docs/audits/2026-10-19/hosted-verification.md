# Hosted verification repair and main protection — 19 October 2026

The Linux verification of head `03c3755384e43c4d7a10636baf3ee9b3c724ad6d`
failed while the Netlify preview succeeded. The
[failed PR run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39301266117)
tested merge `8b98dca47a6fc5f9a85a9db03d940e45b1b10110` on Ubuntu 24.04,
Node 24.20.0 after a successful fresh `npm ci` and locked Chromium installation.
Its Node result was 1,239 passed / 1 failed / 0 skipped out of 1,240 tests.
The pipeline stopped before browsers/build and retained failure evidence only.

The failing assertion was `Design-system inventory is stale` in
`scripts/designSystemInventory.test.js`. The inventory normalized CSS hashes
but parsed unnormalized input: multiline selectors and values retained Windows
CRLF. Linux checkouts therefore produced different JSON for the same CSS.
`inspectCss` now normalizes before parsing. Regeneration changes only those
embedded line endings; token counts remain 69 files, 560 definitions, 295 names.
It does not change the application's CSS or source-evidence hashing rules.

The new multiline Windows/Linux comparison fails before the fix and passes
after it. The focused suite passes 4/4; the complete local Node suite passes
1,241/1,241 without skips. These are local outcomes, not a claim that a pending
hosted browser run passed. Repair commit:
`ca2f162dd9aff6944f3a23ff3e57bf2e3398c680`.
The maintained workflow runs the complete seven-stage verification for each
new push/PR revision. Consult the
[branch's Actions runs](https://github.com/RadarVisuals/INSCAPE/actions/workflows/verify.yml?query=branch%3Acodex%2Faudit-checkpoint-2026-10-19)
for the exact head and its successful evidence/build artifacts; PR runs record
the synthetic merge SHA, while push runs record the branch head.

## Browser follow-up from the first complete Linux runs

On the documentation head `bdcaff4015b29709d8d157246782294573b6bb88`, both
Linux runs passed all 1,241 Node tests. The
[push run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39306200530)
passed 200/202 browser cases; the
[PR run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39306211273)
passed 199/202, across all 53 maintained suites. Neither run proceeded to the
later build stages. These red results are retained, not counted as success.

Both runs failed carousel momentum and narrow Display inspection readiness.
The carousel test now installs the browser clock before application startup and
advances the intended 20ms input samples and 150ms coast explicitly. Real runner
delays can otherwise turn the intended moving release into a stationary one.
The inspection test likewise installs its clock before startup and waits for
the decoded raster replacement to become visible before advancing the opening
animation. Media decoding is asynchronous outside that emulated animation
clock. Existing momentum, exact opening progress, source geometry, storage and
input-lock expectations remain. This follows
[Playwright's clock requirements](https://playwright.dev/docs/clock).

The PR run additionally exposed a real focus race after closing Metadata in
Visitor mode: the shared tool window's deferred focus recovery could overwrite
a newer focus choice. A deterministic regression reproduced it locally in both
Visitor widths (the two Owner cases already passed). Recovery now captures its
original return target and yields when focus has moved elsewhere. It still
restores focus on ordinary close and does not focus a disconnected target.
The existing shared tool host owns this repair; no new focus framework or saved
state was introduced. All eight targeted browser cases pass locally, including
ordinary close and the deliberately interleaved focus choice. Online results
for the subsequent commit remain authoritative for the full chain.

### Remaining difference between the next two hosted runs

On head `3d3d1786b769abf5b26007de5b89685223096aab`, the
[PR run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39309068134)
passed the complete verification, while the
[push run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39309057503)
still failed 2/202 browser cases. These were different failures: a clock pause
requested only 100ms ahead had already passed when the command arrived, and a
Metadata submenu disappeared during keyboard navigation. Both outcomes remain
part of the evidence; the green PR did not erase the red push.

The affected clocked fixtures now install a fixed epoch and pause an hour ahead,
well beyond their whole test timeout, before advancing the same gesture/animation
durations. No short inter-process scheduling margin is assumed. The remaining
same pattern in the maintained Index suite was reconciled too: its five clocked
cases install before mounting, while its ordinary cases retain their native
clock. Historical suites outside the maintained selection were not rewritten.
The disappearing submenu was reproduced locally in all four Owner/Visitor and
wide/narrow cases: leaving with the pointer cleared the menu branch even while
its expanded trigger held keyboard focus. The existing DesktopMenu now retains
an expanded focused branch (or focus inside its flyout) on pointer departure.
Unfocused hover branches still close; outside clicks and Escape retain their
existing close paths. No new saved state, input-mode flag or parallel menu was
introduced. The strengthened browser test explicitly checks this transition.

## Required main check

Before this round, GitHub returned `Branch not protected` and an empty ruleset
list. `main` now requires `Source, tests and production build`, bound to the
GitHub Actions app ID 15368, with strict/up-to-date checking and administrator
enforcement. The setting was verified by a subsequent GET. Existing branch
protection was checked again before writing; no rule was replaced. No approval
review count or new reviewer was imposed. No merge, main push, forced rejection
probe, wallet transaction or content upload was attempted. This is configuration
readback evidence, not an end-to-end attempt to merge a deliberately failing PR.

See [GitHub's branch-protection API](https://docs.github.com/en/rest/branches/branch-protection)
for the meaning of `required_status_checks`, `strict`, `app_id` and `enforce_admins`.
Repository administrators can subsequently change these settings; this dated
record does not make them immutable.

Netlify previews remain review candidates and can build independently of CI.
This main gate is not an attestation of Netlify's rebuilt bytes and does not
control a manual hosting deployment. Public upload admission/quotas, production
hosting policy and real UP publication remain separate release work. This round
does not implement Layers/docking or change corner-resize behavior.
