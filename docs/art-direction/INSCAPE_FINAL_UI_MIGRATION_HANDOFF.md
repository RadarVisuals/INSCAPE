# INSCAPE Final UI, Product Direction, and Migration Handoff

Status: canonical implementation handoff, pending per-slice visual approval
Prepared: 2026-07-27
Primary frozen prototype: `/prototype/lattice-engine`
Historical visual precursor: `/prototype/workspace-rail`
Primary product statement: **Your profile is not a page. It is a place.**

## 1. Purpose of this document

This document transfers the complete product, visual, interaction, and migration context needed to turn the frozen INSCAPE lattice-engine prototype into the final production interface. The earlier workspace-rail and NFT-viewer prototypes remain design evidence, not the target runtime architecture.

It is intentionally detailed. A future implementation agent must be able to continue without relying on the long design conversation that produced the prototype.

This is not permission to migrate the complete prototype in one uninterrupted rewrite. The final UI must be agreed and migrated in bounded slices. Before implementing each slice, the agent must show the owner the exact intended appearance and behavior, using the relevant checklist in this document and `INSCAPE_UI_NOTES.md`. The owner must be able to correct or extend that checklist before code is changed.

The current production application is valuable, deployed, publishing to IPFS, resolving public workspaces, and already contains carefully stabilized ownership, visitor, wallet, indexing, and persistence boundaries. The visual migration must preserve those systems.

## 2. Required reading before implementation

- `docs/art-direction/INSCAPE_ALPHA_EXECUTION_ROADMAP.md` — live execution status, phase gates, checkpoints, and the next approved action.

Read these files completely before proposing or changing production code:

1. `docs/INSCAPE_VISION_AND_ART_DIRECTION.md`
2. `docs/INSCAPE_CANVAS_LATTICE.md`
3. `docs/art-direction/INSCAPE_UI_NOTES.md`
4. This handoff
5. `src/LatticeEnginePrototype.jsx`
6. `src/latticeEnginePrototype.css`
7. The dedicated modules under `src/lattice/`
8. `src/WorkspaceRailPrototype.jsx` and `src/workspaceRailPrototype.css` as historical visual evidence
9. `src/NftTableViewerPrototype.jsx` and `src/nftTableViewerPrototype.css` as historical viewer evidence
10. The current production owner and published visitor entry points
11. The current profile-document builders, validators, publication projection, and migrations

The vision and lattice documents now reflect the confirmed canonical direction: a permanent **3 x 3 lattice containing nine freely authored tables**. Any five-table workspace-v8 input encountered in production is **LEGACY COMPATIBILITY INPUT — NOT THE TARGET MODEL.** Preserve its readability without treating its table names, topology, or geometry as the new lattice schema.

## 3. Product identities

The identities must remain separate:

- **INSCAPE** is the application and spatial profile-presentation system.
- **HUMAN UNDERNEATH** is the owner's artistic identity and body of work.
- **KEEPERS** is the character/NFT collection.
- **The Keeper** is the active resident, host, witness, guide, and performer inside a profile.
- **The Underneath** is a later illustrated free-roam world, not the alpha workspace model.

INSCAPE must be neutral enough to frame other creators while remaining visually unmistakable.

## 4. What the current prototype looks and feels like

The frozen lattice-engine prototype is an archival instrument surrounding a movable spatial profile. It incorporates and supersedes the relevant workspace-rail visual studies while preserving them as historical references.

Its visual language combines:

- Flat charcoal, graphite, slate, ash, mist, and warm paper surfaces.
- Thin one-pixel architectural grid lines.
- Large areas of deliberate emptiness.
- Geist for readable information.
- IBM Plex Mono for small technical labels, metadata keys, counts, and state.
- HVariant only for the INSCAPE signature.
- Technical dossier and issued-document structures.
- Optional inversion between surface, menu, and dossier palettes.
- Fixed interface elements floating above a continuous moving grid.
- Artwork retaining color and volatility inside restrained neutral architecture.

The strongest light treatment resembles archival paper, a museum record, an issued identity document, or a technical certificate. The strongest dark treatments are flat carbon/graphite, not featureless pure black and not dirty noise.

The prototype currently includes:

- A compact profile/navigation rail on the left.
- A separate owner workspace toolbar near the top.
- Surface, menu, dossier, and font studies.
- A continuous lattice that moves beneath fixed chrome.
- A small lattice position map.
- Owner-authored asset placement.
- A full NFT focus viewer.
- Left and right metadata dossier panels.
- A shareable full profile dossier.
- A Keeper Dock control in the lower-right fixed interface.
- INSCAPE identity in the lower-left fixed interface.

Some prototype content is intentionally hardcoded and must not enter production: fixed table names, demo counts, demo metadata, local ratio assets, centered three-column preview labels, coordinate labels, and presentation studies that exist only to compare styles.

## 5. Final experiential model

The fixed interface is the instrument. The profile moves beneath it.

The person remains in one stable viewing position. A bounded 3 x 3 arrangement of nine presentation tables moves as one continuous physical lattice underneath the interface.

```text
[ TABLE 01 ] [ TABLE 02 ] [ TABLE 03 ]
[ TABLE 04 ] [ TABLE 05 ] [ TABLE 06 ]
[ TABLE 07 ] [ TABLE 08 ] [ TABLE 09 ]
```

The center table is the entry table.

During input, movement is continuous and physically follows the pointer. On release, the lattice resolves to one valid table and locks into exact alignment. The resting state is always a table coordinate, never an arbitrary camera offset.

This is not a page carousel, an infinite desktop, or free camera movement. It should feel like a large presentation table being pulled beneath a fixed observer.

## 6. Locked product decisions

Unless the owner explicitly changes them during an approval gate, the following decisions are locked:

1. Alpha uses nine tables in a 3 x 3 lattice.
2. The center table is the entry position.
3. The interface remains fixed while the lattice moves.
4. Arrival always snaps exactly to a valid table.
5. Tables are owner-authored and renameable.
6. Placement is assisted freeform: strong automatic starting layouts are available, but owners may rearrange, resize, crop, overlap, layer, and reframe assets.
7. Authored placement uses grid cells rather than arbitrary persisted camera pixels.
8. Native artwork proportions are respected.
9. Transparent assets remain transparent unless the owner explicitly chooses a frame or background.
10. The old public Gallery and Upper World are excluded from the visible Alpha runtime. Their historical persisted data must remain readable until a separately approved migration or retirement pass; do not delete, reinterpret, or silently merge it into the lattice.
11. Surface, menu, and dossier palettes can match or invert independently.
12. Owner and visitor render the same published tables. Owner utilities are additional fixed chrome, never part of the public presentation document.
13. Missing metadata is never invented.

## 7. Approval-gated execution protocol

This protocol is mandatory for every migration slice.

### Before coding a slice

The implementation agent must report:

1. What production currently does.
2. What the prototype currently demonstrates.
3. Which relevant items from `INSCAPE_UI_NOTES.md` apply.
4. The exact proposed final appearance.
5. The exact pointer, keyboard, focus, Escape, and responsive behavior.
6. Which state is runtime-only, local draft, or published profile data.
7. What legacy code will remain, be bypassed, or eventually be removed.
8. Whether previous iterations have made the relevant implementation more complex than the product behavior requires, and whether a smaller or cleaner implementation boundary is available.

The agent must then ask the owner whether anything should be corrected or added before implementation.

### During implementation

- Implement one cohesive slice only.
- Preserve real data and existing public APIs.
- Do not rewrite unrelated systems.
- Do not introduce hardcoded profile data.
- Do not fabricate fallback metadata.
- Do not commit or push unless explicitly authorized.
- If accumulated iterations are making a simple interaction disproportionately complex, stop and report that complexity before adding another patch.
- Always compare the proposed implementation with the simplest clean implementation that satisfies the confirmed behavior. Prefer replacing accidental prototype complexity over preserving it merely because it already exists.

### After implementation

Report a short manual test script before running an excessive test suite. The owner visually and behaviorally approves the slice. Only then perform proportionate automated verification, cleanup, and an optional checkpoint commit/push.

## 8. Stable interface architecture

### Production-to-final UI mapping

The existing production interface largely presents its utilities as one vertical stack of similarly weighted buttons and separate windows. Public navigation, owner organization, spatial movement, publishing, and settings can therefore appear to belong to one undifferentiated menu.

The final interface deliberately separates those responsibilities:

- **Profile/navigation rail:** identity and public-facing profile navigation. This includes the public presentation of Categories, Creations, Activity, and Discover according to visibility rules.
- **Owner workspace toolbar:** authoring and workspace operations. This includes Browser, Arrange, Preview, Theme, Publish, and secondary owner actions under More.
- **Browser window:** one owner tool containing `INDEX` and `CATEGORIES` as two tabs in the same window. They are grouped because both participate in composing tables.
  - `INDEX` is the searchable and filterable owned-asset pool.
  - `CATEGORIES` is the authoring view for organizing and publishing selections from that pool.
- **Public Categories view:** the Categories entry in the profile rail presents the public result. It is not the owner editing interface, even though it reads the same underlying category data.
- **Lattice navigation:** replaces Gallery/Upper World buttons as the alpha presentation-space model. The fixed rail and toolbar remain stationary while the tables move and snap beneath them.

This is not only a visual rearrangement. It establishes clearer ownership, visibility, and state boundaries. Migration must not reproduce the old single-menu hierarchy using new styling.

These elements remain fixed above the moving lattice:

- Profile/navigation rail.
- Owner workspace toolbar.
- INSCAPE identity/signature.
- Keeper Dock.
- Lattice location map.
- Valid directional chevrons.
- Runtime utility windows such as Browser, Categories, Creations, Activity, Discover, Settings, and publishing controls.
- NFT focus viewer and profile dossier overlays.

Opening any fixed interface element must not shift the table layout.

### Profile rail

The compact profile rail is identity and public-profile navigation. It contains public-facing areas such as Categories, Creations, Activity, and Discover according to owner/visitor visibility rules.

Browser/Index and Arrange belong to owner workspace tooling, not profile navigation.

### Workspace toolbar

The owner toolbar groups Browser, Arrange, Preview, Theme, Publish, and secondary actions. Its labels and icons must communicate mode and active state clearly. It remains absent or appropriately reduced for visitors.

### INSCAPE signature

The HVariant INSCAPE wordmark sits in the lower-left fixed interface with a small technical subtitle such as `SPATIAL PROFILE SYSTEM / ACTIVE`. It must not collide with table content.

### Keeper Dock

The Keeper Dock is fixed in the lower-right corner. Its activation symbol should be materially larger than in the current prototype, with a reliable hit target of at least approximately 48 CSS pixels. Do not store a literal `3x` scaling contract; size it responsively while preserving prominence.

Docking and releasing the Keeper must not be triggered by an unrelated canvas click. The dock does not move with the lattice.

### Directional chevrons

Replace decorative `X0`/`Y0` coordinate labels with clickable chevrons at the left, right, top, and bottom when a valid neighbor exists. Invalid directions should be absent rather than displayed as dead controls.

### Lattice position map

The current small square map is functionally correct but too small and visually recessive. The final map must:

- Clearly show all nine positions.
- Clearly fill or otherwise mark the active table.
- Be immediately visible without dominating artwork.
- Be keyboard accessible.
- Allow direct navigation by clicking a table.
- Optionally reveal table names on hover/focus.
- Remain fixed above the lattice.

Its final location must be visually approved before implementation. The current right-center position is a study, not a locked coordinate.

## 9. Lattice navigation contract

One shared gesture controller should govern mouse, touch, pen, and trackpad behavior.

### Gesture ownership

Lattice navigation may begin only when the gesture starts on eligible empty table space. It must not begin on:

- Artwork.
- NFT cards.
- Dossiers.
- Buttons or links.
- Resize regions.
- Crop controls.
- Fixed chrome.
- Scrollable metadata content.

### Activation and intent

- A real dead zone must be crossed before navigation activates.
- Once a direction is confidently committed, a millimeter of counter-movement must not reverse it.
- One gesture resolves at most one destination.
- Small movement returns to the current table.
- A deliberate velocity flick may complete movement.
- Invalid edge movement receives resistance and returns.
- Horizontal, vertical, and valid diagonal movement are supported.
- Wheel and trackpad input use accumulation, intent detection, and a brief gesture lock to prevent multiple accidental table changes.
- Pointer capture must be acquired after activation and released reliably on completion or cancellation.

### Arrival

- Snap uses one confident easing curve.
- The complete continuous grid travels with the tables.
- The selected table aligns exactly beneath the fixed viewport.
- No cross-fade disguises movement.
- Reduced motion preserves structure with a shorter direct transition.
- Persist only the active table coordinate, not an arbitrary drag offset.

## 10. Tables and table identity

Each table is an authored presentation surface, not a hardcoded feature page.

A table should contain:

```js
{
  id,
  coordinate: { x, y },
  title,
  subtitle,
  labelVisible,
  labelAnchor,
  labelOffset,
  layoutPreset,
  placements,
  visibility
}
```

The exact schema must follow existing project conventions and validators; this shape is conceptual.

### Table labels

Owners may rename tables and optionally add a subtitle. Fully arbitrary pixel placement is not recommended because it becomes unreliable across viewports. Prefer approved anchor positions such as:

- top-left
- top-center
- top-right
- bottom-left
- bottom-center
- bottom-right

A constrained offset may provide nuance without destroying responsive determinism.

The hardcoded prototype labels `IDENTITY`, `COLLECTIONS`, `ARCHIVE`, `DROPS`, and `INDEX` are examples only.

### Assisted freeform

Owners should not be forced to become interface designers before presenting work. New tables may start from a strong automatic arrangement or preset. The owner may then detach from that starting composition and freely author within grid constraints.

The product provides the architecture; the owner composes the presentation.

## 11. Grid placement and authoring geometry

The visible architectural grid becomes meaningful authored geometry.

Conceptual placement data:

```js
{
  id,
  stableAssetReference,
  tableId,
  column,
  row,
  columnSpan,
  rowSpan,
  layer,
  crop,
  frameStyle,
  transparencyMode,
  public
}
```

### Placement behavior

- Drag freely while interacting.
- Preview the snapped result during or near the end of interaction.
- Commit exact grid geometry on release.
- Permit intentional overlap and layering.
- Respect bounded table geometry.
- Permit substantially larger assets than the current prototype cap.
- Do not mutate persisted data on every pointermove; autosave after completed interactions.

### Resize behavior

All four corners must resize.

Dragging one corner changes only the edges controlled by that corner. The opposite corner remains anchored. Remove the current visible hinge. Show resize cursors and a restrained selected state instead.

Native ratio should remain locked by default. Cropping or changing a frame viewport is a distinct operation. Do not distort artwork to satisfy a card ratio.

### Transparency

Transparent WebP, PNG, or other supported alpha assets must remain transparent in the table renderer. Do not add a black rectangle, mat, or frame implicitly.

Automatic transparency resolution should be combined with an owner override because remote gateways and image transformations may prevent reliable inspection.

## 12. Frame system

Top/bottom bars and mats belong to selectable presentation frames, not every asset.

Initial frame family:

1. `NONE` — one-pixel boundary only when needed; native artwork dominates.
2. `DOSSIER` — archival white/paper top and bottom technical bars.
3. `POLAROID / CAPTION` — image with a stronger lower information bar, including the useful dark caption treatment studied on the curated table.

Frame styles may carry information such as artist, edition, collection, dimensions, or an owner-selected caption. They must remain optional and must never crop or recolor artwork without explicit owner action.

The thick prototype border around NFT placements must be replaced with a one-pixel structural border.

## 13. NFT focus viewer

The viewer is viewport-fixed and opens over the current table without moving the lattice, changing the active table, or dimming/recoloring the background.

### Opening and closing

- Selecting an eligible table asset smoothly enlarges it toward a centered focus position.
- The animation should visibly originate from the selected placement.
- Close via `X`, Escape, or the defined return gesture.
- Focus returns to the originating placement.
- Closing returns the artwork to the correct table location without a tilt, disconnected card remnant, or reverse-motion jump.

### Independent dossier panels

The viewer has two independently controlled paper dossiers:

- Left: description, narrative, long-form metadata, traits where appropriate.
- Right: technical record, collection, token ID, edition/supply, standard, creator, owner, contract, network, dimensions, and external references.

Valid states are:

- artwork only
- artwork plus left
- artwork plus right
- artwork plus both

Do not model these as one mutually exclusive `openPanel` value.

When both are open, fit the complete group within the desktop viewport. Panels must not cover the artwork or leave the viewport. On compact screens, use an explicitly approved stacked or tabbed equivalent rather than squeezing unreadable paper panels beside the image.

### Browsing while dossiers remain open

Owners and visitors must be able to navigate to the next/previous presented NFT while either or both dossiers are open.

- Preserve the panel configuration.
- Replace content with real data for the new asset.
- Keep long panel content independently scrollable.
- Do not let panel scrolling navigate the lattice.
- Keep navigation order deterministic, based on authored table ordering/layer rules explicitly defined during implementation.
- Missing fields display honest unresolved/absent states.

### Links

Where real data permits, support explicit links to:

- creator profile
- collection
- contract/explorer
- marketplace or sale destination
- related media

Never invent destinations.

## 14. Full profile identity dossier

The large paper/dossier profile card is the public identity presentation of an INSCAPE workspace. It is also designed to become shareable outside the live interface.

It combines official Universal Profile metadata with a published INSCAPE presentation overlay.

```text
Universal Profile metadata
          +
Published INSCAPE identity overlay
          =
Public INSCAPE profile dossier
```

INSCAPE never overwrites official Universal Profile metadata.

### Immutable official identity

Resolve from the addressed Universal Profile:

- profile address
- network
- official handle/name
- official avatar as an available source
- official bio as an available source
- official tags as available sources
- official links and linked accounts
- real resolved asset/collection counts where displayed

The official handle must not be replaceable inside INSCAPE.

### Owner-authored alias and resident code

Above the official handle, the owner may define an `ALSO KNOWN AS` alias. Example:

```text
RESIDENT ZERO #001
@VXCTXR
```

The `#001` resident code is not entered by the owner. It is deterministically derived from the first three hexadecimal characters after `0x` in the Universal Profile address:

```js
residentCode = profileAddress.slice(2, 5).toUpperCase();
```

Three characters are the fixed INSCAPE resident-code length. Two characters are too collision-prone and four weaken the issued-resident aesthetic. This short code is visual identity, not a security identifier.

Also show a small shortened technical address, for example:

```text
PROFILE ADDRESS
0x001...7584  [COPY]
```

Use a proper ellipsis in the UI if consistent with the typography. Hover/focus may reveal the full checksum address. Copy always copies the complete address.

### Editable INSCAPE overlay

Conceptual public presentation data:

```js
identityPresentation: {
  alias: "RESIDENT ZERO",
  avatar: {
    mode: "official", // official | inscape
    assetReference: null,
    shape: "round" // round | square
  },
  bio: {
    mode: "official", // official | inscape | hidden
    customText: ""
  },
  tags: {
    includeOfficial: true,
    additional: []
  },
  dossierSurface: "paper",
  visibility: {
    links: true,
    network: true,
    counts: true,
    publicationDate: true
  }
}
```

Adapt this conceptual shape to the existing schema/versioning conventions rather than copying it blindly.

### Avatar source

Owner options:

```text
[x] UNIVERSAL PROFILE AVATAR
[ ] INSCAPE AVATAR
```

An INSCAPE avatar override becomes the default avatar shown inside INSCAPE but never modifies the official UP avatar. Preserve transparency. Support the already designed round/square presentation choice.

Show provenance such as `SOURCE / UNIVERSAL PROFILE` or `SOURCE / INSCAPE PRESENTATION` where useful.

### Bio source

Owner options:

```text
[x] USE UNIVERSAL PROFILE BIO
[ ] USE INSCAPE BIO
[ ] HIDE BIO
```

Keep the official bio visible as reference while editing a custom INSCAPE bio. Publishing the overlay does not overwrite official metadata.

### Tags

Official tags may be included and additional INSCAPE tags appended. Preserve internal provenance even if the public visual treatment is unified.

### Network and activity date

Display the resolved network, for example `LUKSO MAINNET`. It is runtime/profile-derived and not freely editable.

For alpha, show `LAST PUBLISHED`, not `LAST ONLINE`. A real last-seen feature requires a presence service, repeated publication, or another shared backend and raises privacy concerns. Future last-seen support must be explicit opt-in.

### Sharing

Share copies a canonical profile URL that resolves the exact Universal Profile and enters its published INSCAPE workspace in visitor mode. Address-based identity is canonical; friendly handle routing may resolve to it.

Potential actions:

- copy profile URL
- share on X
- native Web Share where supported
- later, export the dossier as an image

### Owner editing

An unobtrusive gear appears only for the owner in authoring mode. It opens anchored `PROFILE DOSSIER SETTINGS` without shifting the card.

Editing updates the local draft and live preview. It does not become public until the established preview, IPFS upload, wallet authorization, and publication flow completes.

### Provenance language

The dossier should feel like one coherent issued object, not two competing designs. Use quiet technical provenance labels such as:

- `UP / VERIFIED`
- `INSCAPE / AUTHORED`
- `NETWORK / RESOLVED`
- `PUBLICATION / SIGNED`

## 15. Palette and typography contract

### Palette layers

Three layers may coordinate or invert independently:

- spatial surface
- menus/fixed chrome
- dossier/paper objects

Approved family:

- Carbon
- Graphite
- Slate
- Ash
- Mist
- Paper

Avoid featureless pure black as the default panel surface. Dark surfaces are predominantly flat. Paper may carry restrained grain.

### Typography

- Geist Sans: readable interface information, bios, descriptions, titles, and longer content.
- IBM Plex Mono: technical labels, metadata keys, counts, state, coordinates, and system language.
- HVariant: INSCAPE signature only.
- Geist Mono/Space Mono: prototype comparison only unless deliberately promoted later.

Compact does not mean microscopic. Important information must remain legible in common 1440p layouts and iframe presentations.

## 16. Owner and visitor boundaries

### Owner

The owner can:

- browse and resolve real assets
- organize folders/categories
- configure identity presentation
- name tables
- place and order assets
- choose frames and palettes
- crop, resize, overlap, and layer
- preview the exact visitor projection
- publish through the existing secure workflow

### Visitor

The visitor sees only the published public projection:

- published tables and placements
- permitted identity data
- public categories/creations if enabled
- NFT viewer and permitted external links
- the Keeper
- navigation controls

The visitor never receives private folders, local draft state, unpublished placements, owner settings, wallet actions, or authoring callbacks.

Owner authentication must never replace the published visitor projection with an empty or unrelated local draft while visiting another profile.

## 17. Publication and source-of-truth boundaries

Preserve the stabilized model:

1. Owner edits a profile-scoped local draft.
2. Owner previews a public projection.
3. Public document is validated.
4. Public document is uploaded to IPFS through the server-side publication boundary.
5. Wallet authorization publishes the reference.
6. Visitors resolve and validate the referenced document.

The new lattice requires a deliberate document version. Do not overload old Home/Gallery geometry fields with new table coordinates.

Runtime-only state includes:

- active table during a session unless existing product policy persists it locally
- gesture offsets
- hover/focus
- open NFT viewer
- open left/right dossier panels
- temporary resize previews

Local owner draft state includes unpublished authored table changes.

Published state includes table configuration, public placements, identity overlay, chosen palettes, frame styles, and deterministic visitor ordering.

## 18. Migration strategy

Do not gradually mutate the old vertical Home and Gallery until they resemble the prototype. Build the lattice as a parallel, production-grade runtime and cut over only after owner and visitor parity is proven.

### Phase 0: freeze and audit

- Checkpoint the current safe branch.
- Record current production routes, chunks, storage keys, schemas, profile-document versions, and publication tests.
- Identify all owner-only and visitor-safe dependency boundaries.
- Confirm the nine-table, assisted-freeform, profile-dossier, frame, and viewer contracts with the owner.
- Update canonical vision/lattice documents after confirmation.

### Phase 1: domain and schema

- Define versioned lattice/table/placement/identity-overlay domain structures.
- Define validators and public projection.
- Define ordering semantics for next/previous NFT navigation.
- Define table-label anchors.
- Define frame preset IDs.
- Define alpha transparency override semantics.
- Define deterministic migration behavior.
- Do not write production UI before the data boundary is reviewed.

### Phase 2: isolated lattice engine

Build a framework-conscious but presentation-independent controller for:

- 3 x 3 coordinates
- active table
- pointer intent
- drag offset
- dead zone
- direction commitment
- velocity
- diagonal eligibility
- edge resistance
- snap target
- cancellation
- wheel/trackpad accumulation and cooldown
- reduced motion

Verify movement with empty tables first.

### Phase 3: shared table renderer

- Render the continuous grid and nine tables.
- Render owner-defined labels.
- Apply surface palette.
- Render deterministic placements.
- Support transparent/native artwork.
- Ensure owner and visitor use the same presentation renderer.
- Keep authoring callbacks outside the visitor startup graph.

### Phase 4: authoring geometry

- Place from the real Browser/Index.
- Provide automatic starting arrangements.
- Drag with snap.
- Resize from four anchored corners.
- Crop separately.
- Layer and overlap.
- Select frames.
- Remove and replace.
- Add table naming and label anchors.
- Autosave only completed operations.

### Phase 5: NFT focus viewer

- Smooth origin-to-center opening.
- Stable close/return animation.
- Independent left and right dossiers.
- Both dossiers open simultaneously.
- Sticky dossier configuration while browsing assets.
- Swipe, wheel, keyboard, and chevron navigation.
- Scrollable long content.
- Real metadata and unresolved states.
- Creator, collection, contract, explorer, and marketplace links where real.
- Focus restoration and Escape behavior.

### Phase 6: identity dossier and fixed chrome

Migrate, with separate approval gates:

- profile rail
- owner toolbar
- INSCAPE signature
- Keeper Dock
- direction chevrons
- enlarged 3 x 3 map
- full profile dossier
- profile dossier settings and overlay editing
- palette inversion controls

### Phase 7: public-document integration

- Add the new public document version.
- Build public projection and validation.
- Add owner draft reconciliation.
- Add visitor resolution.
- Preserve cross-profile isolation.
- Preserve iframe/direct-visit equivalence.
- Integrate existing IPFS and wallet publication without exposing secrets.

### Phase 8: migration and compatibility

Decide explicitly what old authored content can be migrated. Categories, identity, and asset references may be reusable. Old vertical Home positions and Gallery-wall geometry should not be silently mapped to tables without a reviewed deterministic rule.

Where conversion cannot preserve meaning, retain legacy readability or provide an owner-guided import rather than producing a broken layout.

### Phase 9: parallel cutover

Run the new lattice behind an internal route or feature flag. Test:

- owner direct
- owner iframe
- visitor direct
- visitor iframe
- signed out
- owner visiting another profile
- different wallets
- refresh/session restoration
- IPFS publish and reload
- different viewport sizes
- all palette combinations
- transparent artwork
- portrait, square, and landscape artwork
- long and missing metadata
- many placements
- profile identity overrides

Only after approval should the lattice replace the alpha Home runtime.

### Phase 10: legacy cleanup

After live proof:

- remove obsolete Home/Upper/Gallery startup paths
- remove unused camera state and controls
- remove superseded frame/presentation UI
- remove dead CSS and components
- retain old document readers while published documents still require them
- re-run production budgets and visitor isolation checks

## 19. Acceptance checklist from current UI notes

Each item must be demonstrated to the owner before its corresponding slice is declared complete:

- [ ] Both NFT dossier sides can be open simultaneously.
- [ ] Next/previous NFT works with zero, one, or both dossiers open.
- [ ] Open dossier state remains stable while changing NFT.
- [ ] Thick NFT outer border is replaced by a one-pixel structural boundary.
- [ ] All four corners resize with the opposite corner anchored.
- [ ] No ugly visible resize hinge remains.
- [ ] Transparent assets render without an implicit black box.
- [ ] White dossier bars are optional frame style, not mandatory NFT chrome.
- [ ] Dark caption/polaroid bar is available as an optional frame.
- [ ] Prototype three-column preview windows do not ship.
- [ ] Tables can be renamed.
- [ ] Table label placement is owner-configurable within approved responsive rules.
- [ ] Keeper Dock control is clearly larger and remains fixed.
- [ ] X/Y labels are replaced by valid directional chevrons.
- [ ] Nine tables are represented and the center is entry.
- [ ] The 3 x 3 location map is larger, obvious, and clickable.
- [ ] Placement snaps to the authored grid.
- [ ] Assets can be resized substantially larger within table bounds.
- [ ] Small clicks do not accidentally change tables.
- [ ] Drag/swipe direction is reliable.
- [ ] Profile dossier combines official metadata with an editable INSCAPE overlay.
- [ ] Alias is editable; official handle is not.
- [ ] Resident code uses three address-derived hexadecimal characters.
- [ ] Short and fully copyable profile address are available.
- [ ] Official/custom avatar selection works without modifying UP metadata.
- [ ] Official/custom/hidden bio selection works.
- [ ] Official and additional INSCAPE tags retain provenance.
- [ ] Network is resolved, not owner-invented.
- [ ] Alpha shows Last Published rather than pretending to know Last Online.
- [ ] Share opens the exact published profile workspace.

## 20. Explicit non-goals for the alpha migration

Do not add these while migrating the core interface:

- Outside World.
- Underneath free-roam.
- Upper World.
- Old freeform Gallery room.
- Social Table/feed.
- Marketplace transaction engine.
- Animated emblem editor.
- Collaborative authoring.
- Hidden/unlockable tables.
- Keeper progression or maintenance loop.
- Full mobile authoring parity.
- Real-time presence or default public last-seen tracking.

## 21. Logical work after migration

After the production lattice is stable:

1. Strong onboarding and meaningful empty-table starting layouts.
2. Read-only mobile/compact visitor experience.
3. Deliberately limited mobile owner actions rather than a compressed desktop editor.
4. Shareable dossier image/export refinement.
5. Creator, collection, contract, explorer, and marketplace-link completeness.
6. Table presets such as Collection, Drop, Archive, Pair, Identity, and Media.
7. Keeper dialogue, authored metadata reactions, and event reactions.
8. Performance work for profiles containing hundreds or thousands of assets.
9. Public directory/discovery refinement.
10. Social Table as a later lattice extension.
11. Advanced freeform Studio/Gallery for layering, animation, and emblems.
12. The illustrated Outside World and Underneath as a separate boundary-crossing experience.

## 22. Engineering principles

- Preserve user data before visual ambition.
- Use real metadata only.
- Keep profile identity explicit in every store and asynchronous callback.
- Keep visitor code free of owner-only startup dependencies.
- Treat local draft and public publication as different states.
- Version schema changes.
- Prefer domain controllers over one giant shell component.
- Keep prototypes isolated; do not import production stores into a visual study without intent.
- Reuse stable production asset, wallet, publication, and profile-resolution systems.
- Do not copy prototype hardcoding into production.
- Report when repeated design iterations have created more implementation complexity than the behavior warrants.
- Before extending a complicated path, consider and explain whether deleting or replacing it with a smaller cohesive implementation would be safer and clearer.
- Keep focus, Escape, pointer cancellation, reduced motion, and iframe behavior first-class.
- Test the same published document across accounts, sessions, direct visits, and iframe sizes.

## 23. Final direction

INSCAPE is not becoming nine pages with a stylized transition. It is one authored profile instrument containing nine spatially connected presentation tables.

The final experience should communicate:

```text
The interface is stable.
The profile is physical.
The artwork remains itself.
The owner composes without inventing an interface.
The visitor moves without becoming lost.
The Keeper gives the place presence.
The published document remains portable and verifiable.
```

The migration is successful only when the owner can compose, preview, publish, revisit, and share the same deterministic profile across wallets, sessions, direct visits, and embeds—and when a first-time visitor can understand where they are without learning the authoring system.
