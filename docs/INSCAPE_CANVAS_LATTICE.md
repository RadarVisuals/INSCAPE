# INSCAPE Table Lattice

Status: locked product direction
Scope: alpha interaction model
Date: 2026-07-26

## Core idea

INSCAPE is a fixed viewing and control surface through which a permanent spatial arrangement of nine authored tables moves.

The person using INSCAPE remains in one stable position. The profile rail, workspace controls, Keeper Dock, branding, and navigation indicator remain fixed. The grid, tables, and everything placed on them move underneath that interface.

This keeps the physical, spatial character of INSCAPE without requiring people to design or navigate an unrestricted world.

## Alpha structure

The Alpha provides one bounded 3 x 3 lattice containing nine authored tables:

```text
[ TABLE 01 ] [ TABLE 02 ] [ TABLE 03 ]
[ TABLE 04 ] [ TABLE 05 ] [ TABLE 06 ]
[ TABLE 07 ] [ TABLE 08 ] [ TABLE 09 ]
```

The center table at coordinate `{ x: 0, y: 0 }` is the session entry position. Active-table navigation is runtime state and is not published as profile identity state.

The Alpha does not present these tables as separate rooms, worlds, pages, or browser windows. Together they form one profile presentation.

## Movement contract

Movement is continuous while the user is interacting and discrete when the interaction ends.

- The user may drag the lattice freely in any direction.
- Mouse, touch, trackpad, and pointer gestures follow the same spatial model.
- Horizontal, vertical, and diagonal movement are supported where a neighboring table exists.
- Nearby tables move as part of one continuous grid; there is no cross-fade or disconnected carousel transition.
- On release, the lattice resolves to the nearest valid table position and snaps exactly into place.
- A movement below the activation threshold returns to the current table.
- Velocity may complete a deliberate flick, but must not make minor pointer movement change direction unexpectedly.
- Invalid outer-edge movement meets resistance and returns to the nearest valid position.
- The resting state never retains an arbitrary camera offset.

The resting navigation state is a table coordinate, not an unrestricted camera position. The session entry remains the center table.

## Presentation contract

Each table is a freely authored composition surface using normalized deterministic geometry.

Owners choose content, placement, size, crop, overlap, layer, mat/backplate, ordering, visibility, labels, and presentation options. Strong starting arrangements may assist authorship but are not compulsory templates. INSCAPE owns projection integrity, table bounds, interaction behavior, and visitor consistency. Native artwork proportions are respected and cropping occurs only through explicit authoring.

The system must work for people who want to present or sell NFTs without first becoming interface designers.

## Stable interface

The following elements do not move with the lattice:

- Profile and navigation rail
- Owner workspace toolbar
- Keeper Dock
- INSCAPE identity
- Table position indicator or minimap

The position indicator must make the active table and available neighboring directions legible without dominating the work.

## Alpha exclusions

The following systems are deliberately not part of the visible alpha experience:

- Legacy Gallery room
- Upper World or top room
- Vertical floors and room transitions
- Outside World
- Social feed table
- Unlockable or hidden diagonal tables
- Animated freeform compositions

Gallery and Upper World are excluded from the Alpha experience. Their historical persisted data and compatibility readers must remain readable until a separately approved migration or retirement pass. They must not be deleted, reinterpreted, or silently remapped into the table lattice.

Any persisted five-table workspace-v8 input is **LEGACY COMPATIBILITY INPUT — NOT THE TARGET MODEL.** It may remain readable for backwards compatibility, but it does not define the permanent nine-table topology or its future published schema.

## Future expansion

The lattice can later grow without changing its interaction contract. Potential additions include:

- A Social Table containing public feeds and conversations
- Additional templates for drops, collections, archives, and identity
- Diagonal or unlockable tables
- Collaborative tables
- Animated compositions
- An advanced freeform Studio or Gallery

These are deferred extensions of the lattice, not requirements for Alpha.

## Product principle

> The interface stays still. The profile moves beneath it. Movement is free; arrival is exact.
