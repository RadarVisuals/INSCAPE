# Phase 4.3 — Selectable shader environments

## Status

Implemented and verified at the Phase 4.3 stabilization checkpoint. The current implementation provides the `illustrated | shader` environment boundary, the controlled `neural-field` shader registry entry, render-config v6 migration, profile-document v3 migration/projection, Atelier selection, stage-only live switching, and explicit Pixi resource ownership.

The repeatable 1080p comparison and limitations are recorded in `docs/PHASE_4_3_PERFORMANCE.md`.

## Task

Turn the current neural-background experiment into the first implementation of a reusable, selectable shader-environment system.

The abstraction must be **shader environment**, not **neural environment**. `neural-field` is one shader registered beneath that environment type. The existing illustrated stage remains the default and must continue working unchanged.

Do not encode `neural`, `shader`, or another renderer type as a fake `backdropId`. Backdrops, patterns, and mountains are configuration owned by the illustrated environment.

## Product model

The intended hierarchy is:

```text
Environment
├── Illustrated stage
│   ├── Backdrop
│   ├── Pattern
│   ├── Back mountain
│   ├── Front mountain
│   ├── Fog
│   └── Particles
└── Shader environment
    └── Neural Field
        ├── Palette
        ├── Motion
        ├── Intensity
        ├── Scroll response
        └── Keeper influence
```

Use a closed, normalized configuration shaped along these lines:

```js
scene: {
  environment: {
    type: 'illustrated' | 'shader',
    shaderId: 'neural-field'
  },
  background: { /* existing illustrated-stage configuration */ },
  atmosphere: { /* existing illustrated-stage configuration */ }
}
```

`shaderId` may retain a valid default while the selected type is `illustrated`, so switching back to shaders remembers the chosen shader. Do not persist constructors, shader source, Pixi objects, arbitrary resource names, or user-provided GLSL.

## Existing experiment to preserve

The worktree already contains:

- `src/engine/entities/NeuralBackground.js`
- `src/engine/shaders/NeuralBackgroundShader.js`
- a temporary `NEURAL_BACKGROUND_PREVIEW = true` branch in `StageEntity.js`

The original standalone shader reference was used during the experiment and removed after adaptation; runtime code does not depend on it. The neural shader currently animates, responds to stage scrolling, and receives the Keeper position. Preserve that visual behavior while moving it behind the new selection boundary.

Remove the global preview constant. Do not delete or overwrite unrelated dirty-worktree changes, including the desktop interaction work and startveil experiment.

## Renderer architecture

Create one explicit environment lifecycle contract. Each implementation must support the equivalent of:

```text
resize(width, height)
update(deltaTime, sceneConfig, runtime)
getEffectsTargets()
destroy()
```

The illustrated implementation owns the existing backdrop, warped patterns, mountains, fog, particles, and foreground layers. The shader implementation owns its mesh, shader, geometry, uniforms, and shader-specific runtime behavior.

Use a controlled registry/factory for shader IDs, initially containing only `neural-field`. Unknown environment types and shader IDs must normalize or fall back to the illustrated default; remote profile data must never select code by path or inject shader source.

It is acceptable for `StageEntity` to remain the facade coordinating `bgContainer` and `fgContainer`, but renderer-specific construction and cleanup must not remain as scattered conditionals throughout the engine.

### Resource ownership

- Switching environment type must rebuild the stage without rebuilding or resetting the Keeper.
- Destroy the outgoing environment's owned Pixi resources exactly once.
- Do not destroy `Texture.WHITE` or other shared Pixi resources.
- A shader environment must not call `renderTextureManager.destroyBackgroundPatterns()`. The render-texture manager is shared with actor rendering and does not belong to the neural environment.
- Returning to the illustrated environment must restore its pattern and mountain resources correctly.
- `getEffectsTargets()` must return safe null targets for environment layers that do not exist.
- Stage visibility must continue hiding both illustrated and shader environments.

## Asset resolution and reload scope

Add environment type and shader ID to the stage reload identity so changing either causes a stage-only rebuild.

When a shader environment is active, avoid loading illustrated-stage-only backdrop, background-pattern, and mountain assets where practical. Do not accidentally skip actor masks, line art, eyelids, actor patterns, or any other resources required by the Keeper.

Keep stale async load protection intact. Rapidly switching environment choices must not install an older resolved rig after a newer choice.

## Configuration and migration

Add controlled definitions for:

- `environmentType`: `illustrated` or `shader`
- `environmentShaderId`: initially only `neural-field`

Update:

- render-config defaults;
- normalization and flat-parameter projection;
- render-config document version/migration as required;
- Zustand state application;
- asset reload subscriptions;
- tests that enumerate the complete normalized configuration.

Existing render configurations without `scene.environment` must migrate deterministically to:

```js
{ type: 'illustrated', shaderId: 'neural-field' }
```

Do not reinterpret an existing illustrated backdrop as a shader environment.

## Atelier interface

In the existing Setup/Background authoring interface, add:

```text
Environment Type
[ Illustrated Stage | Shader Environment ]
```

When `illustrated` is selected, show the existing backdrop, pattern, and mountain controls.

When `shader` is selected, show a controlled shader selector:

```text
Shader
[ Neural Field ]
```

Do not label the top-level selector “Neural.” The UI must leave a clear place for additional shader implementations.

For this phase, shader-specific numeric controls may be limited to parameters already proven useful by the experiment. If exposed, define bounded normalized fields rather than editing uniforms directly. At minimum, selection and persistence must work even if the first shader retains authored defaults.

## Public presentation and portable documents

Environment selection is authored public presentation and must survive:

- switching between Public and Atelier;
- profile snapshot creation;
- export/import;
- visitor preview;
- restore;
- reload through the existing restored-presentation record.

Extend the portable profile document with a closed environment projection, for example:

```js
environment: {
  type: 'shader',
  shaderId: 'neural-field'
}
```

Because the current profile-document schema is strict and versioned, make a deliberate version migration rather than silently accepting arbitrary extra fields. Existing documents default to the illustrated environment. Update builder, validation, canonical serialization/fingerprint behavior, preview, restore, local restored-presentation storage, constants, and migration tests together.

The existing `stageId` continues to represent the illustrated backdrop selection for compatibility; it does not become the environment type.

## Neural shader cleanup

Keep the neural implementation as a repo-owned Pixi shader bit. Give it the registry ID `neural-field`.

Review and correct:

- time units and motion-speed naming;
- aspect correction;
- Keeper position conversion into shader UV space;
- behavior when the Keeper is hidden or unavailable;
- explicit resource cleanup;
- resize behavior;
- bounded values near zero distance to avoid invalid shader math.

The Keeper reaction should remain atmospheric. It must not create maintenance mechanics or gameplay state.

## Performance comparison

The purpose of the experiment is to determine whether the shader environment costs less than the two-pattern/two-mountain illustrated stage.

Do not assume the shader is cheaper merely because it uses fewer textures. The neural fragment loop is evaluated per pixel and may be GPU-heavy. Preserve or use the engine's existing development performance recording and document a repeatable comparison at the same viewport, render resolution, Keeper, and effects settings.

At minimum report:

- average frame time or FPS after warm-up;
- approximate loaded stage texture/resource difference;
- whether the shader causes a visible GPU/frame-time regression at 1080p;
- the shader loop count and any quality reduction made to meet the target.

Performance instrumentation must remain development-only and must not add a production HUD in this phase.

## Tests

Add focused tests for:

- legacy render config defaults to `illustrated`;
- invalid environment types and shader IDs fail closed;
- flat store parameters round-trip environment selection;
- environment type/shader changes are stage reloads, not actor reloads;
- illustrated asset identity remains stable;
- profile-document migration defaults older documents to illustrated;
- profile documents round-trip a shader environment;
- restore and preview preserve the selection;
- unknown remote shader IDs are rejected or safely normalized, according to the existing trust boundary.

Run:

```text
npm test
npm run build
```

## Acceptance criteria

1. The application starts with the existing illustrated stage by default.
2. Atelier can switch between `Illustrated Stage` and `Shader Environment`.
3. `Neural Field` is selected beneath `Shader Environment`, not presented as an environment type.
4. Switching is live and does not recreate, reset, hide, or visibly jump the Keeper beyond unavoidable stage transition behavior.
5. Switching repeatedly does not leak meshes, shaders, geometries, filters, textures, subscriptions, or ticker callbacks.
6. Returning to illustrated mode restores backdrop, patterns, mountains, fog, particles, and effects targets.
7. Public mode, preview, export/import, restore, and reload retain the selected environment.
8. Existing render configs and portable documents migrate to illustrated mode without losing their current stage selection.
9. The shader registry accepts only controlled IDs and never evaluates imported shader source.
10. Tests and production build pass.

## Out of scope

- A public marketplace or shader store
- User-authored/uploaded GLSL
- Remote executable shader plugins
- Static-image, video, or panoramic environment implementations
- Automatic performance-based environment selection
- Multiple simultaneous environment renderers
- Monetization or edition rights

The architecture should leave room for those future renderer types without implementing them now.
