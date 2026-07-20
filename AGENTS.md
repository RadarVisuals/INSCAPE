# HUMAN UNDERNEATH Repository Working Agreement

This file applies to the entire repository. User instructions for a specific task take precedence. Keep this file limited to durable working rules; phase-specific status belongs in a handoff or relevant document.

## Collaboration

- Treat the user as the product owner and art director. Explain results in plain language and define unavoidable technical terms.
- Report progress at meaningful milestones during long-running work. Surface blockers immediately instead of silently changing scope.
- Do not spawn subagents or parallel writers unless the user explicitly requests delegation. All agents share the same worktree, so use one writer per overlapping area.
- Keep the main conversation focused on decisions and concise results. Summarize logs rather than pasting large raw outputs.

## Start Every Task Safely

1. Run `git status --short --branch` and inspect relevant existing diffs before editing.
2. Treat all pre-existing tracked, untracked, and ignored work as user-owned. Preserve it and never overwrite or clean it incidentally.
3. Read the relevant implementation, tests, and architecture documents before deciding on a change.
4. Distinguish read-only diagnosis/review from implementation. A diagnostic request does not authorize a fix.
5. Keep the change set narrowly scoped. Do not bundle unrelated cleanup, dependency upgrades, refactors, or test-harness work.

The immutable foundation reference is the annotated tag `foundation-stable-2026-07-21`, resolving to commit `4b4144e576281b4ef5dbcc33f4e51286ca8e5ba3`. Never move or delete this tag without explicit authorization.

## Product and Trust Invariants

- Owner authority must remain cryptographically verified and fail closed. URL or address equality alone never grants ownership.
- Never add a development ownership override or weaken the public/owner boundary.
- The published visitor renderer must remain detached from owner stores, private state, authoring state, local fallback data, and browser persistence.
- Visitors receive only validated, explicitly public projections. Do not fabricate production data from fixtures.
- Preserve canonical publication verification, bounded loading, hash/integrity checks, profile-authority checks, safe URL policy, and exactly-once wallet submission behavior.
- Schema, storage-format, publication-contract, ERC725Y-key, migration, and authority changes require explicit scope and dedicated compatibility tests.
- Preserve the signed authored grid contract documented in `docs/HOME_WORLD_SPATIAL_FOUNDATION.md`: authored placement uses bounded signed grid coordinates; camera coordinates are separate runtime pixels.
- Consult the relevant hardening documents under `docs/` before changing provider lifecycle, publication, resolver recovery, content security, or production budgets.

## External and Destructive Actions

- Never request a wallet transaction or change on-chain data, permissions, publication pointers, or ownership unless the user explicitly authorizes that exact live action.
- Never upload to Pinata/IPFS, publish, deploy, push, create/move tags, or change remote infrastructure without explicit authorization.
- Never expose, print, commit, or request secrets when a public/manual workflow is sufficient.
- Do not delete project files, caches, logs, browser profiles, or processes that the current task did not create. Validate exact paths and process ownership before cleanup.
- Preserve pre-existing Vite/browser processes. Clean up only processes and runtime directories created by the current task.
- The workspace is on `F:`. Do not use limited `C:` storage for downloads, browser binaries, caches, or generated artifacts without explicit approval.

## Implementation Discipline

- Prefer the smallest behavior-preserving change that satisfies the request.
- Do not add dependencies when the installed stack already provides the required capability. Explain and obtain approval for material dependency additions.
- Preserve accessibility, keyboard behavior, touch behavior, responsive layouts, safe-area handling, and reduced-motion support when changing UI.
- Keep fixtures and test-only hooks out of production import graphs.
- Do not change production behavior merely to make a test pass. Diagnose whether the defect is in the product, fixture, assertion, or harness.
- If evidence exposes a materially larger architectural or security decision, stop and report the decision boundary rather than silently expanding scope.

## Verification Ladder

Testing is part of implementation, not an optional final step. Use checks proportional to the risk.

### During implementation

- Run the smallest relevant focused Node tests after meaningful logic changes.
- Add or update regression tests for changed behavior and failure paths.
- For visual-only iteration, use focused structural tests and inspect the affected viewports; a full suite is not required after every CSS adjustment.

### Before a normal commit

- Run the relevant focused tests.
- Run `git diff --check`.
- Run `npm run build` for production-source changes; this also enforces the production budgets.
- Run the relevant browser assertions for visitor interaction, responsive, focus, touch, CSP, or accessibility changes.
- Do not commit when a required check fails. Report the exact failure and whether it is product, test, environment, or unresolved.

### Before a stabilization, release, or high-risk checkpoint

Run all of:

```text
npm test
npm run test:browser
npm run build
npm run build:check
git diff --check
```

Also verify the final worktree, production owner-runtime isolation, budget output, browser/process cleanup, and any task-specific security invariants. Do not hide an unrelated flaky failure or redesign browser infrastructure inside an unrelated product task.

## Visual and Art-Direction Workflow

- Build visual changes as small, reviewable slices.
- Leave visual prototypes uncommitted until the user explicitly says they are approved.
- Review at least desktop `1280x720`, mobile `390x844`, and narrow `320x844` when the affected surface is responsive.
- Preserve interaction and geometry while exploring appearance unless the user explicitly authorizes behavior changes.
- Accept art-direction feedback in visual language such as hierarchy, atmosphere, weight, contrast, spacing, and dominance; translate it into scoped implementation changes.
- Keep cosmetic refactors separate from functional, architectural, schema, or security changes.

## Git Rules

- Commit only when the task explicitly authorizes a commit. Art-director approval authorizes committing only the approved visual slice.
- Stage only files belonging to the task. Inspect the staged diff before committing.
- Never use destructive reset/checkout commands to discard user work.
- Never amend, rebase, force-push, push, or create/move/delete a tag unless explicitly requested.
- A dirty starting worktree is not permission to include existing changes in a new commit.

## Completion Report

Lead with the outcome and include:

- behavior changed and invariants preserved;
- files changed;
- exact focused, full, browser, build, and budget results that actually ran;
- any skipped verification and why;
- remaining risks or manual checks;
- final branch/worktree state;
- commit hash only if a commit was authorized and created;
- confirmation that no wallet, publication, upload, deployment, permission, or remote action occurred when relevant.

Never claim completion, cleanliness, or passing verification without checking it.
