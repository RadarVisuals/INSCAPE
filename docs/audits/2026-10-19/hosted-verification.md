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
