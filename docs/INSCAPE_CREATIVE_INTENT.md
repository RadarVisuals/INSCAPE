# INSCAPE creative intent

Status: required product-meaning context

Established: 2026-09-02
Clarified with the founder: 2026-09-06

Authority: this document explains why INSCAPE exists and how its concepts must
be interpreted. It is not an implementation roadmap and does not authorize
future systems to be built early. `docs/INSCAPE_ACTIVE_CONTRACT.md` remains the
sole authority for accepted product direction and current scope. If the two
documents appear to conflict, stop and resolve the ambiguity with the product
owner rather than silently choosing one.

## Founder's intent

INSCAPE exists because digital artwork should not be trapped as a finished,
flattened collectible inside an inventory card.

The founder is an illustrator and digital artist whose work is deliberately
constructed from reusable layers: transparent characters, poses, landscapes,
line art, masks, patterns, eyes, effects, shaders, text, and lore. A conventional
export is only one flattened end state. It discards the operative structure that
makes the work capable of being recomposed, animated, interpreted, and placed
in relationship with work from other artists.

INSCAPE is intended to give that artwork **life**.

The founder describes INSCAPE as an online desktop close to their artistic
vision: a lasting place for experiments that would otherwise become isolated
small applications. Human Underneath is the world in which their artwork lives;
Lunar Desert can be one chapter within it. INSCAPE itself also welcomes other
worlds and practices, including a photographer presenting and recomposing photos.

The Workbench contains those experiences. A new animation experiment, music
player, or interactive organism should be able to become a module within
INSCAPE. It should not require rebuilding the surrounding application each
time. The founder's existing asset-composition workflow is valuable working
ground to build on; this wider intent is not an instruction to start over.

That means preserving assets as identifiable creative material and giving
people an environment in which they can do something with them: arrange them,
layer them, combine them across collections and media, tell stories with them,
inspect their metadata, publish compositions, and eventually pass those
compositions between Universal Profiles without erasing their sources.

## The wrong mental model

INSCAPE is not primarily:

- an NFT gallery;
- a profile viewer with elaborate window chrome;
- a marketplace inventory;
- a tool for placing rows of square collectibles beside one another;
- a conventional portfolio-page builder;
- a flattened collage exporter;
- a Pixi application with menus wrapped around it.

An implementation that optimizes the Display Module for uniform asset cards or
simple square-gallery layouts has missed the product's purpose, even if that
implementation is technically polished.

Ordinary images and conventional collections remain valid inputs. They can be
combined with photography, pixel art, illustration, text, and other media. But
the distinctive capability appears when assets have been intentionally prepared
for composition: transparent backgrounds, meaningful silhouettes, compatible
layers, masks, or richer render instructions.

## Core proposition

Universal Profile standards supply identity, extensible data, digital assets,
metadata, permissions, execution, and interaction signals. INSCAPE supplies a
creative environment and a visual grammar for making those things experiential.

In short:

> Assets are material, not terminal presentations.

The source asset must remain independently identifiable after it is placed in a
larger scene. A composition must add authorship and meaning without flattening
away the creator, collection, token scope, provenance, or story of its parts.

## Current product focus

The present focus is deliberately narrow:

1. Fine-tune the Display Module authoring workflow.
2. Fine-tune selection and Metadata so the source and story of each placed
   asset remain accessible.
3. Make it genuinely pleasurable for the founder to experiment with real,
   transparent assets and construct scenes and sequences.
4. Preserve the architectural seams required by the broader intent without
   implementing the broader system prematurely.

The first success condition is not the number of supported modules. It is that
an artist can open the Library, drag prepared assets into the canonical Stage,
compose and layer them, move between Grids, add narrative meaning, and inspect
the identity of every component without reducing the result to a flattened
inventory view.

## Product hierarchy

Use the canonical hierarchy in the active contract:

1. **INSCAPE Workbench**: the containing desktop and experimental space, with
   an authored public experience as well as the owner's workspace.
2. **Module instance**: a creative application with its own content and behavior.
3. **Display Module**: the current composition module type; its Stage is the
   canonical clipped 16:9 output and its Grids are scenes within that output.
4. **Assets and authored primitives**: material interpreted by compatible modules.

Do not use `Grid` to mean a marketplace thumbnail grid. In INSCAPE, a Grid is
an authored scene: a spatial relationship among independently meaningful
objects. It may be sparse, cinematic, narrative, photographic, absurd, or
mixed-media.

The Workbench hosts separate creative modules. The Display Module is the first
composition module, not a synonym for the entire product. Multiple instances
can organize chapters or separate bodies of work. Other module types need not
use Grids or a 16:9 canvas. This is accepted direction, not evidence that the
current application already implements that full model.

## Display Module

The Display Module is where an artist shapes a scene and, across multiple
Grids, can shape a story.

Its important behavior is compositional rather than gallery-like:

- drag assets from the shared Library;
- preserve transparency;
- position, scale, crop, transform, lock, and reorder placements;
- combine assets from different creators and collections;
- retain each placement as a reference to its source asset;
- construct multiple Grids and move between them;
- add authored text and lore;
- inspect the composition without editor chrome;
- publish a canonical public result within the creator's chosen public
  Workbench arrangement, without leaking private editor preferences.

A landscape, transparent character, beam, prop, photograph, or piece of text
can each remain separate. The final scene is an authored relationship between
them, not a replacement for them.

### Authoring instruments belong to the composition

The Display Module owns the controls needed to shape its scene. In particular,
Layers is not a generic application panel: it is the structural view of one
Display Module's active Grid and the direct expression of placement z-order.
Its selection and the Stage selection are the same selection.

Attached instrument placement follows a meaningful spatial grammar:

- **left:** editing tools, placement operations, and Layers;
- **centre:** the canonical Stage and artwork;
- **right:** Metadata, provenance, and narrative inspection.

This is a conceptual orientation, not a prescription for two wide sidecars.
The Display Module must have a compact option that adds no more than one
full-width utility bay. Layers and Metadata can swap within that bay or share
it as a vertically divided, resizable stack. Either section can collapse or
take over the bay when it needs more room. A compact authoring rail may remain
visible on the opposite edge without materially widening the module. This is
one projection of the instruments, not the only valid arrangement.

Layers and Metadata can therefore use a shared attached bay, a bounded overlay
inside the module, a detached Workbench window, or a closed state when the
artist needs the Stage unobstructed. At narrow widths an attached instrument
must yield to an overlay instead of crushing or reflowing the canonical Stage.
The instrument remains owned by the Display Module in every presentation and
is never part of the published Stage.

The Display title bar identifies the presentation and exposes compact instrument
and window controls. The official Universal Profile avatar, name, and address
belong in the Identity Module title bar, keeping the trusted publishing context
available without repeating it above every composition. The Display title bar
should not carry the complete placement toolbar or layer list.
Detailed editing controls belong with Layers, where their scope and effect are
visible.

## Metadata is part of the experience

Metadata is not merely a technical inspector attached to an image editor. It is
how a visitor discovers that a visible component has an identity, origin, and
story.

The Metadata module must preserve three distinct scopes:

1. **Source asset**: contract and token scope, standard, media, collection,
   creator attribution, issuance evidence, and other retained provenance.
2. **Placement**: how the asset is used in this Grid, including its authored
   geometry and presentation.
3. **Composition**: the Grid's title, narrative, contributors, included assets,
   publication, and relationship to other Grids or later derivatives.

Metadata may carry both source truth and authored interpretation, but the UI
must not silently present one as the other.

For multi-artist scenes, preserve the difference between:

- the publishing Universal Profile;
- the composer or composers of the scene;
- contributors to the composition;
- creator attribution on each source asset;
- issuance evidence;
- current LSP7 or LSP8 holding;
- contract ownership;
- controller authority.

These relationships are not interchangeable.

## Prepared and layered assets

The full INSCAPE idea must not equate an asset with one flattened image URL.
An asset reference may eventually resolve to one or more representations or to
an authored package of renderable resources.

A prepared LSP8 asset might conceptually reference a package such as:

```text
asset identity and metadata
├── flattened preview
├── body-colour mask
├── body highlights
├── body pattern or patterns
├── line art
├── eye white
├── iris
├── pupil
├── glint
├── energy or void effects
├── palette or material parameters
└── declared layer order / render manifest
```

The exact schema is not fixed by this document. Do not prematurely standardize
it from one example. The invariant is that the package remains declarative,
versioned, bounded, and safely interpretable. It must describe resources and
render order without requiring a receiving gallery to execute arbitrary code.

For Resident Zero, for example, a continuously active body-pattern layer can be
warped inside a body mask while line art and eyes retain their own ordering and
behavior. The token's flattened preview is a fallback representation, not the
complete meaning of the asset.

## Living entities and the Workbench

The founder has previously developed living-entity experiments. Those studies
do not establish an implemented INSCAPE runtime or prescribe a single place
where every organism must live.

An entity behind functional windows remains one possible experiment. Another
is a bounded module containing an illustrated creature in a perspective space.
The September 6 concept screenshots show possible near/far presentations and
connections to a Display Module and music. They are illustrations of intent,
not evidence of working animation, headtracking, or module communication.

The artwork provides material; the module supplies behavior. A creature can
begin as an image. A module might animate it, add eyes, respond to audio, greet
a visitor, or interpret selected metadata. A landscape image could also be
input to the same behavior if the module supports it. The behavior is not
necessarily embedded in the NFT or exclusive to one illustrated character.

Headtracking, music reactions, metadata interpretation, and greeting visitors
are experiments the founder wants room to explore. They are not mandatory
features of the Workbench host. Any background experiment must respect window
interaction and remain out of the user's way. Specialized rendering must stay
separate from the shell; Pixi is not the universal application model.

## Observed entity material study

The video `Bezig met opnemen 2026-09-02 200211.mp4` was reviewed on 2026-09-02.
It is an Affinity Designer construction study used to demonstrate the intended
layer progression. It is not footage of a working animation and is not evidence
that the resident runtime exists in the current repository. Editor selection
bounds and the accidental viewport zoom during the final seconds are not part
of the intended effect.

The sampled frames show an entity assembled as independently controllable
visual regions rather than a single sprite:

- a stable, high-contrast central eye and void that remain the visual focus;
- dark-purple resting body regions around the central aperture;
- an orange body field expanding radially from the inner ring until it occupies
  nearly the full form, then contracting toward the void;
- repeated expansion and contraction rather than a single opacity flash;
- violet energy remaining visible at the boundary and connective seams during
  transitions;
- line art and skeletal extremities remaining legible across material changes;
- the ability to intensify the entity through internal material distribution
  without replacing it with an unrelated flattened animation frame.

This supports an event pulse as a temporary modulation—for example, an incoming
profile event could drive the orange field outward through the body mask,
energize the violet boundary, affect the eye, and then return the materials to
their resting distribution. The pulse is layered on top of continuous floating
and swaying idle life; it does not make an otherwise static object briefly
animate.

## Multi-artist composition

INSCAPE should allow a scene to combine, for example, one artist's background,
another artist's transparent character, a photographer's bird, a pixel-art
environment, and the composer's text.

The scene gains its own authorship without erasing the authorship or provenance
of its components. Selecting a component can reveal its collection, creator,
source metadata, and its authored role in the current scene. Inspecting the
whole Grid can reveal the composition's story, credits, and asset manifest.

Holding, creator attribution, issuance, permission to remix, permission to
co-author, and permission to mint are separate facts. Future UX must not infer
one from another.

## Publication, portability, and later collaboration

Publishing includes a visitor's experience of the Workbench itself. Someone
can arrive at a desktop with shortcuts, open a chapter such as Lunar Desert,
or follow a direct link to an already open identity or other module. The maker
chooses the starting arrangement; nothing needs to start open.

Visitors are participants. They may move or close windows and play with exposed
module controls, including sliders that change the experience. Their session
may reach a result the maker did not anticipate. That freedom is intentional:
the published starting point remains unchanged and reload restores it. It does
not imply access to the creator's Library organization or Layers, nor permission
to save changes back to the creator's work.

One Workbench per profile is sufficient for now. Publication includes only
the modules and Grids the maker makes public. Private work in progress must
remain outside the public document. Publishing an inventory indiscriminately
would defeat the maker's ability to choose what to present and how.

The existing profile publication direction uses a custom ERC725Y
`INSCAPEProfileDocument` key containing a `VerifiableURI`. This is intentionally
native to Universal Profile extensibility: the profile stores a verifiable
pointer while the canonical document carries the richer presentation.

The longer-term creative model includes:

```text
public composition
→ imported into another artist's Workbench
→ continued as a new private draft
→ published as a new immutable document
→ new publisher updates their own profile pointer
→ derivative retains its source lineage
```

That is a fork or remix. It does not mutate the original publication.

Shared authorship of one draft is a later and separate problem involving
invitation semantics, controller permissions, attribution, revisions, conflict
handling, and publication authority. Do not build it merely because this
document explains it.

A future composition may also be referenced by an LSP8 asset or rendered by a
gallery. The profile, token, gallery, and derivative should be capable of
pointing to the same immutable composition rather than depending on a lossy
flattened export. Clients that do not understand the interactive representation
should still have a safe canonical preview or cover.

## Future modules

The Workbench is intended to host additional modules such as music and video
players, identity presentations, and different animation instruments. Assets from the
shared Library may be dragged into compatible modules: an audio representation
into a music player, for example, or a prepared visual package into an animation
instrument.

Keep INSCAPE's shared host deliberately small in responsibility. It knows about
instances, windows, assets, persistence, publication, and the distinction
between authored state and temporary visitor interaction. Each module knows
its own parameters, content, rendering, and input behavior. Saving a module's
configuration is a shared service; understanding what an eye or effect does
belongs to the module.

Modules should be able to cooperate where useful, such as music driving an
organism's movement. This calls for explicit connections as concrete uses are
built, not a requirement that every module already understand every other one.

Initially the founder and INSCAPE maintainers will make these modules. Giving
other developers a way to contribute is appealing but not yet specified.
Neither an external plugin marketplace nor an arbitrary-code runtime is a
current requirement. The founder may monetize artwork or module experiences;
the commercial packaging and access model remain open. These boundaries allow
experimentation without requiring the founder to choose implementation
technology or a business model before the first module can be explored.

The intended separation is:

> The Workbench hosts. The Library supplies. Modules interpret. Specialized
> renderers perform.

## LUKSO standards fit

This is an interpretive summary, not a substitute for live standards review:

- LSP0 and ERC725Y provide the executable account and extensible profile data
  store.
- LSP2 provides schemas for standard and custom data keys.
- LSP3 supplies official profile metadata.
- LSP4 supplies flexible digital-asset metadata and creator references.
- LSP5 and direct holding checks support received-asset discovery without
  collapsing discovery into current ownership.
- LSP6 supplies scoped controller permissions.
- LSP8 supplies identifiable assets and token-specific metadata capabilities.
- LSP12 supplies the issuer-side relationship used with creator references.
- LSP1 supplies typed Universal Receiver notifications that can be normalized
  into inputs for later resident reactions.
- LSP28 currently describes a draft tiled Grid and mini-app format. It may be a
  bridge or distribution surface for INSCAPE, but it is not identical to the
  free composition Grid inside the Display Module.

Before implementing or changing any standards-facing behavior, read
`docs/standards/LUKSO_ENGINEERING_BASELINE.md` and verify the relevant current
official specification.

## Guardrails for future Codex sessions

When interpreting or modifying INSCAPE:

1. Begin from the premise that assets are reusable, attributable creative
   material—not terminal cards.
2. Do not redesign the Display Module as a conventional NFT gallery.
3. Do not assume every asset is square, opaque, static, single-file, or
   adequately represented by a thumbnail.
4. Preserve transparent media and independent placement identity.
5. Do not flatten a composition as the only canonical result.
6. Keep source metadata, placement metadata, and composition metadata distinct.
7. Preserve multi-artist and multi-collection provenance.
8. Treat living-entity concepts as experiments; preserve window interaction
   and do not hard-code a creature engine into the Workbench host.
9. Do not make Pixi the application shell or universal module runtime.
10. Prepare seams for future modules without implementing them before they are
    accepted into active scope.
11. Treat the current Display Module and Metadata workflow as the immediate
    proving ground for the wider idea.
12. When visual hierarchy is uncertain, prioritize the artwork and the act of
    composition over application chrome.

The central test is:

> Does this help an asset remain alive, usable, attributable, and capable of
> entering new relationships—or does it put the asset back into another frame?
