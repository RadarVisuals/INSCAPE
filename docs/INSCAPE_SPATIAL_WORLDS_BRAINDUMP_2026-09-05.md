# INSCAPE: compositions inside a larger world

Date: 2026-09-05

Status: founder-requested brainstorm recap. This records possibilities discussed
in conversation, not an implementation plan or a replacement for accepted scope.
[The active contract](INSCAPE_ACTIVE_CONTRACT.md) remains product authority;
[creative intent](INSCAPE_CREATIVE_INTENT.md) supplies product-meaning context.
Enthusiasm here does not mean a feature is implemented or scheduled.

## The connection we arrived at

An artist could compose with assets inside a Display Module, then arrange several
Display Modules into a larger composition. Each module could provide a different
experience. Visitors could receive that authored arrangement inside one outer
Display Module, with its interactions intact.

The founder's phrase was: "and make it behave just the same".

A sideways exhibition, a sequence of layered scenes, and a place inhabited by a
Keeper could belong to the same world. Special transition frames could lead into
other profiles' worlds. Over time, this could feel like an expanding universe of
connected art.

## Why this came up

The current interface sometimes felt like a dashboard. The founder initially
considered removing the UI, then chose to improve it instead. The 16:9 boundary
had a useful purpose: knowing where a composition ends and preserving its
arrangement when displayed at different sizes.

Older wireframe studies had a different strength. Space-dragging beyond the
visible frame and releasing still felt like being in the same canvas. Moving
down revealed a floor; moving up revealed a ceiling. Sideways movement felt
continuous, whereas the current Grid transition feels like another slide.

The founder remembered why that earlier approach was discarded: side-scrolling
alone mostly supported hanging individual pieces, and did not yet have the
composing and layering purpose that developed later. The conversation therefore
was not a request to restore the old prototype wholesale.

## The artwork supplies the purpose

Affinity studies showed a landscape, a character on the ground, and a purple beam
as separate reusable elements. Arrival and Removal scenes combined these with
other creatures and narrative text. These could form a slideshow through Grids.
The same pieces could return in other compositions and eventually be animated.

A portrait study mirrored the terrain into a ceiling above the landscape. That
made mixed horizontal and vertical compositions worth discussing. Neither a
universal portrait format nor arbitrary Stage ratios was settled.

The founder considered minting prepared pieces into an LSP8 collection outside
INSCAPE. This was asset-preparation context, not a request for minting features or
a finalized collection or metadata design. The messy Affinity workspace showed
the preparation process; it was not automatically a specification for INSCAPE.

## Multiple Display Modules, different experiences

The founder proposed multiple Display Modules rather than forcing the whole
application into a single navigation style. For example:

- A lower section could scroll sideways along independently presented artworks,
  with a floor providing perspective.
- A middle section could retain bounded composition and layering, with swiping
  between Grids.
- An upper section could house the creature and possibly its customization,
  with a ceiling, floor, or an opening into an adjoining space.

These are examples of arrangements, not a mandatory three-floor architecture.
The founder explicitly described "side scrolling in one module, drag swiping in
another". The modules' placement could itself create relationships between
scenes: stacked, adjacent, separated, or connected visually.

Whether the creature's customization area belongs to a visitor world or only to
the owner's workspace remains open. The founder was connecting ideas and did
not want every possibility turned immediately into another product decision.

## Frames with quieter controls

Repeated title bars, names, and addresses could overwhelm a multi-module layout.
The founder suggested a choice similar to Metadata's inside/sidecar controls:
keep module controls above the frame, or bring the icons inside it and collapse
the full title bar. The frame itself is not necessarily the problem.

Assistant suggestions, not finalized interaction design: keep inside controls
readable over artwork, retain access to trusted publishing identity, and provide
a clear grip for moving a module. Moving a module, navigating its content, and
editing a placement need distinguishable gestures. Controls should not change
authored geometry or become artwork merely because they appear inside a frame.

## Visitors receive the interactive arrangement

The founder proposed presenting the arrangement inside one large Display Module
for visitors. The important ambition is to preserve the behavior as well as the
appearance: a scrolling inner module still scrolls, and a Grid sequence still
swipes. It is not intended as a flattened screenshot of the owner's screen.

We discussed fitting a fixed outer composition to the visitor's available space
without rearranging its contents. A screen is not necessarily 16:9, even when
the Stage is. Multiple 16:9 modules also do not automatically form a 16:9 outer
arrangement. The outer dimensions and fitting rules are still undecided.

The assistant distinguished deliberately authored public module arrangements
from incidental editor window positions. Publishing the former would be a new
capability; the current contract keeps Workbench geometry and tools private.
Visitor exploration and owner editing permissions also remain distinct. Exactly
which movements are part of the artwork is unresolved.

## The Keeper and connected worlds

The founder imagined one Keeper literally gliding from one module into another.
The desired impression is continuity of an entity across spaces. Its relationship
to module clipping, depth, scene state, and publication is not designed. This
extends beyond the existing creative-intent description of a resident behind
Workbench modules; it must not silently replace that description.

The founder also proposed clicking a special transition frame into another
profile. Such a frame could be authored as part of a scene while linking to
another artist's published world.

Assistant suggestions: make the destination identity clear, provide a way back,
and load bounded portions of a world as needed. These support the idea of a world
that feels endless; no unlimited nesting or runtime architecture was agreed.

## Perspective and ideas explicitly left outside current work

Wireframe rooms, scaling, overlap, and mirrored artwork suggested combinations
of 2D art and apparent 3D space. These screenshots do not establish a requirement
for a full 3D engine or prove an existing implementation.

Webcam/head-tracked perspective was briefly imagined as a way to look into a
framed shaft while a creature appears aware of the viewer. The founder explicitly
said not to build that in INSCAPE now. No webcam, head tracking, 3D system, or
animation module was authorized by this conversation. The proposed navigation
experiment was also declined; discussion continued instead.

## What remains current

The single bounded 16:9 Stage remains the working baseline. The immediate work
is a usable Library and dependable asset placement, composition, saving, and
presentation. The founder chose concrete Library improvements during this
discussion: right-edge resizing, inset artwork scrolling within an edge-aligned
panel, and staying open during ordinary Workbench interactions. Reopening should
preserve browsing context rather than repeatedly reset to All Assets.

This recap preserves the larger possibility without turning it into a backlog.
Before implementing it, the unresolved boundaries include authored versus local
module arrangement, module-specific navigation, mixed aspect ratios, visitor
fitting and close inspection, Keeper continuity, and profile-to-profile travel.

## Visual references

The conversation contains the Affinity Arrival/Removal studies, portrait mirror
composition, upper/middle/lower wireframe diagrams, creature depth studies, and
the multi-Display-Module mockup. They were supplied as conversation images; this
document does not create local copies or claim to archive their original files.
