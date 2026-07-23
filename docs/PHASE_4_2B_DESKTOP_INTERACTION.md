# Phase 4.2B desktop interaction

## Purpose

Phase 4.2B makes the public canvas behave as a desktop while keeping profile authoring explicit. Window use is ordinary runtime behavior; launcher composition, visitor visibility, and visitor startup presentation remain authored behavior.

## Normal mode and Arrange Desktop

Normal mode opens, closes, focuses, moves, and resizes windows. A window moves only from its marked title bar and uses the Phase 4.2A square-grid pointer geometry. Its resize handle remains available without enabling Arrange Desktop. Interacting with a window promotes its stable ID to the end of a bounded z-order list; rendered z-index is derived from that list, so values cannot run away.

Arrange Desktop is narrowly scoped to launcher movement and resizing. Entering or leaving it does not copy, reset, close, move, or resize runtime windows. Grid visibility remains an independent local preference.

Individual authoring does not require Arrange Desktop. Right-clicking a launcher exposes `Edit Launcher`, visibility, and unpin actions directly. Its contextual inspector provides name, display mode, controlled icon, presets, numeric spans, visibility, and grid controls. It clamps to the viewport and becomes a bottom sheet on narrow layouts. Escape and outside pointer input close it. In Arrange Desktop, activating a launcher selects it and opens the same inspector as the non-right-click and touch fallback; dragging moves instead of opening.

## Runtime and authored persistence

Runtime desktop state is stored under `os-underneath.runtime-windows.v1:<normalized-profile>`:

- currently open stable window IDs;
- current complete grid rectangles;
- deterministic z-order.

The decoder allowlists valid IDs and rectangles, deduplicates ordering, and falls back safely on malformed data. The previous global window geometry record is read only as a migration source. Runtime state is never passed to the profile-document builder and therefore cannot dirty a snapshot.

Authored Canvas Space data is library workspace v5. It adds `startOpen` and `windowGeometry` to launcher presentation. v1-v4 workspaces migrate with `startOpen: false` and `windowGeometry: null`; organization, Favorites, multi-folder membership, pins, visibility, launcher placement, spans, icons, and presentation order are retained. System-module start state and initial geometry live with the existing system presentation record.

Closing a runtime window changes only the runtime record. It never changes `startOpen`.

## Portable profile documents

Phase 4.2B advanced portable profile documents to version 2. Public system modules and public spaces added the closed fields `startOpen` and `windowGeometry`. Private spaces remain omitted completely. Version 1 documents migrate with startup disabled and no authored window rectangle; malformed or future documents still fail closed. Phase 4.3 subsequently advanced the current schema to version 3 for controlled environment presentation, while retaining the same v1 → v2 → v3 migration semantics. Restore carries only public authored startup presentation into workspace v5.

## Context menus

Right-click is intercepted only when a target resolves inside the interactive desktop:

- empty canvas: Arrange Desktop, `Create`, `View`, runtime reset, close all, and Settings;
- `Create`: direct folder creation, placement near the context anchor, and immediate launcher editing;
- `View`: Keeper visibility, stage visibility, and grid preference;
- launcher: Open, Edit Launcher, visibility, and applicable unpin actions;
- window title bar: Close, reset that runtime rectangle, and visitor start-layout actions.

Window content does not resolve as empty canvas, so nested links, form fields, and asset content retain their appropriate browser behavior. The Pixi world forwards empty-world right-clicks to the desktop owner without adding an invisible pointer-blocking overlay. Menus carry stable target type/ID, clamp to the viewport, close on outside input, Escape, command execution, or target removal, and support arrow-key focus plus native Enter/Space activation. HUD commands, Arrange Desktop selection, close controls, resize handles, and the system menu provide non-right-click alternatives.

The menu model deliberately accepts target types rather than component names. A future `artwork` target can add inspect, placement, fit/fill, stacking, visitor visibility, and removal commands without adding another menu implementation.

## Reset semantics

`Reset Windows` replaces the current profile's runtime open state, rectangles, and stacking with its authored/default visitor arrangement. It does not touch organization or authored presentation.

`Reset Authored Canvas` is visible only in Arrange Desktop, names its scope, and requires confirmation. It clears authored launcher/system placement through existing owners while preserving folders, Favorites, memberships, pins, visibility, appearance, Signals, and runtime window state.

## System sigil

The system control renders the INSCAPE `N` as a code-native boxed mark, without retaining a legacy OS Underneath image asset. It is neutral by default and gains restrained accent emphasis on hover, focus, or open state. The system menu provides functional About/profile status, Open Atelier, Arrange Desktop, Reset Windows, Close All Windows, and Settings actions. The information panel reports the active profile and read-only LUKSO status. At widths where HUD groups could collide, the control is hidden.

## Mobile behavior

Narrow layout continues using the existing full-screen/stacked window geometry. Desktop pointer move/resize exits early and resize handles are hidden. Launchers pack through the existing compact algorithm. Arrange Desktop launcher activation opens the inspector as a touch-friendly bottom sheet; normal close controls and HUD commands remain available. No long-press behavior was added.

## Known limitations

- The shell currently presents one folder window at a time, matching the pre-existing folder viewer; switching folders closes the previous folder runtime ID.
- Visitor preview applies start-open to Canvas Space windows. Full system-module visitor window rendering remains owned by the main public renderer.
- Keyboard resize exposes a focusable handle but does not yet implement arrow-key dimension changes; numeric launcher sizing is available in the inspector.
- Direct canvas artwork is not part of this phase; only its context-menu target extension boundary is defined.
