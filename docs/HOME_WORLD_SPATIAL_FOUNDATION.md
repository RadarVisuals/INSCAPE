# Home-world spatial foundation

## Status

The public home now runs as a stage-free, vertically navigated grid world. The horizontal camera position is fixed, zoom is fixed at 100%, and desktop wheel input moves only along the vertical axis. Empty-space dragging is deliberately inert so placed objects retain a stable directional frame.

The illustrated/shader stage, foreground layers, and screen treatment remain implemented and editable in Atelier, but public home and gallery presentation deliberately omit them. They are reserved for a future dedicated free-roam mode.

Authored launcher, artwork, and runtime-window persistence remain compatible with the bounded grid schema. Existing profile-scoped camera records remain readable, but the effective home camera normalizes their horizontal position and zoom to the vertical-world contract.

Implemented foundations:

- `verticalHomeWorld.js` owns the three-viewport world dimensions, centered origin, authorable placement geometry, and initial fixed-X camera.
- `homeWorldCamera.js` retains bounded, profile-scoped camera persistence and provides the vertical camera clamp used by owner and visitor worlds.
- `spatialWorldCamera.js` remains the framework-neutral shared primitive for drag-threshold/click routing and for the separately horizontal gallery camera.
- `HomeWorldSurface.jsx` portals the near-black grid below the transparent Keeper canvas, suppresses click activation after a drag gesture, and handles passive-safe vertical wheel navigation.
- `ModuleGridShell.jsx` and `PublishedHomeWorld.jsx` project authored launchers and artwork through the same vertical camera contract.
- Runtime windows remain viewport-fixed while the authored grid, launchers, and canvas artwork move vertically behind them.
- The former home navigator, drag-panning, keyboard panning, pinch zoom, and zoom controls are not part of the current home interaction.

## Intended compositor

```text
world architecture / spatial grid
        -> authored launchers and canvas objects
        -> transparent Pixi resident layer
        -> fixed system bar, menus, inspectors, previews
```

The home and gallery follow the same root compositor boundary. The public stage is not part of this stack. Atelier retains the stage system for authoring and future free-roam work.

The vertical architecture now reserves three explicit spatial levels: an unassigned Upper world at `-1`, Home at `0`, and Gallery at `+1`. `UpperWorldSurface.jsx` contains the empty architectural surface and inverse transition primitives. Subtle spatial arrows connect the three levels, but the Upper world deliberately has no product label, content, or dock destination until its role is defined.

## Home interaction contract

- Empty-space click moves the Keeper and does not move the camera.
- Empty-space drag beyond the movement threshold does not pan the camera and does not activate a Keeper move.
- Desktop wheel input uses `deltaY` only. Horizontal-only wheel input and Ctrl+wheel are ignored.
- The desktop camera keeps one fixed horizontal position and zoom level while its vertical position is clamped to the reachable world.
- Controls, launchers, artwork, windows, resize handles, and menu surfaces do not initiate home-camera movement.
- The grid covers the complete viewport and moves vertically with the camera.
- The system bar remains fixed and floats above the world.
- Arrow keys remain available to focused controls and applications; there is no global keyboard camera mode.
- Compact/mobile presentation uses its bounded stacked layout and native vertical scrolling rather than the desktop camera interaction.

## Coordinate and persistence boundaries

The effective desktop home camera expresses the viewport origin in world pixels:

```text
screenX = worldX - fixedCameraX
screenY = worldY - cameraY
```

Camera position is runtime navigation state. It is profile-scoped local state and does not enter the portable public profile document.

Desktop placement uses one signed, bounded grid contract. Positions are integer `{ column, row }` origins in the range `-255` through `255`; spans are positive integer grid-cell counts. Negative columns and rows are intentional: they identify cells left of or above the world origin. They are not corrupt values and they are not camera coordinates.

- Launchers and canvas artwork are world-anchored. They move vertically on screen when the camera moves.
- Desktop authoring restricts placement to the columns intersecting the fixed horizontal viewport while retaining the existing signed grid vocabulary.
- Runtime windows persist rectangles in the same grid vocabulary, but remain viewport-fixed while the camera moves.
- Portable profile documents validate the same signed placement bounds. A builder drops malformed local geometry, and an imported document outside the bounds is rejected.
- Camera position uses world pixels and is never copied into authored placement fields.

Authored launcher and canvas-object positions remain public presentation. A future migration from bounded grid cells to unrestricted spatial pixel coordinates would require a deliberate workspace/profile-document version change. That migration must preserve ordering, spans, visibility, folders, start-open configuration, and object references.

Runtime windows need a separate product decision before migration:

- viewport-anchored windows behave like fixed OS applications while the authored world scrolls behind them;
- world-anchored windows would behave like spatial objects and scroll with the desktop.

The current runtime-window model remains untouched until that choice is reviewed.

## Next integration slice

1. Settle the fixed, always-reachable navigation surface without shifting the authored grid layout.
2. Visually tune grid scale, contrast, initial object composition, and Keeper depth against representative profiles.
3. Add deterministic migration and portable-document coverage before changing the current bounded placement contract.
4. Decide whether any window type should optionally become world-anchored; runtime windows are viewport-fixed today.
5. Define a dedicated free-roam mode before reconnecting the preserved stage renderer to public navigation.

## Gallery stabilization captured by this foundation

- Gallery architecture and framed artwork are portaled below the transparent resident canvas.
- The fixed public interface remains above the resident.
- Horizontal gallery navigation changes only the Keeper's local X target and preserves the existing local Y target exactly.
- Clicking any empty gallery area only moves the Keeper; it never triggers camera scrolling.
- Drag, wheel, arrows, Home/End, and explicit gallery buttons remain gallery camera inputs. This horizontal gallery contract does not apply to the vertical home world.
