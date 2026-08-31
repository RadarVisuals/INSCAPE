# INSCAPE active contract

Status: sole active product-direction document
Established: 2026-08-28
Rollback baseline before the documentation reset: `64458ac`

## Authority

This file records current accepted direction. Historical plans, phases,
handoffs, roadmaps, art-direction notes, archived prototypes, and deleted
documentation are not product authority. Consult Git history only when the user
explicitly requests recovery or historical evidence.

The existing application remains the working baseline until a replacement is
implemented and accepted. Direction below is not permission to perform a broad
rewrite, schema migration, publication, upload, deployment, or wallet action.

## Product hierarchy

INSCAPE must separate the creation environment from the created result:

1. **INSCAPE Workbench** — the application shell and experimental workspace.
2. **Display Module** — a bounded, movable object on the Workbench.
3. **Stage** — the clipped canonical visual output inside the Display Module.
4. **Grid** — a scene or composition rendered inside the Stage.
5. **Assets and authored primitives** — content placed inside a Grid.

The Workbench is not the published artwork. Editor navigation, Library,
Activity, Preview, Publish, settings, and future creative modules stay outside
the published Stage. Workbench background, alignment-grid visibility and
colour, and shortcut snapping are local editor preferences. They must not enter
the public profile document or IPFS publication snapshot.

## Display Module

`Display Module` is the product-facing term. Existing `PresentationBoard` and
`presentationBoard*` implementation identifiers and persistence keys remain
internal compatibility names during this migration; do not broadly rename them.

- Begin with one canonical 16:9 Stage. Do not introduce arbitrary ratios during
  the first migration.
- Content outside the Stage boundary is clipped and is not published.
- The Display Module may move freely on the Workbench without changing published
  composition coordinates.
- Pan and zoom are camera/view state. They never resize assets, mutate the Grid,
  or alter published geometry.
- Support a fitted overview and sufficiently strong zoom for precise editing.
- Do not implement the Display Module as an HTML iframe. Use one application context with
  an isolated, clipped viewport and camera transform.
- The Display Module bar owns the authoring instruments in the order
  **Lock, Metadata**, followed by its window controls. Metadata is a singular
  module that may be attached, detached, or closed, but must never be mounted
  in two places at once.
- Layers remains the existing global Workbench dock window. It is not attached
  to the Display Module and has no Display Module sidecar lifecycle.
- A detached Metadata module opens at the upper-right of the Workbench and
  remains viewport-bounded. Attached Metadata retains its established inner
  and right-side projections.
- The composition Lock is local, profile-scoped Workbench state. While active,
  it prevents placement, movement, resize, crop, transform, reorder, removal,
  and other authored-geometry mutations without blocking selection or artwork
  inspection. It is never part of the published document.

## Identity and authored personas

- The identity strip is trusted publication chrome, not artistic Stage content.
- It is derived from the official Universal Profile identity and authority.
- Authored content cannot replace or impersonate that publication anchor.
- The strip may collapse and may hide in an explicit immersive view. Its state
  never changes Stage geometry.
- A Grid may present any fictional persona, biography, role-play identity,
  text, NFT, image, animation, or later supported primitive. That content is a
  composition, not the publishing identity.
- Do not rebuild official profile metadata as a mandatory conventional profile
  page. Official identity is the anchor; the Stage is the playground.

## Cover, entry, and Discover

- A **Cover Grid** is an existing public Grid selected as the source of the
  Discover snapshot.
- An **Entry Grid** is an existing public Grid selected as the first interactive
  scene a visitor enters.
- Cover and Entry default to the same Grid but may be selected independently.
- Private Grids cannot be Cover or Entry. A public snapshot must never leak a
  private Grid.
- Generate the cover snapshot from the canonical Stage at publication time and
  bind it to that publication revision. Draft edits must not silently change a
  published Discover card.
- Discover renders the lightweight snapshot plus trusted identity chrome. It
  does not mount many live owner renderers.
- Opening a world visually expands the card while the published document loads.
  The snapshot is the poster/loading state; the interactive renderer replaces
  it in the same bounded presentation area when ready.

## Editing, public inspection, and publication

- Owner editing and public inspection must not silently replace or rearrange
  the application dock.
- The canonical Display Module should make a separate full-application Preview mode
  unnecessary. A future public-inspection state may hide authoring controls and
  private content without changing route or workspace context.
- Keep public/private projection explicit. Only public canonical content may
  enter a publication document or snapshot.
- The current canonical v9 document, profile-scoped private draft, external
  wallet authority, IPFS validation, and visitor recovery boundaries remain in
  force until an explicit, tested migration replaces them.

## Visual language

INSCAPE is flat, technical, spatial, and deliberately bounded. It must not drift
into generic dashboard, marketplace, or AI-generated interface styling.

### Typography

- Use **Inscape Sora** for primary navigation, headings, controls, body copy,
  human-facing labels, and concise identity labels. Normal UI weights are
  approximately 400–500; heavier weight requires an established reference.
- Use **Inscape IBM Plex Sans Condensed** for technical data, addresses, codes,
  microcopy, measurements, state labels, publication details, dense secondary
  copy, Library rails, metadata, and supporting descriptions.
- The INSCAPE wordmark remains the existing SVG and does not require a brand
  font.
- Do not introduce a new font, generic fallback styling, arbitrary all-caps, or
  unrelated weights when an established role exists.

### Geometry and surfaces

- Default interface geometry is square and structural: zero corner radius,
  one-pixel borders, contiguous faceplates, clipped overflow, and deliberate
  alignment. Circular geometry is reserved for avatars, identity marks, status
  indicators, and controls that are already circular.
- Use the active `--workflow-*`, `--lattice-menu-*`, and established surface
  tokens. Do not add a parallel palette for one screen.
- Retain the established carbon, graphite, slate, ash, mist, and paper surface
  family. Artwork and authored Grid appearance may vary; application chrome
  remains coherent.
- Shadows communicate a genuinely elevated Display Module, window, menu, or modal. They
  remain restrained and must not turn every bounded region into a floating card.
- Spacing follows structural rails, cells, borders, and neighbouring production
  components. Avoid large empty padding used only to make a UI appear modern.

### Selection and interaction

- Active navigation and selected commands use the established high-contrast
  edge-selector grammar: horizontal on horizontal rails and vertical on
  vertical lists. Do not rely on an unrelated fill colour alone.
- Hover, focus, pressed, selected, disabled, and loading states must occupy the
  complete interactive hit area and must not shift layout.
- Keyboard focus remains clearly visible. Controls retain usable hit targets
  even when their visual label is compact.
- Scrollable content must be constrained by its owning window or panel. It must
  not escape above, below, or sideways across the application shell.

### Grid and alignment

- A visible Grid must correspond to real layout, snapping, measurement, or
  navigation geometry. Never add a Grid as detached background decoration.
- The Workbench alignment Grid may be hidden independently from shortcut
  snapping. The Display Module Grid and its authored snapping remain separate,
  publishable Stage appearance and geometry.
- Headers, rails, cards, Display Modules, windows, and controls align to the same active
  structural coordinates wherever their relationship is visible.
- The Display Module boundary must remain visually unmistakable at every
  zoom level and viewport size.
- Zoom changes inspection scale, not document geometry. Visual chrome must not
  accidentally scale as authored Stage content.

### Responsive and cross-mode validation

- Wide and narrow layouts must preserve hierarchy and access, not merely shrink
  the desktop composition.
- Owner, Visitor, Discover, public presentation, loading, empty, and error states
  must look like one system.
- Before accepting visual work, compare screenshots at representative wide and
  narrow viewports and check alignment, overflow, clipping, scroll boundaries,
  typography, active selectors, and input focus.
- Do not declare a visual change complete solely because CSS compiles or one
  viewport appears correct.

## Scope discipline

- Do not build the future animation, shader, audio, modulation, or free-module
  Workbench merely because this architecture permits it.
- Implement migrations in narrow replace-and-verify slices.
- Delete old presentation code only after its accepted replacement is live and
  regression-covered.
- Preserve rollback points and user-owned files.

## Active operational safety

- Public IPFS content is public and permanent.
- A successful IPFS upload is not an on-chain publication.
- Never retry an ambiguous wallet action after a transaction hash exists.
- Keep Pinata credentials server-side and outside all `VITE_*` variables.
- Validate canonical bytes, size, CID, profile, chain, and wallet authority at
  their existing fail-closed boundaries.
- Retain provenance and relationship scope for all LUKSO-derived facts.
- Recheck official LUKSO sources live before changing standards-facing behavior.
- Do not run `npm audit fix --force`, downgrade `@lukso/up-modal`, or introduce
  untested overrides to conceal inherited dependency findings.
