# Reception cell editor — 2026-10-27

Local refinement of `4a02516` on `codex/static-reception-bento-2026-10-26`.
Not committed, pushed or deployed by this change.

## Delivered interaction

- Bounded editor window with cell-local content choices and tools, replacing
  the permanent settings sidebar. Add cell offers Beside / Below; divider
  dragging and keyboard resizing preserve the authored content.
- Shared Workbench Library, Text and Colour controls. Reception owns their
  placement and explicit destination. No Workbench camera/runtime is mounted.
- Image placement defaults to centered fill. Direct drag, arrow keys and zoom
  reframe the selected image. Cancelled gestures do not create edits.
- No exposed canvas size or pixel crop fields. Temporary panels contain
  appearance, framing, content, page settings and unused content.
- Move/swap, neighbor merge, content reuse/deletion and undo keep canonical
  records in the existing Reception store. Unused content can be deleted to
  recover capacity; Library originals are untouched.
- Preview uses public geometry. Editor selection/divider code lives in an
  editor-only component, while public and owner previews share the renderer.
- Mobile header, panels and Library fit narrow viewports. Library's inherited
  620px minimum width is removed only within Reception; its shared controls
  and asset presenter remain in use.

## Verified

- `npm run lint`: passed; 498 files, 91 inherited recorded hook observations.
- `npm run typecheck`: passed, including the negative-call and mutation checks.
- Focused Node tests: 32 passed across Reception presentation/session,
  Text recovery, profile publication flow and production build tests.
  Windows sandbox initially denied esbuild directory access; the identical
  command passed outside the sandbox.
- Production build and `build:check`: passed. Initial JavaScript: 830,441 bytes.
- Browser interaction through CUA using isolated fixture storage: add cells,
  Library placement, crop/zoom, text entry and shared controls, swap, merge,
  divider drag/keyboard, undo, remove/delete/reuse, reload and preview/public
  geometry. Real Workbench entry/return preserved its private text.
- Desktop preview and public frame measured identically: x12/y12,
  1246×696 at the 1280×720 viewport. Mobile preview/public matching was checked
  earlier at 390px. Final mobile editor/Library checks use same-origin test
  frames of 320×740 and 390×844 because the browser viewport override did not
  affect the bound test tab. Image selection and placement at 320px succeeded.
- Fixed a focus-scroll jump: the editor's grid track is now bounded; observed
  clientHeight and scrollHeight both 720 at the 1280×720 viewport.

Screenshots are in the parent workspace's
`output/reception-cell-editor-2026-10-27/`: desktop editor, shared Text tools,
and both mobile layouts. These show fixture artwork, not modified founder data.

## Limits and architecture

The Reception editor still orchestrates its own operations and panels. It
reuses module tools; it is not a generic editor framework. Existing persistence,
generation guards, recovery and publication projection remain authoritative.
The existing Text `containerControls` option was previously unused; it now
omits Reception-inappropriate container controls while Workbench retains them.

The aggregate non-wallet JavaScript raw budget was increased from 2,650,000
to 2,652,000 after measuring the added editor controls. Startup, compressed JS,
owner/wallet separation, CSS and asset limits were not raised.

The automated Reception browser test file was updated and syntax-checked,
but not executed this turn. UI evidence above is direct CUA interaction.
The full unit/browser suites and a deployed wallet/IPFS publication were not
rerun; this is not a release checkpoint. Touch hardware was not tested.

The pre-existing `docs/audits/2026-10-23/code-quality-progress.json` change and
historical untracked evidence were left untouched.

## Follow-up: Reception to the owner's canvas collection

Reproduced on the founder's local Chrome tab: Workbench showed eight local
canvases, while Reception's Canvases action retained the explicit public
`reception=1` route and showed the one-canvas published document. The action now
opens the existing local overview for the verified owner. The destination keeps
the canvas intent, reports startup readiness and clears the gallery route when
entering the Workbench editor. Public routes and visitor data sources stay public.

Confirmed Reception to Canvases shows all eight local compositions in the live
tab. No authored content was changed or published during verification. Further
live navigation checks stopped when the founder resumed using their editor.
Eight navigation unit tests, lint, typecheck, build and build:check passed;
initial production JavaScript measured 830,575 bytes. The routing browser
regression was updated and syntax-checked, but not executed. No commit, push or
deployment was performed.

## Follow-up: Done and About show the saved owner Reception

The founder observed that Done returned to the empty publication and that
Canvases to About did the same. Saving itself worked. ProfileOverview discarded
the owner editor and resumed rendering the publication prop. The verified owner
now enters a local reader on About; Done returns the authoritative saved store
to that reader, without a copied document or publication. Account/ownership
changes remove this reader through the existing authority gate. Visitors retain
the public input. Missing local data uses the publication, while unreadable
local data has an explicit recovery notice.

ReceptionOverview now owns the shared presentation, and useReceptionContent
supplies the same identity/content resolution to the owner editor and reader.
OwnerReception reuses ReceptionStoreEditor for scope acquisition and cleanup.
The write lease exists only during editing, allowing later Workbench or Keeper
entry. No artwork, text, authored geometry, or published content was changed by
this verification.

Live CUA confirmed Edit to Done retained the founder's three cells, artwork,
branding and introduction without editor tools. After returning from Canvases,
the same content was visible on About. Evidence is in the parent workspace at
`output/reception-done-2026-10-27/owner-after-done.png`. The final additional live
reopen check encountered a browser connection timeout; the expanded automated
routing test is syntax-checked but has not been executed. That test covers
Done, reopening, About from Canvases, narrow widths and owner-authority loss.

Seventeen focused navigation/Reception tests, nineteen production-build tests,
lint, typecheck, production build and build:check passed. Initial JavaScript
remains 830,575 bytes. Shared extraction and reuse reduced the first attempted
build; the final optional-route aggregate is 2,652,486 raw / 865,503 gzip bytes.
The raw aggregate limit was increased by 1,000 to 2,653,000; all other limits
remain unchanged. No release-wide browser run, commit, push or deployment.
