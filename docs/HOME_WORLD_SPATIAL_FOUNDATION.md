# Home-world spatial foundation

## Status

The public home now runs as a stage-free two-dimensional spatial world. The illustrated/shader stage, foreground layers, and screen treatment remain implemented and editable in Atelier, but public home and gallery presentation deliberately omit them. They are reserved for a future dedicated free-roam mode.

Authored launcher, artwork, and runtime-window persistence remain compatible with the bounded grid schema while the camera itself is unbounded runtime navigation state.

Implemented foundations:

- `spatialWorldCamera.js` owns framework-neutral two-axis camera clamping, pointer panning, screen/world conversion, and repeating-grid offsets.
- `SpatialWireframeGrid.jsx` renders a camera-aware full-area orthogonal grid.
- `HomeWorldSurface.jsx` portals a near-black full-viewport grid below the transparent Keeper canvas and owns click-versus-pan routing.
- The home camera pans launchers and canvas artwork through one accelerated spatial layer while runtime windows remain viewport-fixed.
- Home camera state is versioned, bounded for corrupt-state safety, and persisted per profile.
- The gallery uses the shared camera clamp, pointer-pan, and grid-offset math while constraining its Y axis to zero.

## Intended compositor

```text
world architecture / spatial grid
        -> authored launchers and canvas objects
        -> transparent Pixi resident layer
        -> fixed system bar, menus, inspectors, previews
```

The home and gallery follow the same root compositor boundary. The public stage is not part of this stack. Atelier retains the stage system for authoring and future free-roam work.

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

1. Visually tune grid scale, contrast, initial object composition, and Keeper depth against representative profiles.
2. Add deterministic migration and portable-document coverage before allowing authored positions outside the old bounded grid.
3. Add accessible keyboard camera navigation without taking arrow keys from open applications.
4. Decide whether any window type should optionally become world-anchored; runtime windows are viewport-fixed today.
5. Define a dedicated free-roam mode before reconnecting the preserved stage renderer to public navigation.

## Gallery stabilization captured by this foundation

- Gallery architecture and framed artwork are portaled below the transparent resident canvas.
- The fixed public interface remains above the resident.
- Horizontal gallery navigation changes only the Keeper's local X target and preserves the existing local Y target exactly.
- Clicking any empty gallery area only moves the Keeper; it never triggers camera scrolling.
- Drag, wheel, arrows, Home/End, and explicit gallery buttons remain camera-navigation inputs.
