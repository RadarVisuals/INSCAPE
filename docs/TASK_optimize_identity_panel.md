# Task: Make the Identity panel rendering path maximally efficient

## Objective

Opening the public Identity panel must not pause, freeze, or materially degrade the Pixi animation. Preserve the behavior in which the resident moves into and remains animated inside the Identity habitat, using the existing Pixi application renderer only.

This task is performance-sensitive. Prefer the simplest rendering architecture and remove avoidable GPU, compositing, layout, and per-frame work.

## Current diagnosis

Identity is the only public window that activates a second full-screen WebGL renderer. The current path:

1. `IdentityWindow` measures `.identity-habitat__resident` and reports its bounds.
2. `PixiEngine.setResidentHabitat()` creates an additional renderer through `autoDetectRenderer()`.
3. Actor render textures and authored mutation sources are rendered into both WebGL contexts.
4. The actor is rendered again onto a full-screen transparent overlay canvas every frame.
5. The large Identity window applies a live `backdrop-filter: blur(30px)` over the animated WebGL scene.

The combined duplicate rendering, cross-context resource work, and backdrop compositing can starve the frame loop. There is no intentional ticker pause.

Relevant code:

- `src/public/IdentityWindow.jsx`
- `src/public/publicShell.css`
- `src/components/Canvas/ArtCanvas.jsx`
- `src/engine/PixiEngine.js`
- `src/engine/entities/ActorEntity.js`
- `src/engine/entities/actorMovement.js`
- `src/engine/systems/RenderTextureManager.js`
- `src/engine/overlayLifecycle.js`
- `src/engine/PixiEngine.test.js`
- `src/engine/entities/ActorEntity.test.js`

The worktree already contains user changes. Preserve unrelated edits and do not reset or overwrite them.

## Required architecture

Use the existing main Pixi renderer and canvas. Do not create another `Renderer`, `Application`, canvas, WebGL context, duplicated actor graph, or continuously copied bitmap.

Use this low-cost composition:

- Continue using habitat bounds to constrain/reposition the actor in the main Pixi scene.
- Make the resident viewport visually transparent so the main canvas and actor remain visible through it.
- Let Identity UI regions cover the rest of the scene as ordinary translucent/opaque CSS surfaces.
- Remove Identity's parent-level live backdrop blur. Use alpha backgrounds, gradients, borders, and shadows for separation. Any retained backdrop blur must be narrowly scoped and measured.

The resident can remain in the world behind the UI; it does not need to be rendered into a second DOM canvas.

## Implementation requirements

### Remove duplicate renderer infrastructure

- Remove `autoDetectRenderer`, the additional `Matrix`, and actor-overlay renderer/canvas lifecycle state from `PixiEngine`.
- Remove `activateActorOverlay()`, `deactivateActorOverlay()`, overlay rendering in `update()`, overlay resize work, and overlay renderer cleanup.
- Remove the actor overlay DOM element and ref from `ArtCanvas`.
- Remove `ActorEntity.additionalRenderers`, `setAdditionalRenderers()`, and duplicate authored-source rendering.
- Remove the second `RenderTextureManager.update()` call used for the overlay renderer.
- Delete `overlayLifecycle.js` and replace/remove tests that only validate the obsolete renderer lifecycle, provided nothing else uses them.
- Verify with `rg` that no obsolete overlay renderer references remain.

### Preserve habitat behavior

- Keep `setResidentHabitat()`, `syncResidentHabitat()`, movement bounds, reduced-motion handling, and return-position behavior.
- Opening Identity should smoothly move the resident into the measured habitat.
- Idle motion, eyes, shaders, warp, phenomena, reactions, and pointer animation must continue while open.
- Closing Identity should release bounds and return the resident as currently intended.
- Resize, scroll, orientation, and responsive layout changes must keep bounds correct.

### Minimize layout work

- Keep `ResizeObserver`, but coalesce bursty resize/scroll reports through one `requestAnimationFrame`.
- Do not call `onHabitatChange` when rounded habitat bounds have not changed.
- Cancel queued animation frames during cleanup.
- Avoid React state updates on animation frames.

### Reduce compositing cost

- Remove the full-window `backdrop-filter: blur(30px)` from Identity.
- Keep the resident grid area transparent enough to reveal the main-canvas actor.
- Apply backgrounds directly to header/profile/social/action regions for legibility.
- Audit launcher/window blur visible while Identity is open. Prefer static translucent gradients for this performance-critical view.

## Acceptance criteria

- Opening Identity creates no new canvas, Pixi renderer, or WebGL context.
- The same main ticker and renderer run before, during, and after opening.
- The actor remains visibly animated inside the resident habitat.
- The stage and actor do not visually duplicate.
- Ten repeated open/close cycles leak no canvases, listeners, observers, animation-frame callbacks, textures, or GPU resources.
- Desktop, mobile portrait, short landscape, and reduced-motion behavior remain correct.
- Existing tests pass, obsolete overlay tests are replaced where appropriate, and the production build succeeds.

## Performance verification

Perform runtime verification in addition to unit tests:

1. Record engine time/ticker state and average frame time for several seconds with Identity closed.
2. Open Identity and record the same values after layout settles.
3. Confirm engine time continuously advances while Identity is open.
4. Confirm the DOM has only the main Pixi canvas before and after opening.
5. Open/close Identity 10 times and confirm canvas/resource counts remain stable.
6. Test with animated warp, particles, weather/veins, and reactions enabled.
7. Check the console for Pixi/WebGL errors and ResizeObserver loop warnings.

Do not claim an FPS improvement without measurements. Report before/after frame-time observations and the test environment.

## Suggested commands

```powershell
rg -n "actorOverlay|additionalRenderers|setAdditionalRenderers|autoDetectRenderer|overlayLifecycle" src
npm test
npm run build
```

## Deliverable

Implement and verify the optimization. Report the final rendering architecture, files changed/deleted, tests/build results, measured runtime behavior, and remaining performance risks.
