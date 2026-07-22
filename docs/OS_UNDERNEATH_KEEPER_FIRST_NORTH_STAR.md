# OS_UNDERNEATH Keeper-first north star

Status: canonical product direction and working guidance

Audience: product owner, art director, Codex, and future contributors

Established: 2026-07-22

Foundation reference: `foundation-stable-2026-07-21` (`4b4144e576281b4ef5dbcc33f4e51286ca8e5ba3`)

## How to use this document

This document records the deliberate pivot away from a rack-first product and back toward the original center of HUMAN UNDERNEATH: the Keeper as a living identity agent inside an authored profile world.

For new work:

1. Read `AGENTS.md` completely.
2. Read this document before phase handoffs or older roadmap documents.
3. Treat `docs/OS_UNDERNEATH_VISION.md` as the enduring product thesis.
4. Treat `docs/OS_UNDERNEATH_DEVICE_RACK_NORTH_STAR.md` as a superseded exploration, not the active roadmap.
5. Inspect the current branch, dirty worktree, relevant implementation, tests, and security documents before proposing a change.
6. Keep discussion separate from implementation. Do not edit, delete, publish, or commit without explicit authorization.

Git and production code remain the source of truth for what exists today. This document defines where the product is going.

## The pivot

> The Keeper is not decoration inside an interface. The Keeper is the identity encounter around which the interface is organized.

OS_UNDERNEATH is a Keeper-led, artist-authored identity world built on Universal Profile data. A visitor does not arrive at a dashboard of containers. They enter a place, encounter its resident Keeper, understand whose world they are in, and explore the art, media, history, and personality that the Keeper reveals.

The Keeper is an **identity agent**: the active HUMAN UNDERNEATH creature through which a profile expresses presence, character, authorship, and response.

“Agent” does not require generative AI, autonomous decision-making, memory, or a chatbot. The first Keeper is an authored and deterministic presence. Its words, timing, reactions, and available actions are deliberately composed by the artist.

The practical rule is:

> World first. Keeper first. Art first. Interface only when it earns the space it occupies.

## Why the rack-first direction is ending

The rack work proved useful technical capabilities: owner editing, persistence, module arrangement, public projection, detached Preview, responsive disclosure, and publication-safe rendering. It also revealed the wrong product pressure.

Simple identity and collection functions began consuming too much permanent screen space. The rack became the dominant visual object, while the Keeper and authored world became background. Adding more folders, devices, controls, or nested modules would deepen that imbalance.

This pivot rejects the rack as the primary metaphor for the product. It does not reject modular code, reusable media tools, compact summoned panels, or the verified data and publication foundations built during the rack phase.

## Product hierarchy

The hierarchy is now:

1. **The Keeper** — the identity agent and primary presence.
2. **The World** — the spatial authored profile and atmosphere the Keeper inhabits.
3. **The Art** — the work, media, collections, and experiences the Keeper presents.
4. **The visitor relationship** — looking, listening, moving, discovering, and receiving authored responses.
5. **Summoned tools** — compact interfaces used only when the visitor or owner asks for them.
6. **Publication infrastructure** — the invisible verified system that reproduces the public world safely.

The interface must not reverse this hierarchy.

## The Keeper’s roles

The four roles from the original vision remain canonical.

### Host

The Keeper establishes whose world this is and how it feels. A welcome may be silent, textual, animated, musical, or a restrained combination.

### Guide

The Keeper can draw attention to art, releases, collections, locations, or actions without trapping the visitor in a tutorial or blocking exploration.

### Interpreter

The Keeper can translate verified profile activity and normalized Signals into understandable authored moments. Raw blockchain records remain data sources, not dialogue scripts.

### Performer

The Keeper can use movement, expression, shader changes, sound, timing, and other bounded reactions as an artistic medium.

These roles share one presentation authority. Dialogue, Signals, live events, audio cues, and Keeper reactions must not become competing systems that speak or animate independently.

## Primary visitor journey

The first canonical journey is intentionally simple:

1. The visitor enters the profile world.
2. The Keeper resolves as the dominant identity presence.
3. A sparse authored presentation establishes personality and atmosphere.
4. The visitor remains free to move, look, and open artwork throughout.
5. The Keeper may point toward or interpret something in the world.
6. Additional information or tools appear only when requested.
7. The visitor can pause or stop timed presentation and can leave without losing control of the page.

Success is not measured by how many controls are visible. Success is whether the visitor feels they encountered a specific identity and wants to remain in its world.

## Primary owner journey

The owner should inhabit substantially the same world they are authoring.

Owner tools are summoned, task-focused surfaces. They may organize Library assets, choose public material, author Keeper presentation, place artwork, or inspect publication state, but they should close, collapse, or get out of the way when the task is complete.

The owner experience must preserve:

- verified owner authority;
- profile-scoped draft persistence;
- Library organization and stable asset references;
- public/private disclosure controls;
- authored world and artwork placement;
- truthful detached Preview;
- explicit verified publication.

The pivot does not authorize rebuilding these domains from scratch.

## Interface discipline

Every persistent interface element must answer: why must this remain visible while the Keeper and art are being experienced?

Default rules:

- Prefer one compact summoned surface over several permanent containers.
- Prefer progressive disclosure over displaying every available control.
- Do not represent simple identity facts as large infrastructure.
- Do not force Library organization to occupy the visitor world.
- Keep owner authoring controls out of the visitor projection.
- Let artwork and the Keeper retain visual dominance at desktop, mobile, and narrow widths.
- Timed presentation must not block racks, artwork, navigation, or exit controls that remain during transition.
- Preserve keyboard access, touch behavior, safe areas, reduced motion, and clear pause/stop controls.

No particular visual language—desktop, panel, rack, terminal, card, or window—is canonical by itself. It is valid only when it serves the hierarchy above.

## First product proof: Keeper presentation v1

The first implementation after this pivot is a small Preview-only proof. Its purpose is to test the Keeper experience before changing publication contracts or building authoring tools.

### Intended behavior

- Preview begins only through an explicit owner/user action.
- Opening Preview starts one predefined deterministic presentation from the beginning.
- A monotonic presentation clock controls sparse Keeper lines and optional cues.
- The clock pauses while the document is hidden.
- Text continues even when audio is absent, delayed, or blocked.
- A small allowlist of existing non-asset-swapping Keeper reactions may support lines.
- Dismissing one line hides that line without seeking or stopping the presentation.
- Pause/stop presentation and mute are distinct, keyboard-operable controls.
- Racks and artwork that still exist during transition remain usable throughout.
- Exiting Preview cancels timers, cues, listeners, and audio.
- Reopening Preview restarts the presentation in v1.
- Reduced-motion mode retains the words and meaning while suppressing optional motion.

### Ownership boundary

A small framework-neutral presentation director owns the clock, ordering, interruption, and cleanup. It is mounted initially by owner Preview.

The director may submit controlled requests to existing Keeper reaction and audio adapters. It must not own Pixi objects, Library state, Signal history, wallet state, profile-document construction, or browser persistence.

Signals and live LSP1 events remain separate data products. They may later submit presentation requests through the same director, but they are not merged into one history or persistence model.

### Explicit non-goals

Keeper presentation v1 does not include:

- generative AI or autonomous dialogue;
- memory, personalization, or conversation history;
- voice or text-to-speech;
- branching narrative;
- an owner dialogue editor;
- arbitrary animation scripting;
- actor or stage asset swapping;
- public visitor behavior;
- new profile-document fields or schema versions;
- publication, IPFS, wallet, or on-chain changes;
- a general device graph;
- rebuilding Signals or the Library.

### Acceptance gate

The proof is accepted only when:

- fake-clock ordering, hidden-tab pause, cleanup, and reopen behavior are deterministic;
- audio failure never blocks text;
- dismissal, pause/stop, mute, keyboard use, and reduced-motion behavior work;
- React Strict Mode does not leave timer, listener, or audio leaks;
- desktop `1280x720`, mobile `390x844`, and narrow `320x844` remain usable;
- artwork and remaining transitional controls do not lose interaction;
- no owner store, local persistence, public schema, publication, or visitor behavior is added to the director;
- the art director confirms that the pacing, words, placement, reactions, and sound make the Keeper feel more present.

If the artistic proof fails, revise or remove it before expanding the architecture.

## Transition map

### Keep and protect

These are foundations, not rack-specific product commitments:

- cryptographically verified owner authority and fail-closed lifecycle;
- dynamic owner-runtime isolation;
- detached Preview and published visitor rendering;
- strict portable-document validation and deterministic migration;
- canonical serialization, CID/hash verification, and exactly-once publication;
- signed authored-grid coordinates and camera separation;
- Library normalization, profile-scoped organization, and stable asset references;
- public/private projection rules;
- artwork placement and safe visitor rendering;
- Pixi engine, Keeper rendering, and the existing bounded reaction bridge;
- normalized Signals as an activity data product.

### Keep but reframe

These capabilities remain useful but no longer define the product:

- folders as owner organization rather than large permanent visitor structures;
- modules as compact summoned tools rather than the primary world composition;
- Library, Gallery, media, and publication interfaces as task surfaces;
- existing rack renderers as temporary compatibility while the Keeper-first replacement is proven;
- Signal history as inspectable activity, separate from presentation timing;
- Atelier as a source of authored Keeper and world configuration.

### Isolate during the proof

Do not deepen these paths while Keeper presentation v1 is under review:

- rack/device roadmap work;
- folder-per-rack expansion;
- general device contracts and connection graphs;
- new public Signal promises;
- new dialogue or reaction paths outside the presentation director;
- broad refactors of `ModuleGridShell` or `PixiEngine` unrelated to a proven boundary.

### Remove only after replacement evidence

Potential removal candidates require an import/consumer check, saved-data compatibility check, and a working accepted replacement:

- rack-first owner home and navigation that compete with the Keeper-first hierarchy;
- published rack composition if it is no longer part of the accepted visitor journey;
- superseded public-shell and legacy profile-renderer prototypes;
- duplicate speech/reaction presentation paths;
- rack-specific styling and browser prototypes with no remaining review value;
- stale handoffs and roadmap claims that present the rack/device direction as current.

Do not delete migrations, schema readers, publication safeguards, owner isolation, or saved-data compatibility merely because their original interface has been superseded.

## Removal workflow

Deletion happens as a controlled migration, not as the emotional first act of the pivot.

For each candidate:

1. Identify production imports, tests, browser fixtures, persisted records, and public-document dependencies.
2. Decide whether the responsibility still exists in the Keeper-first product.
3. Name the replacement or explicitly decide that no replacement is needed.
4. Prove the accepted owner and visitor journeys without the candidate.
5. Remove the smallest coherent set.
6. Run proportional focused, browser, build, budget, and isolation checks.
7. Keep removals uncommitted until the art director reviews the result; commit only when explicitly authorized.

Committed rack work remains recoverable through Git history. Current untracked prototypes and documents must be classified before deletion because Git does not yet preserve them.

## Publication and provenance gate

Keeper presentation v1 is Preview-only and does not loosen publication requirements.

Before any later real publication, fixture-derived Library records must be prevented from entering a publication snapshot. Fixture mode may remain available for explicit development or demonstration, but live data failure must never silently become publishable fictional content.

This is a required hardening gate before republication, not a reason to delay the first local artistic proof.

## Phased direction

### Phase 0 — Record and approve the pivot

Accept this north star, mark contradictory roadmaps as superseded, and agree on the first proof. No runtime deletion is required for this phase.

### Phase 1 — Keeper presentation v1 in Preview

Build and art-direct the bounded deterministic proof described above.

### Phase 2 — Simplify around the accepted experience

Inventory and remove or isolate rack-first UI that competes with the accepted Keeper experience. Preserve underlying Library, document, publication, artwork, and authority domains.

### Phase 3 — Minimal Keeper authoring

After the predefined proof works, define the smallest owner surface needed to edit identity-agent presentation. Do not design a general narrative system before real authored needs are observed.

### Phase 4 — One presentation authority

Route appropriate historical Signals and live-event reaction requests through the presentation director with explicit priority and interruption policy. Keep ingestion and persistence separate.

### Phase 5 — Decide portability

Only after local Preview proves the experience should the product owner decide whether deterministic Keeper presentation belongs in the published visitor contract. A public decision requires a deliberate schema version, strict bounds, migration, isolation tests, and visitor budget review.

## Deliberately deferred

- AI-generated dialogue;
- autonomous Keeper goals or memory;
- voice and text-to-speech;
- branching stories and dialogue trees;
- public dialogue schema;
- arbitrary animation scripts;
- device marketplace or external plugin SDK;
- Audio Player/Radar/Screen graph;
- automatic IPFS upload or wallet publication;
- on-chain mutable state;
- large cosmetic rewrites before the Keeper proof is accepted.

These ideas are not rejected. They are prevented from defining the architecture before the Keeper’s basic presence works.

## Trust invariants

The pivot must not weaken:

- authoritative provider context and fail-closed owner verification;
- URL equality being insufficient for authoring authority;
- owner-runtime isolation from visitor bundles;
- visitor rendering from validated public projections only;
- strict unknown-field rejection and bounded loading;
- canonical bytes, hash-before-parse, CID binding, and publication freshness;
- exactly-once wallet submission and read-back verification;
- private spaces, owner stores, Signal history, and browser persistence remaining absent from public documents;
- signed authored-grid coordinates remaining separate from runtime camera pixels;
- explicit approval for wallet, upload, publication, deployment, permission, or remote actions.

## Decision log

1. The Keeper is the primary identity encounter, not decoration behind application chrome.
2. “Identity agent” initially means an authored deterministic presence, not generative AI.
3. The world and art retain visual priority over permanent interface structures.
4. Racks and devices are no longer the canonical product metaphor.
5. Existing rack work remains transitional until an accepted Keeper-first replacement proves what can be removed.
6. One presentation director will eventually arbitrate authored lines, Signals, live-event reactions, safe animation cues, and audio cues.
7. The first proof is Preview-only, schema-free, publication-free, and restart-on-open.
8. Fixture provenance must be closed before a later real publication.

## Immediate recommended next move

Review and approve this direction as Phase 0. Then implement Keeper presentation v1 as one small uncommitted Preview slice.

Do not delete the rack runtime, design a dialogue editor, add AI, or change the public schema before the art director has experienced and accepted that proof.
