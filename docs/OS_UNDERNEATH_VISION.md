# OS_UNDERNEATH

## Product vision

> Your profile is not a page. It is a place.

OS_UNDERNEATH is an alternative viewer and editor for Universal Profiles. It turns a wallet and its contents into a customizable, living desktop: a place where artwork can move, media can be organized and used, applications can be opened, and a resident creature can communicate what is happening.

The canvas is not decoration behind a conventional profile. The canvas is the profile.

This project begins with a personal need. I am a digital illustrator who wants to keep making detailed, strange, dark, highly authored work. I do not want the presentation of that work to end at uploading a file, filling in a biography, and releasing another collection onto a profile made of pages and inventory grids. I want the profile itself to become part of the artwork.

OS_UNDERNEATH is the framework for creating that experience.

## Why this exists

I have released digital artwork before, including a collection of one hundred unique characters that took roughly a year to illustrate. They originally sold for a modest price. The secondary market later valued some of them much more highly, including an individual sale worth more than I earned from much of the original release.

That experience left me with unresolved questions about editions, scarcity and pricing. Should future pieces be unique 1/1 works, 1/1 works with a vaulted copy, or small editions of five or ten? What is a fair price for art that is unusually detailed and takes a meaningful amount of time to produce?

Those questions matter, but OS_UNDERNEATH is not an attempt to manufacture utility solely to justify a price. It comes from wanting to give the artwork a richer life—and wanting to feel that releasing it does not mean reducing it to another thumbnail in an endless inventory.

I want to create complete experiences around my work: characters, patterns, environments, reactive behavior, colors, shaders, sound, dialogue and atmosphere. I want collectors and visitors to receive something that feels considered, expressive and alive.

## The road away from gamification

The project began with a customized Pixi engine originally developed for a more VJ- and music-oriented application. That earlier application allowed NFTs to be combined as visual layers. It worked well as a performance tool, but it was less legible from a collector's perspective.

For OS_UNDERNEATH, the engine was adapted around illustrated flying creatures moving through side-scrolling environments. The layered artwork and shader pipeline immediately created exciting possibilities: character line art could remain crisp while patterns beneath it warped into liquid forms; creatures could float through hand-drawn stages; pointer movement and live data could affect their behavior.

For a full week, the project was pushed toward games. Many directions were prototyped:

- A Tamagotchi-like pet system
- Creature maintenance and progression
- Evolution
- Enemy waves and shooting
- More general game loops and reward systems

Each direction initially felt like the answer. A few hours later, the same problem became visible: it would demand balancing, progression design, content schedules and long-term game development. More importantly, it did not feel like something I would personally return to every day.

The interaction might impress someone once. They could say, “That is cool,” play briefly and leave. Keeping the experience alive would then require continuously creating game content instead of creating the art I actually wanted to make.

The important discovery was not that these ideas were impossible. It was that they answered the wrong question.

The creature does not need to be a game objective. It can be a presence.

The canvas does not need to contain a game. It can contain a profile, a desktop, a collection, a gallery, a music player, an archive and a world.

## The product thesis

OS_UNDERNEATH is a spatial, artist-controlled profile operating system built on top of Universal Profile data.

It should make a profile:

- Expressive rather than standardized
- Organized rather than paginated
- Spatial rather than linear
- Useful rather than merely decorative
- Alive without demanding maintenance
- Extensible without becoming an endless game-development obligation

The central promise is simple:

> Connect a Universal Profile, find any owned asset immediately, organize it into meaningful folders, and place those folders inside a living canvas profile.

Everything else grows from that foundation.

## The identity hierarchy

The project has three related but separate identities.

### OS_UNDERNEATH

OS_UNDERNEATH is the operating system, application and world framework. It owns the startveil, system interface, desktop behavior, modules and profile composition tools.

### HUMAN UNDERNEATH

HUMAN UNDERNEATH is the collection of illustrated flying creatures. These creatures latch onto humans—hence the human underneath them. They inhabit profiles and can act as resident companions, hosts, interpreters and performers.

### The Keeper

The Keeper is the active HUMAN UNDERNEATH creature currently inhabiting a profile. It is the living interface between the visitor, the creator, the collection and incoming activity.

The Keeper should not create chores. It should create presence.

## The canvas is the profile

A conventional profile treats visual customization as a banner, avatar and theme wrapped around a fixed information layout. OS_UNDERNEATH begins from the opposite position.

The stage, Keeper, movement, modules, atmosphere and sound together form the identity. The profile is something a visitor enters.

The owner should eventually be able to author:

- The active Keeper
- The illustrated stage and foreground layers
- Character pattern and palette combinations
- Shader and effect configurations
- Ambient music and sound behavior
- Module and folder placement
- Featured artwork and exhibitions
- Keeper dialogue and personality
- Reactions to visits, transfers, tips and other events
- Shortcuts to media, applications and external platforms

A biography should not be required to explain the creator. The Keeper might welcome a visitor, tell a story, make a joke, introduce a release or guide them toward a hidden folder.

## The practical problem: profile inventory is not organization

Owning hundreds of NFTs should not mean searching through fifteen or nineteen pages to find one item. A wallet inventory is not a usable personal library.

OS_UNDERNEATH should allow owners to create their own organization without moving or wrapping the underlying assets.

Example folders might include:

- My 1/1 Art
- Collected PFPs
- Videos
- Music
- Favorites
- HUMAN UNDERNEATH
- Works by Friends
- Hidden Archive
- Currently Exhibiting

Folders are collections of references to existing assets. They can become launchers on the canvas, open as desktop windows, appear in search results, feed playlists or galleries, and be selectively published to visitors.

This is the first essential utility of the product. The animated world makes it desirable; organization makes it useful.

## Desktop behavior

Desktop behavior does not simply mean making rectangles look like windows. It means giving people the directness and persistence they expect from a personal computer:

- User-created folders and shortcuts
- Persistent spatial arrangements
- Windows that remember their positions
- Search across the complete profile inventory
- Dragging, grouping and favoriting
- Immediate access instead of deep pagination
- Media that can continue playing while other areas are explored
- Different viewers for images, video, audio and interactive work
- A clear distinction between files, applications and presentation
- A public visitor mode and an owner editing mode

The canvas should feel authored, but it should also remain navigable.

## The Keeper as interface

The Keeper can fulfill four roles.

### Host

It welcomes visitors and establishes the personality of the profile.

### Guide

It can point toward featured releases, folders, music, exhibitions and hidden areas.

### Interpreter

LSP1 and profile activity can be translated into understandable moments. Instead of exposing raw blockchain events, the Keeper might say:

> “You received some LYX from this person.”

> “A new piece entered the collection.”

> “Someone collected your latest release.”

The message can be accompanied by movement, particles, sound, color, pattern changes or any other authored reaction.

### Performer

The Keeper can respond to the pointer, visitors, music, modules and live events through animation, dialogue, voice, shaders and effects.

The reaction system should operate on normalized OS events rather than one-off blockchain integrations:

```text
LSP1 notification
Profile update
Asset received or sent
Visitor entered
Module opened
Track started
Tip received
        ↓
Normalized OS event
        ↓
Keeper reaction recipe
        ↓
Movement + dialogue + sound + visual effect
```

This makes reactions another creative medium instead of a growing pile of hard-coded exceptions.

## Media and applications

Owned media should be usable from within the profile.

Music purchased through another platform might appear deep in a conventional asset list. In OS_UNDERNEATH it could be available through a native music module, organized into playlists, mixed with tracks from other artists and played while the visitor continues exploring the canvas.

The same principle applies to:

- Image galleries
- Video players
- Slideshows and exhibitions
- Social photography platforms
- External creative applications
- Playlists and ambient soundscapes

External applications may be embedded when their security and wallet behavior allow it. When embedding is not possible, OS_UNDERNEATH should provide a graceful external-launch experience rather than depending on arbitrary iframes.

## Atelier and the experience manifest

The public canvas renders an experience. Atelier authors it.

The long-term boundary between them should be an experience manifest describing:

- Keeper selection
- Stage and environment
- Theme and colors
- Ambient audio
- Module and folder positions
- Public and private folders
- Featured assets
- Playlists
- Keeper dialogue
- Event reaction mappings
- Visitor-facing shortcuts
- Presentation and accessibility preferences

Initially this manifest can be local prototype data. Later it can be published through decentralized storage and referenced by the Universal Profile.

The public renderer should remain focused on interpreting the manifest. Atelier should remain focused on editing it.

## What this is not

OS_UNDERNEATH is not currently trying to become:

- A combat game
- A creature-stat or progression system
- A feeding or maintenance loop
- A daily quest platform
- A game economy
- A marketplace
- A replacement for every external application
- A generic plugin platform before its core experience exists

Game-like moments, side-scrolling adventures and interactive exhibitions may eventually exist as authored experiences. They are not the foundation and should not dictate the entire product.

The product should remain valuable when the visitor does nothing more than enter, look, listen, browse and move around.

## Creative and commercial possibility

The decision between 1/1 art and small editions does not need to block the product.

OS_UNDERNEATH gives artwork additional expressive space without promising an endlessly maintained game. A HUMAN UNDERNEATH piece can simultaneously be:

- A standalone artwork
- A profile resident
- A visual identity
- A reactive performance
- A stage-compatible character
- Part of a larger authored collection

Different release structures may eventually carry different creative rights or configurations. A 1/1 could have a unique Keeper, environment, dialogue and reaction design. A small edition could share a character archetype while allowing individualized presentation. A broader edition could provide standard resident behavior and artwork.

The application should not exist merely to justify higher prices. Its purpose is to let the art live more fully and let owners genuinely use what they collect.

## Development direction

### First: the personal library

Build one complete useful path:

1. Load a Universal Profile.
2. Normalize its owned assets.
3. Search the complete inventory.
4. Open image, video and audio assets.
5. Create folders and favorites.
6. Add asset references without moving the assets.
7. Persist the organization locally.
8. Turn a folder into a canvas launcher.

This proves that OS_UNDERNEATH is already more useful than browsing pages of inventory.

### Second: author the profile

Use Atelier to choose what becomes public, arrange folders, select the Keeper and stage, configure visual effects and preview the visitor experience.

### Third: make the Keeper reactive

Create reusable dialogue, event and reaction systems. Begin with simulated events, then connect real profile and LSP1 activity.

### Fourth: add focused media applications

Build the music player, playlist editor, gallery, video viewer and exhibition modes as coherent modules.

### Fifth: create authored experiences

Add voice, side-scrolling exhibitions, hidden modules, visitor-triggered scenes, collaborative media and Keeper-specific worlds once the underlying profile utility is stable.

## Guiding principles

1. **The canvas comes first.** The interface should frame the world rather than turning it back into a website.
2. **Art is not content filler.** New systems should create opportunities to illustrate, animate, compose and experiment.
3. **Utility should reduce friction.** Search, folders and media access must solve real profile problems.
4. **The Keeper creates presence, not obligation.** No artificial maintenance or punishment for absence.
5. **Desktop behavior should be genuine.** Persistence and direct access matter more than desktop aesthetics.
6. **Start with one useful vertical slice.** Do not build every possible application at once.
7. **Keep the system modular.** Profile data, organization, rendering, events and Keeper reactions need explicit boundaries.
8. **Do not optimize speculation.** Strengthen confirmed journeys and measure before optimizing.
9. **Respect the visitor's time.** Atmosphere and transitions should feel intentional, not obstructive.
10. **Let the project remain creatively sustainable.** It should encourage making art instead of creating an endless service burden.

## The destination

OS_UNDERNEATH should become a place where a creator can build a profile that could not belong to anyone else.

A visitor enters through a system veil. The world resolves. A Keeper appears. The interface quietly connects. From there, the visitor can browse a deeply organized collection, listen to music, inspect artwork, launch applications and encounter a personality expressed through illustration, movement, sound and live reaction.

The system does not demand that the creator build a game forever. It gives every future artwork somewhere meaningful to live.

```text
OS_UNDERNEATH boots the world.
VXCTXR authors the experience.
HUMAN UNDERNEATH inhabits it.
```
