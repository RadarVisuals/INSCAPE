# Phase 4.4 — Canvas objects and framed artwork

## Prerequisite

Do not begin this phase until the Phase 4.2B desktop work, Phase 4.3 shader-environment work, startveil changes, and the Atelier pointer-routing fix have been reviewed and committed as a stable checkpoint.

This phase touches the library workspace, desktop renderer, context menus, public profile documents, preview, restore, and persistence. Starting it on top of an unidentified mixed worktree would make ownership and migrations unnecessarily risky.

## Purpose

Phase 4.4 makes owned artwork placeable directly on the profile canvas.

Today the canvas contains launchers that open folders and system modules. A profile owner should also be able to right-click the canvas, choose an owned image, and place it as a framed visual object without creating a folder or moving the underlying asset.

Framed artwork is the first implementation of a reusable **canvas-object system**. Music players, video players, galleries, clocks, text, and future modules must be able to join the same creation, placement, persistence, visibility, context-menu, and document boundaries later without turning `ModuleGridShell` into a list of special cases.

This phase implements only framed artwork. It creates the controlled extension seam for later object types without prematurely building a generic plugin platform.

## Product journey

Build one complete path:

```text
Right-click empty canvas
        ↓
Create → Framed Artwork
        ↓
Choose an image from the normalized owned-asset library
        ↓
Artwork appears near the requested canvas position
        ↓
Edit its frame and image presentation
        ↓
Arrange, resize, reorder, publish, reload, preview, export, and restore it
```

Creating a framed artwork must not require creating a folder, pinning a view, or moving/wrapping the owned asset.

## Vocabulary and boundaries

Keep these concepts separate:

- **Launcher:** opens a folder, Favorites, system module, or future application.
- **Runtime window:** temporary open/focused/moved application state.
- **Canvas object:** an authored visual item placed directly on the profile canvas.
- **Asset reference:** a stable reference to an already-owned asset.
- **Object inspector:** edits one canvas object's authored presentation.
- **Arrange Desktop:** moves and resizes launchers and canvas objects without opening them.

A framed artwork is not a launcher and does not open a persistent application window when selected. In normal mode, activating it may open the existing asset preview/lightbox. In Arrange Desktop, pointer interaction selects or moves it.

Do not store React components, DOM nodes, Pixi objects, constructors, arbitrary CSS, arbitrary HTML, or executable code in canvas-object data.

## Data ownership

Canvas objects belong to the profile-scoped local library workspace because they are owner-authored organization/presentation referencing owned assets.

Extend the workspace with a closed collection such as:

```js
canvas: {
  launchers: [/* existing */],
  objects: [
    {
      id: 'canvas:artwork:<stable-local-id>',
      kind: 'framed-artwork',
      stableAssetId: '<normalized library asset id>',
      visitorVisible: true,
      placement: { column: 8, row: 3 },
      span: { columns: 4, rows: 4 },
      presentationOrder: 0,
      presentation: {
        fit: 'contain',
        frame: 'thin',
        mat: 'none',
        background: 'dark'
      }
    }
  ]
}
```

Exact naming may follow repository conventions, but preserve these properties:

- stable controlled ID;
- allowlisted object kind;
- stable library asset reference;
- independent visitor visibility;
- bounded grid placement and span;
- deterministic stacking/presentation order;
- closed, kind-specific presentation;
- no duplicated ownership or token data in local workspace objects.

Increment the library-workspace version and add a pure migration. Existing workspaces receive `objects: []` while preserving folders, Favorites, memberships, launchers, launcher presentation, visitor visibility, window startup state, and runtime separation.

Invalid or missing referenced assets must not crash rendering. Preserve the object as a recoverable missing reference in owner mode, show a clear unavailable state, and omit or safely represent it according to the existing public-document trust boundary.

## Controlled canvas-object registry

Create a small controlled registry/model for canvas-object kinds. Initially it contains only:

```text
framed-artwork
```

The registry may define:

- public label;
- controlled icon key;
- allowed asset media kinds;
- default span;
- minimum and maximum span;
- default presentation;
- presentation normalizer;
- future renderer/inspector routing key.

Do not let imported documents name modules, component paths, JavaScript files, shader sources, or arbitrary renderers. Unknown kinds fail closed.

The registry should prevent scattered `if (kind === ...)` checks where a controlled lookup is clearer, but do not build a remotely extensible plugin system.

## Create menu and asset selection

Extend the existing empty-canvas context menu:

```text
Create →
  Folder
  Framed Artwork
```

Selecting `Framed Artwork` opens an owner-only asset chooser over the current world. Reuse the normalized library asset collection, image preview metadata, search behavior, thumbnail handling, and safe URL resolution where practical.

The chooser must:

- search the complete normalized inventory rather than the currently open page;
- show image-compatible owned assets only;
- preserve keyboard navigation and accessible names;
- distinguish loading, empty, error, and no-compatible-image states;
- support cancel without creating an empty object;
- create exactly one object after selection;
- close after successful selection;
- not mutate folders, Favorites, or asset ownership.

Use the original context-menu anchor as the preferred placement. Convert it through the existing desktop grid geometry, clamp it to safe bounds, and use deterministic nearest placement when occupied.

After creation, open the new object's inspector directly. Do not silently enter Arrange Desktop.

## Placement and collision behavior

Use the existing square logical desktop grid rather than persisting viewport pixels.

Canvas objects must:

- move and resize in Arrange Desktop;
- persist only completed valid interactions, not every pointer frame;
- clamp to authored desktop bounds;
- receive kind-specific minimum and maximum spans;
- pack deterministically on compact/mobile layouts;
- remain selectable when another object overlaps them through explicit stacking commands.

Define collision behavior deliberately. The recommended first implementation allows canvas objects to overlap other canvas objects and launchers because artistic composition and frames often require layering. If overlap is allowed, launcher collision helpers must not silently reject canvas-object movement, and stacking must be deterministic.

Windows remain a separate runtime layer and do not participate in authored object collision.

## Layering contract

For Phase 4.4, canvas-object stacking is deterministic among canvas objects:

- Bring Forward
- Send Backward
- Bring to Front
- Send to Back

Persist bounded/deterministic ordering rather than ever-increasing CSS z-index values. Normalize ordering after mutations.

Document the compositor boundary clearly: the existing Pixi world contains the stage and Keeper, while desktop objects are rendered through the public interface layer. This phase does not implement arbitrary interleaving where one DOM object is behind the Keeper and another is in front of it.

HUD, context menus, inspectors, dialogs, and runtime windows must remain above canvas objects. Canvas objects must not make the system HUD unreachable.

## Framed-artwork presentation

Provide a focused inspector with controlled options:

### Image fit

- `contain`: show the complete artwork;
- `cover`: fill the frame and crop overflow.

Do not destructively crop or rewrite the source asset.

### Frame

Start with a small allowlist such as:

- `none`
- `thin`
- `heavy`

### Mat

Start with:

- `none`
- `light`
- `dark`

### Background

Use a controlled small palette or semantic values. Do not accept imported arbitrary CSS strings.

The inspector must also provide:

- visitor visibility;
- numeric width/height grid spans as a keyboard alternative;
- stacking commands or a clear route to them;
- Replace Artwork, which changes only the referenced asset;
- Remove from Canvas, which requires clear wording and never deletes or transfers the asset.

Escape and outside pointer input close the inspector consistently with launcher editing. Inspector edits do not enter Arrange Desktop.

## Direct interaction

Normal mode:

- click/tap framed artwork to open the existing safe asset preview or an equivalent lightweight viewer;
- right-click opens artwork commands;
- pointer movement over empty world continues reaching the Keeper/canvas;
- canvas objects must not create a full-screen invisible pointer layer.

Arrange Desktop:

- click selects;
- drag moves after the existing movement threshold;
- resize handle changes bounded grid span;
- activation is suppressed after a completed drag;
- grid visibility follows the existing independent grid preference;
- `Done Arranging` returns to normal activation behavior.

## Context menu

Add an explicit `artwork` or `canvas-object` target to the controlled context-menu model.

Recommended commands:

```text
Open Artwork
Edit Artwork
Replace Artwork
Show to Visitors / Make Private
Layer →
  Bring Forward
  Send Backward
  Bring to Front
  Send to Back
Remove from Canvas
```

Commands must carry stable target IDs, clamp to the viewport, retain keyboard operation, and close if the target is removed. Browser context behavior should remain available inside content where the desktop target resolver intentionally does not claim ownership.

Provide non-right-click alternatives through selection/inspector controls.

## Responsive and mobile behavior

Do not add long-press context-menu behavior in this phase.

On compact layouts:

- pack objects deterministically using presentation order;
- preserve their authored desktop placement separately;
- use touch-safe minimum rendered sizes;
- open editing through a visible owner control or inspector route;
- render the inspector/asset chooser as a bottom sheet or full-screen dialog;
- ensure framed artwork cannot cover all navigation permanently.

Use the existing compact-layout conventions rather than persisting a second mobile layout unless a repository boundary already supports it cleanly.

## Public/private projection

Private canvas objects remain in the owner's local workspace but must be completely absent from visitor preview and exported profile documents.

Public framed artwork projects only controlled presentation and a canonical safe asset reference. Reuse the existing profile-document asset-reference projection rather than inventing another token identity format.

The public projection should resemble:

```js
{
  id: 'canvas:artwork:...',
  kind: 'framed-artwork',
  asset: { /* canonical public asset reference */ },
  placement: { column: 8, row: 3 },
  span: { columns: 4, rows: 4 },
  order: 0,
  presentation: {
    fit: 'contain',
    frame: 'thin',
    mat: 'none',
    background: 'dark'
  }
}
```

Use exact-key validation, bounded counts, bounded strings, allowlisted enum values, safe URLs, canonical asset identity, deterministic ordering, and existing document size/depth limits.

Because the current profile document is version 3 and strict, increment it deliberately and add a pure migration. Older documents receive an empty canvas-object collection and retain Keeper, stage/environment, Signals, system modules, spaces, startup presentation, and identity data.

Update together:

- builder;
- validation;
- canonical serialization/fingerprint;
- snapshot stale detection;
- preview;
- import/export;
- restore;
- migration;
- security tests.

Changing a public canvas object must make the snapshot stale. Creating, changing, reordering, or removing a private object must not leak into the public fingerprint.

## Visitor rendering and restore

Visitor preview and the main Public renderer must interpret the same controlled canvas-object projection.

Restore must:

- recreate public canvas objects in the local workspace;
- preserve stable IDs when valid;
- safely resolve collisions with existing local IDs;
- never remove unrelated private local objects without explicit restore semantics;
- preserve the imported canonical asset reference even when current live metadata is unavailable;
- avoid creating folder membership or Favorites as a side effect.

Document and test the chosen merge/replacement behavior. Follow the existing profile-document restore policy rather than introducing a second inconsistent policy.

## Accessibility

- Framed artwork retains the asset's accessible name.
- Image-only presentation still exposes a meaningful button/figure label.
- Missing images have readable fallback text.
- The chooser is a labelled dialog with focus containment and focus restoration.
- Numeric span controls provide a keyboard alternative to pointer resizing.
- Context-menu commands remain keyboard operable.
- Frame and mat styling must not be the only indication of selected/private state.
- Reduced motion should not add decorative object-entry animation beyond existing presentation behavior.

## Performance

- Do not render full-resolution originals for desktop thumbnails when normalized preview media exists.
- Lazy-load artwork images when practical.
- Avoid rebuilding all asset view models on pointer movement.
- Do not serialize or fingerprint the full workspace during drag frames.
- Persist only completed authored mutations.
- Bound the number of public canvas objects in the profile document.
- Revoke any temporary object URLs created by local preview/import workflows.

## Tests

Add focused tests for:

- workspace migration adds `objects: []` without losing existing data;
- controlled object-kind and presentation normalization;
- invalid kinds, spans, enum values, and asset IDs fail closed;
- creation produces one stable object referencing the selected asset;
- cancel produces no object;
- removal never deletes the library asset;
- placement clamps and compact packing are deterministic;
- stacking operations remain bounded and deterministic;
- private objects are absent from documents and fingerprints;
- public object changes make snapshots stale;
- profile-document migration adds an empty object projection;
- framed artwork survives build, validate, serialize, parse, preview, and restore;
- unknown remote renderer/component/shader/source fields are rejected;
- missing asset references render a safe fallback;
- drag completion persists once and suppresses activation.

Run:

```text
npm test
npm run build
git diff --check
```

## Manual acceptance journey

1. Start in Public mode with the illustrated or shader environment.
2. Right-click empty canvas and choose `Create → Framed Artwork`.
3. Search the full owned library and choose an image.
4. Confirm it appears near the right-click location and its inspector opens.
5. Change fit, frame, mat, and visibility without entering Arrange Desktop.
6. Enter Arrange Desktop, move and resize the artwork, then finish arranging.
7. Click it in normal mode and confirm the asset viewer opens.
8. Place a second artwork and verify layer commands deterministically change overlap.
9. Reload and confirm both objects return.
10. Mark one private and confirm visitor preview/export contains only the public object.
11. Export, import, preview, and restore the public object.
12. Remove an artwork from the canvas and confirm the underlying owned asset remains in the library.
13. Confirm Keeper click movement still works on empty canvas in both Public and Atelier modes.

## Acceptance criteria

1. `Create → Framed Artwork` is available from empty canvas.
2. The owner chooses from normalized owned image assets rather than entering an arbitrary URL.
3. A framed artwork is a first-class canvas object, not a folder or launcher workaround.
4. Direct editing does not require Arrange Desktop.
5. Arrange Desktop moves/resizes objects without opening them.
6. Normal activation opens a safe artwork viewer.
7. Object presentation, placement, size, stacking, and visibility persist per profile.
8. Private objects never enter visitor preview, export, or public fingerprints.
9. Public objects round-trip through the versioned profile document and restore safely.
10. Removing an object never deletes, transfers, wraps, or mutates the owned asset.
11. Unknown imported kinds and presentation values fail closed.
12. Empty-world pointer interaction with the Keeper remains functional.
13. Existing launchers, runtime windows, shader environments, startveil, and profile-library behavior do not regress.
14. Tests, build, and diff check pass.

## Out of scope

- Music players and playlists
- Video players or framed video
- Galleries and slideshows
- Text/biography objects
- Arbitrary uploaded images not represented by normalized assets
- Arbitrary HTML, CSS, JavaScript, GLSL, or remote plugins
- Marketplace or purchase flows
- Moving or wrapping underlying tokens
- Arbitrary DOM/Pixi interleaving around the Keeper
- Multi-select, grouping, rotation, or freeform pixel placement
- Authored compact/mobile overrides

Those features can build on the canvas-object boundary after framed artwork proves the complete vertical slice.
