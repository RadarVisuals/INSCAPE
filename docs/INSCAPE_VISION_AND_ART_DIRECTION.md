# INSCAPE: Product Vision and Art Direction

Status: canonical north star
Date: 2026-07-26
Related interaction contract: [INSCAPE Canvas Lattice](./INSCAPE_CANVAS_LATTICE.md)

## The statement

> Your profile is not a page. It is a place.

INSCAPE is a spatial presentation system for Universal Profiles. It lets an artist, collector, or creator transform public on-chain inventory into a selective, authored profile experience.

It is not another wallet inventory, marketplace grid, or social profile with a different skin. It is a place for deciding what deserves to be seen, how it should be encountered, and what kind of atmosphere surrounds it.

The defining interaction is simple:

> The interface stays still. The profile moves beneath it. Movement is free; arrival is exact.

## Why INSCAPE exists

Blockchain ownership is not the same as presentation.

A Universal Profile can contain art, editions, music, video, tokens, experiments, purchases, gifts, abandoned work, and years of activity. A conventional inventory exposes those things, but does not create hierarchy or meaning. Everything becomes another item in a list.

INSCAPE gives the owner an editorial layer without changing the underlying assets. The owner can organize what they hold, distinguish public presentation from private organization, and construct a profile around the work they actually want people to remember.

The product begins with a personal artistic need: digital work should not stop living when it is minted. Its presentation should be capable of carrying the same care, tension, rhythm, and identity as the artwork itself.

INSCAPE therefore serves two needs at once:

- A practical need for finding, sorting, and structuring Universal Profile assets.
- A creative need for presenting selected work as an authored experience.

Utility makes the system usable. Art direction makes it desirable.

## Identity architecture

The project contains related identities that must remain distinct.

### INSCAPE

INSCAPE is the application and presentation architecture. It owns the interface, grid, canvas lattice, templates, organization tools, publication flow, public profile renderer, and shareable profile identity.

INSCAPE should feel neutral enough to frame many creators, but authored enough that it is immediately recognizable.

### HUMAN UNDERNEATH

HUMAN UNDERNEATH is the artistic identity and body of work. It can inhabit INSCAPE without becoming the name of the software itself.

This separation protects both identities. INSCAPE can become useful to other people. HUMAN UNDERNEATH can remain mysterious, confrontational, and artistically specific.

### KEEPERS

KEEPERS is the character and NFT collection. Keepers are illustrated entities that attach themselves to a human presence and inhabit the profile system.

### The Keeper

The Keeper is the active resident of an INSCAPE profile. It is not a pet that creates chores and not an assistant that pretends to know everything. It is a host, witness, guide, and performer.

### The Underneath

The Underneath is the illustrated world in which Keepers may eventually move freely. It is a future authored environment and not the alpha navigation model.

## The product thesis

INSCAPE is a profile presentation instrument built on top of public Universal Profile data.

It should make a profile:

- Selective instead of exhaustive.
- Authored instead of standardized.
- Spatial instead of paginated.
- Legible instead of chaotic.
- Alive without demanding maintenance.
- Distinct without requiring the owner to become a designer.
- Extensible without exposing unfinished systems in the alpha.

The owner decides what the profile means. INSCAPE preserves the visual and interaction integrity of how it is shown.

## The central product model

INSCAPE consists of a fixed interface surrounding a movable canvas lattice.

The person using the application remains at one stable viewing position. The grid and the presentation canvases move underneath that position. The interface does not travel with the world.

For alpha, the lattice contains five canvases arranged around one central entry canvas:

```text
              [ CANVAS ]

[ CANVAS ]  [ CANVAS ]  [ CANVAS ]

              [ CANVAS ]
```

The user may pull this lattice freely in any valid direction. During the gesture the movement is continuous and physical. On release the lattice resolves to the nearest valid canvas and locks into exact alignment.

This is neither a carousel nor unrestricted camera navigation. It combines the tactile quality of a spatial canvas with the clarity of discrete destinations.

The metaphor is a presentation table:

- The viewer remains seated at one position.
- The interface forms the instrument panel around that position.
- A complete canvas is placed in front of the viewer.
- The surrounding canvases remain spatially connected.
- Pulling the table reveals the next composed surface.

The movement should feel like handling something large, precise, and physical.

## Authored templates, not compulsory design work

Free placement is powerful for artists who enjoy constructing compositions, but it cannot be the only way to create a good profile. Most people who want to showcase or sell an NFT should not first have to learn spatial layout, responsive composition, layering, and viewport management.

Every alpha canvas therefore uses an authored template.

The owner controls:

- Which assets appear.
- Their order.
- Which information is visible.
- Public or private presentation.
- Surface and interface palette.
- Template-specific emphasis.

INSCAPE controls:

- Responsive layout.
- Alignment and spacing.
- Typographic hierarchy.
- Native artwork proportions.
- Safe minimum and maximum sizes.
- Interaction behavior.
- Visitor consistency.

Templates may eventually include forms such as Hero, Archive, Collection, Pair, Identity, and Drop. These names and the exact five alpha assignments must be validated in the lattice prototype before they become part of the published schema.

The principle is already fixed: a creator selects and directs; the system composes.

## The practical foundation

Before a profile can be presented, its inventory must become usable.

INSCAPE provides an owner-facing browser that can:

- Resolve owned assets from a Universal Profile.
- Preserve real metadata and never invent missing data.
- Search and filter the asset pool.
- Separate filed and unfiled assets.
- Create private organizational folders.
- Publish selected folders as public categories.
- Distinguish owned assets from authored creations.
- Select assets for presentation canvases.

Folders organize the owner workspace. Categories communicate public structure. Canvases present selected work. These are related but not interchangeable concepts.

## Owner and visitor experiences

The owner and visitor share the same published profile presentation, but they do not share the same authority or interface burden.

### Owner

The owner can organize assets, configure categories, assign content to canvas templates, preview the public result, and publish a signed profile document.

Owner tools should remain close at hand but visually secondary to the presentation itself.

### Visitor

The visitor encounters only what the owner chose to publish. Private folders, unpublished artwork, authoring state, and owner utilities must remain absent.

The visitor can move across the lattice, inspect the presented work, open permitted metadata, follow external links, and encounter the Keeper. They should never need to understand the author's editing system.

The public presentation must be deterministic across profile accounts, browser sessions, iframe sizes, and direct visits.

## Publication and ownership

An INSCAPE profile is a portable published document associated with a Universal Profile.

The intended trust boundary is:

1. The owner edits a private local draft.
2. The owner previews a public projection of that draft.
3. The public document is uploaded to IPFS.
4. The profile publishes a reference through an authorized wallet action.
5. Visitors resolve and validate the referenced public document.

Local drafts and public presentations are not the same state. Signing in as the owner must not replace the published visitor presentation with an empty or unrelated local workspace. Profile identity, document ownership, and publication authority must remain explicit throughout the runtime.

## The Keeper

The Keeper gives the system presence.

It can serve four roles:

### Host

The Keeper welcomes the visitor and establishes the character of the profile.

### Guide

The Keeper may draw attention to a featured canvas, new release, category, or hidden detail.

### Interpreter

The Keeper can translate profile activity and NFT metadata into authored reactions. It does not need unrestricted AI access to feel personal.

An owner or asset creator may provide structured stories, remarks, jokes, or cues through supported metadata. The Keeper can interpret those authored ingredients without fabricating claims about the work.

### Performer

The Keeper responds through movement, orientation, trails, shaders, sound, dialogue, and event reactions.

The Keeper must create presence rather than obligation. There is no feeding loop, punishment for absence, artificial mood maintenance, or progression treadmill.

The Keeper Dock is part of the fixed interface. Docking provides a deliberate resting state and keeps the canvas available without removing the resident from the identity of the profile.

## Visual character

INSCAPE should feel like an archival instrument placed inside an impossible spatial system.

It combines:

- Museum and archive precision.
- Technical dossier typography.
- Near-black spatial depth.
- Off-white paper surfaces.
- Thin structural lines.
- Large areas of deliberate emptiness.
- Small, exact labels.
- Artwork presented without decorative competition.

The result should not resemble a generic crypto dashboard, game HUD, operating-system parody, or fashionable glass interface.

The interface is quiet architecture. The artwork and Keeper are the volatile occupants.

## Palette system

The visual system is built around polarity rather than one global dark-mode switch.

Three layers may use coordinated or contrasting palettes:

- Surface: the spatial grid and canvas environment.
- Menus: the profile rail, owner toolbar, browser, controls, and Keeper Dock.
- Dossier: the shareable profile identity and related editorial cards.

These layers can match or invert independently. A carbon environment may carry paper menus. A warm paper surface may carry a charcoal dossier. The contrast is part of the authorship, not an accessibility afterthought.

The palette family moves through a controlled tonal range:

- Carbon: near-black, but never featureless pure black.
- Graphite: the dark midpoint.
- Slate: a clear neutral gray.
- Ash: a light structural gray.
- Mist: a warm gray derived from paper.
- Paper: the light archival surface.

Pure black should not become the default panel color. Flat charcoal has more material presence and produces better line definition.

Noise is used sparingly. Paper may carry a subtle physical grain and vignette. Dark surfaces remain predominantly flat so they do not become dirty or visually cheap.

Color outside this neutral architecture belongs primarily to artwork, the Keeper, live state, or a rare semantic signal.

## Grid and line language

The grid is the continuous architectural substrate of INSCAPE.

It should:

- Continue across canvas boundaries during movement.
- Align exactly when a canvas reaches rest.
- Remain subordinate to artwork.
- Change contrast with its surface palette.
- Avoid decorative double lines and accidental mismatches.
- Provide orientation without becoming a spreadsheet.

Borders use one-pixel structural lines wherever possible. Selection is indicated by one localized edge, change in tone, or precise focus treatment. Persistent orange rails and unrelated legacy accents do not belong to the current system.

## Typography

Typography has explicit roles.

### Geist Sans

Used for readable interface information, profile biographies, descriptions, titles, and longer content.

### IBM Plex Mono

Used for technical labels, small caps, coordinates, metadata keys, counts, state, and system language.

### HVariant

Used only for the INSCAPE signature and rare identity moments. It is not a general interface font.

### Additional prototype faces

Geist Mono and Space Mono may remain available for controlled comparison in prototypes. Production should settle on a small, deliberate role-based set rather than expose arbitrary font switching.

Typography should be compact, but never microscopic. Technical restraint is not permission to make important information difficult to read. Primary controls and titles establish hierarchy; secondary labels remain quieter but legible.

## Artwork treatment

Artwork is not content filler.

INSCAPE must respect the work as published:

- Preserve native aspect ratio.
- Avoid automatic square crops.
- Support portrait, landscape, square, animated, and transparent assets.
- Distinguish transparent presentation from framed presentation.
- Avoid adding mats, borders, shadows, or backgrounds that the owner did not choose.
- Keep presentation stable across supported viewport sizes.
- Never hide missing metadata behind fabricated replacement content.

The system may normalize layout geometry, but it must not normalize the artwork itself into sameness.

## Shareable identity

The shareable profile dossier is the compressed identity of an INSCAPE profile.

It combines:

- Verified profile identity.
- Avatar or emblem.
- Profile name and address fragment.
- Biography and tags.
- Relevant asset or collection counts.
- Network identity.
- Public profile URL.
- A direct sharing action.

It uses the same archival language as the application and can carry its own palette independently from the surrounding surface. It should feel like an issued identity object, not a social-media statistic card.

## Motion language

Motion explains structure.

The primary movement is the canvas lattice travelling beneath a fixed interface. It must remain direct enough to preserve spatial continuity and restrained enough not to delay access.

Motion principles:

- Input follows the pointer without lag.
- Release creates one confident snap.
- Small gestures return to origin.
- Edge resistance communicates a boundary.
- Neighboring canvases remain physically connected.
- Text does not visibly compress during container animation.
- Content changes happen near the visual midpoint of a flip, never while facing the viewer.
- Focus and Escape behavior remain predictable.
- Reduced-motion preferences receive a functional, non-disorienting equivalent.

Flicker, glitch, fold, shader distortion, and perspective are expressive materials. They should mark meaningful transitions or authored events, not decorate every interaction.

## Sound

Sound is optional and subordinate.

Future profiles may include ambient audio, music, Keeper voice, or event signals. Audio must never begin unexpectedly without clear consent, block navigation, or become required to understand the interface.

## Alpha product

The alpha proves one complete journey:

1. Connect a Universal Profile.
2. Resolve and search its assets.
3. Organize assets into private folders and public categories.
4. Select content for five templated canvases.
5. Move through the lattice with free drag and exact snap.
6. Preview the visitor presentation.
7. Publish a validated profile document to IPFS.
8. Discover and visit other published INSCAPE profiles.
9. Share a profile URL and identity dossier.

The alpha should feel complete within this boundary.

## Explicit alpha exclusions

The alpha does not expose:

- Freeform Gallery authoring.
- Upper World or vertical floors.
- The illustrated Outside World.
- The Underneath free-roam experience.
- Social feeds or the Social Table.
- Hidden diagonal canvases.
- Animated composition tools.
- Collaborative authoring.
- A marketplace.
- Keeper progression or maintenance.

These systems are not rejected. They are protected from being shipped before their role is clear.

## Future extensions

The canvas lattice is designed to expand without replacing its central interaction.

Possible future tables include:

- Social Table: a spatial feed and conversation surface.
- Studio: advanced composition, layering, animation, and emblem construction.
- Gallery: freeform exhibitions for owners who want full spatial authorship.
- Archive: deeper collection and provenance exploration.
- Media Table: music, video, playlists, and ambient presentation.
- Collaborative Table: shared curation or exhibitions.
- Hidden canvases: diagonal, unlocked, event-driven, or collectible spaces.

Beyond the lattice, the Underneath may eventually open as a deliberately separate free-roam world with illustrated side-scrolling environments, sound, dialogue, and Keeper-specific encounters.

That world should feel like crossing a boundary, not like opening another menu.

## What INSCAPE is not

INSCAPE is not:

- A generic website builder.
- A marketplace inventory with themes.
- A replacement for the Universal Profile standard.
- A game economy.
- A Tamagotchi maintenance loop.
- An AI companion making unsupported claims.
- An infinite desktop that forces every user to design a layout.
- A showcase for every experiment at once.

The product remains valuable when a visitor only enters, moves, looks, reads, and remembers one work.

## Decision test

Every new feature should answer five questions:

1. Does it help an owner organize or present what matters?
2. Does it preserve clarity for a first-time visitor?
3. Does it strengthen the fixed-interface and moving-profile model?
4. Does it respect artwork and real profile data?
5. Can it remain creatively and technically sustainable?

If a feature is impressive but weakens those answers, it belongs in a prototype or later table rather than the alpha.

## Destination

INSCAPE should become a place where a creator can build a profile that could not belong to anyone else without having to invent an interface from nothing.

A visitor passes through the startveil. The lattice resolves beneath a fixed instrument panel. A Keeper occupies the profile. One composed canvas rests in front of the visitor while other parts of the identity remain spatially connected around it.

The visitor pulls another canvas into place. The grid aligns. Artwork appears at its intended proportion. The profile reveals itself through selection, sequence, contrast, and presence.

The software does not ask every owner to become a world builder. It gives them a strong architecture and lets their work determine what the architecture becomes.

```text
INSCAPE provides the instrument.
The profile owner composes the presentation.
The Keeper gives it presence.
HUMAN UNDERNEATH inhabits the deeper world.
```
