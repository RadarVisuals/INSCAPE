# Home-world spatial foundation

## Status

The gallery stabilization introduced the first reusable pieces for a two-dimensional home world. The existing home desktop has not yet been migrated to an unbounded coordinate plane. Its authored launcher, artwork, and runtime-window persistence remain unchanged.

Implemented foundations:

- `spatialWorldCamera.js` owns framework-neutral two-axis camera clamping, pointer panning, screen/world conversion, and repeating-grid offsets.
- `SpatialWireframeGrid.jsx` renders a camera-aware full-area orthogonal grid.
- The existing desktop grid now uses `SpatialWireframeGrid` at camera `{ x: 0, y: 0 }`, proving that the reusable renderer preserves the current bounded desktop before camera movement is enabled.
- The gallery uses the shared camera clamp, pointer-pan, and grid-offset math while constraining its Y axis to zero.

## Intended compositor

```text
world architecture / spatial grid
        -> authored launchers and canvas objects
        -> transparent Pixi resident layer
        -> fixed system bar, menus, inspectors, previews
```

The gallery now follows this order. The home migration should use the same explicit layer boundary rather than relying on child `z-index` values inside one interface stacking context.

## Home interaction contract

- Empty-space click moves the Keeper and does not move the camera.
- Empty-space drag beyond a small threshold pans the camera on both axes.
- Controls, launchers, artwork, windows, resize handles, and menu surfaces never initiate world panning.
- The grid covers the complete viewport and moves continuously with the camera.
- The system bar remains fixed and floats above the world.
- Keyboard camera movement needs an explicit accessible command/focus mode so arrow keys inside applications retain their native behavior.
- Mobile retains a bounded/stacked presentation until touch panning and application scrolling can be separated reliably.

## Coordinate and persistence boundaries

The reusable camera expresses the viewport origin in world pixels:

```text
screen = world - camera
world = screen + camera
```

Camera position is runtime navigation state. It should be profile-scoped local state and should not enter a portable public profile document by default.

Authored launcher and canvas-object positions are public presentation. Migrating them from bounded grid cells to spatial coordinates requires a deliberate workspace/profile-document version change. Existing positions should map deterministically into an initial world region; the migration must preserve ordering, spans, visibility, folders, start-open configuration, and object references.

Runtime windows need a separate product decision before migration:

- viewport-anchored windows behave like fixed OS applications while the authored world pans behind them;
- world-anchored windows behave like spatial objects and pan with the desktop.

The current runtime-window model remains untouched until that choice is reviewed.

## Next integration slice

1. Add profile-scoped runtime camera state with a reset-to-origin command.
2. Expand the desktop world layer to the viewport and render the wireframe grid continuously, not only in Arrange mode.
3. Route empty-canvas pointer gestures through the shared pan threshold while preserving the existing context-menu and Keeper click routes.
4. Apply camera transforms to launchers and canvas objects through one world container.
5. Convert pointer coordinates to world coordinates before placement, drag, resize, and context-menu creation.
6. Add deterministic migration and portable-document coverage before allowing authored positions outside the old bounded grid.
7. Decide window anchoring, then migrate runtime geometry separately from authored presentation.

## Gallery stabilization captured by this foundation

- Gallery architecture and framed artwork are portaled below the transparent resident canvas.
- The fixed public interface remains above the resident.
- Horizontal gallery navigation changes only the Keeper's local X target and preserves the existing local Y target exactly.
- Clicking any empty gallery area only moves the Keeper; it never triggers camera scrolling.
- Drag, wheel, arrows, Home/End, and explicit gallery buttons remain camera-navigation inputs.
