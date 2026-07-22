# OS_UNDERNEATH device rack north star

Status: superseded product exploration; retained as historical design evidence

Audience: product owner, art director, Codex, and future contributors

Established: 2026-07-21

Foundation reference: `foundation-stable-2026-07-21` (`4b4144e576281b4ef5dbcc33f4e51286ca8e5ba3`)

> **Superseded on 2026-07-22.** The rack/device direction is no longer the active product roadmap. Read `docs/OS_UNDERNEATH_KEEPER_FIRST_NORTH_STAR.md` for the canonical Keeper-first pivot. This document remains intact to preserve the reasoning, implemented context, and compatibility considerations discovered during the rack exploration. It must not be used to restart rack-first implementation without a new explicit product decision.

## How to use this document

This was the product and workflow north star for the rack/device exploration. It explains what that direction attempted, what the rack metaphor meant, and which technical and compatibility considerations were discovered. It is no longer the active implementation sequence.

For every new Codex window:

1. Read `AGENTS.md` completely.
2. Read this document completely.
3. Inspect the current branch, HEAD, dirty worktree, recent commits, and relevant diffs.
4. Read the technical documents named in the relevant section below.
5. Inspect the current implementation and tests before proposing a slice.
6. Summarize the intended outcome, non-goals, risks, and manual acceptance journey.
7. Do not implement until the product owner gives an explicit action instruction.

This document sets direction. Git and production code remain the source of truth for what is implemented today. Historical handoffs describe the state at their date; they must not silently overrule newer verified code or this direction.

## The north star

> Your profile is not a page. It is a place.

OS_UNDERNEATH is an artist-owned spatial profile that can grow into a creative instrument. A Universal Profile supplies identity and owned media. The Library organizes that material. The rack gives the profile a durable modular structure. Devices can later let the artist play, transform, combine, and present profile material. The world gives the whole system space, atmosphere, and presence. The Keeper makes the place feel inhabited rather than merely configured.

The decisive product idea is:

> The contents of a profile are not only things to display. They are creative material to use.

An image NFT can be framed or collected; specially compatible visual material may later become a layer or processor input. A music NFT can eventually play through an audio device and drive another device with rhythm or frequency data. A mini-app can eventually behave like a trusted instrument inside the rack. The result is not a conventional profile builder and not a folder dashboard. It begins as a coherent modular profile environment and can grow into a personal media studio and public artwork.

Four verbs define the system:

- **Organize** in the Browser.
- **Compose** in the Rack.
- **Experience** in the World.
- **Publish** a verified public projection.

## The course correction

The current rack work proved useful owner authoring, persistence, folding modules, folder membership, asset cards, identity arrangement, framed artwork, detached Preview, and explicit publication. It also exposed an important scaling problem: one rack module per Library folder makes the rack become another file manager.

That is not the destination.

The rack direction is inspired by the operating logic of Reason Studios without copying its appearance or product literally:

- the Browser holds and organizes a large catalogue;
- the rack holds only devices that are actively part of the composition;
- a device receives compatible content from the Browser;
- device settings and selected content can become a reusable preset;
- devices can be folded, moved, resized where appropriate, grouped, and connected;
- the active rack remains legible even when the Library becomes very large.

The existing folder-rack modules are therefore a transitional compatibility surface. They should remain functional while the new journey is proven, but new architecture must not deepen the assumption that every folder belongs in the rack.

## Canonical mental model

| Product concept | Meaning | Primary home |
| --- | --- | --- |
| Universal Profile | Cryptographic identity and discoverable owned content | LUKSO / verified owner boundary |
| Library | Normalized owned assets plus private organization | Owner domain store |
| Browser | The text-first interface for finding and organizing Library content and available devices | Owner workspace |
| Folder / collection | Private organizational structure; optionally a source selection | Browser / Library |
| Asset | Stable reference to image, audio, video, or other supported media | Library |
| Device definition | Trusted description of what a device is and which inputs, outputs, controls, and renderer it supports | Closed registry initially |
| Device instance | One configured occurrence of a device in the owner's rack | Saved owner draft |
| Preset / patch | Reusable device settings and content bindings | Owner draft / Library support later |
| Source device | Produces media or signals, such as an audio player or NFT source | Rack |
| Processor device | Transforms media or signals, such as Radar, mirrors, or shaders | Rack |
| Output device | Presents a result, such as a screen, frame, or gallery wall | Rack / World |
| Port | Typed input or output contract between devices | Device graph |
| Connection | Saved compatible link between two ports | Device graph |
| Rack | Active artistic composition of devices | Owner world and public projection |
| Canvas object | Authored spatial object in the world, such as framed artwork | World |
| Runtime window | Temporary working surface; open/closed position is not automatically public authorship | Owner runtime |
| Saved draft | Automatically persisted owner-authored state | Local profile-scoped storage initially |
| Preview | Detached visitor rendering of the current saved public projection | Local, no wallet or IPFS required |
| Publication snapshot | Frozen canonical document prepared for verification and publication | Separate from mutable draft |
| Published profile | Verified canonical document resolved from the Universal Profile publication pointer | Visitor runtime |

The short rule is:

> Folders organize content. Devices do things with content.

## The rack foundation comes first

The immediate product is not Radar, an audio graph, a plugin SDK, or a collection of spectacular devices. The immediate product is a rack frame that remains understandable when all of those arrive later.

The frame must answer, once and coherently:

- what belongs in a rack;
- what a module is;
- how modules are added and removed;
- how they fold, open, move, order, group, and resize;
- what happens directly and what requires a deliberate arrange mode;
- which state is authored, which is temporary runtime state, and which is public;
- how the Browser targets a rack or module;
- how the same saved composition becomes a detached Preview;
- how owner controls disappear for visitors without changing the composition;
- how several rack columns or bays remain navigable when a profile grows;
- how a deep editor can open without forcing every control onto a faceplate;
- how unavailable future modules fail without breaking the rest of the rack.

This is the work to solve now. A visually exciting end-game device is useful only as a pressure test: if the rack frame could not eventually carry it, the frame is too weak. It is not permission to build that end game early.

## FRACTURE lineage and proof already earned

The earlier FRACTURE designs are primary art-direction evidence, not nostalgic reference material. They already established a modular rack extension for Universal Profiles with:

- a shared mechanical chassis;
- rails, screws, recessed surfaces, texture, and physical weight;
- function-specific faceplates inside a common construction system;
- folded modules that retain name, role, colour, and signal identity;
- large output surfaces where the result can dominate;
- compact control surfaces close to the output they influence;
- functional accent colours local to a device rather than page-wide themes;
- module height determined by purpose rather than by one generic card size;
- branding applied like hardware labelling rather than floating website decoration.

The most refined FRACTURE composition shows a master/header section, a large output module, and a compact controller beneath it. That relationship is more important than copying any individual screw, colour, or icon. The rack reads as one assembled machine.

Radar later proved how deep such an instrument can become: three deliberately authored layer sources, smooth parameter control, automation recording, scenes and crossfades, modulation, MIDI, audio response, LSP1 event reactions, workspaces/setlists, and a clean detached output. Parts of its optimized Pixi lineage already live in HUMAN_UNDERNEATH. This proves continuity across FRACTURE, Radar, and the present system.

Radar remains distinct. Its source assets were deliberately designed with negative space and gaps so multiple mirrored layers can interlock. Automatic X/Y mirroring and Radar's composition rules create its visual language. A random opaque image may be a valid image NFT but is not therefore useful Radar material. HUMAN_UNDERNEATH may share engine ancestry without sharing Radar's rendering grammar.

The architectural lesson is:

> Reuse proven engines and instruments; do not rebuild them. First build a rack frame and adapter boundaries capable of carrying them without absorbing or flattening their identity.

The product-planning lesson is equally important:

> Radar is evidence and end-game pressure, not the current implementation focus.

## Future flagship proof of the idea

After the rack frame, Browser, persistence, and Preview path are mature, an ambitious demonstration can reveal the full product:

```text
Universal Profile / Library
        |
        +--> Digital Audio Player --> audio output
        |             |
        |             +--> time / beat / bass / mids / highs
        |                              |
        +--> Image or NFT texture -----+--> Radar Visualizer --> visual surface
                                                               |
                                                               +--> Screen
```

An artist selects a music NFT in the Browser and loads it into the Digital Audio Player. The player produces sound and bounded analysis signals. The artist loads deliberately Radar-compatible layer material rather than treating every image as equivalent. Radar reacts to the music. A Screen presents the result in the world or rack.

That later vertical slice would prove:

- profile content can be used rather than merely listed;
- different media types can cooperate;
- the Browser scales better than folder modules;
- the rack has a clear purpose;
- a mini-app can behave as an instrument;
- the public profile can become a live artwork;
- the future third-party device idea is credible without opening unsafe plugin execution now.

## Artist workflow

The target everyday journey is:

```text
EDIT WORKSPACE
    -> AUTOMATICALLY SAVED DRAFT
    -> PREVIEW CURRENT PUBLIC PROJECTION
    -> UNPUBLISHED CHANGES
    -> PUBLISH CHANGES
    -> PUBLISHED PROFILE
```

### What should be automatic

- Creating, moving, resizing, folding, configuring, and connecting supported owner objects and devices should save automatically after a completed interaction.
- Folder organization and asset membership should save automatically.
- A visible save state should distinguish `SAVING`, `SAVED DRAFT`, and `SAVE FAILED`.
- Refreshing the owner world should restore the saved draft without requiring Share, Snapshot, Preview, IPFS, or a wallet.
- Preview should be able to render the current saved public projection directly.
- Public-relevant draft changes should automatically mark the last publication snapshot or publication as stale: `UNPUBLISHED CHANGES`.

Persistence should happen at meaningful commit points, not on every pointer frame. Releasing a drag or resize, confirming a setting, changing a connection, or saving a modal is a persistence point.

### What must remain explicit

- Deciding which content is public.
- Freezing the exact publication document.
- Verifying that a CID resolves to the exact canonical bytes.
- Asking the owner wallet to submit a transaction.
- Updating the Universal Profile publication pointer.

IPFS content is immutable by design and wallet transactions affect public state. Automatic draft saving must never silently pin, upload, publish, request a signature, or send a transaction.

### Three views that must never be confused

1. **Owner workspace** shows the mutable saved draft, including private content and authoring controls.
2. **Preview current draft** shows what a visitor would receive if the current public projection were published now. It is detached and requires no wallet or IPFS.
3. **Published visitor profile** shows only the last verified document resolved from the on-chain pointer. It remains unchanged until an explicit successful publication.

The visitor view being older than the draft is correct. The interface must explain that difference instead of making it look like lost work.

## Art direction

### Emotional target

OS_UNDERNEATH should feel like opening a private, strange, precision-built studio belonging to an artist. It should be tactile, serious, alive, and slightly dangerous without becoming illegible. It is a creative machine, not an administration panel.

The visual hierarchy should communicate:

1. the artist's work and environment;
2. active instruments and their signal state;
3. identity and navigation;
4. configuration details only when requested.

The art must remain the hero. Chrome exists to frame activity and make it controllable.

### Visual language

- Near-black, charcoal, smoke, and restrained warm orange remain the main shell vocabulary.
- Lines, rails, screws, sockets, status lamps, labels, and measured spacing may suggest physical equipment.
- Typography may feel technical and authored, but essential labels must remain readable.
- Devices should have distinct silhouettes and faceplates while sharing rack dimensions, control grammar, focus treatment, and accessibility rules.
- The Browser should be quieter, denser, and more text-led than the devices. It is backstage organization, not the main spectacle.
- The world may be atmospheric and spatial. Fixed controls should remain calm and dependable above it.
- The Keeper is a resident presence, not a decorative loading mascot or a mandatory task system.

### What it must not become

- a generic SaaS dashboard;
- an endless stack of identical folder cards;
- a marketplace before it is a creative instrument;
- a conventional social profile with cosmetic widgets;
- a plugin free-for-all that executes arbitrary profile-controlled code;
- a game economy that distracts from making and presenting work;
- a dense imitation of Reason that loses OS_UNDERNEATH's own world and identity.

### Interaction language

- Direct manipulation is the default when it is safe: drag the object, resize from a visible handle, fold from its bar, open its controls directly.
- Arrange mode may remain useful for global composition, selection, collision rules, grouping, and preventing accidents. It should not be required for every ordinary edit.
- Right-click offers fast expert commands, but every essential action needs a visible or keyboard-accessible route.
- A folded device should preserve its identity, essential status, and signal activity without exposing its whole body.
- Resizing must have an artistic or functional meaning. It should not merely stretch controls or create arbitrary dead space.
- Modals must actually be modal: contain pointer input and focus, provide a clear close/cancel route, and never leak clicks or drags to the world behind them.
- Long interactions should show their result immediately and persist on completion.
- Motion should clarify state and signal flow. Reduced-motion users must retain equivalent information.

### Browser direction

The Library Browser should eventually be:

- owner-only;
- collapsible and resizable with remembered geometry;
- text-first at its narrowest size;
- able to show optional thumbnails or previews when widened;
- searchable across normalized owned media;
- organized by folders, tags, favorites, saved searches, and compatible media kinds over time;
- capable of browsing both content and trusted device types;
- focused by the selected device so incompatible content can be filtered or de-emphasized;
- usable through click, keyboard, and drag-and-drop where the semantics are clear.

The Browser is not part of the visitor document. Private folder names, tags, searches, and organizational structure never need to leave the owner workspace merely because a public device uses selected assets.

### Responsive direction

Desktop is the primary authoring surface, but compact layouts must remain bounded and operable. Desktop authored placement should be preserved separately from deterministic compact presentation. Do not solve mobile by saving an accidental second layout unless a deliberate mobile-authoring contract is approved.

At minimum, every completed responsive slice should remain understandable at:

- desktop `1280 x 720`;
- mobile `390 x 844`;
- narrow mobile `320 x 844`.

## Architecture direction

### One Library, many consumers

There should remain one normalized Library domain and one profile-scoped owner workspace. The Browser, NFT Viewer, Audio Player, framed artwork chooser, Gallery, and future devices should consume that domain through explicit selectors or adapters. They must not each invent duplicate folder membership or asset identity.

The current stable asset reference model should be reused. Device instances bind to stable asset IDs or bounded source selections. Live metadata can enrich the owner experience, but a public projection must carry the controlled fallback fields needed to render safely and consistently.

### Device definition and device instance

A device definition is trusted code plus a closed declarative contract. Conceptually it owns:

```js
{
  type: 'underneath.audio-player',
  version: 1,
  label: 'Digital Audio Player',
  category: 'source',
  compatibleMedia: ['audio'],
  inputs: [],
  outputs: [
    { id: 'audio', type: 'audio' },
    { id: 'beat', type: 'control.beat' },
    { id: 'spectrum', type: 'control.spectrum' }
  ],
  settingsSchema: { /* bounded, versioned, non-executable */ },
  rendererKey: 'digital-audio-player'
}
```

A device instance is authored data only:

```js
{
  id: 'device:...',
  type: 'underneath.audio-player',
  definitionVersion: 1,
  placement: { column: 0, row: 0 },
  span: { columns: 12, rows: 3 },
  folded: false,
  visitorVisible: true,
  bindings: { track: { stableAssetId: '...' } },
  settings: { /* validated against the definition */ }
}
```

Remote documents may name only allowlisted device types and bounded data. They may not name React components, DOM nodes, CSS files, arbitrary shaders, iframe sources, JavaScript URLs, or executable callbacks.

### Typed ports and connections

Connections must be typed. An image texture is not interchangeable with raw audio; a beat event is not a video surface. The graph should reject incompatible or cyclic connections according to explicit rules before persistence.

Early useful types may include:

- `media.image`
- `media.audio`
- `audio`
- `control.time`
- `control.beat`
- `control.level`
- `control.spectrum`
- `visual.texture`
- `visual.surface`

The first implementation does not need visible cables. A clear connection panel can prove the graph before cable routing, animated wires, rear-rack views, or complex modulation UI are attempted.

### Draft bindings versus public projection

An owner device may use a live private convenience such as “current contents of folder X.” That is owner-authoring data. Preview and publication must resolve it into an explicit bounded public projection:

- exact public device definitions and versions;
- exact public settings;
- exact public connections;
- exact public asset references;
- no private folder name or hidden membership;
- no implicit future assets added after publication;
- no dependency on owner localStorage or live authoring stores.

This preserves the artist's convenient workflow without making the visitor output ambiguous or leaky.

### Schema discipline

The current canonical profile document is version 5 and strict. Its `spaces`, Identity Rack, Inventory Rack, canvas objects, and presentation fields are real compatibility contracts. A device graph must be introduced through a deliberate document-version change with:

- a written schema decision;
- exact-key validation and bounded limits;
- deterministic serialization and fingerprinting;
- pure migration for older documents;
- builder, Preview, visitor, import/export, restore, and publication updates together;
- public/private leakage tests;
- safe behavior for unknown or unavailable devices.

Do not silently reinterpret `spaces` as devices or add executable escape hatches to avoid a versioned migration.

### Owner and visitor boundary

The owner runtime may use authenticated owner stores, local persistence, authoring tools, live Library metadata, and private organization. The published visitor renderer must remain detached from all of them.

The visitor renderer receives one validated public document. It must not import owner stores, localStorage, runtime-window state, private folder data, wallet state, or authoring fallbacks. Missing data produces a bounded unavailable state; it does not reach into owner state to make the result look complete.

Owner authority remains cryptographically verified and fails closed. Address or URL equality is never sufficient.

## Trusted devices now, extensibility later

The long-term vision may allow artists or developers to create new rack devices. The launch architecture should make that future possible, but the first product should ship only bundled, reviewed, allowlisted device definitions.

Arbitrary remote JavaScript, iframe applications, CSS, GLSL, RPC endpoints, or component names must not be loaded from a Universal Profile document.

A future external device SDK requires its own security phase. At minimum it will need:

- content-addressed, versioned packages;
- authenticated publisher identity and package hashes or signatures;
- a manifest with declared ports, capabilities, settings, assets, and budgets;
- sandboxed execution separated from the shell and wallet;
- no wallet, private Library, DOM, storage, microphone, camera, or network access by default;
- explicit capability grants owned by the user;
- CPU, memory, frame-time, audio, network, and storage budgets;
- deterministic suspension and crash isolation;
- a safe missing-device placeholder in Preview and visitor rendering;
- revocation and compatibility policy without rewriting an immutable published document.

The correct near-term extension seam is a clean internal device contract, not an open plugin marketplace.

## Current state and transitional surfaces

As established at commit `687395a`, the owner rack foundation already includes:

- a verified owner-specific home world;
- automatically persisted workspace changes with visible draft status;
- Identity Rack module arrangement;
- Inventory folders with naming, visibility, membership management, folding, and asset cards;
- private folders retained for the owner and excluded from the public projection;
- direct framed-artwork creation, movement, resizing, editing, layering, and persistence;
- Preview of the current draft rather than only an old snapshot;
- separate publication snapshot and stale-state handling;
- a detached published visitor renderer;
- canonical publication verification and explicit wallet submission boundaries.

The codebase still contains several historical interaction models: the legacy Workspace, launcher/window desktop concepts, folder-as-space publication, the new owner Rack Board, and published rack renderers. This is acceptable during migration, but every new slice should identify which model owns its data and whether it is transitional or canonical.

The following should remain usable but receive no deep new investment until the device path proves itself:

- one rack module per folder;
- extensive folder-module resizing;
- richer asset preview behavior inside folder modules;
- cosmetic perfection of legacy Workspace windows;
- publication of a new device schema before local Preview parity exists.

## Phased implementation roadmap

Each phase is a vertical product slice with its own acceptance gate. Do not begin several phases merely because their code is adjacent.

### Phase 0 — Align the north star

Outcome: this document accurately captures the product owner’s intention and becomes the read-first direction for future sessions.

Acceptance:

- the artist recognizes the intended product;
- Browser, Rack, World, Preview, and Publication have distinct meanings;
- the working rhythm below feels practical;
- unresolved architecture-changing questions are recorded rather than guessed.

### Phase 1 — Owner Library Browser foundation

Outcome: one owner-only Browser exposes the existing Library and folder organization without requiring folders to occupy the rack.

Scope:

- reuse the existing normalized Library store and folder domain;
- text-first browsing, search, folders, assets, and compatibility metadata;
- collapsible/resizable owner panel with persisted UI geometry;
- explicit focus target for the selected future device;
- no publication-schema change;
- no deletion of transitional folder racks.

Acceptance journey:

1. Open and resize the Browser.
2. Find several assets through search and folders.
3. Refresh and confirm Browser geometry and organization persist.
4. Close or collapse it and continue using the world.
5. Confirm Preview and visitor output contain no Browser or private organization.

### Phase 2 — Internal device contract and NFT Viewer

Outcome: one trusted empty NFT Viewer device can be created in the rack, configured from the Browser, folded, moved, resized within meaningful bounds, and restored after refresh.

The Viewer, not a folder, is the rack object. It may accept one asset, an explicit selection, or a live owner folder binding. Inside the first slice, presentation should stay simple; asset cards are enough until the device/editor pattern is stable.

Acceptance:

- definition and instance data are separated;
- invalid kinds/settings fail closed;
- one device survives save and refresh;
- Browser focus shows compatible image assets;
- folder data is not duplicated into device state;
- legacy folder racks remain available for compatibility.

### Phase 3 — Device draft and Preview parity

Outcome: public NFT Viewer state survives the complete draft-to-detached-Preview path exactly; private state does not appear.

This phase deliberately includes the profile-document version and migration work. It is complete only when movement, size, fold/presentation state, settings, selected public assets, and deterministic order all agree between owner draft and Preview.

Do not publish on-chain yet. First prove canonical construction, stale detection, Preview, import/export, and safe visitor rendering locally.

### Phase 4 — Audio Player, Radar, and Screen graph

Outcome: the flagship demonstration works with bundled devices and a small typed connection graph.

Suggested order:

1. Digital Audio Player loads and plays one supported owned track.
2. Player exposes bounded analysis/control outputs.
3. Radar accepts a compatible texture and audio/control input.
4. Screen accepts Radar’s visual output.
5. Connections persist and reproduce in detached Preview.
6. Missing media or unsupported browser capabilities fail visibly and safely.

Visible cables, advanced modulation, elaborate presets, and third-party packages are not required to accept this phase.

### Phase 5 — Art-direction consolidation

Outcome: the proven Browser/device workflow feels like one instrument rather than joined prototypes.

This is the right moment for substantial visual-system work:

- rack proportions and device rails;
- faceplate hierarchy;
- folded-state language;
- Browser density and resize behavior;
- ports and connection feedback;
- coherent context menus and inspectors;
- desktop/mobile review;
- motion, focus, touch, and reduced-motion refinement.

Structural layout decisions happen earlier when needed for usability. Fine styling waits until the interaction and data model stop moving underneath it.

### Phase 6 — Verified device publication

Outcome: an accepted device composition can be frozen, verified, explicitly published, and resolved by a logged-out visitor without owner dependencies.

Acceptance includes canonical byte/hash verification, CID verification, authority revalidation, exactly-once wallet submission, on-chain read-back, and a clean visitor session resolving the new publication.

Pinata account configuration and live publication remain explicit operational steps. Tests should use controlled fakes; no live action occurs merely to verify ordinary UI work.

### Phase 7 — External device research and SDK

Outcome: only after the bundled graph is successful, define whether and how third-party devices can exist safely.

This starts as threat modelling, package-format design, capability policy, and a sandbox prototype. It does not start as “load this URL in the profile.”

## What deliberately waits

- arbitrary third-party plugins or remote mini-app execution;
- device marketplace and economy;
- complex cable animation or rear-rack simulation;
- multi-user collaborative editing;
- on-chain persistence of mutable owner drafts;
- automatic IPFS upload or automatic wallet publication;
- perfect Gallery and every legacy modal before the core device slice;
- deep folder-rack resizing and richer folder-module previews;
- authored separate mobile worlds;
- broad refactors that do not unlock the accepted vertical slice.

These are not rejected ideas. They are protected from being built before the foundation can carry them.

## Working rhythm for the artist and Codex

The product owner does not need to know the entire software-testing discipline. Codex should convert creative direction into a safe, visible rhythm.

### Gate 1 — Discuss

Ideas, screenshots, complaints, questions, and enthusiasm are discussion. No files or state change merely because an idea sounds good.

Codex should translate the discussion into a proposed slice:

- artist-visible outcome;
- what is included;
- what is deliberately excluded;
- which existing data owner is reused;
- important privacy, persistence, Preview, and visitor risks;
- a short manual acceptance journey.

The product owner may adjust the batch. `Doe maar`, `implement`, `fix`, or an equivalent explicit instruction opens implementation. `Stop ff` or `stop` ends it immediately.

### Gate 2 — Implement a narrow slice

Codex first inspects Git state, relevant code, tests, and architecture. It preserves unrelated work and implements the smallest coherent behavior.

During implementation:

- run focused tests after meaningful logic changes;
- add a regression test for a confirmed bug or new failure boundary;
- avoid full builds after every CSS or spacing adjustment;
- report if a local request exposes a schema, security, or product decision larger than the authorized slice;
- never silently publish, upload, transact, deploy, or modify remote state.

### Gate 3 — Manual artist review

When the slice is ready to feel, Codex gives one concrete journey to try and states what is not finished. The artist tests the behavior that matters creatively.

A useful acceptance report from the artist can be simple:

```text
- what I did
- what stayed after refresh
- what Preview showed
- what felt wrong or confusing
- screenshot if visual
```

The artist is not expected to run automated commands or invent edge cases. Codex owns technical verification. The artist owns whether the interaction and visual result make sense.

`Perfect`, `works`, or `approved` accepts the reviewed result but does not automatically authorize a commit.

### Gate 4 — Fix, batch, or defer findings

Use this priority system:

#### P0 — stop and fix before building onward

- owner changes do not persist or restore incorrectly;
- Preview differs from the saved public draft;
- private content enters Preview or visitor output;
- owner authority can be bypassed or fails open;
- canonical publication/hash/CID/wallet integrity is at risk;
- a modal leaks interaction to the world behind it;
- normal use corrupts or destroys organization or assets;
- the accepted primary journey is impossible.

#### P1 — fix within the current or next tightly related slice

- controls have conflicting meanings;
- a required workflow is confusing or unnecessarily repetitive;
- device/folder/window state has two competing sources of truth;
- keyboard, touch, responsive, or focus behavior blocks a meaningful group of users;
- a regression affects an already accepted workflow but does not risk data or privacy.

#### P2 — record and batch for polish

- spacing, icon, border, copy, minor animation, and visual-density refinement;
- an optional shortcut or convenience;
- advanced device presentation that does not block the current proof;
- cleanup whose only value is future maintainability.

Confirmed P0 issues override the roadmap. P1 issues should not accumulate across multiple phases. P2 issues should not repeatedly interrupt a data-flow foundation.

### Gate 5 — Commit checkpoint

Commit only after the product owner explicitly says `commit maar`, `checkpoint`, or equivalent.

Before a normal production-code commit, Codex runs:

- relevant focused tests;
- `git diff --check`;
- `npm run build` for production-source changes;
- relevant browser assertions for changed interaction, responsiveness, focus, touch, CSP, or accessibility;
- staged-diff inspection to ensure only the approved slice is included.

A checkpoint is valuable when one coherent user journey is accepted and verified. It is not necessary after every micro-adjustment, and unrelated dirty files must never be swept into it.

### Gate 6 — Stabilization or release

Before a stabilization, high-risk checkpoint, or release, run the full ladder:

```text
npm test
npm run test:browser
npm run build
npm run build:check
git diff --check
```

Also verify:

- production owner-runtime isolation;
- public/private projection;
- authority failure behavior;
- production budgets;
- final worktree and staged scope;
- cleanup only of processes/artifacts created by the current task;
- manual owner, Preview, and logged-out visitor journeys where relevant.

## Which tests, and when

| Kind of work | During the slice | Acceptance / commit gate |
| --- | --- | --- |
| Discussion or art direction only | No commands required | Confirm written decisions |
| Documentation only | Read references; inspect diff | `git diff --check`; link/path review |
| Pure domain/storage logic | Smallest relevant Node tests | Focused suite plus build if production imports changed |
| Persistence or migration | Migration/round-trip/failure tests immediately | Focused tests, build, manual refresh journey |
| UI interaction | Focused structural/component test | Relevant browser assertion plus manual journey |
| Pure visual adjustment | Small structural check if useful | Manual desktop/mobile/narrow review; do not full-test every tweak |
| Preview/public projection | Builder, fingerprint, validation, isolation tests | Manual owner-to-Preview parity and relevant browser tests |
| Security/publication | Failure-path and exactly-once tests | Full high-risk ladder; controlled fixtures; no live action |
| Release/stabilization | Focused tests while working | Entire stabilization ladder |

### When to style

Use three passes:

1. **Structural usability:** size, placement, scrolling, layering, modal behavior, responsive bounds, and direct manipulation. Fix this while implementing the behavior.
2. **Visual system:** shared hierarchy, faceplates, bars, typography, controls, states, and density. Consolidate after the vertical slice works.
3. **Polish:** micro-spacing, animation, icon nuance, texture, and atmosphere. Batch after acceptance so it does not hide data-flow defects.

Do not wait until the end to fix an unusable layout. Do wait before perfecting a surface whose model is about to be replaced.

### When to keep coding

Continue to the next slice when:

- the current acceptance journey works;
- save and refresh agree;
- Preview agrees where the slice is public;
- private data remains private;
- focused tests pass;
- remaining issues are named P2 items or explicitly deferred scope.

Stop expanding the slice when:

- the request reveals a new schema or authority decision;
- there are two plausible sources of truth;
- a workaround would couple the visitor to owner state;
- the fix requires changing publication compatibility;
- the artist has not chosen between materially different product behaviors.

## Bug-reporting language

A report does not need to be technical. The most useful form is:

```text
WHERE: Owner / Preview / Published visitor
START: what was visible before
ACTION: exact click, drag, resize, refresh, or command
EXPECTED: what should have remained or happened
ACTUAL: what changed, disappeared, reset, or blocked input
REPEATABLE: always / sometimes / once
```

For persistence bugs, always mention which boundary exposed it:

- immediately after the edit;
- after closing/reopening a module;
- after leaving and returning to the rack;
- after browser refresh;
- in Preview current draft;
- in the last published visitor profile.

Those are different data paths and prevent “save” from becoming an ambiguous word.

## Decision log

The following decisions are active until deliberately revised:

1. OS_UNDERNEATH is a spatial creative profile/instrument, not a page builder.
2. The Browser organizes; the Rack contains active devices.
3. Folder rack modules are transitional, not the scalable end state.
4. There is one normalized Library source of truth.
5. Owner draft persistence is automatic and profile-scoped.
6. Preview current draft is local, detached, truthful, and does not require IPFS or a wallet.
7. Publication remains explicit, verified, and immutable per CID.
8. Visitors receive only a validated public projection and never owner/private stores.
9. Initial devices are bundled and allowlisted.
10. A clean internal device contract precedes any external SDK.
11. The first device proof is NFT Viewer; the flagship system is Audio Player + Radar + Screen.
12. Persistence and Preview parity take priority over cosmetic polish and republication.
13. Existing accepted capabilities remain available during migration unless a replacement has passed its journey.

## Questions that would change architecture

These are genuine future product decisions. They should be answered only when their phase approaches:

- Can one public device bind to a dynamic collection that changes after publication, or must every publication always freeze exact asset references? The safe default is exact frozen references.
- Is device audio expected to continue while navigating the world, or is playback scoped to an open/active device? This changes runtime ownership.
- Is a Screen a rack device, a world canvas object, or one device with both a rack controller and a world output? The flagship prototype should test the last option.
- May visitors interact with device controls, or do they receive a presentation-only configuration? This affects the public schema and runtime budget.
- Must future third-party devices reproduce deterministically from immutable packages, or may a publication reference an upgrade channel? The safe default is immutable exact versions.

Do not block the Browser or NFT Viewer foundation on these later questions.

## Relevant technical foundations

Read the documents that match the slice:

- `docs/OS_UNDERNEATH_VISION.md` — original product thesis and identity.
- `docs/HOME_WORLD_SPATIAL_FOUNDATION.md` — signed authored grid and camera separation.
- `docs/PHASE_1_PROFILE_LIBRARY.md` — normalized assets and Library ownership.
- `docs/PHASE_2_CANVAS_SPACES.md` — folder/space domain and historical launcher mapping.
- `docs/PHASE_4_2A_SPATIAL_GRID_AND_LAUNCHERS.md` — grid, spans, and public projection.
- `docs/PHASE_4_2B_DESKTOP_INTERACTION.md` — runtime versus authored window state.
- `docs/PHASE_4_4_CANVAS_OBJECTS_AND_FRAMED_ARTWORK.md` — closed object registry and complete vertical slice.
- `docs/PHASE_4_PORTABLE_PROFILE_DOCUMENTS.md` — draft, snapshot, Preview, import, and restore.
- `docs/PHASE_2_IDENTITY_RACK_DOCUMENT_V5.md` — Identity Rack document contract.
- `docs/PHASE_1C2F_PUBLISHED_CONTENT_SECURITY.md` — visitor content restrictions and CSP.
- `docs/PHASE_1C2G_PROVIDER_LIFECYCLE_AND_PUBLICATION_ERRORS.md` — fail-closed authority and exactly-once publication.
- `docs/PHASE_1C2H_PRODUCTION_DIAGNOSTICS_AND_BUDGETS.md` — production isolation and budgets.

External design reference:

- Reason Studios, [Working with the rack](https://docs.reasonstudios.com/reason12/working-with-the-rack)
- Reason Studios, [Sounds, patches and the Browser](https://docs.reasonstudios.com/reason12/sounds-patches-and-the-browser)

These are interaction references, not specifications to copy.

## Definition of done for a vertical slice

A slice is done when:

- the artist-visible journey is coherent;
- the correct domain owns every persisted field;
- completed edits save once and survive refresh;
- public state reproduces in detached Preview;
- private state is absent from Preview and publication inputs;
- the visitor renderer remains detached;
- invalid or missing data fails safely;
- focused automated checks pass;
- the artist manually accepts the journey;
- remaining issues and deferred scope are written down;
- the requested commit gate, if any, passes without unrelated files.

## Immediate recommended next move

After this direction is accepted, start Phase 1: the owner-only Library Browser foundation. Reuse the current Library and folder store, keep the publication schema untouched, and prove remembered resize/collapse behavior plus owner-only isolation. Then build the internal device contract and one NFT Viewer against that Browser.

Do not begin with the Audio Player, visible cables, external plugins, Gallery polish, or live republication. The Browser-to-NFT-Viewer path is the smallest slice that proves the corrected architecture while preserving the work that already functions.

## Final reminder

When the project feels confusing, return to these boundaries:

```text
Library owns content and organization.
Browser finds and prepares it.
Rack devices use and transform it.
World presents and inhabits it.
Draft saves automatically.
Preview tells the truth locally.
Publication is explicit and verified.
Visitor receives only the frozen public result.
```

That is the foundation on which the stranger, more expressive future can safely grow.
