# Desktop composition index — reversible prototype, 2026-10-30

## Scope and recovery

The founder authorized a real implementation after rejecting simulated chat
mockups, and explicitly excluded mobile. This is a first desktop review, not
visual acceptance or a release checkpoint.

Before edits, tracked application files were clean at
`3c9bfd7cbe153d21eacfe0d01f6e845d7d9ac06d`. The GitHub branch
`codex/audit-checkpoint-2026-10-19` resolved to that exact commit; its workflow
and Netlify preview were successful. Historical untracked docs/output were
preserved. Work is isolated on `codex/profile-work-index-2026-10-30`.
The prototype commit is local; no new push, deployment or publication was made.
Revert this prototype commit to recover the starting application, preserving
later work separately if another iteration has begun.

## Replacement and boundaries

The old list's hover selection, split preview/details layout and modal opening
were replaced by click selection and an inline explorable canvas. Their styles
and obsolete tests were removed. The thumbnail grid and its modal remain because
they are still used by Grid view and existing linked-content presentation.

The index uses the existing owner/public collection, source metadata and preview
renderer. Camera state is temporary per composition; only explicit Edit activates
the owner editor. Existing pan gestures and camera geometry are reused. No data
schema, asset resolver, persistence service or dependency was added.

Production delta: +280 / -81 lines. Browser fixtures/tests: +219 / -140.
Suite registration: +6 / -0. Product-contract/creative-intent updates: +31 / -21,
excluding this evidence note. The net production growth implements the viewport,
camera memory and gestures that the former static list did not provide.

## Evidence

- Lint and typecheck passed; lint retains 87 existing hook warnings.
- 15 focused Node tests passed for camera/navigation and presentation models.
- Two new browser tests passed: real local artwork, cursor-anchored zoom, pan,
  saved viewpoints, camera retention, expand/return, read-only viewing,
  explicit owner activation, failed saves, reload and focus recovery.
- Three retained grid checks passed, including motion/reveal and 5K inspection.
- Mirrored Image seams and mixed-content/departure checks passed.
- Three desktop Reception local/public/navigation checks passed.
- Production build and budget check passed (801352 initial JS bytes).
- Suite catalog and diff whitespace checks passed.
- Screenshots inspected at desktop sizes, including an un-intercepted local
  review load with real artwork. Development server: http://127.0.0.1:5217/.

No full release suite or CI run was performed for this local prototype. Mobile
was not implemented or tested. The retired narrow-screen list test described
UI removed by this replacement; existing touch grid tests remain.

## Review and known limits

`/browser-tests/composition-index-fixture.html` presents the production index
with three memory-only examples using existing artwork. It does not read or
seed the founder's browser drafts. Actual owner/public routes use their own
saved composition data.

The renderer retains preview semantics: first Image side / Display scene and
mini-app placeholders. Canvas navigation is interactive; full module controls
are not part of this slice. Independent articles, Reception authoring changes,
mobile navigation and the separately deferred Desktop product remain outside
this prototype.
