# Reception cohesion trial — 14 November 2026

Local, reversible implementation of the first two proposed refinements: shared
header/Bento alignment and a quieter default outer frame. This is a visual trial
for founder review, not acceptance of the remaining lighting/menu/type proposals.
Branch: `codex/profile-work-index-2026-10-30`, HEAD `08b4a7b`, with substantial
pre-existing local work. No commit, push, deployment or user-draft write was made.

## Change and ownership

The native Reception page now exposes its existing authored Bento width to both
the header and body. CSS derives the common inset. The shared ReceptionHeader
uses its available composition width to wrap controls, including a small Bento
inside a wide browser. Preview and public rendering use the same rules.

Removed the separate `reception-layout-rails` background and its two callers;
the page draws one pair of rails on the actual Bento boundaries. The existing
portrait separator remains a header detail and disappears when the header wraps.
No new layout measurement, observer, saved field, dependency or persistence path
was introduced. The authored document and temporary Preview width retain their
existing owners. Body scroll ownership and vertical centering are unchanged.

The default frame line uses a quiet ink tint, and the default frame fill follows
the authored page background when available. Explicit frame/fill colors,
opacity, frame visibility, cell styling and authored geometry remain effective.
The editor's authored controls and the light's color/direction/strength were not
changed. This does not claim to resolve the earlier audit's broader coupling.

Relative to the saved pre-edit files: production **21 added / 17 removed lines**
in six files. Browser fixture/assertions and the generated CSS inventory are
separate. The inventory refresh also reconciles an already-stale Preview CSS
entry; that stylesheet itself was not edited here.

## Verification and limits

- Native document/scope tests: **56 passed**.
- Lint, strict contract/type checks and generated CSS inventory: passed.
- Atmosphere browser baseline: **9 passed, 1 failed**. The failure is the
  already-disabled Undo action after reload in the first light-control test.
- After the change: **15 passed, the same 1 baseline failure**, including shared
  edges in Preview/public, 1920/900 widths, Dark/Light, 960/480 Bento widths,
  identity, saved-document preservation, menu dismissal and width round trips.
  The final `browser-height-check` run has the same 15/1 result and additionally
  checks alignment after shortening the window to 600 px and reloading.
  Its source guard also rejected the run because this audit was added while it
  ran. Comparing the complete before/current manifests identifies this report
  as the only added/changed input, with no removed files or changed executable
  sources. See `source-reconciliation.json`; this is not a green release gate.
- The width round-trip assertion now waits for the exact ResizeObserver-backed
  displayed measurement as well as the CSS width. The prior assertion could read
  the previous number before that callback; the numerical equality is unchanged.
- Screenshots inspected for alignment, compact header wrapping, clipping and
  Dark/Light appearance. They use the repository's isolated artwork fixture,
  not a replacement or edit of the founder's actual saved composition.
- Native `npm run build` and `build:check` remain blocked by the existing
  aggregate JavaScript ceiling: baseline **2,756,111**, final **2,756,096** bytes,
  ceiling **2,744,000**. Compilation reaches the budget gate; no limit was raised.
- The full app/release suite was not run. No current deployed-state claim is made.

Sandbox attempts could not inspect Windows process ownership or resolve Vite's
config. Approved native commands were used. The default full Chromium executable
failed to spawn; the installed headless-shell 149.0.7827.55 with Playwright 1.61.1
ran the browser checks. Its process cleanup is recorded by the existing runner.

Evidence: [task checkpoint](../../../.verification/reception-cohesion-2026-11-14/),
including before/after logs and the `browser-height-check` final browser run.

## Reversal

Original bytes are saved under the checkpoint's `before/` directory. The
`manifest.json` records file hashes and the task-only `changes.patch` excludes
unrelated existing changes. `git apply --reverse --check` was verified against
the current worktree without applying the reversal. On a requested rollback,
run that check again and review intervening edits before reversing this patch;
do not reset the branch or restore these files wholesale from Git HEAD.

This report is a new audit artifact and is intentionally separate from the
source/test/inventory rollback patch.
