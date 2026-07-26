# INSCAPE Canvas Lattice

Status: locked product direction
Scope: alpha interaction model
Date: 2026-07-26

## Core idea

INSCAPE is a fixed viewing and control surface through which a spatial arrangement of presentation canvases moves.

The person using INSCAPE remains in one stable position. The profile rail, workspace controls, Keeper Dock, branding, and navigation indicator remain fixed. The grid and everything placed on its canvases move underneath that interface.

This keeps the physical, spatial character of INSCAPE without requiring people to design or navigate an unrestricted world.

## Alpha structure

The alpha provides one bounded lattice containing five presentation canvases:

```text
              [ CANVAS ]

[ CANVAS ]  [ CANVAS ]  [ CANVAS ]

              [ CANVAS ]
```

The center canvas is the natural entry position. The exact presentation templates assigned to the five positions remain configurable and should be validated in the prototype before their names and purposes are frozen.

The alpha does not present these canvases as separate rooms, floors, pages, or browser windows. Together they form one profile presentation.

## Movement contract

Movement is continuous while the user is interacting and discrete when the interaction ends.

- The user may drag the lattice freely in any direction.
- Mouse, touch, trackpad, and pointer gestures follow the same spatial model.
- Horizontal, vertical, and diagonal movement are supported where a neighboring canvas exists.
- Nearby canvases move as part of one continuous grid; there is no cross-fade or disconnected carousel transition.
- On release, the lattice resolves to the nearest valid canvas position and snaps exactly into place.
- A movement below the activation threshold returns to the current canvas.
- Velocity may complete a deliberate flick, but must not make minor pointer movement change direction unexpectedly.
- Invalid outer-edge movement meets resistance and returns to the nearest valid position.
- The resting state never retains an arbitrary camera offset.

The persisted navigation state is a canvas coordinate, not an unrestricted camera position.

## Presentation contract

Each canvas uses an authored layout template rather than requiring free placement.

Users choose content, ordering, visibility, and presentation options. INSCAPE owns layout integrity, responsive behavior, spacing, and alignment. Native artwork proportions should be respected and arbitrary cropping avoided.

The system must work for people who want to present or sell NFTs without first becoming interface designers.

## Stable interface

The following elements do not move with the lattice:

- Profile and navigation rail
- Owner workspace toolbar
- Keeper Dock
- INSCAPE identity
- Canvas position indicator or minimap

The position indicator must make the active canvas and available neighboring directions legible without dominating the work.

## Alpha exclusions

The following systems are deliberately not part of the visible alpha experience:

- Freeform Gallery authoring
- Upper World or top room
- Vertical floors and room transitions
- Outside World
- Social feed canvas
- Unlockable or hidden diagonal canvases
- Animated freeform compositions

Existing experimental work should be preserved outside the alpha runtime path rather than treated as the primary navigation model.

## Future expansion

The lattice can later grow without changing its interaction contract. Potential additions include:

- A Social Table containing public feeds and conversations
- Additional templates for drops, collections, archives, and identity
- Diagonal or unlockable canvases
- Collaborative canvases
- Animated compositions
- An advanced freeform Studio or Gallery

These are extensions of the lattice, not requirements for alpha.

## Product principle

> The interface stays still. The profile moves beneath it. Movement is free; arrival is exact.
