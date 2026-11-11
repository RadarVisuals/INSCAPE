# Reception with linked canvases — 28 October 2026

Status: implemented and checked locally, uncommitted. Branch
`codex/static-reception-bento-2026-10-26`, starting HEAD
`4a0251647234c0757847078ec34f0865425f6857`. Extensive preceding local work
was preserved. No push, deployment, upload, wallet prompt or chain publication
was performed in this implementation.

## Try it

[Local Reception](http://127.0.0.1:5197/browser-tests/reception-linked-fixture.html?session=reception-linked-v1)
uses the production Reception, Display, Text, Image, gallery and viewer.
Swipe/drag Display directly; Text follows the motion and the image switches
on selection. Canvases scrolls below Reception. Open canvas on the linked image
opens its saved camera point. Edit Reception → Cell options → Link canvas
content lets the owner choose a source, map scenes, and choose an optional
canvas/camera destination. The development page uses isolated fixture storage;
its sample data and controls are not added to production routes.

## Boundaries and implementation

- Optional canonical Reception `links` hold qualified references, never copied
  source content. Source display, scene mapping and destination are distinct.
  Missing sources remain editable in local drafts. Public documents require
  resolvable sources and destinations in their assembled public snapshot.
- The existing Display renderer/gesture/playback code is hosted in a bounded
  Reception frame. Canvas scene scopes share both selection and motion with
  their cells, while duplicate Display IDs on another canvas stay independent.
  Gallery thumbnails remain cheap static previews; the existing viewer retains
  its original read-only projection limits, including app placeholders.
- Scene-linked Text follows actual swipe transport. Arbitrary mapped Image/Text
  cells change when the selected scene commits; they are not a new animation
  system. Existing standalone Image and Reception Text records are unchanged.
- Link edits use the existing Reception completed operation. Undo, redo, quota
  failures, save/reload, lease revocation and full private collection backup
  are exercised. Selected source, controller and camera point are explicit UI
  choices. Ordinary Display creation remains parked.
- Shared publication projection happens after selected and retained canvas
  versions have been assembled. A newer private local revision cannot replace
  an excluded public canvas. Private controller-scene mappings are omitted from
  publication; private content referenced by a public mapping blocks publication.
- The owner reader uses a scoped read-only artwork reader, not the owner Library
  store. It requests only referenced source IDs, ignores unrequested and obsolete
  batches, aborts when unused and exposes retry. This reuses the existing data
  repository without changing network, LSP or provenance semantics.
- Reception and its finite gallery share one scroll container. The public
  Canvases route uses that same page. The separate owner management overview
  remains available for creation, ordering and canvas details.

## Verification

- Complete Node suite: **1,490 passed**, zero failed/skipped. This includes
  publication, storage/backup, scoped source-reader lifecycle and production
  boundary tests. The final CSS-only correction was followed by the four
  design-system inventory checks and five new browser cases again.
- New browser suite: **5 passed**. Real desktop drag and Chromium touch events
  at **1920×1080** and **390×844**, local and public snapshots, live Text motion,
  image selection, static cell isolation, zero interaction writes, gallery,
  camera destination, focus/scroll return, save/undo/redo/failure/reload.
- Existing Reception boundary suite: **6 passed**; Text scene suite: **2 passed**;
  preparatory scene-boundaries suite: **2 passed**. Total **15 distinct browser
  cases**, with bounded repetitions after fixes. This is not the full browser
  release gate.
- Lint passes with the same **88** recorded observations; no new exceptions.
  Type checks pass (17 invalid calls and 3 production mutations rejected).
  LUKSO baseline checks: **5 passed**. Inventory: **4 passed**.
- Production build and build check pass; **831,504 initial JS bytes**.
  The aggregate lazy-runtime budget was explicitly increased from
  2,653,000/866,000 raw/gzip to 2,676,000/879,000 for persisted links, source
  editing, scoped source reading and the merged page. Startup, wallet, owner,
  CSS and asset limits were not raised. See the measured bundle report.
- Desktop, narrow, gallery and viewer screenshots were inspected. Source-button
  positioning was hardened against shared material specificity and gallery
  card geometry now responds to the bounded Reception width.

The two-tab regression exposed an actual editor remount when a blur saved the
brand name before Done received its click. Reception now retains its scene scope
through saves; content reconciliation remains separate. The regression passes.
Earlier browser failures also included wrong test-server configuration, hidden
viewer controls and a screenshot check incorrectly expecting an absolute zero
rail offset; diagnostic logs are retained. The final checks use the rail origin.

## Screenshots

- [Desktop Reception, 1920×1080](screenshots/local-1920-reception.png)
- [Desktop gallery, 1920×1080](screenshots/public-1920-gallery.png)
- [Desktop viewer, 1920×1080](screenshots/public-1920-viewer.png)
- [Mobile Reception, 390×844](screenshots/local-390-reception.png)
- [Mobile gallery](screenshots/public-390-gallery.png)

## Deployment and remaining evidence limits

PR #5 remains a draft on remote head
`3cfd6cf5da12218938d7706268ebd10bed890966`. Its Netlify status was read as
success during this turn; it does not contain or verify this local work.
The standalone Sites demo was not changed. Real signed upload, chain publication
and physical Safari/iPhone interaction were not exercised; Chromium touch tests
are the narrow-device evidence. No claim is made that the full application or
separate owner-management overview was redesigned.
