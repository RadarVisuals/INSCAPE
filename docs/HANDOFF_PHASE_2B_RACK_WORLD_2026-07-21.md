# Phase 2B Rack World Handoff — 2026-07-21

> **Historical handoff — superseded 2026-07-22.** This file records the Phase 2B rack-world state at the time it was written. Its HEAD, dirty-worktree description, recommended sequence, and rack-first product direction are stale. Do not use it as the current continuation plan. The active direction is `docs/OS_UNDERNEATH_KEEPER_FIRST_NORTH_STAR.md`. Preserve this handoff until rack-specific implementation and untracked prototypes have been classified through the pivot removal workflow.

## Purpose

This is the current continuation point for the HUMAN UNDERNEATH public rack-world redesign. It separates the immutable stabilized foundation, committed Phase 2 work, and the open uncommitted art-direction slice.

Do not discard, reset, or casually re-create the open work. Continue from the existing worktree.

## Repository state

- Branch: `design/phase-2b1-published-hierarchy`
- Current HEAD: `eb4e5a1 feat: compose published profile racks`
- Stabilized foundation tag: `foundation-stable-2026-07-21`
- Stabilized foundation commit: `4b4144e576281b4ef5dbcc33f4e51286ca8e5ba3`
- Remote push: none performed during this slice
- Current worktree: intentionally dirty; the open review slice is not committed

Committed Phase 2 checkpoints after the foundation:

1. `e48cd94 docs: add repository working agreement`
2. `5d160b3 design: checkpoint modular rack prototypes`
3. `fd6acde feat: add v5 identity rack document contract`
4. `8f369ff feat: render published identity rack`
5. `eb4e5a1 feat: compose published profile racks`

## Product direction now approved

The public profile is becoming a rack world rather than a loose desktop-window imitation.

- Identity, Inventory, and future Grid content live in modular racks.
- Rack modules expand inline and push modules below them down.
- The same vertical module language works on desktop, embedded Universal Everything profiles, and mobile.
- Identity is split into controlled public modules such as Profile, Bio, and Links / Tags.
- Inventory contains authored public spaces and their public assets.
- Future Grid racks may host allowlisted mini-app surfaces, but no arbitrary iframe policy has been implemented.
- Rack headers use the HUMAN UNDERNEATH visual language and the supplied SVG marks.
- The owner still has an explicit authoring Workspace; the rack world is the owner's default presentation surface.

## Open uncommitted review slice

The current worktree contains one combined functional/visual slice. Its main changes are:

### Owner rack home and navigation

- A cryptographically verified owner now enters the rack-world presentation by default.
- Owner-only `Workspace`, `Share`, and `Atelier` controls exist outside the visitor projection.
- These controls are positioned at the lower-left so they do not overlap the lower-right Navigator.
- Pointer interaction was restored for those owner controls.
- Workspace still opens the established authoring shell; the public boundary is not weakened.

### Preview controls

- Owner Share preview continues to use the detached visitor renderer.
- The Exit Preview control has explicit pointer interaction and a bounded label.
- No visitor gains owner actions through this path.

### Identity disclosure and arrangement

- Public Profile remains the required identity module; optional Bio and Links / Tags remain owner-controlled public disclosures.
- The compact Profile row can switch between display name and full address using the existing scramble transition.
- Copy and official-profile actions remain separate semantic controls.
- Identity module order is now saved only when the owner finishes Arrange with `DONE`.
- The persisted order is bound into rack presentation, snapshot fingerprinting, snapshot construction, and detached preview.
- Visitor arrangement remains ephemeral and receives no owner storage callback.

### Artwork and layer contract

The intended visual order is:

1. authored framed artwork and world objects: spatial layer `93`;
2. racks: layer `94`;
3. foreground-only Keeper / resident canvas: public application layer `200`;
4. opened artwork modal: layer `220`.

Consequences:

- Normal framed artwork stays beneath racks.
- The Keeper remains visually above the ordinary world.
- Clicking framed artwork opens a focused modal above the Keeper.
- While the modal is open, world movement is intentionally unavailable behind it.
- The artwork modal close control now has a dedicated class and uses the minimal rack-control styling.

### Files currently involved

Tracked modifications include browser assertions, public application layering, profile preview/panel/surface components, published rack components, profile-document CSS/tests, and `ModuleGridShell`.

New untracked implementation files include:

- `src/public/ownerRackHome.css`
- `src/profileDocument/components/profileDocumentDisclosure.css`
- `src/profileDocument/components/profileDocumentDisclosure.test.js`
- `src/profileDocument/components/profileDocumentPreview.css`
- `src/profileDocument/storage/profileRackPresentationStorage.js`
- `src/profileDocument/storage/profileRackPresentationStorage.test.js`

User-owned prototype/assets still present and not to be discarded:

- `browser-tests/identity-disclosure-prototype.*`
- `public/assets/logo/underneath_dos.svg`

## Publication behavior that can look confusing

- Rebuild Snapshot updates the local draft snapshot used by owner Preview.
- It does not update the already published IPFS document or on-chain ERC725Y pointer.
- A logged-out visitor continues to see the last real published document until the owner completes the manual canonical-file upload, CID verification, and wallet publication flow again.
- Therefore owner Preview can show the new v5 rack document while the live visitor route still shows the older publication. This is expected, not local-data fallback.

## Product-course correction recorded after the visual review

The rack world must become the real owner authoring environment, not merely a polished public presentation placed in front of the legacy Workspace.

Everything that already worked before the rack redesign must remain available through, or deliberately integrate with, the new owner experience:

- creating, naming, and managing folders/public spaces;
- adding, removing, and moving NFTs and other Library assets;
- controlling public/private visibility;
- creating, placing, moving, and editing framed artwork;
- retaining existing Library, Gallery, canvas, Keeper, and world-configuration behavior;
- creating, naming, ordering, grouping, and placing racks/modules;
- saving the complete authored workspace;
- previewing the current authored public projection;
- publishing the same reviewed projection for visitors.

Do not rebuild these domain capabilities from scratch. The established owner stores, folder/space records, Library assets, canvas objects, framed-artwork logic, and authority checks remain the underlying engine. Racks become the new interface and public projection over those established capabilities.

### Confirmed P0 arrangement bug

Current reproduction:

1. open Identity Arrange;
2. move the Profile/name module;
3. press `DONE`;
4. open Share;
5. rebuild the snapshot;
6. open Preview Profile;
7. observe that Preview returns to the previous module order.

Expected behavior: after `DONE`, the saved owner draft, rebuilt snapshot, and detached Preview must preserve the exact same normalized module order.

### Required persistence and preview model

Routine authoring must not require the artist to operate the snapshot machinery manually.

Desired experience:

```text
EDIT WORKSPACE
      ↓
AUTOMATICALLY SAVED DRAFT
      ↓
PREVIEW CURRENT PUBLIC PROJECTION
      ↓
UNPUBLISHED CHANGES
      ↓
PUBLISH CHANGES
      ↓
PUBLISHED PROFILE
```

- Owner changes must autosave and survive refresh, navigation, Workspace/rack switching, and Preview entry/exit.
- Preview should render a fresh detached projection of the current saved draft without requiring a manual `Rebuild Snapshot` step merely to inspect it.
- Canonical snapshot construction, validation, fingerprinting, and publication verification must remain internally deterministic even if their mechanics are hidden from the normal artist workflow.
- The interface must clearly distinguish the current saved draft, unpublished changes, and the actually published IPFS/on-chain document.
- Publishing remains explicit because IPFS/CID handling and wallet confirmation cannot occur silently after every edit.

This persistence/authoring roundtrip is now higher priority than further cosmetic polish or republishing v5.

## Verification already performed

Latest relevant results:

- Focused profile/rack/storage/document tests after the latest layer work: `61/61` passed.
- Earlier complete Node suite for this open slice: `405/405` passed before the final small modal-style/layer adjustment.
- Latest Edge browser behavior run: all `18/18` product assertions passed, including 390px touch scrolling and 320px rack reachability.
- The browser command still returned nonzero only because its Windows after-hook could not immediately remove its own `.browser-test-runtime` directory after graceful Edge/Vite shutdown.
- The exact test-created runtime directory was subsequently verified and removed; no runtime directory remains.
- Latest production build: passed, `3,798` modules transformed.
- Production budgets passed; owner runtime remains outside the initial entry.
- Latest initial JavaScript: approximately `1,177.60 kB` raw / `345.30 kB` gzip.
- Latest owner JavaScript: approximately `204.55 kB` raw / `58.60 kB` gzip.
- `git diff --check`: passed; only existing LF/CRLF conversion warnings were reported.

Do not describe the browser command itself as fully passing until the Windows runtime-removal after-hook returns cleanly. The product assertions did all pass.

## Manual review still required

Use the connected verified owner profile and check this exact flow:

1. Refresh and confirm the owner lands on the rack home, not the legacy workspace.
2. Confirm `Workspace`, `Share`, and `Atelier` are clickable at lower-left and do not cover the Navigator.
3. Open Workspace and confirm the existing authoring UI still works.
4. Return to rack home and open Share.
5. In Identity Arrange, move the Profile/name module to another position.
6. Press `DONE`; this is the persistence boundary.
7. Open Share and confirm an existing snapshot becomes `DRAFT CHANGED`.
8. Rebuild Snapshot, then Preview Profile.
9. Confirm the arranged identity order remains unchanged in Preview.
10. Exit Preview with the pointer and with keyboard activation.
11. Confirm normal framed artwork is beneath racks but remains clickable where unobstructed.
12. Open framed artwork and confirm the enlarged modal sits above the Keeper, its styled close control works, and closing restores focus.
13. Repeat the visual pass at desktop, 390x844, and 320x844.

If step 9 fails, diagnose the persisted `rackPresentation.identity.order` path. Do not work around it by mutating the validated document in the renderer.

## Recommended work plan

### Project-lead rule

At the end of every approved slice, recommend one concrete next task instead of presenting an undifferentiated list. The recommendation must state why it comes next, how the user can approve it, and what should deliberately wait. The user is the product owner and art director; Codex is responsible for maintaining the technical sequence.

### Gate A — finish this review slice

1. Continue collecting the art director's functional and visual observations without implementing them until explicitly authorized.
2. Inventory the existing Workspace capabilities that require parity in the rack owner experience.
3. Fix the P0 saved-draft and Arrange → Preview roundtrip before treating the rack UI as complete.
4. Integrate the established folders, assets, visibility, framed-artwork, Library, canvas, and world-authoring capabilities rather than replacing their domain logic.
5. Batch typography, icon, opacity, spacing, and control styling around the functional work instead of rerunning the full suite after every note.
6. When the art director says `review` or `test the slice`, run one browser/build pass.
7. When the art director approves the complete functional/visual slice and explicitly authorizes a commit, run the final commit ladder and commit only that reviewed slice.

### Gate B — stabilize the rack foundation

After the Phase 2B rack slice is committed:

1. perform a read-only diff/authority/publication-boundary audit;
2. repeat the full Node, browser, build, budget, owner-leakage, and diff checks;
3. manually test owner, owner Preview, logged-out visitor, mobile, and embedded Universal Everything modes;
4. create a new annotated design checkpoint only with explicit authorization.

### Gate C — future features

Only after Gate B:

- define a strict allowlisted mini-app embedding contract for the future Grid rack;
- explore rack expand/collapse animation with reduced-motion behavior;
- return to Keeper dialogue/tutorial/story tooling, audio, and authored timeline work.

Do not introduce arbitrary iframe URLs, remote code, new publication fields, wallet transactions, or on-chain changes as part of visual rack iteration.

## Recommended sequence from this handoff

Follow this order unless new evidence exposes a blocker:

1. **Finish collecting the current backlog.** Record missing legacy capabilities, persistence failures, confusing state transitions, and visual notes without implementing them prematurely. Acceptance: the art director says the backlog is complete enough to plan.
2. **Perform a read-only owner-capability and data-flow audit.** Map every established Workspace capability and trace owner edit → saved draft → public projection → Preview → publication. Acceptance: a bounded implementation plan with explicit reuse points and no duplicated domain system.
3. **Implement owner rack-authoring parity and reliable draft persistence.** Restore folders/spaces, asset organization, visibility, framed artwork, Library/canvas/world integration, real rack/module creation and ordering, automatic saving, and the confirmed Arrange persistence fix. Acceptance: refresh and Preview preserve authored state.
4. **Simplify Preview and publication state.** Preview the current saved draft projection directly and clearly label saved draft, unpublished changes, and published state. Keep final publication explicit and verified. Acceptance: the artist can explain the state without knowing the snapshot implementation.
5. **Finish the visual rack review.** Test lower-left owner controls, Preview exit, framed artwork/modal/Keeper layering, responsive racks, and the accumulated visual batch. Acceptance: explicit art-director approval of the complete functional/visual slice.
6. **Verify and commit Phase 2B.** Run the final focused/full/browser/build/budget/diff ladder once, audit only intended files, and commit only with explicit authorization. Acceptance: clean required checks and a scoped commit.
7. **Perform a short post-commit stabilization audit and checkpoint.** Confirm owner authority, detached visitor boundaries, v5 compatibility, persistence, and responsive behavior; create an annotated checkpoint only with explicit authorization.
8. **Republish the owner's v5 profile document.** Build the canonical document from the approved workspace, manually upload the unchanged file to public IPFS, verify its CID, and use the established wallet publication flow. Acceptance: another account/browser renders the same rack world.
9. **Define the Grid mini-app contract.** Design a strict, allowlisted, sandboxed way to expose approved Universal Profile mini-apps inside rack modules. Security and lifecycle rules come before visual iframe implementation.
10. **Add rack motion and narrative layers later.** Expand/collapse transitions, sound, Keeper dialogue/tutorials, authored timelines, scanning sequences, lore, expeditions, trophies, and minting build on the stabilized authoring system.

Do not begin republishing, arbitrary embedded apps, minting, expeditions, trophy discovery, or major story tooling before steps 1–7 are stable. Those remain viable later phases, not discarded ideas.

## Operational note: C: drive

The user reports approximately `9 GB` free on `C:` after the earlier zero-space condition. The previous sandbox measurement was transient and is no longer the current state. Continue monitoring space before repeated browser suites because earlier full-disk conditions prevented even sandbox logging.

Before running repeated browser suites or long Codex sessions:

- free meaningful space on `C:` manually;
- do not delete project files or active Codex databases;
- keep browser/runtime output on `F:`;
- preserve unrelated user processes and the interactive Vite server;
- remove only exact test-owned runtime directories after verifying their resolved paths.

## Trust invariants

- URL equality never grants owner authority.
- Owner UI remains behind verified matching authority.
- Visitor racks remain detached from owner stores, localStorage, private library data, and authoring callbacks.
- Only validated public snapshot projections render for visitors.
- Existing publication integrity, URL safety, resolver recovery, and exactly-once wallet behavior remain unchanged.
- No wallet request, upload, publication, deployment, permission change, push, or tag operation was performed in the open slice.
