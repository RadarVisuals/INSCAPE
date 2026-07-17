# Phase 2 Canvas Spaces

## Purpose

Phase 2 turns the Phase 1 Collection workspace into a local profile-composition system. Favorites and custom folders can become persistent launchers in the public module grid. A launcher opens a bounded folder window that reads the same normalized assets and organization state as Collection.

The phase remains local and read-only with respect to LUKSO. It does not connect a wallet, request a signature, publish a manifest, transfer an asset, or write profile data.

## User flow

1. Enter HUD **EDIT** mode.
2. Open **Collection**. Create or select a custom folder, then organize assets with the Phase 1 card or preview controls.
3. Select the folder or Favorites and choose **PIN TO CANVAS**.
4. The launcher joins the existing module-grid reveal and shows the current label and assigned asset count.
5. Drag launchers or open folder windows while edit mode is active. Grid positions are bounded and snapped on desktop; mobile uses the established full-canvas module behavior.
6. Choose **DONE** to return to presentation mode. Authoring and placement controls disappear while the curated launchers and folder contents remain available.
7. Refreshing restores the pinned views and their placement for the active profile.

**UNPIN FROM CANVAS** removes only the launcher. It does not remove favorites or folder membership. All Assets is a protected system view and cannot be pinned, renamed, or deleted. Favorites is protected from rename/delete but can be pinned.

## Architecture

```text
LUKSO or fixture repository
  -> normalized asset records
  -> one Zustand library store
       |-> Collection (all views and authoring)
       |-> public module grid (pinned launcher projection)
       `-> FolderWindow (one pinned view + local query)

profile-scoped workspace v2
  -> favorites and custom folder references
  -> pinned view records and stable launcher IDs
  -> launcher and folder-window grid placement
```

`src/library/domain/libraryWorkspace.js` owns workspace transformations. Pin, unpin, placement, deletion cleanup, protected-view rules, and layout reset are React-independent functions. `selectLibraryViewAssets.js` owns folder/favorites filtering, local search composition, and unresolved-reference detection.

`ModuleGridShell` subscribes directly to the workspace slice. It projects pinned records into the existing grid and never duplicates folders or asset membership in public-shell state. It reuses the existing grid geometry, collision resolution, drag preview, startup reveal, active orange line, hover styling, and responsive spans.

`FolderWindow` reuses Phase 1 `AssetGrid`, `AssetCard`, `AssetPreview`, `CollectionToolbar`, normalized records, and resolved URLs. Its query is local to that open window and does not overwrite Collection search.

## Workspace schema changes

The profile-scoped key is now:

```text
os-underneath.library-workspace.v2:0xf3c189...
```

The stored value is:

```js
{
  version: 2,
  profileAddress: '0x...',
  favorites: ['stable-asset-id'],
  folders: [{
    id: 'collision-safe-folder-id',
    name: '1/1 Art',
    assetIds: ['stable-asset-id'],
    createdAt: 0,
    updatedAt: 0
  }],
  canvas: {
    launchers: [{
      id: 'library:folder:collision-safe-folder-id',
      viewType: 'folder', // or 'favorites'
      folderId: 'collision-safe-folder-id', // null for Favorites
      position: { column: 3, row: 4 },
      windowPosition: { column: 1, row: 2 }
    }]
  }
}
```

Launcher IDs are deterministic from the pinned view identity: `library:folder:<folder-id>` or `library:favorites`. Unpinning and repinning therefore retains identity without coupling it to a folder name. Names may change without invalidating the launcher.

Positions are grid coordinates, not pixels, so the public renderer can clamp and resolve them against the current viewport. The existing built-in module layout remains in its established module-grid layout record; profile-authored folder composition belongs to the profile workspace.

## Migration behavior

On load, storage first checks the v2 key. If it is absent, it checks the Phase 1 v1 key, validates it, constructs an empty `canvas.launchers` list, and writes the migrated record to the v2 key.

Migration preserves, in order and without semantic changes:

- favorites;
- folder IDs and names;
- creation and update timestamps;
- every folder's stable asset references;
- the same asset appearing in multiple folders.

Malformed, wrong-profile, duplicate, or unsafe fields continue to be normalized at the storage boundary. Unknown asset IDs remain valid organization references and surface as unresolved assets in a folder window rather than corrupting the workspace.

## Edit and presentation boundary

HUD **EDIT** is a local shell mode and requires no ownership proof in this prototype.

Edit mode exposes folder creation, rename, delete, favorite/membership changes, pin/unpin, launcher dragging, window dragging, and Reset Layout. Presentation mode exposes the four established launchers, pinned curated launchers, asset browsing, local search, previews, and external original-image links. It does not expose organization controls.

HUD **SEARCH** retains its Phase 1 contract: it opens Collection, makes Collection active, and focuses Collection's search field.

## Persistence ownership

- The library store owns normalized assets in memory and the active profile's workspace.
- The v2 profile-scoped localStorage record owns favorites, folder organization, pinned views, stable launcher identity, and custom launcher/window placement.
- The public shell owns transient UI state such as edit mode, open windows, active focus, drag frames, and reveal availability.
- Reset Layout resets built-in launcher placement plus custom launcher/window coordinates. It never deletes favorites, folders, folder names, memberships, or pins.

## Known limitations

- Authoring is local to one browser and is not authenticated; any visitor using that browser can enter edit mode.
- Only one pinned folder window is open at a time, while Collection and Profile Card can remain open alongside it.
- Folder windows support the Phase 1 image model only. Audio, video, playlists, and specialized viewers are out of scope.
- Grid collision resolution is viewport-relative. Very small screens or unusually large launcher sets may share fallback cells, though every module remains clamped to the visible canvas.
- The public/private publication distinction is represented by pinning only; there is no separate private-folder visibility policy yet.

## Explicit Phase 3 extension points

- Move the v2 composition fields into an experience-manifest adapter while keeping the current domain API.
- Add authenticated owner/edit capability without changing presentation-mode rendering.
- Add explicit public/private visibility and selective publication per folder.
- Generalize the normalized view selector for gallery, audio, video, and playlist applications without creating an unrestricted widget framework.
- Allow multiple independently focused folder windows by extending transient window state; stable launcher IDs already provide window keys.
- Add manifest conflict/version handling and decentralized persistence behind the storage boundary.
- Emit normalized `module-opened`, asset-preview, and profile activity events for Keeper reactions.
