# Phase 4.2A spatial grid and launcher composition

## Purpose

Phase 4.2A replaces the horizontal endpoint table with a spatial launcher system. The composition uses square logical cells while launchers span rectangular groups of cells. Saved state contains grid coordinates, spans, controlled icon keys, and presentation order—never viewport pixels, DOM nodes, React components, CSS, or Pixi objects.

## Coordinate system

Expanded windows deliberately use a separate freeform geometry model. On desktop they move and resize pixel-for-pixel without launcher-grid snapping or collision rules. Their rectangles are normalized against the usable scene bounds for responsive persistence, then clamped to safe bounds and per-window minimum sizes when restored. Legacy span-based window records migrate once into this model.

Desktop uses a 24-column lattice inside the safe area below the HUD. The unit is the smaller of the available width per column and available height per 13 rows, clamped to a usable minimum. Remaining width is centered as a gutter. The renderer does not distort cells to fill the viewport.

Compact screens use four columns. Desktop coordinates remain authored data, while compact placement is deterministically packed by `presentationOrder`. Icon launchers remain 1×1; label launchers retain a safe width and become one row high. `layouts.compact` is deliberately reserved for later optional authored overrides.

## Scene responsibilities

A launcher separates stable scene identity and target identity from:

- appearance mode: `label`, `icon`, or `icon_label`;
- a controlled serializable icon key;
- square-grid position and rectangular span;
- owner pinning and visitor visibility;
- presentation order.

`src/public/sceneGrid.js` contains framework-neutral span, collision, nearest-placement, and compact-packing logic. `sceneIcons.js` is the controlled icon registry. Unknown keys fall back to `folder`; remote documents cannot name components or inject SVG/HTML.

## Authoring

Edit mode reveals the grid and allows launchers to move by snapped cells. Selecting a launcher opens a compact inspector with appearance, icon, presets, and keyboard-operable numeric span controls. A bottom-right handle supplies direct grid resizing. Invalid collisions or out-of-bounds resizing roll back. Persistence happens only at completed move/resize or inspector changes, not each pointer frame.

Presets are conveniences:

- Square: 1×1 icon
- Compact: 2×1 icon and label
- Standard: 3×1 label
- Feature: 3×2 icon and label

Icon-only launchers retain their full accessible launcher name.

## Persistence and migration

Library workspace v4 adds `appearanceMode`, `iconKey`, `span`, and `presentationOrder` to pinned Canvas Spaces. v1–v3 records migrate deterministically with a 3×1 label default while preserving IDs, organization, visitor visibility, placements, and window positions. Existing module-grid v3 coordinates are read as a legacy input and mapped onto the new bounded grid. System launcher appearance is stored separately from private library organization.

Reset Layout clears launcher/window coordinates through existing owners. It preserves launcher size, appearance, icons, pins, visitor visibility, folders, Favorites, and Signals state.

## Privacy and portable documents

Private pinned launchers stay on the owner scene and retain all authoring data. They remain absent from visitor preview and exported JSON. Public Canvas Spaces include a closed, validated `appearance` projection with mode, allowlisted icon, label visibility, and bounded spans. Public move, resize, or appearance changes make a snapshot stale; private launcher changes do not enter its fingerprint.

The pre-publication v1 document gained this closed appearance projection. Earlier v1 documents without the optional projection remain readable and receive safe label defaults in preview/restore. Canonical serialization stays deterministic.

## Visitor preview and startup

Visitor preview uses the same 24-column square coordinate semantics for public Canvas Spaces and a deterministic compact grid on narrow screens. It exposes no grid, inspector, movement, or resize controls. Startup reveal still follows presentation order and reduced-motion behavior.

## Accessibility and performance

Grid lines are decorative. Icon-only controls retain accessible text. Numeric span inputs provide an alternative to pointer resizing. Focus and existing module semantics are preserved. The grid overlay is SVG/CSS rather than hundreds of empty interactive cells; persistence and snapshot calculation do not run on pointer-move frames.

## Known limitations and Phase 4.2B

- System launcher visibility is unchanged in this phase.
- Compact layouts are automatic; authored mobile overrides are reserved.
- Expanded windows use freeform desktop rectangles; compact/mobile presentation remains full-screen and ignores desktop geometry.
- Thumbnail launchers, arbitrary icons, pixel offsets, and free placement are excluded.

Phase 4.2B can add direct image/NFT scene items and initially open windows without replacing the launcher coordinate, collision, icon, privacy, or document foundations.
