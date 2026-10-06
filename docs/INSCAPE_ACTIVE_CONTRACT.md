# INSCAPE active contract

Status: sole active product-direction document
Established: 2026-08-28
Product clarification: 2026-09-06 — public Workbench and independent modules
Rollback baseline before the documentation reset: `64458ac`

## Independent Image module

The founder accepted Image as a standalone Workbench module beside Display.
It holds one Library image per side, with no layers or nested composition.
One side holds one artwork source. Multiple sides expose a separate Next control:
every flip turns in the same direction and the last side wraps to the first.
The selected side is temporary reading state; reloading starts at side one.
Image has its own flat, borderless rectangular surface, without instrument-window
chrome, grain, shadows or rounded corners. The original media alpha is retained.
Canvas projection and clipping share one rectangle. Movement and snapping use
exact Workbench geometry, never rounded DOM positions. Crop projection uses
authored canvas dimensions independently of the camera. Only painting rounds
the projected edges to physical pixels, so adjacent modules share a boundary
through pan and zoom without rewriting authored geometry. Resting
artwork is 2D. Flip faces and perspective exist only during a side transition.
The requested side is prepared before the turn: raster media is decoded and
SVG media waits for its live document, including extensionless sources. The
visible side remains mounted while waiting; the prepared side retains its DOM
and live document when it becomes the resting image. Only these two sides are
mounted during a transition. Loading is bounded, failed preparation preserves
the current side and offers retry through Next, and closing or changing content
cancels obsolete preparation. The 600ms turn uses a symmetric easing curve.
Artwork briefly fades around the edge-on midpoint (30ms either side), softening
the dark stripe formed by compressing dark artwork. The rotating faces retain
their backface culling; the resting artwork remains fully opaque.
Each face retains its authored crop; the rotating plane can extend beyond the
resting canvas instead of being clipped again by its stationary rectangle.
Clicking the image opens the existing Display Lift renderer, revealing its
full media from the cropped rectangle. Return or Escape restores that crop.
Reduced-motion users get immediate side changes and inspection transitions.

Image and Display render SVG artwork through the same isolated document runtime
as Identity. Module-owned geometry still determines crop, resize, rotation,
mirroring and layer order. The document occupies that projected media rectangle
inside a clipped SVG viewport; it does not receive module editing input.
Owner, Visitor and enlarged inspection share this rendering path. Display
prepares SVG documents within its existing bounded five-slot Grid rail while
the module is visible, so incoming artwork can start before a swipe exposes it.
Documents outside that rail, or in a hidden module, are disposed. Other offscreen
projected documents restart when visible; their internal
animation state is temporary, not saved composition data. Display selects live
SVGs by rectangular bounds because a static alpha mask cannot describe animated
content. Raster artwork keeps its existing renderer. Saved URLs and schemas are
unchanged, and the runtime retains its existing restricted LUKSO RPC policy.

Width and height are independent whole-pixel dimensions from 32 to 4096.
Owner selection or keyboard focus reveals the complete Image bounds and contrasting
28-pixel resize targets. Corners resize both dimensions; midpoint handles resize
one dimension around the opposite edge. Targets keep their screen size through
zoom and are centred on their visible marks. Tiny surfaces keep more of the
target outside to preserve a movement area, while the whole mark stays clickable.
At viewport edges, hit areas
stay reachable while their marks identify the canvas edges. Redundant handles are
omitted on tiny canvases.
Resize focus fills the small visible handle mark instead of outlining the larger
transparent pointer target. Keyboard resizing retains visible focus.
The artwork itself is the move surface: clicking inspects it; dragging beyond
five screen pixels moves its window and never inspects on release. Movement is
temporary until release; Escape, lost capture or blur cancels it. Crop retains
its own pan gesture. The separate floating title strip is removed. Close and a
small Next arrow appear on hover or keyboard focus, and remain available on
touch. The side count stays in the accessible description and tooltip rather
than covering the artwork. On tiny or thin canvases these action targets sit
outside the artwork and resize handles so the canvas remains grabbable.
Shift-click or Shift+Enter on the artwork toggles Workbench selection; focused
window arrow keys move it. Resizing saves position and dimensions together
as one undoable operation; Escape cancels the preview. Keyboard focus remains
visible. Visitor shares direct movement, inspection and quiet controls without
editing bounds or resize controls. The contextual dock also offers exact
dimensions, shared rotate/mirror actions, crop pan/zoom and Native fit.
New artwork fills the canvas through a centred crop. Library drops append a
side by default; Replace side retains its position in the sequence and starts
the new artwork at its default crop/transform. Remove side is undoable.
Image resizing keeps the artwork proportions while filling the changing canvas;
the canvas edges remain the resize and snap targets. Previously native-fitted
sides acquire a centred filling crop during a changed-size preview and commit.
Existing crops retain their focus and zoom. Pointer, keyboard, selection and
numeric size edits use the same authored resize operation. Cancel restores the
previous fit; undo restores fit, dimensions and position together. Older saved
native-fit sides remain unchanged when opened or moved. Fit inside and Fill
canvas expose the existing fitting choices directly in Image tools; Fit inside
shows the full source and may leave space until the next authored resize.
The first implementation supports up to sixteen modules and 32 sides each.
Image tools offer Duplicate, creating an independent Image beside the original.
It retains authored dimensions, publication inclusion, every side's source,
crop and transforms, with new module and side IDs. The copy starts on the
currently viewed side and receives selection and keyboard focus; that side
choice remains temporary. Duplication saves the copy and its position in one
undoable operation, observes the module limit, and never resets an existing crop.
Dragging Library artwork onto empty Workbench space creates one Image module at
the preview's exact position, accounting for camera pan and zoom. The preview is
centred on the pointer and respects the Workbench boundary. Initial whole-pixel
dimensions follow the source proportions within a manageable 360-pixel size.
The centred filling crop matches other Library additions; Fit inside remains
available when the full source is preferred. Creation saves the artwork and open window
position in one undoable draft operation and selects the Image tools. Drops on
existing modules retain their own behavior; Display receives a Grid placement
and Image appends a side unless Replace side is selected.
An Image created by this drop is included in the next explicit publication by
default. Empty Images created through Add remain private. Existing visibility
choices stay unchanged, and Include Image in publication remains available.
Nothing uploads or publishes on drop. It shares the owner/Visitor renderer; Visitor can flip, inspect and
move its temporary window, with no editing tools or authored resize.

Optional `imageModules` extends draft v4 and public document v9. Each side
retains the canonical resolved Library asset and source metadata, as illustrated
Text already does, separately from crop and transform. Authored dimensions
belong to the module. `workbench.imageModules` stores only window position and
open state, avoiding a second saved size. Large canvases fit proportionally in
the available viewport; viewport fitting never rewrites authored dimensions.
Missing optional fields retain the old behavior without migrations, storage-key
changes or resets. Older publication restore retains missing local Images as
private. Asset-reference and document-size limits include Image content.
The ordinary draft store owns edits, persistence errors and undo/redo; current
Display sessions cannot overwrite Image content. Crop/drag state is scoped to
its originating module and side and ends on target/content change, close,
Preview suspension or disposal. Image loads lazily when present.

## Workbench background shapes

The founder requested coloured squares and rectangles to connect or sit behind
modules, replacing the need to use empty Text modules as background blocks.
Workbench Add > Shape creates a 288-pixel square at the context-menu invocation
point. The existing Workbench window host owns movement, edge/grid snapping,
resize, camera projection and selection; Shape owns only its name, colour,
opacity, grain and order among shapes. Shapes stay below content windows even while
selected. Their array order is the single authored back-to-front order, with
Lower, Raise, To back and To front actions; this is not a global reordering of
Display, Text and Image. Shapes have no title strip over the artwork.

The existing contextual tool window offers colour, opacity, grain strength, exact dimensions,
Make square, duplication, deletion and publication inclusion. Its shape selector
and the Workbench Shapes menu keep fully covered or hidden shapes reachable.
Dimensions range from 8 to 7992 work pixels and up to 32 shapes are supported.
The owner drags directly on a shape and resizes with the existing handles.
Visitor uses the same paint and camera projection without shape editing input.

Optional `shapes` extends draft v4 and public document v9. Name, colour, opacity
and order belong to the shape collection; `workbench.shapes` owns starting
window geometry and visibility. New shapes are included in the next explicit
publication by default; creation itself never publishes. Private shapes and
their layouts are excluded from public projection. Missing optional fields
mean no shapes, with no storage-key change or data reset. Restoring an older
publication retains local shapes as private, including their windows. The
existing draft store owns authored edits and undo; the existing local layout
cache retains temporary window movement and is invalidated by authored restore.
Existing empty Text modules remain unchanged.
Optional `shapes[].grain` stores strength from 0 to 1; omission retains the
previous flat fill without rewriting saved shapes. Shape reuses the Text/Display
grain texture, scale and strength control. Grain blends within the shape's fill,
follows its opacity and cannot intercept input. Duplication, undo, publication
and restore retain the authored strength; setting it to zero removes the texture.

## Text authoring

The Text module is a simple Tiptap editor with formatting, local saving and a
reader. On 2026-09-16 the founder removed NFT tools and all file import/export
from its scope. No article upload endpoint or token transaction flow remains.
One module holds one illustrated article, or a scene-linked sequence of articles
as described below; up to 16 standalone Text modules are supported per Workbench.
Workbench Add > Text places the new module's top-left at the context-menu
invocation point, accounting for camera pan and zoom and the Workbench boundary.
Content and its initial window are saved together as one undoable operation.
Existing modules and callers without a position retain their previous placement.
Write and Read use the same full content viewport as Visitor: no duplicate window title,
formatting toolbar or saved-status footer reserves space. Window actions appear
on hover or keyboard focus in a compact strip outside the text surface, and
remain available on touch. Read/Write, move into Display, Text tools and close
occupy equal cells; the strip and resize targets retain their screen size at zoom.
Read permits direct dragging from the text surface after five screen pixels;
links and reader buttons retain their own input. Movement commits on release,
and Escape, blur or cancelled capture restores the starting position. Write
retains native text selection and the separate window grip.
The optional title is edited directly in the document; Enter continues in the
body. It remains the existing article title, not a duplicate rich-text heading.
An absent title reserves no space. Add title opens its inline field; leaving an
empty field removes that temporary editing placeholder. Title alignment (left,
centre, right) and colour are independent of paragraph formatting. The title
inherits the document colour unless explicitly overridden.
Write opens its tools, Read closes them, and the settings action can reopen them.
Focus writing temporarily presents the same article editor in a full-viewport
native modal with its title, confirmed local-save status and Return to composition.
The same editor DOM, selection and undo history move between the composition
and the focused viewport; there is no second article copy or saved layout change.
The mode is available through Selection in Text tools for standalone and Display
Text. Existing article typography is retained while content reflows to the wider
reading area. A transparent article gets a temporary backing chosen for contrast
with its existing body ink; authored appearance is unchanged.
Escape and Return restore the inspector trigger and reveal the current cursor
in the original viewport. Ctrl+F returns to the existing search controls.
The modal contains keyboard focus and its input cannot select or move underlying
Display layers. Disabling, suspending or disposing the editor ends the temporary
mode. Save failures remain visible and returning exposes the existing recovery
actions. Focus writing does not affect public presentation or publication.
The owner has one shared Text tools window for standalone Text and Text being
edited inside a Display. Selecting another Text retargets this window without
moving it or changing either article's Read/Write mode. Explicit closure remains
closed until reopened. A non-Text target, closed module or Preview hides the
Text controls; returning to Text restores the open tool at its previous screen
position. Its header identifies the current article. Editors, selection/undo
history and failed-save recovery remain scoped to their originating articles.
Within an unlocked Display, an open Text tool follows the selected Text layer.
Formatting, appearance, artwork captions and save recovery belong
to a separate movable Text tools window. Save failures expose a small output
indicator; Retry reads the latest saved draft and preserves unrelated edits.
Conflicting text requires an explicit replacement choice. Failed recovery never
resets the draft or reports an unconfirmed save as successful.
New Text starts with its dark background colour enabled and remains frameless. Background colour/opacity and the
frame are independent authored settings; older articles retain their appearance.
On 2026-09-29 the founder accepted the compact vertical Text inspector proposal,
with freedom to depart from the other instruments' visual chrome. Text tools
uses Text, Layout and Appearance tabs and explicit Document, Selection and Title
formatting targets. Selection controls keep the originating Tiptap editor and
history mounted when another target or tab is shown. The tool has a 326-pixel
width, no resize handles and quiet opaque surfaces; it retains the bundled interface
fonts. Text tools and Focus writing controls follow the selected system window
theme, including their selection and focus colours, rather than a separate
green palette or operating-system light/dark preference. Authored article
colours remain independent. Height follows its content,
and overflow scrolls inside the panel. It opens beside the module's visible
screen rectangle, preferring the right side, without resizing or moving the
article. The target title remains visible in the movable tool header. The module
action strip remains reachable while tools are open. Typography and formatting
use compact rows. Display connection stays available below every tab: Follow
Display is directly visible and Move into Display remains an explicit separate
action. Read as pages belongs to Layout. Publication inclusion and confirmed
save/recovery status remain below the settings. Edges, texture and background
belong to Appearance; columns and inner spacing belong to Layout. Tabs and
formatting targets are temporary UI state, with no article schema or storage-key
change. This redesign does not introduce automatic cloud draft sync or linked
text-frame flow. The founder intends Text to support illustrated articles and
artbook composition; additional authoring capabilities require concrete workflows.
Library artwork enters through direct drag
into the text; there is no separate artwork-selection dropdown.
The Library passes the release point to the receiving module. Text resolves it
against its live editor, including scroll and zoom, and inserts without replacing
an earlier selection. Insertion starts a separate editor undo step. Library owns
drop routing and stale-target checks; Text owns the article position and save.
Text tools offers optional per-side inner spacing in text pixels, including zero.
Custom spacing uses the full available text width; Automatic retains the existing
responsive padding and reading-width limit.
Automatic bottom spacing in standalone Text yields to the available height when
the article itself fits, avoiding scrolling solely for empty end space. Longer
articles retain scrolling and their normal end spacing; custom padding is respected.
Optional `appearance.padding` belongs to the article and travels through draft,
publication, restore and Display transfer.
Articles without it retain their existing layout without a migration or reset.
Dragging the Text move handle onto an unlocked Display attaches it to that Grid;
dragging its handle out detaches it as a private standalone Text. The tools also
offer keyboard-accessible move actions. Each move is atomic and undoable, retaining
rich formatting and appearance. A drop preview identifies the receiving Display.
Text is owned once, either by its independent module or by its Grid placement.
Writing uses labelled icon controls and retains its undo history across Read.
Link validation accepts the editor's optional null `title` attribute as equivalent
to omission. Non-null link titles remain unsupported. Existing links are not
rewritten; the normal HTTPS/mailto checks and publication validation still apply.
Paragraphs and headings support left, centre and right alignment, plus
justification with the last line left, centred, right or fully justified.
Optional block alignment is shared by Write, Read and Visitor; older articles
without it retain their existing appearance.
Write and Read share typography, white-space handling and font features so
authored spaces, line breaks and ligatures cannot silently reflow at the mode
switch. Selected text supports an explicit colour and a return to document
colour, alongside the existing font and formatting marks.
Text supports one continuous body arranged into one, two or three
columns with an authored gap of 0–128 text pixels (24 when omitted). The title
spans the body width. In two- and three-column compositions, the available frame
height below the title and inside the authored padding determines the column
breaks: fill down, then continue to the right. Resizing reflows complete lines;
extra columns are clipped at the frame edge and the owner sees “Text doesn’t fit”.
The full article remains saved and available through Focus writing, which keeps
its continuous editor. One-column articles retain contained scrolling; the
explicit page reader retains its pagination. Write, Read, Visitor and Display
share the bounded column layout. Existing multi-column articles acquire this
height-aware layout without rewriting their content, identifiers or settings.
This is flowing article content, not separately editable column modules.
On 2026-09-30 the founder accepted linked, freely positioned Text frames with
direct writing in every frame. The + action adds a continuation after that
frame; its own position, width and height determine how much of the article
fits. Text flows through the authored order and reflows when any frame changes.
The title appears in the first frame. Removing a continuation preserves the
entire article and flows it through the remaining frames. Closing the original
Text minimizes the whole chain. The owner sees frame numbers, connection lines
while selected, and an overflow notice on the final frame when content remains.
There is one article, selection and editing history across the chain; typing,
formatting and undo in a continuation act on that same document. Focus writing
remains an optional continuous view. The initial implementation permits eight
frames per article, sharing its typography, appearance and publication setting.
Follow Display, Read as pages and moving Text into Display are unavailable while
continuations are attached; remove them to use those existing workflows.
The optional `workbench.texts[].frames` array stores only continuation identifiers
and geometry, in reading order. The existing Text record remains the sole saved
content. Measured break positions and editor projections are temporary, rebuilt
when content, fonts, media or frame bounds change. Publication and restoration
retain frame order and geometry. Older layouts without this field retain their
existing single-frame behavior; no storage key or existing article is rewritten.
Optional `appearance.titleAlignment`, `titleColor`, `columns`, `columnGap` and
`textStyle.color` are validated by the existing article boundary and retained
through draft, Display transfer, publication and restore. Omitted fields keep
left title alignment, inherited colour and one column; older font-only marks
remain readable. No storage keys change and no saved content is rewritten.
The shared Workbench window owns geometry and lifecycle. Tiptap loads only for
authoring. Library images retain their resolved asset identity and source
information separately from authored captions and alternative text.
Source information remains stored with inserted artwork, but is not displayed
as an Artwork info section in Text. Authored captions remain optional.

Plain-text paste preserves authored line breaks, including CR, LF and CRLF,
and starts its own undo step. Empty or image-only clipboard data does not erase
the current text selection. Pasted HTML is not imported as article formatting.
Embedded artwork uses the editor's native drag handle to reorder within the
article. Selected artwork also offers Move artwork up/down for keyboard and touch
use. These actions swap adjacent blocks within their existing parent, preserve
the artwork source, caption and alternative text, and retain node selection.
Parent constraints, including a list item's first paragraph, are respected.
Each move is undoable through the existing editor history and saves through the
originating module. No article schema or storage keys change.

Optional `texts` extends the existing profile draft and v9 public document;
`workbench.texts` carries starting windows. Typing saves through the existing
profile draft store. Public articles use the normal Workbench publication flow.
Older documents remain readable without storage-key changes or content resets.
Legacy draft NFT bindings are accepted as unused compatibility data, never used
or published; new records and restored public articles do not create bindings.
Restoring an older publication retains missing local articles as private.

Article typography may use Sora, IBM Plex Sans Condensed, Literata, Cormorant
Garamond and IBM Plex Mono under their bundled OFL licenses. The three additional
families are authored article choices, not alternative interface fonts. Existing
Sora/Plex interface typography remains authoritative.

Text tools exposes a separate Title size when an optional title is present.
Optional `appearance.titleFontSize` accepts 8–300 pixels and travels with the
article through saving, Display transfer and publication. Omission retains the
existing 28-pixel title; body Text size remains independent.

Selected text also supports its own size (8–300 text pixels) and tracking
(letter spacing from -0.1 to 1 em). These are optional numeric `textStyle.fontSize`
and `textStyle.letterSpacing` marks on selected words, paragraphs or body
headings, separate from document-wide size. Mixed selections show Mixed;
clearing either override restores inherited styling without removing other
marks. Valid numeric edits apply immediately while the field retains focus.
Incomplete or out-of-range input stays local; finishing restores the last valid
value. Clearing a field resets its override on Enter or blur. Escape restores
the formatting from before editing that field, including mixed selections.
The existing plain-text article title has independent tracking through optional
`appearance.titleLetterSpacing`, alongside its existing title-size control.
A small index, classification or sub-label such as ARCHIVE // 01 is an ordinary
body line styled with these same controls, without a separate metadata field.
Write, Read, Visitor and Display Text share these authored values. Saving,
undo/redo, Display transfer, publication and restore retain them. Existing
articles without these optional values keep their appearance and storage keys;
reading them does not rewrite their content. Tracking is relative to the styled
text's font size and follows the existing content and Workbench scaling.

Text tools also offers Title gap and individual paragraph/heading space before
and after, from 0 to 512 text pixels. A cursor targets its containing block;
a text selection targets the covered blocks. Optional numeric `spaceBefore`
and `spaceAfter` block attributes retain spacing alongside alignment, and
optional `appearance.titleGap` controls space below the separate article title.
Explicit adjacent before/after spacing adds without margin collapse. Clearing a
value restores the existing defaults, including compact Text and the 20-pixel
title gap. Blank paragraphs remain authored content and are never removed by
spacing edits. Line spacing and font sizes remain independent.
Mixed values, immediate valid edits, Escape cancellation and reset use the existing
numeric controls. Write, Read, Visitor and Display share the spacing projection;
draft saving, undo, transfer, publication and restore preserve it. Missing values
keep old layouts without rewriting saved articles or changing storage keys.

When an authored line break or saved newline joins several lines in one
paragraph, Text tools identifies that shared paragraph and offers Separate this
line. The action isolates the cursor's line as its own paragraph or heading,
retaining inline formatting, block alignment, surrounding text and outer
spacing. New internal boundaries start at zero spacing. It is one undoable
editor operation and does not change saved schemas. It is unavailable for a
selection spanning lines or for wrapping caused only by available width;
spacing controls continue to target real paragraphs, without automatic splits.

On 2026-09-29 the founder requested line spacing and verification with longer
illustrated articles. Optional `appearance.lineHeight` sets body line spacing
as a unitless font-size multiplier from 1 to 3. Optional paragraph/heading
`lineHeight` attributes override it for the cursor's block or selected blocks.
The separate title and default heading leading remain unchanged by the body
setting. Selection can explicitly change heading leading. Document reset removes
the optional appearance field; block reset returns to inherited/default leading.
Missing values preserve the existing 1.65 body, 1.2 compact body and 1.3 heading
defaults. No storage key changes or old-data rewrite are required. New readers
must support these optional fields to open newly authored documents. The existing
article validator, draft store, transfer and publication boundaries retain them;
Write, Read, Visitor and Display use the same projection. Numeric fields retain
mixed-state indication, immediate valid edits, Escape cancellation and undo behavior.
Text windows remain fixed-size, resizable viewports with contained scrolling;
this change does not introduce automatic window growth or linked text frames.

The article editor also supports reusable heading and artwork-caption defaults
under Text → Document → Heading & caption styles. Optional
`appearance.textStyles` contains only `h1`, `h2`, `h3` and `caption` roles. Each
role may specify a bundled `fontFamily`, `fontSize` (8–300), six-digit hex `color`,
`lineHeight` (1–3), or `letterSpacing` (-0.1–1 em). Body defaults remain owned
by the existing document typography controls; the separate title keeps its own
controls. Role changes apply to all matching content without rewriting nodes.
Explicit text marks and block spacing override role defaults. Removing an
override restores existing stylesheet defaults. Old articles require no migration;
readers need these optional fields to open newly styled articles. Write, Read,
Visitor and Display share their projection; save, undo, transfer, publication and
restore retain them.

Selection includes a collapsible Outline derived from the live editor document.
Its heading buttons move the cursor and scroll within the article. Labels,
positions and the active heading are temporary views, never saved copies.

Selection also offers Find and replace for the article body. Ctrl+F (Cmd+F on
Mac) while the body editor is focused opens its inspector and search field;
other page fields retain browser Find. Search is literal and ignores case,
spans inline formatting but never crosses paragraph, hard-break or artwork
boundaries. The title and artwork captions are excluded and labelled as such
through the body-only scope. Matching uses document positions without changing
authored text. The first match scrolls into view; Next/Previous and Enter/
Shift+Enter navigate with wrapping. Escape closes search and restores focus
to its trigger. Closing or retargeting the inspector, Read and Preview discard
the originating editor's temporary search state and highlights.

Replace match and Replace all use the existing editor save/recovery path. Each
action is independently undoable. Replacement inherits the first matched
character's marks; text and formatting outside matches, links outside the
replacement, and artwork references remain untouched. Empty replacement deletes
only the matched text. A candidate article must pass the existing validator
before any replacement is applied. Bulk replacement is limited to 1,000 matches
per action with an explicit refine-search message above that limit; it never
silently replaces a subset. Highlight rendering is limited to 500 near the active
match while the full count and navigation remain available. Search does not
change article schemas, draft storage keys, publication or module authority.

Document also offers a portable article JSON backup, including the current
working edits when browser saving fails. Opening a backup validates it before
an explicit Replace article action; cancellation changes nothing. Replacement
uses the existing module save/conflict/recovery boundary and preserves the
module's connection, visibility and geometry. A changed article invalidates the
pending replacement; file reads belong to their originating profile, module
and passage. Replacement is disabled while local edits need recovery. Files
contain the article and artwork references, not image bytes, profile credentials,
module IDs or Display connections. Download does not claim a confirmed save to
disk. This is manual portability, not cross-device synchronization or a change
to localStorage/IPFS publication. Failed-save memory recovery and its leave guard
remain in place; the file provides an explicit recovery copy across reloads.

## Scene-linked Text and reading pages

A standalone Text may explicitly follow one Display through Text tools. New links
use one full article: explicit page breaks divide it into sections, in Display
Grid order (excluding the cover). Section one follows Grid one, regardless of the
Grid or reading page selected when linking. Write edits the full article; Read
and Visitor show the current section with contained scrolling for overflow.
Resizing never changes section boundaries. Grid changes reset section scrolling;
Text scrolling does not advance the Grid. Unmapped sections remain authored but
are not published. New links store `sceneLink: { mode: 'sections', displayId }`
without automatic reading-page pagination. Publication excludes private Grid
sections; restore merges retained local sections using the respective Grid orders.

Existing passage links retain their previous behavior: their
original article is the passage for the Grid selected when linked; additional
Grids own separate passages within that Text record. Missing passages start empty
with the original article's typography. Repeated scenery uses distinct Grids for
distinct story moments. Display owns navigation and reports its current Grid and
temporary swipe progress through a Workbench-scoped connection. Text follows that
report without choosing or advancing the Display's Grid. A closed or missing
Display shows an unavailable prompt and preserves its passages.
Text tools always offers explicit Unlink Text from Display, including after that
Display was removed. Section links retain the entire unchanged article as
standalone Text. Legacy extra passages become separate private Text modules,
preserving each complete article and appearance. This is one undoable saved
operation; insufficient module capacity or failed persistence leaves the link
and every passage intact. Missing Display guidance identifies removal instead
of asking the owner to reopen a nonexistent Display. No schema migration occurs.

Existing passage links enable Read as pages. Automatic overflow pagination and optional authored
page breaks divide one rich article into reading pages. Small previous/next
controls and a page count turn only the text; the last page stops. Returning to a
Grid starts its passage at page one. Page position is temporary and never saved.
Read and Visitor share the reader and reduced-motion behavior. Write retains one
continuous editor. Scene-linked Text remains on the Workbench rather than being
transferred into a single Grid and losing its other passages.

Optional Text `sceneLink` and `pagination` fields extend draft v4 and public v9;
`pageBreak` is an optional rich-text leaf. Existing records retain scrolling and
their previous interpretation without rewriting. Publication omits passages for
private or missing Grids and Text linked to an excluded Display. Restore retains
missing local passages for the same linked Display. Save, recovery, and undo use
the existing profile draft store. Window geometry remains independent of passages.

## Removed artwork animation

On 2026-09-20 the founder removed the Animation module, Float/Flicker and the
layered-character assembly/playback experiment to focus on core Display navigation
and authoring. This removes the Animation window, effect authoring and playback
controls, layered source preparation, Pixi renderer and assembled-frame cache.
Display, Visitor and inspection render ordinary selected artwork media. Layered
characters are not assembled into a replacement static representation.
Click-to-move is not part of current scope.

The founder confirmed that no saved drafts or animation data require compatibility.
Placement/group animation and layeredArtwork fields, authoring actions and tool
window state are removed rather than retained as dormant compatibility code.
Existing ordinary static compositions retain their schema and behavior; there is
no storage-key change, migration or draft reset.

Grid dragging, momentum, wraparound, Play Grids and inspection transitions remain
Display behavior. Removing artwork animation is not proof that Grid transition
stutter is fixed. Validate navigation with representative static compositions.

## Keeper dock

The founder requested a focused Keeper on 2026-09-29: Add → Keeper dock,
then drag one Library image onto it. Clicking releases the inhabitant onto
the Workbench; clicking again recalls it. The dock remains present and movable.
Replacing its image replaces its single inhabitant. Ordinary characters retain
the original whole-image Flip movement. On 2026-09-30 the founder also requested
Layered swim for a prepared Keeper with one body and independently floating
tentacles. These are per-character choices, not a replacement for other
characters' flip behavior or a restoration of the removed Animation module.

The Keeper wanders with pauses in a zone beside the pointer and leaves space
around it. Pointer tracking is continuous, including over controls and during
drags. Crossing the Keeper's vertical centre immediately starts a flip towards
the pointer, independently of flight direction or a rest. The short flipcard
turn uses the vertical axis; reduced motion switches facing immediately.
Flight follows with damped acceleration and braking. A resting Keeper still
responds to pointer movement; its wandering destination moves with its zone.
The owner can identify whether the source artwork faces left or right. Roaming
does not intercept Workbench clicks. Reduced motion disables this locomotion.
Return/release remains available by keyboard. On 2026-09-30 the founder also
requested interactive text carried by the character's token. Releasing then
clicking the head (or activating it by keyboard) opens a conversation. Automatic
travel pauses while idle tentacle motion continues. The founder's 2026-10-01
refinement keeps explicit click/right-button swim steering available during chat;
arrow keys on the focused head nudge it. Manual steering cancels a reaction and
invalidates pending AI movement, then settles at the chosen destination.
Closing resumes ordinary movement. The upright bubble fits the viewport and offers authored replies,
Close and Escape with focus returned to the head. Owner and Visitor share the
same player. LSP1 reactions, minting, contract changes and script execution are
not introduced here.

On 2026-09-30 the founder requested connecting their own ChatGPT account to
talk freely with Keeper. The first implementation is an optional AI chat mode
in the existing conversation panel, available only in the local development
app. Continue with ChatGPT opens OpenAI's sign-in and consent page. The local
server owns OAuth, verifies identity, lists the account's eligible models and
streams text replies. It uses the documented subscription-sharing route;
there is no browser API key, paid API fallback or public hosted integration.
The authored dialogue remains separately usable. A few bounded dialogue
excerpts may provide character voice when a message is sent to OpenAI.

Account access and the last twelve completed exchanges belong to a temporary
server session scoped to browser, profile, dock and asset. They never enter
the artwork, draft, undo history, publication or blockchain. Tokens remain in
server memory; only a public installation identifier is persisted. Server
restart clears connections and chat. Disconnect clears local access and asks
OpenAI to revoke the token. Closing the panel stops an active reply; partial
or failed replies are not added to history. Hosted access and persistence require
a separate accepted design.

On 2026-10-01 the founder requested conversational gestures and nearby artwork
awareness. Each reply may request one bounded reaction: curious head tilt,
startled spread, approach or retreat. Only Keeper moves, by at most 160 screen
pixels, through its existing motion loop. Following the founder's 2026-10-01
visual examples, the conversation uses a rounded, subtly grained speech bubble
with a tail, at most 320 by 330 screen pixels. It follows actual travel but not
idle bob or head rotation. Long replies scroll; the default view shows the latest
reply, with History available. Account, model and sharing controls occupy a
separate settings view within that same bound. The user can disable gestures;
reduced motion suppresses them.
The founder's 2026-10-01 reply-style refinement calls for concise, clean speech:
normally one to three short sentences, with real paragraph breaks and restrained
character humour. Metadata plus visual review defaults to two short paragraphs.
Internal scene labels, addresses and protocol details stay out of ordinary
conversation unless requested or needed for clarity. Explicit requests for a
full breakdown may expand the answer. This is response guidance, not truncation
of streamed text or a rewrite of the character's authored dialogue file.
Closing, changing mode, focus loss, recall, asset changes and disposal cancel
the reaction. Invalid, incomplete or stale model actions never execute.

Optional Share artwork details sends up to eight rendered Image/Display
artwork titles, relative locations and known token identities when the user sends
a message. It defaults off. Following the founder's 2026-10-01 metadata request,
Keeper may request one public LSP8 metadata lookup for at most two supplied
LUKSO artwork identities per reply. The browser rechecks each visible target
and uses the existing strict Library token metadata reader; the AI gateway does
not fetch model-supplied URLs. Results expose bounded name, description, traits,
token identity, read time and source. Unsupported identities, changed targets,
failed reads and missing metadata remain distinct; they do not imply absent
metadata or establish creator attribution, holding, issuance or control.
The shared resolver's short-lived contract context cache remains in use; token
metadata is read on request. Only the completed spoken answer enters temporary
chat history, not raw tool output. Closing or replacing the conversation aborts
the read and discards late results. The founder also requested visual recognition
on 2026-10-01: Share artwork
previews opts into sending at most two source-artwork stills, selected first then nearest, rasterized
to PNG with a longest side of 512 pixels. SVG uses the browser's non-scriptable
image decoder. These are source previews, not screenshots of the workspace,
current crops or live animation. Source access failures are visible; no preview
is substituted silently. Previews require a model accepting image input and use
the connected plan allowance. Bytes are sent for the current request only and
are not retained in chat history, status, drafts or publication. There is no
automatic capture, desktop inspection, document text or Library inventory access.
Modules explicitly expose title/identity/source/token cues; Keeper reads only its own
Workbench and rechecks targets before acting. Names and image text are untrusted
content, not instructions; the same applies to metadata fields. The AI
has no object-editing, browser, wallet, durable-memory or autonomous polling tools.

On 2026-10-06 the founder continued with Keeper selection awareness. With Share
artwork details enabled, each Send reads the existing Workbench module selection
or, when none is selected, the Display artwork selection. The bounded scene
identifies selection scope/count and prioritizes selected visible artwork for
its eight references and two optional previews. Selecting a Display module does
not mean one particular artwork inside it; ambiguous, hidden or unsupported
selections require clarification. Opening, using and closing Keeper conversation
preserves Workbench selection. Selection remains temporary and is not copied
into chat history, saved drafts or publication. Sharing defaults remain off.

An open conversation survives switching to the sign-in tab: its artwork pauses
while the page is inactive and resumes on return. Ordinary roaming still docks
on focus loss. Pending pointer gestures always clear when the page loses focus.

Keeper dialogue is read on interaction from text/JSON attachments in the
inhabitant's LSP8 token metadata, using the shared token metadata resolver.
It is not a second stored draft field: existing canonical token identities work
without re-adding the artwork. Each opened conversation reads current metadata;
publication retains the token reference, not a frozen copy of its dialogue.
Declared metadata/file verification hashes are checked against fetched bytes.
The UTF-8 `.txt` file contains JSON with `format: "inscape.keeper-dialogue"`,
`version: 1`, `language`, `start`, and `nodes`. Each node has plain `text` and
`choices`; each choice has `label` and a valid `next` node. Empty choices finish
a branch. No HTML, executable commands or external reply actions are accepted.
Reads are bounded to eight text candidates, 256 KiB per file and 25 seconds for
the conversation request; documents allow at most 512 nodes and six replies per
node. Loading, no attached dialogue, invalid/unavailable files and Retry remain
visible. Closing, recall, asset replacement, suspension and disposal cancel or
ignore obsolete work. Conversation progress is temporary and never writes the
draft or publication.

Layered swim accepts the founder's prepared SVG layout: a `keeper` group with
one `body` and numbered `tentacle-N` groups, each containing a positioned,
cropped, embedded PNG or WebP image. The importer reads only bounded raster
resources and numeric geometry; imported SVG markup and scripts never enter the
application DOM. Unsupported geometry and failed loads remain explicit errors
with Retry. This is a focused Keeper format, not a general SVG rigging editor.
Each tentacle traces an independent, subtle figure-eight. The head leads turns
continuously through 360 degrees; tentacles follow with different delays.
Actual travel speed determines gathering and opening on braking. The founder's
2026-09-30 tuning refinement requests faster travel and gather/spread response,
plus head-first turns with tentacles regrouping one by one around the body.
The sequence follows turn direction: for the right-facing source, clockwise
turns begin at the top of the tentacle fan; counterclockwise turns begin at the
bottom. Geometric order, rather than SVG group order, determines the sequence;
left-facing sources mirror it. Each direction's delayed angular travel remains
continuous when retargeting mid-turn, including across the angle wrap boundary.
Keeper tools expose swim speed (80–900 px/s, default 420), gather time (0.1–3 s,
default 0.4), spread time (0.1–3 s, default 0.55), head turn time (0.1–2 s, default
0.4), and tentacle stagger (0–0.2 s apart, default 0.06). Response times describe
roughly 90% approach to a settled target; travel speed and retargeting continue
to affect the pose. Enter or leaving a field saves one undoable change and
applies it to active swimming without resetting the creature. Reset swim tuning
restores these defaults. Existing artwork is reused through position and rotation;
mesh deformation and separately animated eyes/patterns are not part of this step.
Completed clicks on empty Workbench space choose temporary swim destinations;
controls, editing, modified clicks and left-button drags do not. Holding the
right mouse button from empty Workbench space continuously retargets a released
swimming Keeper to the cursor, including while crossing module windows. Release
ends tracking and retains the last indicated destination. Only that gesture's
context menu is suppressed; controls, modified right-clicks, docked/returning
Keepers, chat controls and reduced motion keep ordinary context behaviour.
Escape or pointer cancellation stops tracking; disposal, recall, mode changes,
suspension and focus loss cannot leave a hold active. The hold is temporary,
uses the existing swim speed, head turn and tentacle motion, and is shared by
owner and Visitor. Flip retains its original
pointer-following behavior. Both modes share flight, recall, bounds and cleanup.
Reduced motion holds the layered artwork still and retains dock controls.

On 2026-10-02 the founder requested a segmented snake using these same controls.
A prepared `keeper` group marked `data-keeper-rig="snake"` contains `body`, `eye`
and consecutive `segment-N` embedded raster groups (at least two segments, at
most 50 total parts, with the existing decoded-pixel and dimension limits).
Layered swim detects this artwork kind without adding a saved movement mode or
rewriting old docks. The head follows existing click/right-hold destinations;
the chain follows its recent path with an S ripple. Speed opens segment spacing;
braking gathers it again. Gather/spread and head-turn controls retain their
existing saved meanings; tentacle stagger and left/right source facing are
irrelevant to a snake and remain preserved but hidden. Segment geometry supplies
its source heading. The separate eye translates with the head while keeping its
orientation; the surrounding head rotates about the eye. Flight, conversation,
recall, reduced motion and disposal retain the existing shared lifecycle.
Only bounded temporary path history and part poses are introduced. Raster
conversion preserves the original vector files and embeds cropped WebPs into
new SVG copies; no executable behavior is imported from artwork.

On 2026-10-04 the founder requested a hybrid octopus from a Library LSP8
artwork. A prepared `keeper` group marked `data-keeper-rig="octopus"` supplies
one cropped embedded WebP/PNG `body`, one to eight consecutive `tentacle-N`
vector outlines with gradient stops and root/tip coordinates, and one to four
consecutive `eye-N` groups with separate apertures, gaze shapes and lids. This
uses the separate SVG float movement choice (`movement: "svg"`), as refined
by the founder after reviewing the initial Layered swim treatment. It has no
hard-coded token ID, artwork URL or bundled production character. The importer reads bounded numeric path commands and
hex colors into application-owned shapes; imported markup, scripts, external
resources, styles and arbitrary transforms never enter the application DOM.
The founder's four directional references refine SVG float: never mirror the
artwork, keep the head level through upward travel, bank for sideways travel,
and tilt farther for downward travel. Tentacles trail opposite actual motion,
including above the head during a descent; braking returns to the authored
hanging pose. Eyes look toward the destination during travel and resume pointer
attention at rest. Source left/right facing is irrelevant to this mode and is
preserved but hidden. Travel, gather/spread and stagger use the existing controls. Flip and Layered
swim keep their existing behavior, including full rotation in Layered swim.
Selecting SVG float is explicit and undoable; old docks are never auto-switched.
It shares destination/recall and lifecycle ownership with the existing dock,
but uses a separate artwork orientation model. Eyes look toward pointer attention
and blink; a fixed pool of at most eight detached goo drops falls in screen space
and fades. Animation uses the existing dock clock and temporary pose only.
Conversation keeps gentle idle motion, recall clears droplets, inactive talking
freezes the artwork, and reduced motion holds the authored pose. Owner/Visitor,
Library selection, publication, viewport sizing and existing raster/snake rigs
keep their shared boundaries. Raster conversion writes a separate 2048-square
upload SVG and preserves the source illustration.

The first implementation permits four docks per profile. Optional `keeperDocks`
records in draft v4 and public document v9 retain the name, canonical Library
image, source facing and owner publication choice; optional `movement` selects
`flip`, `swim` or `svg`, with omission preserving Flip without rewriting old records.
An optional complete `swim` record retains `speed`, `gatherSeconds`,
`spreadSeconds`, `turnSeconds` and `staggerSeconds`. Omission reads the new swim
defaults without rewriting old data. Flip ignores these settings but preserves
them when switching modes. The choices use the existing undo, draft, publication and restore boundaries;
parsed artwork and animation state are temporary. `workbench.keeperDocks` retains
dock positions. Optional `size` is the square artwork envelope in screen pixels,
from 64 to 384, editable in Keeper tools and retained through undo, publication
and restoration. New docks start at 192; older records without size retain 128
without a rewrite. Narrow viewports fit only the temporary rendered creature
and leave the authored size intact. Missing fields mean no Keepers, with no reset or storage-key
change. New docks start private. Only explicitly included docks enter Preview
and publication; their visitors use the same release/return component.
Old-publication restoration preserves local docks privately. Roaming state is
temporary and starts docked on reload; motion stops on disposal, preview
suspension, page hiding or loss of window focus. Ordinary artwork media is used
as an image; any intrinsic image animation remains the source's own behavior.

## Persistent artwork groups

Display supports persistent, non-nested artwork groups within one Grid. Layers
offers Group layers for two or more ungrouped artwork placements and Ungroup for
one complete group. Text is outside this first version. Grouping preserves exact
placement geometry, crop, transforms, source identity and stacking order, including
unrelated artwork between group members. Selecting a member selects its whole
group; movement, resizing, transforms, duplication and removal reuse the existing
multi-placement operations. Lock and temporary editor visibility act on all members.
Individual geometry edits and composition spacing require ungrouping first.

Optional Grid `groups` records own IDs and `placementIds`. Membership is stored
once, not copied into placements. Ungroup retains the authored arrangement;
undo restores the group. The Display owns membership, independently of the host
and Library.

Draft-v4 and public-v9 accept the optional Grid field, including World Cover and
additional Displays. Old documents without groups retain their interpretation and
are not rewritten on read. Save, recovery, undo, duplication, publication and
restoration retain groups. Duplication creates independent group and member IDs.
Dangling, overlapping, nested, private-member and partially locked groups are invalid.

## Removed Mirror module

The founder removed the Mirror animation module on 2026-09-17. Its runtime,
creation controls, demo and `animations` draft/publication field are removed.
The founder confirmed that no saved compositions require Mirror compatibility.
Display and Mobile image-flipping controls are independent and remain available.

## Mobile entrance and Index

The isolated mobile prototype establishes a two-sided artwork-led entrance.
Tapping the front reveals the profile metadata on its reverse; tapping the
reverse returns to the front. Every turn continues in the same direction.
Works is a separate action on the reverse, with a compact preview of the first
authored entries. There is no extra About dialog. The reverse presents the existing
Identity bio, tags, links and nonempty authored fields. The founder approved
profile and publication integration on 2026-09-12. The original standalone
projects remain preserved as visual and interaction references.

The integrated Mobile module owns one presentation per profile. Owner opens its
portrait editor through Workbench Add. Editing happens directly on its output;
Layers and Settings occupy a separate, movable companion window that can close
and reopen but does not dock into the portrait. Display retains its existing
attached/detached behaviour and its frame feature is outside this change.
Mobile authoring uses the existing profile
draft store and publication action, with no separate metadata or storage owner.
The optional draft `mobile` field starts private. Explicit inclusion projects a
validated presentation into the optional v9 publication `mobile` field.
Version 1 remains readable without changing its appearance. The next authored
edit upgrades it to version 2, adding neutral rotation and mirror settings for
the three fixed roles. Editor open/close does not upgrade content.
Older drafts and publications without Mobile remain valid; restoring a document
without Mobile preserves any local Mobile composition as private.

The standard design canvas is 1080 by 1920 (9:16). Foreground artwork, alpha mask
and controls share that canvas and fit without viewport cropping. The background
fills the screen and may crop. Standard Library compositions fit horizontally
centred and bottom-aligned, so taller screens add background above the composition,
not a strip below its artwork. Existing saved coordinates, masks and scales stay
unchanged; this rendering correction applies to existing drafts and publications
without rewriting them. Deliberate artwork scaling, positioning and cover-fit
cropping still apply. The custom Steyra depth study retains its centred canvas.
The editor provides the resolution, a downloadable
SVG guide. Placement snaps invisibly to 12 design-pixel increments; no snapping
grid is drawn. Background, artwork and mask
come from Library; image fit, scale, position, background colour and an optional
thin mask border are authored settings. Identity and functional icons can move,
but their text and meaning remain owned by INSCAPE and the profile. The official
username appears on the front. The reverse matches Desktop Identity: the authored
title appears as a small uppercase label above the prominent official username,
omitted when identical to the username. A title never replaces the
official username in Mobile.

Mobile has three fixed image roles, not an arbitrary layer stack. Each supports
quarter-turn rotation and horizontal/vertical mirroring. Artwork can move and
scale inside the mask, with contain/cover crop settings. Duplicate, frame and
layer stacking-order controls are not included. The window shell and transform
buttons are shared with Display; each module retains its own state and actions.
Locking and hiding elements are temporary editor aids. Edit mode selects and
manipulates content; Preview restores visitor interactions. Gallery headings and
introductory copy are edited in place and tiles reorder directly. Collection
names matching a work's fallback name are not repeated as tile captions.

Draft asset references retain stable asset IDs and media selection. Publication
resolves the selected assets using the existing canonical metadata projection;
published metadata is a snapshot refreshed by explicit publication. There is no
second title, description or attribution editor. Missing sources must remain
unavailable rather than becoming fabricated content or successful empty reads.

Owner preview and Mobile Visitor use the same renderer. Phone visitors enter the
Mobile presentation without loading the desktop Workbench; desktop visitors do
not load the Mobile renderer or editor. A profile without a published Mobile
presentation has an explicit unavailable state and an optional desktop action.
Theme persists across the card, Index and viewer. The founder's Steyra renderer
and separate Through the Eye / seven-layer experiment are curated custom work,
not a default template for other profiles. Executable imported themes, LSP8
template packaging, paid accounts and a general shader editor are deferred.

The active standalone mobile preview is `Mobile/INSCAPE final/inscape-profile-card`.
Its entrance flips to a flat profile reverse, with a separate Index action that
opens the staggered image tiles. The entrance eye is not a navigation target;
tapping it flips the card like the rest of the artwork. Through the Eye and the
seven-layer interaction remain in the artwork viewer for The world inside.
The entrance retains the depth study's recessed animated Steyra and inward
foreground wordmark and identity. Its eye journey and room-wall metadata remain
separate experiments in `Mobile/inscape-profile-card/depth-study`; the active
preview uses the flat profile reverse instead.

Index is an explicitly authored table of contents, not a wallet inventory.
The maker chooses published destinations and their order inside INSCAPE.
Entries have a title, an optional cover derived from existing content unless
overridden, and a destination to a work, composition or experience. Unsupported
mobile destinations require an explicit desktop treatment rather than a
silently broken embedded desktop. The integrated first format supports explicitly
chosen Library images, reordered in the Mobile editor, with an authored Index
heading and introduction. Its staggered tiles open the shared image viewer;
counts and navigation order are derived from the selected entries. Additional
destination types must be explicitly supported before they can be authored.

The prototype prepares read-only presentation fields and distinguishes
unconnected content from successfully loaded empty content. Its hardcoded
gallery and bio are not public profile data. The existing Through the Eye
portal and seven-layer hold-to-separate experiment remain available together
as an explicitly identified experiment, outside the published Index entries.

## Authoring undo

Completed profile-draft edits share one chronological undo/redo history across
Display instances, Identity and Mobile. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z
or Ctrl+Y redoes. Text-entry controls retain native text undo. Pointer gestures
group continuous updates into one step. New edits discard redo, and failures to
save leave both history and the draft unchanged. History is bounded, temporary
and isolated by profile; reloading a draft clears its history. Existing saved
drafts gain no history fields or storage-key changes.

Undo restores authored draft data, not wallet transactions or old publications.
Preview navigation, playback, helper visibility, local window presentation and
publication's host-layout capture do not become artwork undo steps. Independent
Workbench preferences remain local preferences rather than authored content.

## Authority

This file records current accepted direction. Historical plans, phases,
handoffs, roadmaps, art-direction notes, archived prototypes, and deleted
documentation are not product authority. Consult Git history only when the user
explicitly requests recovery or historical evidence.

Read `docs/INSCAPE_CREATIVE_INTENT.md` after this contract before substantial
product, architecture, UI, composition, asset-model, metadata, or module work.
It is required context for why the product exists and for avoiding the false
interpretation of INSCAPE as an elaborate profile viewer or NFT-card gallery.
It does not independently expand active implementation scope; this contract
remains the sole authority for accepted direction.

The existing application remains the working baseline until a replacement is
implemented and accepted. Direction below is not permission to perform a broad
rewrite, schema migration, publication, upload, deployment, or wallet action.

## Product hierarchy

INSCAPE is an artist's online desktop: one environment for composing,
experiencing, and publishing artwork through independent creative modules.
It begins with the founder's own artistic practice and also accommodates other
makers. Human Underneath is the founder's artistic world, not a required theme
or content model for everyone using INSCAPE.

The hierarchy is:

1. **INSCAPE Workbench** — the containing desktop and experimental workspace.
2. **Module instance** — an independently configured creative application on
   that desktop. Multiple instances of the same type are accepted direction.
3. **Display Module** — a module type for composing assets across Grids.
4. **Stage and Grids** — the Display Module's clipped visual output and scenes.
5. **Assets and authored primitives** — material interpreted by a module.

One Workbench per Universal Profile is the current product direction. Multiple
Workbenches per profile remain unproven and are not a requirement.

The public Workbench is part of the created experience. Visitors can enter its
desktop and open the creator's published modules. The creator's Library
organization, Layers and authoring tools, Activity, and publication controls
are not part of that visitor experience. Module chrome is not Stage content.

## Workbench host and module responsibilities

- Keep the host independent of each module's creative behavior. It manages
  module instances, shortcuts, window lifecycle and geometry, shared asset
  access, persistence, publication, and owner/visitor state boundaries.
- A module owns its content model, parameters, supported inputs, rendering,
  behavior, and exposed visitor controls. The host must not need to understand
  eyes, animation effects, audio analysis, or every module-specific setting.
- The host coordinates saving and restoring settings; each module defines and
  validates what those settings mean. This direction does not specify a new
  serialization format or replace the current validation boundaries.
- Right click → Add creates a module instance. Its shortcut opens the existing
  instance. Closing a window is distinct from deleting its authored instance.
- The owner's Workbench context menu offers Add and a top-level Show/Hide dock
  command. Dock visibility is a profile-scoped local preference, never published;
  older preferences show the dock. Hidden docks release their reserved space.
  Display Format belongs to that Display's canvas, title-bar and shortcut menus.
  The open Display's menu also offers Close module (minimize to its shortcut)
  and Delete module through the existing undoable deletion action.
  Add → Display Module offers Horizontal (16:9), Vertical (9:16) and Custom size.
  The Display's Format menu offers those same presets and Custom size for later
  canvas edits, including from its shortcut. Custom size opens a bounded form
  with independent width and height; creation waits until Create is submitted.
  New Displays start with clean shortcut artwork and names, using a 960×540
  horizontal or 405×720 vertical window constrained to the available Workbench.
  Recreating a deleted primary Display starts a fresh presentation; existing
  saved presentations retain their dimensions. Shortcut fallbacks are scoped
  to the Display instance. Add and Format share the same orientation defaults.
  Format changes preserve the window's size relative to those defaults, so an
  unresized horizontal Display becomes the same size as Add → Vertical.
  Changes involving custom dimensions retain the current viewing scale per
  canvas unit where viewport bounds allow. New custom windows start at up to
  30 work pixels per canvas unit, bounded by 960×720 before viewport fitting.
  Viewport bounds still apply; existing saved windows are not rewritten on read.
  Metadata is a shared Workbench tool and is not an authored Add-menu module.
  Library stays anchored to the Workbench's left edge above ordinary module
  windows and shortcuts. Its existing drag-to-hide behavior exposes drop targets.
  Opening or resizing it never reserves space or shifts modules or shortcuts,
  including on narrow screens. Dock visibility does not close Library or change
  the open panel. Workbench and Display context menus open the same shared
  Library without changing the active module or Grid.
  The dock's Grids menu can open over Library without closing, suspending or
  resetting it. Choosing a Grid keeps both panels open, with Library's search,
  collection and scroll state intact. While both are open, Library and canvas
  interactions do not dismiss Grids or disable the Display's existing drop
  targets. Repeated Grid selection and asset drops need no composition-lock
  toggling or panel reopening.
  Each dock button reflects and toggles its own panel. Escape dismisses Grids
  first; closing Library can leave Grids open. Other dock panels and Preview
  retain their existing exclusive entry behavior. This is temporary panel state,
  with no saved-draft, publication or composition-lock change.
  Dock visibility changes preserve normal Display window pixel dimensions and
  position wherever the available bounds allow. Maximized windows continue to
  fit the available Workbench. Opening Library does not reserve desktop space.
- Multiple Display Modules can organize chapters such as Lunar Desert, a photo
  series, or other presentations, each with its own content and Grids.
- Modules must be able to cooperate through explicit inputs and outputs, for
  example music influencing an animation. Universal interoperability between
  every module is not required. Introduce concrete connections as workflows
  require them rather than building a speculative general system first.
- Initially modules are developed by the founder and the INSCAPE maintainers.
  External contributions are a possible future direction, not a commitment to
  an arbitrary-code plugin marketplace or a public developer SDK now.
- Future module types need not share the Display Module's canvas model, aspect
  ratio, or renderer. Runtime technology and isolation are implementation
  decisions to evaluate against a concrete module, not product assumptions.

## Named Workbench groups

On 2026-10-05 the founder approved the next spatial-navigation step: saved,
named groups of Workbench modules. The owner Groups tool creates a group from
selection or an empty group, renames it, adds/removes members, changes member
order and ungroups without deleting or rearranging content. Selecting a saved
group selects its open windows; Focus and Back remain separate navigation actions.
A selected group can move through the existing selection gesture as one undoable
position edit. Drops onto group names preview the target and commit membership
without moving the camera or the modules. Escape cancels the drop.

Optional draft-v4 `workbenchGroups` records contain `id`, `name` and ordered
`memberIds`. Membership is owned once at the Workbench level, independent of
Display Grid placement groups and the local window-layout cache. Up to 32 groups
and 128 members per group are accepted; names contain 1–48 characters. A module
belongs to at most one group. Empty groups are valid; nested groups, duplicate
membership and unknown references are invalid. Display, Image, Text, Shape and
Keeper windows participate. Linked Text frames belong to their parent Text
module and are selected together. Closing a window retains membership; deleting
a module removes its reference in that same undoable operation.

Old drafts without groups retain their interpretation and are not rewritten on
read. Group operations use the existing profile-bound draft store and undo
history. Failed or stale saves preserve the accepted draft. Display-only editing
receives no Workbench group data. Public v9 projection currently omits group
names and membership; restoring a public document preserves applicable local
groups. Group publication remains a separate boundary; private group names,
membership and stack positions are not included in public v9 snapshots.

On 2026-10-06 the founder authorized continuing the grouping implementation,
with code quality and ownership separation checked throughout. Groups now offer
Stack and Unstack. Optional group `position: { left, top }` records the compact
stack's Workbench anchor; omission preserves the original module arrangement.
The 180 by 160 work-pixel stack stays inside the existing 4,000 work area.
Dragging its grip or using arrow keys saves only that anchor as one undoable
operation. Escape, cancellation and focus loss restore the prior anchor. Stacking,
moving, membership drops and unstacking never move the camera or rewrite members.
The stack remains after reload; unstacking restores the original arrangement.

Open group is a temporary browsing action. Registered live module windows remain
mounted while compacted. Hidden windows are inert and excluded from selection
and snapping; hidden Keepers settle at their docks. Opening derives an ordered,
proportion-preserving row layout from module-owned frames, with 32-work-pixel gaps
and one column on narrow screens. Surrounding modules and other stacks dim.
Image inspection, Display scene interaction and native Text reading remain in
their existing modules. Group presentation disables window movement/resizing and
uses Text's existing read mode without replacing its editor or saving a mode change.
Unstacking is the explicit way to resume authoring the original window layout.

The temporary projection is separate from authoring transforms and layout reports.
It is derived again when membership, live frames or viewport width change and is
discarded on return, reset, suspension or disposal. Opening and returning reuse
the camera's high-resolution live-surface animation, with bounded rectangle
inputs; navigation receives no draft store or group schema. Reduced motion is
immediate. Interrupted travel settles the presentation while leaving the camera
at the interruption point. No animation frame enters draft history or publication.

A bounded, horizontally scrolling named destination strip opens saved groups.
Within an open group, an item selector and Previous/Next follow saved member order
and stop at the ends. Item focus keeps one return context for the group overview,
so Back returns from reading to the group and then to the preceding Workbench view.
Closed windows retain membership and are listed as closed in Groups; browsing
uses open windows. Empty groups remain valid drop targets and open their management
tools until they have a live member. Group controls occupy reserved fitting space.
Owner tools remain absent from Visitor mode; public group browsing awaits explicit
public projection rather than using private draft records.

## Public Workbench and visitor interaction

On 2026-10-05 the founder removed the custom reference frame and chose a fixed
4,000 × 4,000 work-pixel area. There is no Frame toggle, width/height setup,
reference outline or Fit frame action. The alignment grid uses the shared work
area bounds; its line/dot/hidden mode, colour and snapping remain independent
preferences. Module-owned grids and authored canvas dimensions are unchanged.

Owner and Visitor start at 100% with zero camera offset. Camera movement is free
in both axes, including when the whole work area fits on screen; manual zoom
remains 25%–200%. The work area limits placement, not camera navigation or Focus.
Viewport, dock and control-size changes can stop an active journey but never
refit, clamp or recenter the camera. Reset view clears navigation history and
restores zero pan while retaining zoom. The percentage button and Ctrl/Cmd+0
restore 100% zoom around the view. Existing inspection locks remain authoritative.

Old reference-frame preference fields are ignored. Other local preferences,
storage keys, draft/public schemas and authored positions retain their meaning.
Reading or reloading older 8,000-area arrangements does not move outlying modules;
free camera navigation and Focus can still reach them beyond the visible grid.

Dragging empty Workbench space marquee-selects open Display and standalone Text
windows. Shift-drag adds to the selection; Shift-click a window header toggles it.
Focused window headers also toggle selection with Shift+Enter.
The selection's corner handles scale its windows proportionally around the
opposite corner. Text boxes resize and reflow without scaling their letters,
including during the drag preview. Escape cancels a gesture or clears selection.
Dragging anywhere inside the selection moves the selected modules together,
including over artwork, text, headers and gaps. This temporarily takes priority
over module interactions. Clicking outside clears selection. The focused selection
also moves with arrow keys (one screen pixel, or ten with Shift). Group movement
uses temporary view state during interaction; Escape cancels an active
drag and restores its starting position.
Completing owner group movement, including keyboard movement or moving an
individual window while zoomed, reports its position back to each window.
The existing local workspace layout then saves the same positions shown on
screen. Temporary translations do not remain a second owner of placement.
Movement never chooses new dimensions or artwork fitting; Visitor movement
remains temporary and cannot write the maker's arrangement.
Group movement and corner resizing respect the 4,000 by 4,000 Workbench area,
projected through the current view scale and pan. Moving a zoomed module
individually uses those same bounds. Group movement keeps
relative spacing intact at the boundary.
Group resizing starts from exact module geometry, using one scale factor around
the opposite selection corner. Moving and resizing a selection reuse Workbench
grid and module-edge snapping on its outer bounds; selected members never snap
individually or serve as each other's targets. Proportional resizing chooses one
eligible edge to determine the scale, with module edges preferred over the grid.
Alt bypasses snapping. Owner selections of editable Image, Text and Display
modules, including mixed selections, commit real dimensions and window positions
together through the existing draft store on release. Image uses whole-pixel
dimensions. Both group and solo Text window resizing change available space and
reflow text without changing article appearance or scene-linked passages.
Text retains continuous window dimensions during group preview and commit, so
its shared edges with Display are not quantized differently. Existing saved
spacing is preserved; resizing does not infer or repair an intended join.
Display retains its Stage ratio using continuous dimensions for both group
preview and commit; only painting rounds Display edges. Remeasuring available
space does not grow a deliberately small Display to a 320-pixel minimum.
Internal selection, movement, resizing and Library/Text drops reuse the rendered
Grid/World Cover projection before camera scaling, including World Cover's
fixed logical margins and size cap. Display resizing does not rewrite its layers.
Grid rail ownership: scene slots and camera motion use the same continuous
percentage width. Each scene plane owns its Grid clip; nested artwork planes on
the rail do not repeat that clip. Full-bleed artwork inherits the exact outer
Grid boundary; interior artwork joins use shared rounded paint endpoints.
The isolated rail moves its scene clips without per-scene additive blend
compensation, and hides offscreen scenes at exact resting slots. Grid geometry
must not be replaced with arbitrary artwork overlap or resizing.
Owner and Visitor use the same clipping rule. Saved geometry is unchanged.
A normal Display Grid maps its authored reference directly to the painted Stage
endpoints; it is not contained again inside the rounded Stage. Vertical input
and guide projection use that same row spacing. Artwork fitting and crop use
unrounded authored placement proportions before mapping into the painted opening,
so pixel rounding cannot introduce a new native-fit margin. World Cover retains
its intentional margins and cap; standalone Image keeps its own fitting frame.
Image, Text and Display share one outer-edge projection: exact Workbench frame,
module transform and camera pan are combined before shared endpoints are rounded
to physical screen pixels. Width/height are differences of those endpoints,
never independently rounded sizes. Text, Display and Image consume the shared
projection as integer physical-pixel surfaces mapped back by inverse density.
Standalone Text paints its background/frame once on that outer surface; its
transformed content uses native zoom and the authored wrapping width. Display
projects its internal paint edges into the physical Stage; pointer input and
logical control sizes have explicit conversions. No second CSS pan is applied
to an already projected window.
Subpixel camera movement can change painted coverage by one physical pixel;
it never rewrites logical geometry. Text retains its logical wrapping width.
Display's legacy exterior chrome background is removed. An explicitly enabled
Display frame is drawn inside its bounds; companion-window chrome is unchanged.
Visible Workbench grid marks use the same physical-pixel projection of the
24-work-pixel snap coordinates, without a separate half-pixel pattern offset.
Only visible rows/columns are generated. One viewport-sized canvas paints the
grid; dots reuse a rasterized row rather than expanding SVG instances per point.
The row exists only for the current paint lifecycle and never owns coordinates.
Snap calculations retain exact world coordinates and module-edge priority.
Grid-line retention is capped at three quarters of the projected grid interval
and at 18 screen pixels, so movement and resize can reach each adjacent line
when zoomed out instead of sticking across multiple cells.
Workbench coordinates and
module content remain separate inputs to one atomic save. Failed saving restores
the starting view; Escape cancels before saving. Shared endpoints are rounded
together to preserve joins. Previous temporary scaling is absorbed by the next
explicit group resize, not by a read or reload. Image size fields then report
the same dimensions as solo resize. Draft Undo/Redo restores saved window geometry
with its content; local frame recovery for missing older layouts is bounded by
the existing history limit and ends when the module unmounts.
Visitor group interaction remains temporary. Camera zoom is always view-only.
The mounted Workbench camera owns session zoom and pan together. Its navigation
controller owns wheel and Space input, destinations, return history and reset.
Selection, movement and resizing read that camera for coordinate projection and
retain their existing authoring boundaries. Navigation can cancel an editing
gesture but never receives its draft store or changes module transforms. Pan
updates do not notify scale-only module editors. This separation does not change
stored layouts, publication data or storage keys.
Workbench destination navigation starts with explicit **Focus selection** and
**Back** controls shared by owner and Visitor. Focus frames the selected live
module instances using their logical geometry, available space above the dock
and camera controls, and visible floating instruments. Camera scale remains
between 25% and 200%; the work area does not clamp travel. Focus changes only the camera; it does
not group, move, resize, remount or save modules. Selection clears on arrival so
the content can be used. Back restores the preceding camera and surviving
selection, then returns keyboard focus to that selection or the Workbench.
Return viewport measurements exclude selection-driven toolbar wrapping so
restoring selection cannot shift the saved camera position. Destination fitting
still reserves the currently visible controls and instruments.
The session keeps at most 50 return contexts and clears them on Workbench
disposal, profile replacement, Preview suspension or Reset view.
Navigation decisions and return contexts are separate from the cancellable
460 ms camera animation, which uses the existing inspection easing. Reduced
motion travels immediately. New navigation replaces the active animation;
pointer or keyboard editing, manual camera input, viewport changes,
inspection locks, window blur and hidden-document transitions stop it at its
current position. Missing or changed destination geometry invalidates pending
travel. Interrupted Back remains available until the return completes.
Escape first retains existing editor, inspector, gesture and selection behavior;
with none of those active, it returns to the preceding Workbench view. Image
and Display inspection keep their own input lock and source-return behavior.
This step does not change click-to-inspect, dragging, wheel ownership, schemas
or publication data. Named Workbench groups extend this same navigation path with
temporary spreading and item reading, as specified in their section above.
Existing Workbench fields carry Text window sizes through publication and restore;
no schema, storage key, default or old-data interpretation changes. Previously
saved article scales remain readable. Explicitly setting Text size resets the
article scale to one, removing any earlier group magnification so the chosen
size applies directly; opening or resizing a window does not rewrite its article.
Workbench wheel zoom (accepted 2026-09-22) always scales the whole module view,
independently of selection, between 25% and 200%, including positions, spacing and
rendered text. Text retains its original wrapping area; the entire output shrinks.
Only Ctrl + wheel zooms the Workbench, continuously around the cursor, on empty
space and over modules. Unmodified wheel and Cmd + wheel do not zoom it.
The world point beneath the cursor stays fixed. There are no plus/minus zoom
buttons or Workbench zoom keyboard shortcuts.
Selection corner handles remain a separate group-scale operation.
Dock, shortcuts, Identity and companion tools retain their normal size.
Companion tools (including Layers, Artwork tools and Text tools) stay in screen
coordinates during camera pan and zoom; their manual dragging remains independent.
Text, Layers and Artwork info offer resize targets on all four edges
and corners, centred on their visible edge marks. The opposite edge stays fixed;
Escape restores the complete starting frame. Owner Text resizing saves through
the existing module resize transaction and supports draft Undo/Redo. Companion
window sizing remains temporary UI state and stays reachable after viewport resize.
This is session-only view state, shared by owner and Visitor rendering, never
captured as authored geometry or publication data. The percentage reset control
and Ctrl/Cmd + 0 restore camera zoom to 100% around the centre of the current
visible Workbench (excluding the dock), retaining the world point at that centre.
They preserve module positions and individual/group scale transforms. Reset view resets only
camera pan and likewise preserves the composition. Display has no
independent wheel zoom, maximize/restore, or immersive fullscreen mode. Article
scrolling retains its existing behavior.
Shared module boundaries use matching physical-pixel edges at fractional zoom,
without changing the text's wrapping area or authored dimensions. Native content
zoom paints text at its target size; rounding the visible frame never rewrites
the authored layout. Companion-window viewport constraints do not cap a scaled
composition surface.

- The maker chooses which modules and Grids enter the public snapshot. Private
  modules and private Grids are omitted from that document, not merely hidden
  by the interface. Draft work can remain private while other work is published.
- Explicit Publish updates the public configuration as a snapshot. Later local
  edits do not change the existing publication.
- The maker authors the public starting arrangement: window positions and
  sizes, shortcuts, and which modules start open. Arriving with all modules
  closed is valid. These authored public choices must be distinguished from
  private editor preferences and temporary window state.
- Visitors may move, resize, open, and close available module windows and use
  the interactive controls a module exposes. Those changes are session-local;
  they do not alter the creator's draft or publication. Reload restores the
  published starting configuration. Inspection can include source metadata
  without exposing the author's Layers or Library workspace.
- Direct entry to the Workbench and to a published module is accepted
  direction. An identity module could provide a directly linked visiting card
  from which the visitor explores the rest of the published Workbench.
- Background, alignment-grid settings, and shortcut snapping remain local
  editor preferences in the current implementation. Publishing a desktop does
  not authorize serializing all workspace preferences. Which appearance
  settings become explicit public choices remains to be specified.

The current v9 document and private draft support an optional `workbench`
starting configuration for the implemented Display and Identity modules.
Prepare Publication explicitly captures and saves their open state and window
geometry, plus the Display name and shortcut position, visibility and artwork.
Module content remains in the existing Grid and Identity envelopes. Identity
height follows its content. Visitor interactions remain session-local.

Preview and Prepare Publication share a pure Workbench presentation capture.
It combines current module reports, saved arrangements, and existing defaults;
only current draft modules contribute layouts or unresolved-artwork errors.
The Workbench session owns saving that capture and Identity configuration.
Display authoring sessions, including the original Display, project and merge
only their module content through the shared profile draft store. The original
Display's root storage envelope is retained for compatibility.

Space + primary-pointer drag anywhere on the Workbench pans the view freely in
both axes, including over Image, Display artwork, Text, shortcuts and resize
handles. While Space is held, the Workbench claims the gesture before module
selection, movement, cropping, resizing or Grid navigation; releasing a pan
cannot open an image or activate the underlying control. The grab cursor marks
this temporary mode across the Workbench. Space typed into an active editor or
text field retains its normal meaning. Content modules and their shortcuts move together;
Shift + wheel pans horizontally (wheel down moves the view right, content left);
ordinary wheel pans vertically over the background and module content, including
Image, Display and fitting or paged Text. Native readers with actual overflow
on the requested axis retain their own scrolling, including at their ends;
tool lists retain native scrolling too. Merely clipping artwork or paginating
Text does not capture wheel input. Native horizontal wheel
input (wheel tilt or trackpad deltaX) pans horizontally, without a middle
button gesture. Both axes can move together on a trackpad.
Ctrl + wheel retains zoom priority when both modifiers are held.
The background colour, dock and viewport menus remain fixed. The alignment grid
follows camera pan and scale, and snapping uses that same projected lattice. Display
Grid navigation and editing retain their own input when Space is not held. The pan
is temporary per mounted Workbench, shared by owner and Visitor, and never
changes saved windows, draft content or publication. Reset view restores the
starting camera offset. Ctrl/Cmd+0 changes only zoom around the current view,
retaining module movement and scale transforms. An authored initial camera or
spawn point remains deferred; this does not change Reset view's destination.
Release, cancellation, focus loss, Preview suspension and disposal end the
gesture. This change retains the current visual design.
Image and Display Lift inspection dimming follows the artwork's shared animation
progress in both directions, including interrupted opening and reduced motion.

The fixed 4,000 by 4,000 work-pixel placement area extends right and down from
the existing coordinate origin, replacing the earlier 8,000-area size. Content
windows, instruments and movable shortcuts can leave the visible viewport;
movement and resizing use the shared area bounds with an eight-pixel inset.
The alignment grid is visible only inside those same placement bounds. Panning
or zooming beyond them reveals plain background, with no extra border or overlay.
Reset view is always visible in the Workbench controls. It resets the temporary
pan, not the saved arrangement. Browser resizing and reload never pull saved
positions back into the viewport. Existing Display/Image viewport size fitting
remain separate from window placement.
The v9 storage redesign is explicitly deferred: existing positive window
coordinates already support the area, with no schema, storage-key or origin
change. Older outlying layouts remain readable without rewriting their positions.
The work area is not a 4,000-pixel render target and adds no module instances.

The owner's local arrangement also survives reload independently of publication.
A profile-scoped `inscape:workbench:layout:v1` record stores module geometry,
open state and shortcuts, selected Display Grid, lock and instrument state,
and Text Read/Write state. It contains no module content. Existing
drafts fall back to their saved Workbench or runtime defaults; deleted module
IDs are ignored. A changed saved Workbench configuration invalidates the local
record. Unreadable records are retained until the owner explicitly saves the
current layout; failed writes are reported with a retry action. Optional
`views['workbench:tools']` retains shared Layers and Artwork info open state,
window geometry and the explicit Display target. Older per-Display instrument
records are consolidated on read without changing authored content.
Optional `views['workbench:text-tools']` retains the single Text tool's open
state; its active module uses the existing shared tool target. Old per-Text
`settings` flags consolidate to one available Text target on read, retaining
each article's Read/Write mode. No draft/publication schema or storage key changes.
Optional shared Display `appearance` open state and window geometry use the
same profile-local tool record as Layers and Metadata; omission means closed.

Failed Text edits are retained in a profile/module-scoped, in-memory page-session
recovery buffer. Workbench draft stores reconnect to their profile's buffer after
internal navigation or account changes; disposing an editor or Workbench does not
discard it. Other profiles cannot read or clear that recovery. Confirmed saves
remove recovered edits; opening or enabling an editor does not itself save. Recovery
blocks preview, publication preparation, draft undo and conflicting Display
operations until saved. A leave-page warning remains active even while the affected
Workbench is absent. The
buffer is not durable across a forced reload when storage cannot save.

Preview preparation has a visible loading/cancel state and accepts only the latest
request for the same profile, draft generation and Workbench presentation. Changed
input requires opening Preview again; cancellation or disposal ignores late results.
Preview suspends every owner Display through the same module input, independently
of focus. Display stops playback and momentum while retaining the temporary camera
position; returning from Preview does not resume playback automatically.

Existing documents without this configuration load in the shared Display window
with runtime defaults; a subsequent preparation can save the new configuration.
The publication version and ERC725Y pointer key remain unchanged. A publication
still requires a new verified content hash and URI and a separate wallet action.
Multiple Display instances are implemented through an optional `displays` array.
The original Display retains its root content envelope and existing storage key;
additional Displays have stable IDs and their own Grids, appearance and format.
All instances commit through one profile draft store. Selection, inspection,
playback and composition lock are scoped to an instance. Module connections
remain accepted direction, not an implemented capability.

The first implementation bounds a Workbench to eight Displays. Right click Add
creates an additional private Display; its context menu can include it in the
next publication. Public projection omits private instances and private Grids.
The original Display requires a public Grid while it exists. An empty root
`grids` array represents its absence in draft v4 and document v9; additional
Display records still require Grids. Older nonempty documents retain their
existing interpretation, and no storage key changes. Add recreates the original
Display when absent before allocating another instance.
`workbench.displays` retains additional window and shortcut arrangements when
Prepare Publication captures the Workbench. Closing minimizes to the shortcut;
it does not delete content. Visitor window changes remain session-local.
Owner shortcuts offer right-click Delete for every created Display,
Mobile and mini app. Deletion removes authored module content and its saved
arrangement through one undoable draft operation. A desktop with no created
modules is valid and survives reload and publication. Identity remains accessible
through Profile; removing modules does not delete Library assets or change an
existing publication. The Workbench owns its alignment grid independently of
Display presence.
Optional arrays do not rewrite older documents on read. Publications using them
require the updated strict reader and a newly verified hash and URI.

## Minting direction

The founder wants both visitors minting from a creator's collection and creator
issuance tools. Visitor minting is the first step. It uses the visiting buyer's
wallet authority, independently of the viewed creator's authoring permissions.
The initial interaction preview is a local simulation; live sale terms,
supported contracts and holder-editable character settings remain to be defined.

## Hosted mini apps

The Workbench can host existing web mini apps by external HTTPS URL, with
connection support through the official LUKSO UP Provider client protocol.
Adding another app does not require a domain entry in code or deployment
configuration. This is a URL-based module; INSCAPE owns its window and
connection lifecycle while the remote application owns its creative behavior,
content, and storage. It does not add an arbitrary-code module SDK.

Right click Add → Mini App creates a private instance. Settings saves its name,
URL, and explicit inclusion in publication through the existing profile draft
store. Up to four instances are supported. Closing destroys the running frame
and leaves a shortcut; removing the instance is a separate settings action.
Owner and Visitor use the same window and host. Movement and resizing are
temporary until Prepare Publication captures the starting arrangement.

Optional `miniApps` fields extend draft v4 and public document v9; optional
`workbench.miniApps` stores their starting windows. Public projection omits
private apps and their windows. Older documents remain readable without writes.
Restoring a publication retains noncolliding local apps and their window
arrangements as private. An over-limit restoration fails without truncation.
Published URLs reference live websites, whose contents can change independently
of the INSCAPE snapshot. App-internal settings are not captured by INSCAPE.

The viewed Universal Profile is public context, distinct from the connected
visitor's account. Connect App grants only that instance access to the existing
wallet authority; wallet actions still require the wallet's approval. Grants
are never saved, published, or shared across instances. Account/provider/chain
changes, closure, reload, and preview suspension revoke them. Microphone
delegation starts off and is controlled per app, with browser permission still
required. Preview suspension also ends that delegation.

The founder approved general HTTPS hosting on 2026-09-13. Production permits
HTTPS frames; each bridge still binds connection messages and optional microphone
delegation to its own app's exact origin and window. There is no app domain list.
Private localhost drafts remain readable and run only during development.
Embedding headers, supported wallet methods, and ancestor permission policies
determine compatibility; working on Universal Everything is not a guarantee
that every app works unchanged here. Grid/LSP28 import and synchronization,
app-to-app audio sharing, and a marketplace are not implemented by this host.
See [mini app hosting](MINI_APP_HOSTING.md) for the boundaries and checks.

## Removed artwork presentation panel

On 2026-09-21 the founder removed the entire artwork Frame and mat panel:
mats, artwork frames, backing colour and the Transparency override. Artwork
always retains its source transparency. No authored mats require preservation.
Controls, presets, inset geometry and decorative rendering are removed.
Grid backgrounds, Display window appearance and Text appearance are independent
and remain available. In place / Lift remains a separate inspection choice.

Older writers emitted unused presentation fields automatically. The read boundary
accepts the unused mat default and former frame, backing and transparency fields,
then omits them from validated draft content. New saves and publications omit them.
Published readers retain the exact old fields for canonical-byte and hash checks;
renderers ignore them. Restoring a publication removes them at the draft boundary.
There is no storage-key change or draft reset; reading does not rewrite storage.

## Display Module

The Grids menu offers Duplicate Grid for ordinary scenes in the active Display.
It appends and selects a private copy named after the source, with a unique
copy suffix. Artwork, embedded Text, placement geometry, media choices, crop,
transforms, locks, labels and groups are retained; Grid, placement and group IDs
are independent. The copy is one undoable draft operation. Failed persistence,
stale input or the 24-Grid limit leaves the draft and selection unchanged.
World Cover is excluded. Appending preserves existing scene-linked Text section
indices; standalone Text articles and passages remain independently authored.
Existing drafts and public documents require no schema or storage-key changes.

Display supports authored text layers within a Grid. Text layers share placement
geometry, ordering, selection, movement, resizing, duplication, locking and undo
with artwork. Layers lists the text and opens its separate Text tools companion;
it does not contain a second text editor. Rich text uses the same article model
and renderer as standalone Text; existing plain text layers remain readable and
upgrade when edited. Text retains its background/frame choices and follows the
Grid and Display scale. Resizing
the text box changes its wrapping area; font size is an explicit text setting.
Owner and Visitor use the same text renderer. Text has no Library asset,
creator attribution, artwork inspection or crop controls.
An explicit `kind: text` placement extends draft v4 and public v9 documents;
existing artwork placements remain unchanged. Private Grids and placements
remain excluded from publication. Existing document and storage keys stay valid.

Metadata now has one shared Workbench output window, exposed as Artwork info.
Opening it enables artwork + markers across Displays; selecting a marker or
artwork updates that window without lifting, dimming or moving the scene.
Closing it removes the markers and metadata output. There are no independent
metadata foldouts. Artwork inspection remains a separate temporary interaction.
Unlocked owners may adjust marker offsets; these remain mounted-Grid session
state and are not authored or published. Visitors cannot move markers.
Metadata continues to use existing asset projections, with no second source
of artwork facts. Edition labels still require sourced artwork-level facts.

Layers offers one custom Gutter value in canvas units and Apply to all for the
current scene. It preserves image sizes and directional ordering, including
staggered layouts. Neighbours are identified by overlapping projections on the
opposite axis; matching top edges are not required. Each axis is spaced from
its leading neighbours, retaining positions for images without predecessors.
The same target gap applies horizontally and vertically. Multiple constraints
may leave larger gaps; image sizes are never changed to force exact spacing.
Locked or editor-hidden images disable the action. Overlapping image bounds,
or arrangements where spacing would introduce a conflicting neighbour, are
rejected atomically rather than flattened or partially moved.
The gap is rounded to existing one-ninth-unit geometry precision. All moves are
validated and saved in one undoable operation through the Display session.
Only resulting placement coordinates persist; there is no new draft schema,
automatic reflow, drag snapping or publication field. Existing drafts remain
unchanged until the owner applies the operation.

`Display Module` is the product-facing term. Existing `PresentationBoard` and
`presentationBoard*` implementation identifiers and persistence keys remain
internal compatibility names during this migration; do not broadly rename them.

- Accepted direction (2026-09-28): the owner can choose a Display's canvas width
  and height before composing and change them later, including custom aspect
  ratios. Changing canvas dimensions preserves existing placement coordinates,
  sizes, crops, transforms and text-box geometry across its Grids. It changes
  the clipping boundary; the artist rearranges the composition manually. There
  is no automatic stretching, scaling, repositioning or reflow to fit the new
  canvas. Content beyond the boundary remains in the draft. Canvas dimensions
  belong to Display content; Workbench viewing scale remains separate.
  All Grids in an instance continue to share its canvas dimensions.
  Implemented on 2026-09-29: independent whole-number width and height from
  1 to 512 canvas units, matching the coordinate units used by layers.
  Landscape (32×18) and Portrait (18×32) remain presets. Format → Custom size
  submits both dimensions as one undoable operation; Cancel/Escape changes
  nothing, and failed saving keeps the form open and the saved draft unchanged.
  Old forms cannot overwrite dimensions changed since opening.
  Window resizing remains proportional to the authored canvas; Workbench zoom
  remains viewing state. All Grids in that Display share the new boundary.
  Existing geometry and reduced artboard-ratio fields carry the dimensions in
  draft v4 and public v9, without new storage keys, migrations or rewritten reads.
  Existing saved Displays retain their geometry until explicitly edited, and
  published work changes only on explicit publication. Documents with custom
  dimensions require this updated reader; older strict readers reject them.
  Display window validation accepts narrow fitted frames without changing the
  minimum saved sizes of Text, Identity or Mini Apps.
  The profile's World Cover remains landscape.
- New public snapshots omit fully outside placements and retain valid groups
  among the remaining members. Intersecting placements retain their geometry
  and are clipped by the shared renderer; their underlying media is still public.
  This projection never removes content from the draft or rewrites old publications.
- The Display Module may move freely on the Workbench without changing published
  composition coordinates.
- Pan and zoom are camera/view state. They never resize assets, mutate the Grid,
  or alter published geometry.
- Support a fitted overview and sufficiently strong zoom for precise editing.
- Display uses one Stage projection. Corner resize changes its saved window size;
  Workbench Ctrl-wheel zoom changes the Workbench viewing scale. Independent
  Display wheel enlargement, editable maximize/restore and immersive fullscreen are removed.
  Artwork inspect, Grid navigation, composition editing and minimize-to-shortcut
  remain. Removed modes were temporary, so old saved compositions and window
  geometry remain readable without a storage migration or reset.
- **Enlarge Display** temporarily lifts the live Display into a fitted inspection
  view for owners and visitors. It reuses the Image/artwork lift's 460 ms easing
  and Workbench input lock; reduced motion opens and returns immediately.
  The Stage renders at the enlarged resolution, with the same mounted artwork
  documents. This is temporary projection, never saved window or composition geometry.
  Normal Grid navigation, Stage swiping and contained artwork inspection
  remain usable. Composition editing, drop placement and window manipulation are
  unavailable until return; the owner's saved composition lock is unchanged.
  The same window button switches to Restore Display and returns to the original
  window. Enlargement adds no dimming, modal overlay or separate navigation controls.
  Clicking outside also restores it; clicking or swiping inside never restores
  the window, including a swipe released outside its bounds. Escape closes a nested
  artwork inspection first, then the enlarged Display. Focus and
  Workbench input return after the closing animation, including interrupted opens.
- Display's window, Stage and artwork use shared paint boundaries at the
  Workbench scale. This rounding is derived screen geometry, never an edit to
  the saved composition. Owner, Visitor and Display inspect use the same native
  image-source opening for crop, rotation and mirroring. Media retain their
  original transparency and animation. Browsers without `object-view-box`
  retain the prior image clipping path; its fractional-edge limitations remain
  outside the verified Chromium rendering path.
- Ordered Grid navigation wraps from last to first and first to last, in the
  editor and public presentation. A single Grid does not swipe to itself; the
  World Cover remains outside the editor's scene sequence.
- Dragging the Display Stage swipes between Grids directly in Visitor mode and
  when the owner's Display composition is locked. Unlocked authoring keeps
  ordinary dragging for editing and uses the Grids menu to select a scene.
  Space-drag always belongs to the Workbench camera, including over the Stage.
  The Grid follows the pointer directly. Release chooses an exact Grid seam from
  its position and velocity and lands there in one bounded motion, without spring
  motion, overshoot or a separate final snap. A held release lands on the nearest
  seam. Taking hold interrupts the landing immediately and retains
  the position. Manual movement and Play Grids share one temporary camera position;
  crossing a Grid boundary changes the selected Grid without interrupting travel.
  Reduced motion omits momentum and retains discrete Grid selection on release.
- An explicitly paused or interrupted camera may remain between Grids while the owner edits the selected
  Grid through Layers or directly on its visible artwork. The adjacent Grid is
  a preview, not a second editing target. Layer coordinates and selection handles
  follow the selected Grid's displayed position. Active dragging, coasting and
  Play Grids suspend editing; resting at an offset does not. Unlock stops motion
  while retaining that position. Opening Layers and cropping do not align the
  camera or change authored geometry. Lock continues to protect composition edits.
- The Display context menu offers Play Grids when more than one Grid exists.
  While playing, its toolbar exposes Pause; otherwise no playback icon appears. Playback
  slides continuously through the ordered Grids at 12 seconds per Grid and wraps without a dwell.
  Pause retains progress; Stage interaction returns to manual control. Playback
  does not change the draft schema or publication. Reduced motion uses discrete
  Grid changes instead of sliding.
- Owner, Preview and Visitor use the same contained Display artwork inspection,
  keyboard artwork navigation and Metadata instrument. The former full-screen
  visitor artwork/dossier presentation is retired, including for old publications.
  Visitors retain window interaction, Grid playback and Metadata inspection, with
  no Layers tab, placement tools or composition Lock. Metadata uses one shared,
  bounded Workbench window. Published creator attribution
  and source details remain available. These interactions are session-local and
  never write an owner draft or rewrite publication bytes.
- **Inspect: In place | Lift** appears in Selection properties below the Layers
  list for one selected artwork. It applies to the selected, unlocked placement
  and remains independent of crop controls.
  The choice is saved as optional `inspectionMode`
  (`IN_PLACE` or `LIFT`) in drafts and public placements. Existing drafts and
  publications without it now default to Lift; explicit IN_PLACE choices remain
  respected. This is a read-time default change, with no saved document rewrite.
  No image or geometry is copied
  into the saved setting. Visitors follow the authored choice. Lift to centre
  enlarges the artwork within the Stage using its original media proportions,
  dims the other artwork, and returns it on close without changing the scene.
  Lift opening and return share the same 460 ms duration and gentle easing.
- Focus in place keeps the composition and camera fixed. The selected
  artwork stays visible, layers behind it dim, and foreground layers fade away;
  closing restores the scene. Pointer picking follows visible image pixels,
  passing through transparent areas to artwork underneath. Visible artwork
  remains selectable. While a transparency mask is unavailable, rectangular
  picking remains available. Alt-click cycling and its Stage tooltip are removed.
  Keyboard and Layers selection remain explicit. These are temporary Display
  interactions shared by owner and visitor, not saved placement mutations.
  During focus, clicking anywhere within the Stage, including on the selected
  artwork, closes inspection through the same restore path as Escape. That
  click does not activate underlying artwork. Metadata and title-bar controls
  retain their own interactions. Stage artwork never displays a rectangular
  focus outline, including after keyboard interaction or focus restoration.
  Keyboard activation and focus indicators on interface controls remain available.
  Selecting artwork does not add an image-edge halo; editing and crop handles
  remain available. Authored Display grain stays visible over artwork during
  artwork inspection, using the same module surface effect.
  Opening and closing inspection preserve the current Grid camera position;
  temporary inspection suspends navigation without resetting the retained rail.
  Image and Display inspection also suspend Workbench pan, zoom and movement or
  resizing of their source module until the return finishes. Closing or disposing
  an inspector releases its temporary input lock. Native scrolling in independent
  readers and tool windows remains available; no camera or saved-layout mutation
  is used to enter or leave inspection.
- Do not implement the Display Module as an HTML iframe. Use one application context with
  an isolated, clipped viewport and camera transform.
- The Workbench hosts one shared Layers window and one shared Artwork info
  window. Both are independently movable and resizable, with no reserved sidecar
  space or changes to Display geometry. Both start closed.
- Layers follows the explicitly active Display and its current Grid. Its content
  and actions still belong to that Display session. Metadata follows the selected
  artwork in the targeted Display; its title identifies Display, Grid and artwork.
  A missing or minimized target shows an empty prompt, never another Display's
  content. These windows do not own or duplicate authored content.
- Display appearance also uses one shared window, opened through the Display's
  Appearance command. Selecting another open, unlocked Display replaces its
  controls in place. Closed, locked or unavailable targets expose a selection
  prompt; they never leave the previous Display editable through the window.
- Owner tool state survives reload in the profile-local layout record; visitor
  Metadata state stays session-local. Old open sidecars migrate to shared windows.
- Workbench and Display context menus expose Tools → Layers / Metadata; Visitor
  exposes Metadata only. Display menu actions explicitly target that Display.
  A keyboard-accessible Tools launcher in the owner and Visitor docks provides
  the same shared tools, retaining the current target. Owner Layers also offers
  Artwork info for the selected artwork.
- The ordinary Display toolbar contains composition Lock (owner only) and
  minimize. Layers, Metadata, Play and the Inspect label/counter/arrows are
  absent. Active artwork inspection adds only Return to composition; Escape
  and existing arrow-key artwork navigation remain available.
- The shared Display toolbar is quiet until the pointer approaches its top
  edge or keyboard focus enters it. Touch exposes a Show/Hide controls button.
  Hovering over the artwork alone does not reveal the toolbar.
- Layer rows and Stage placements share one selection model. The list exposes
  the active Grid's render order from front to back; reordering rows changes
  placement z-order. Placement lock, visibility, removal, and other accepted
  row actions remain synchronized with the Stage and obey the composition
  Lock.
- The Layers eye toggle temporarily hides a placement in the editing Stage only.
  Keep its row available to show it again. This is session-local Workbench state:
  it resets on reload, never changes the draft schema or public/private visibility,
  and does not hide the placement from Preview or publication.
- Layers presents its thumbnail list first, in front-to-back order, followed by
  properties for the current selection. Artwork-only controls are absent for
  Text. Composition spacing is a separate collapsible section. Existing scoped
  controller actions remain authoritative; reorganizing controls adds no stored
  content, schema or publication fields.
- The owner Workbench hosts one movable contextual artwork-tools dock,
  independent of the Layers window. Modules supply their own controls and
  actions for the current selection; the host owns no artwork or editing state.
  Display supplies rotate, horizontal/vertical mirror, duplicate, stack order,
  crop. Text selections omit image-only actions. Composition and
  placement locks still apply. Closing Layers leaves these tools available.
  Crop temporarily replaces the dock controls while Layers remains
  a separate list/properties window. Changing target cancels unfinished crop
  input; minimized, suspended and inspecting Displays offer no
  authoring dock. The dock can move by pointer or focused-header arrow keys.
  Its position is session-local; this introduces no saved-content or public
  document fields. Visitor has no authoring dock. Other modules can supply
  their own content through the same module-neutral host when integrated.
- Long metadata scrolls inside the shared bounded window. Shared tool positions
  and selection targets are Workbench view state, never published composition
  state. Visitor Metadata has no authoring actions or Layers window.
- The Display title bar identifies its presentation. The official publishing
  identity is available in the Identity Module header; authored presentation
  names must not be treated as official profile metadata.
- The composition Lock is local, profile-scoped Workbench state. While active,
  it prevents placement, movement, resize, crop, transform, reorder, removal,
  and other authored-geometry mutations without blocking selection or artwork
  inspection. It is never part of the published document.

## Identity and authored personas

Identity can minimize to a movable circular crop of its existing portrait and
background. The same cloud canvas remains mounted and animating, respecting
reduced motion and visibility. Click restores the retained window; the circle's
context menu offers Open Identity, Small/Medium/Large, Circle/Rounded square,
Close and owner-only
Disconnect. Minimizing is disabled during an unsaved edit. The owner's Workbench
context menu opens or restores Identity independently of the dock. Shortcut size,
shape, position and window/minimized/closed state are optional local preferences under `inscape:identity-shortcut:`
plus the profile address, never draft or publication content. Missing preferences
use a medium circle at the upper right and the existing starting open state;
older size/position-only records remain readable without resetting them.
Rounded square uses the shared module corner radius. Visitors use temporary state only.
Close removes the module from view and releases the renderer. Existing publications and
drafts retain their schemas and content.

- The identity strip is trusted publication chrome, not artistic Stage content.
- It is derived from the official Universal Profile identity and authority.
- Authored content cannot replace or impersonate that publication anchor.
- The strip may collapse and remains an overlay rather than reserving layout space. Its state
  never changes Stage geometry.
- A Grid may present any fictional persona, biography, role-play identity,
  text, NFT, image, animation, or later supported primitive. That content is a
  composition, not the publishing identity.
- Do not rebuild official profile metadata as a mandatory conventional profile
  page. Official identity is the anchor; the Stage is the playground.

## Cover, entry, and Discover

- Identity's title bar shows the official avatar and profile name, followed by
  `#` and the first four hexadecimal address characters after `0x`. The full
  address is available on hover/focus, with an explicit copy action and a
  diagonal link to the official Universal Everything profile. This header is
  separate from authored Identity artwork and aliases. The redundant INSCAPE
  IDENTITY caption, self-link, and permanent Library-drop banner are omitted.
  The Display Module title bar shows its existing shortcut/presentation name;
  renaming that shortcut also updates the title, using one name state.
  Copy, source and QR controls use the same muted icon weight. QR sharing
  generates the full address locally, on demand, with a declared dependency;
  it performs no upload, wallet action or publication.
  The large Identity portrait renders SVG media as an isolated document with
  scripts enabled, so artwork can read public events and animate itself.
  The frame has no same-origin, wallet, popup or parent-navigation grant.
  Its URL remains the official LSP3 image URL or the authored Library artwork's
  selected media URL; no local substitution or profile-data rewrite occurs.
  Extensionless URLs use their response media type.
  Raster avatars and unresolved media types retain ordinary image rendering.
  SVG source is fetched with a size limit, validated, and sent to the isolated
  artwork document host. This avoids inheriting a gateway's network prohibition.
  Only the public RPC origins `https://rpc.mainnet.lukso.network` and
  `https://42.rpc.thirdweb.com` are allowed to receive artwork connections.
  External scripts and general network access remain disabled. The host response
  owns this narrow policy; the main application's script policy is unchanged.
  Header and shortcut thumbnails remain images, and minimizing or closing
  Identity removes the executable artwork document.
  The dock's account menu uses the official profile name and avatar as well;
  the authored title and artwork belong to the Identity presentation.
  QR sharing reuses the shared window chrome and opens beside its trigger,
  following that trigger while open and staying within viewport bounds.
  Its scan surface is still and high-contrast, with softly rounded modules.
  It currently encodes the address; switching to a public INSCAPE profile URL
  is deferred until that public destination is settled.

- Identity establishes the approved shared bevel window chrome: a thin edge and inner highlight,
  a one-pixel content gutter, and a filled close control. One module-owned cloud
  renderer spans the body and title bar; the title bar and detail extension
  overlay 65%-opaque surfaces while text and controls remain opaque. Detail
  dividers are internal only and fade over 16px into an 8px outer inset.
  The shared shell owns this opt-in style through `chrome="bevel"` and an explicit
  `menuSurface`. `workbenchWindowChrome.css` owns the edge, overlay, selector and
  raised-control tokens and their light/dark theme values. Controls use the shared
  window-cap class, including the recessed pressed state and keyboard focus.
  Identity owns its content layout, artwork, editor and divider geometry.
  This is the reference for subsequent window migration; other instruments retain
  their existing chrome until migrated and visually verified. The shared window
  accepts the supplied background; shader settings and lifecycle remain owned
  by Identity. Styling choices are not persisted profile data.

- Display adopts the same bevel tokens for its outer frame, title-bar controls,
  inspection controls and independent instrument windows. Opening tools leaves
  Stage dimensions, artwork crop and saved compositions unchanged. Tool windows
  receive the module theme explicitly.
  Owner and Visitor share this treatment, including the two-pixel tab selector,
  reduced grain, thin content boundary and light-theme control shadows.

  The current Display frame experiment removes the title bar's layout space.
  A compact control group overlays the upper-right Stage. The controls use plain
  icons with hover feedback, keyboard focus and an active underline instead of
  raised circles. One shared 65%-opaque backing maintains contrast over light and
  dark artwork;
  the remaining top strip stays draggable and keyboard movable. The Display name
  is available on hover, with a minimize control. Stage aspect ratio
  and authored geometry remain unchanged; older windows retain their saved width
  and position without a data migration. Attached/overlay/detached instrument
  behaviour is retained while the standalone frame is evaluated.
  Display's artwork clip meets the outer one-pixel stroke without an extra
  content gutter; its inner radius is the outer radius minus that stroke.
  Its outer stroke omits inset highlights to avoid bright spots along the
  antialiased corners. Identity and instrument windows retain their bevels.

- Identity starts compact. A centered chevron reveals its INSCAPE extension
  with a selectable 2–5 column detail layout. A section can be marked Wide to
  span two available columns. Sections retain authored order and wrap to fewer
  columns according to the card's width, without shrinking the text. Optional
  `card.columns` and field `wide` settings use the existing Save/Cancel and
  publication path. Older cards without these settings retain two columns and
  their existing final full-width section; no saved content is rewritten on read.
  Identity's extension sits
  below the official profile section. Expansion preserves the window's top
  edge, grows only as needed, and uses contained scrolling at viewport bounds.
  Expand/collapse is temporary window state, including for visitors.
  The upper section keeps the official name, with an optional authored title
  above it. The custom title keeps its original small condensed technical font;
  username typography is unchanged. Tags form a separate, spaced group below
  the biography. Subtitle support is removed from the interface and card data
  model. The local draft loader discards the removed subtitle property from
  drafts written by the previous editor, then validates the remaining data.
  Other content is preserved; the next successful save writes the cleaned draft.
  An authored biography replaces the official bio
  in this artistic presentation when provided; otherwise the official bio is
  used. The official title-bar identity remains unchanged. Visible official
  and additional tags and profile links belong in this upper section.
  Profile links use icons with hover/focus labels and accessible names;
  unknown sites use the shared globe icon. Repeated platforms remain separate
  links, distinguished by those labels.
  The official-avatar fallback is small and uses a plain theme surface.
  Explicitly chosen Library artwork retains the larger artistic presentation.
  Cards without saved background settings retain their existing defaults:
  official avatars use plain, and INSCAPE artwork uses clouds. Choosing
  artwork is not evidence that its image has transparency.
  The chevron overlays the hero directly, without a separate full-width bar.
  One chevron click reveals all nonempty fields directly. There is no second
  category-expansion step or summary row. Existing category strings remain
  intact in saved data but do not add a navigation step to the card.
  An owner-only gear beside Close enables editing directly in the hero and
  field cells, with a + Add cell alongside the existing cells. Save and Cancel
  are in the title bar. Appearance controls remain a secondary inline section.
  Title, biography, tags, artwork,
  background and fields save atomically through the authoring session,
  with stale-write and storage-failure checks. Save and Cancel restore the
  reading view and focus to the gear. Visitors have no edit command.
  Dropping Library artwork enters the same temporary edit session. Its
  keyboard-accessible selector and reset are available inside the editor;
  Save commits the preview and Cancel restores the saved artwork with the rest
  of the card. Artwork participates in the same stale-write checks.
  No redundant artwork or technical-address section appears in reading mode.
  Identity height follows measured content, with no manual height-resize handle.
  Title-bar movement remains available. Long content scrolls within viewport
  bounds. Other instruments retain their existing resizing behavior.
  The cloud pattern is anchored to the card's top edge and width, so expanding
  the card reveals more of the same running shader instead of rescaling it.
  Makers may additionally name, order and remove free information fields with
  text or list content. These use one shared responsive layout, not a second
  canvas editor. Empty fields are omitted from the visible and public card.

- Identity background and free fields use the optional, declarative
  `identityPresentation.card` envelope (version 1), shared by draft-v4 and
  public-v9 validation. Absence remains valid and does not trigger a write or
  change old publication bytes. Explicit Save records the selection even if
  it matches the previous default. Both publication restoration paths retain
  the envelope. New documents containing it require the updated reader;
  older deployed strict readers do not understand this optional extension.
  The host delegates validation to the Identity domain instead of interpreting
  shader behavior. Unsupported types, versions and properties are rejected.
  Background choices are Plain (theme surface) and Clouds, with theme or hex
  cloud color and speed from 0 to 2. Zero is still; reduced motion remains still
  at every setting. Editing previews locally; Save persists and Cancel restores.
  Shader implementation stays in the renderer, never in the document.
  Free fields have stable IDs, labels up to 60 characters, and either text up
  to 2,000 characters or up to 16 list items of 160 characters each. At most 16
  fields are accepted. Publication trims values and omits empty fields/items
  without changing the owner's draft. These are authored descriptions, not
  verified facts or official profile metadata. Visitors receive the published
  settings and fields without authoring commands. No shader marketplace,
  third-party code loading or arbitrary field layout is implemented here.
  Optional field category (60 characters) retains the same envelope.
  Old documents without categories remain valid and are
  not rewritten on read; documents using them need this updated strict reader.
  One cloud canvas spans the hero and extension. The lower reading surface uses
  90% theme-surface opacity while text remains opaque. Renderer resolution stays
  bounded, with a lower cap on narrow screens; this is not a guarantee of mobile
  frame rate. Hidden/offscreen, reduced-motion and disposal behavior still apply.

- Account controls remain available from Profile on the owner's Workbench,
  independently of any authored Identity Module. Explicit Disconnect from the
  owner's Workbench or its Discover panel opens signed-out Discover. Disconnect
  while visiting a public presentation preserves that visitor destination.
- Discover is the shared navigation label for the publication directory.
  An authored Identity Module may present custom biography and fields alongside
  artwork; these are distinct from official Universal Profile metadata and
  account controls. Its implementation and publication format remain to be scoped.
  The Identity Module will replace the existing dossier rather than add a second
  profile presentation. Its window uses the shared rounded module chrome; the
  old dossier's overlay styling is not its visual baseline.
  The replacement opens from Profile as a non-modal, movable window that fits
  its content in owner and visitor views. It reads the existing projected
  identity data; window interaction is session-local and does not write a draft
  or publication. Closing returns focus to Profile. Authored
  shortcuts and starting arrangements, and direct module links remain separate
  work; this replacement does not add a module-instance publication schema.

- Identity content follows the founder's artwork-and-story reference, within
  the shared rounded module window. A module-owned animated cloud shader sits
  behind the portrait; reduced motion renders a still frame. It does not copy
  the old dossier's horizontal menus. Library images can replace the Identity
  portrait without changing official Universal Profile metadata. The existing
  profile-scoped avatar setting retains the asset ID and optional selected
  image resource. Older drafts without that optional resource remain valid.
  Saving uses the existing authoring authority; the module does not publish.
  The existing public avatar asset envelope carries the selected image without
  a new avatar schema. The optional card envelope described above carries
  free fields and background settings; source facts must not stand in for
  invented personal fields.
  The default cloud palette responds to the existing light/dark surface tokens.
  Creator-authored shader aesthetics are also an accepted future direction:
  visual styles and animated materials may be authored and monetized as part
  of the founder's creative offering. Theme adaptation is a default, not a
  requirement that all artistic shaders look alike. Shader behavior belongs
  to the module, not the Workbench host. Third-party packaging, paid access,
  and execution of third-party shader code remain unspecified and unimplemented.

- The INSCAPE Founder designation is product-owned, separate from authored
  roles and official LSP3 metadata. It is assigned to residentzero's mainnet
  profile `0x001048331cd14cef40dd5da644a738e7324fe691`. The Identity projection
  shows it only for that address with a resolved mainnet chain fact. Editing a
  title, biography or field cannot grant it; it is not serialized in
  the creator-authored card. It grants no wallet or authoring authority.

- Direct world links enter the targeted world automatically through Startveil,
  without a separate Enter button. The bare INSCAPE URL retains the public
  Explore/Connect entrance. Its featured world is explicitly selected as
  `0xf3C189819Fd5b042f692983bFbFD57ab607ee709`, independent of directory ordering.
- Startveil remains visible until the destination interface or its recovery
  surface has mounted. A short reveal then hands over interaction and keyboard
  focus. Optional artwork media loads progressively; boot or resident timers
  must not stand in for destination readiness. Returning visits shorten the
  reveal and reduced-motion entry skips it.

- A **Cover Grid** is an existing public Grid selected as the source of the
  Discover snapshot.
- An **Entry Grid** is an existing public Grid selected as the first interactive
  scene in the current Display Module presentation. This does not require every
  future public Workbench visit to open a Display Module automatically.
- Cover and Entry default to the same Grid but may be selected independently.
- Private Grids cannot be Cover or Entry. A public snapshot must never leak a
  private Grid.
- Generate the cover snapshot from the canonical Stage at publication time and
  bind it to that publication revision. Draft edits must not silently change a
  published Discover card.
- Discover renders the lightweight snapshot plus trusted identity chrome. It
  does not mount many live owner renderers.
- Opening a world visually expands the card while the published document loads.
  The snapshot is the poster/loading state; the interactive renderer replaces
  it in the same bounded presentation area when ready.

The entry and card transition above retain the existing presentation baseline.
Discover's eventual presentation of published Workbenches is not yet designed.
Do not infer a final Discover layout from the current screen. Exact module-link
URLs, optional Grid links, and their interaction with the maker's starting
arrangement remain to be specified when implementing public Workbench entry.

## Editing, public inspection, and publication

- The Library retains one canonical record and initially one cover tile per token.
  Its circular image-count button expands or folds that NFT's supported attached
  images directly in the browsing grid, labelled with their source NFT. Each NFT
  expands independently, so standalone poses can remain visible while a layered
  character stays folded. Folded attachments are not mounted or loaded by the grid.
  Expansion is temporary profile-scoped browsing state, retained across filters
  and closing the Library, and reset on reload or profile change. Resolution variants
  of one image remain one choice. Choosing an image does not create a new token
  identity or change Library category membership. Navigation counts count source
  records, not their image tiles. Library category drops remain available during asset drags;
  the Library fades and lets asset drops reach Displays behind its content area,
  while its category sidebar remains a drop target. Metadata refresh must keep cover URLs and image
  choices consistent without changing holding or creator authority.
- An image chosen for placement belongs to that placement. Preserve its resource
  and dimensions through draft persistence, Preview, and public projection,
  alongside the original token identity and provenance. Different placements
  of the same token may use different images.
  Library attachment discovery accepts a .svg resource path declared as
  application/xml or text/xml, including charset parameters. It retains the
  original URL and declared type; unrelated XML documents remain excluded.
  Existing cached records refresh through the ordinary metadata loader without
  a storage-key change or a draft rewrite. Resolution variants remain one image;
  accepted attachments have no separate per-token count cap.
  Library thumbnails accept SVG attachments served with a generic XML media
  type: after an image decode failure, a bounded fetch validates the SVG and
  creates an inert image preview with the correct media type. Preview object
  URLs are temporary and revoked on disposal; placement retains the original
  resource URL. Library thumbnails do not execute artwork scripts.
- Owner editing and public inspection must not silently replace or rearrange
  the application dock.
- The canonical Display Module should make a separate full-application Preview mode
  unnecessary. A future public-inspection state may hide authoring controls and
  private content without changing route or workspace context.
- Keep public/private projection explicit. Only public canonical content may
  enter a publication document or snapshot.
- The current canonical v9 document, profile-scoped private draft, external
  wallet authority, IPFS validation, and visitor recovery boundaries remain in
  force until an explicit, tested migration replaces them.

## Visual language

Module selection outlines and resize marks follow explicit activation by click
or keyboard focus, never pointer hover. Selecting another module clears the
previous module's activation outline; empty Workbench space clears activation.
Image, Text and Shape share this behavior. Unselected resize targets cannot
intercept pointer input; keyboard access remains available. Module action strips
keep their existing reveal behavior, separate from selection bounds.
Image, Text, Shape and tool-window resize targets surround the visible corner
or midpoint, so grabbing that mark always starts the corresponding resize.
Display window corner targets also straddle their real corners and retain a
28-screen-pixel hit area through camera zoom. Workbench group
and Display artwork handles retain their centred geometry. Keyboard focus fills
the small handle mark; the larger transparent hit target never gains an outline.

Selected artwork uses 28-pixel resize targets with contrasting corner marks.
Single selections also have midpoint handles: left/right changes width only;
top/bottom changes height only. Corners retain Shift-proportional dragging.
Layers Selection exposes Width and Height in canvas units (1–512, quantized to
ninths); Enter or leaving the field commits one undoable resize, anchored at the
top left. Invalid sizes do not change saved work. Text resizing reflows its content.
For artwork, side handles and numeric sizes enable free scaling of the media,
including its transparent margins and existing crop. Optional placement
`mediaFrameRatio` retains the original fitting-frame ratio; omission preserves
existing draft-v4/public-v9 rendering without rewriting old data. The field
travels through publication, restoration and duplication; it is placement data,
not a change to the source asset or metadata. Owner and public renderers share
the same fitting calculation. Fit/Cover restore native proportions by clearing
this optional reference; Centre retains it. Group selections retain corner handles.
Targets stay inside the visible Display, including artwork extending beyond it;
their offset from the authored corner is retained by the drag gesture. While
selection handles are visible, window corner targets yield pointer interaction;
Escape clears selection to resize the window. Shift preserves proportions for
single and grouped resizing; Alt uses the existing ninth-cell precision.
Layers offers Fit inside Display, Cover Display and Centre for one unlocked
artwork. Fit/Cover use source proportions (including quarter-turn orientation),
centre the placement, and retain crop, source and other content settings. These
are single undoable geometry edits, with no new saved layout constraint or schema.

Display and Text own optional authored `appearance.edges`: four corner radii in
clockwise order from top left (0–64 pixels), a shadow switch, and grain strength
(0–1). Display also accepts optional `appearance.frame`; Text retains its existing
frame setting. Omitted fields preserve existing appearance without a data rewrite.
Square adjoining corners and rounded outer corners allow modules to read together.
Grain is optional and independent of interface noise and texture in source artwork.
These settings survive publication, restore and Text transfer into Display.

Display background and Grid controls live in the targeted Display's Appearance
window, and beside dimensions in the Custom size creation/editing form. The form
saves size and appearance together as one undoable operation; Cancel changes
nothing. Display-specific controls no longer live in general Workbench Settings.
Background accepts the existing surface presets or a custom six-digit hex colour.
Snap to grid and Show grid are independent checkboxes. Hiding a Grid retains its
Lines/Dots style and spacing; disabling snapping uses the existing ninth-unit
placement precision without changing the visible lattice or moving content.
These settings apply to all scenes of that Display and do not change Workbench
background, snapping or guides. Optional Display appearance fields are
`backgroundColor` (hex or null for the surface preset), `guideVisible` and
`snapToGrid`. Existing draft-v4/public-v9 documents without these fields keep
their original surface, guideMode visibility and enabled snapping, with no data
rewrite. Existing `guideMode: NONE` stays hidden until Show grid is enabled.
New settings survive save, undo, reload, public projection and restore; readers
must support these optional fields to open newly authored documents using them.

Workbench owns module-edge snapping and the local gap preference (0–128 pixels).
While moving or resizing, temporary guides identify the applied module edge,
visible Workbench grid line, or spacing bracket. Flush joins highlight their seam.
Guides reflect the final bounded window, disappear when the interaction ends,
and never enter saved layouts or publication. Module edges capture within 10
screen pixels and retain their target until pulled beyond 18 screen pixels;
Alt immediately releases snapping and its guides. Grid guides use the visible
24-work-pixel Workbench lattice projected through camera pan and zoom, including
when a module is temporarily scaled.
Settings calls the existing gap preference “Space between modules” and shows
a two-window spacing preview. Existing preference keys and values are retained.
Nearby visible module edges take priority over grid snapping, including top and
bottom alignment. Zero gap permits flush joins. Alt bypasses both kinds of snapping;
Workbench area bounds still win. Display resize retains its ratio and opposite corner.
Only open content windows participate; instruments, shortcuts, enlarged inspection
windows and other Workbenches are excluded. Changing preferences does not rearrange
windows. Publication captures the resulting layout through its existing flow;
snapping preferences remain local and Visitor movement remains temporary.

Workbench Grid snapping uses the existing 24-pixel guide spacing when moving or resizing
owner Display and standalone Text windows, as well as Display shortcuts.
Workbench selection, movement and group-resize gestures capture their pointer
on the host and release it on completion. Lost capture, blur or a hidden document
cancels temporary state. Input showing that the mouse has already been released
clears a stale gesture instead of leaving pan and zoom blocked. This lifecycle
belongs to the Workbench and does not change authored module content.
Alt bypasses window snapping temporarily; focused window headers support arrow
keys. Workbench area limits take priority at edges. The existing profile-local
`shortcutSnap` preference remains the storage owner, now labelled Grid snapping;
older values retain their meaning for shortcuts and also control these windows.
Toggling snapping or changing guide visibility does not rearrange existing
windows. Text snaps its moving edges. Display projects pointer movement onto its
fixed Stage ratio, retaining the opposite corner. A module edge on either axis
takes priority over the horizontal grid candidate; the other dimension follows
the ratio. Artwork placement inside Display retains its own rules.
Visitor window movement remains free and does not acquire owner preferences.

INSCAPE is flat, technical, spatial, and deliberately bounded. It must not drift
into generic dashboard, marketplace, or AI-generated interface styling.

### Typography

- Use **Inscape Sora** for primary navigation, headings, controls, body copy,
  human-facing labels, and concise identity labels. Normal UI weights are
  approximately 400–500; heavier weight requires an established reference.
- Use **Inscape IBM Plex Sans Condensed** for technical data, addresses, codes,
  microcopy, measurements, state labels, publication details, dense secondary
  copy, Library rails, metadata, and supporting descriptions.
- The INSCAPE wordmark remains the existing SVG and does not require a brand
  font.
- Do not introduce a new font, generic fallback styling, arbitrary all-caps, or
  unrelated weights when an established role exists.

### Geometry and surfaces

- The Display Module and its creative instruments retain the current restrained
  rounded, textured window chrome, as confirmed by the founder. Concentrate that
  tactile treatment around the instruments; Library, menus, and the application
  dock retain their flatter structural surfaces and existing selector grammar.
- Reuse the shared window-chrome tokens, grain treatment, window controls, and
  existing detached-window shell for compatible module windows. Keep content
  layout and Stage-specific clipping separate; do not copy a module's chrome
  into a new stylesheet merely to recreate the same appearance.
- Default interface geometry is square and structural: zero corner radius,
  one-pixel borders, contiguous faceplates, clipped overflow, and deliberate
  alignment. Circular geometry is reserved for avatars, identity marks, status
  indicators, and controls that are already circular.
- Use the active `--workflow-*`, `--lattice-menu-*`, and established surface
  tokens. Do not add a parallel palette for one screen.
- Retain the established carbon, graphite, slate, ash, mist, and paper surface
  family. Artwork and authored Grid appearance may vary; application chrome
  remains coherent.
- Shadows communicate a genuinely elevated Display Module, window, menu, or modal. They
  remain restrained and must not turn every bounded region into a floating card.
- Spacing follows structural rails, cells, borders, and neighbouring production
  components. Avoid large empty padding used only to make a UI appear modern.

### Selection and interaction

- Active navigation and selected commands use the established high-contrast
  edge-selector grammar: horizontal on horizontal rails and vertical on
  vertical lists. Do not rely on an unrelated fill colour alone.
- Hover, focus, pressed, selected, disabled, and loading states must occupy the
  complete interactive hit area and must not shift layout.
- Keyboard focus remains clearly visible. Controls retain usable hit targets
  even when their visual label is compact.
- Scrollable content must be constrained by its owning window or panel. It must
  not escape above, below, or sideways across the application shell.

### Grid and alignment

- A visible Grid must correspond to real layout, snapping, measurement, or
  navigation geometry. Never add a Grid as detached background decoration.
- The Workbench alignment Grid may be hidden independently from shortcut
  snapping. The Display Module Grid and its authored snapping remain separate,
  publishable Stage appearance and geometry.
- Headers, rails, cards, Display Modules, windows, and controls align to the same active
  structural coordinates wherever their relationship is visible.
- The Display Module boundary must remain visually unmistakable at every
  zoom level and viewport size.
- Zoom changes inspection scale, not document geometry. Visual chrome must not
  accidentally scale as authored Stage content.

### Responsive and cross-mode validation

- Wide and narrow layouts must preserve hierarchy and access, not merely shrink
  the desktop composition.
- Owner, Visitor, Discover, public presentation, loading, empty, and error states
  must look like one system.
- Before accepting visual work, compare screenshots at representative wide and
  narrow viewports and check alignment, overflow, clipping, scroll boundaries,
  typography, active selectors, and input focus.
- Do not declare a visual change complete solely because CSS compiles or one
  viewport appears correct.

## Scope discipline

- The independent-module host and public Workbench are accepted direction.
  They do not authorize implementing every proposed animation, audio,
  headtracking, or identity module immediately.
- Monetization, third-party module distribution, collaborative editing,
  connection protocols, module-version upgrades, and responsive public-layout
  rules remain open implementation or product decisions. Preserve room for
  experiments without treating every possibility as a committed feature.
- Implement migrations in narrow replace-and-verify slices.
- Delete old presentation code only after its accepted replacement is live and
  regression-covered.
- Preserve rollback points and user-owned files.

## Active operational safety

- Public IPFS content is public and permanent.
- A successful IPFS upload is not an on-chain publication.
- Never retry an ambiguous wallet action after a transaction hash exists.
- Keep Pinata credentials server-side and outside all `VITE_*` variables.
- Validate canonical bytes, size, CID, profile, chain, and wallet authority at
  their existing fail-closed boundaries.
- Retain provenance and relationship scope for all LUKSO-derived facts.
- Recheck official LUKSO sources live before changing standards-facing behavior.
- Do not run `npm audit fix --force`, downgrade `@lukso/up-modal`, or introduce
  untested overrides to conceal inherited dependency findings.

### Dependency checkpoint (2026-09-08)

The Identity QR addition declares the already locked `qrcode-generator@1.5.2`
directly; no package versions or transitive package entries changed. Its code
loads when the QR is opened. Existing origin: `@lukso/up-modal` through
`@lukso/web-components` and `qr-code-styling`.

A live `npm audit --json` reported 93 advisories (10 low, 61 moderate,
19 high, 3 critical). This is a dependency inventory, not a demonstrated
browser exploit or a security clearance. The critical entries are `form-data`,
`request` and `tar`. A confirmed path runs from `@lukso/up-modal` through LUKSO
contract packages, `solidity-bytes-utils`, `@truffle/hdwallet-provider` and
legacy Web3 utilities. Vite also has a direct high-severity advisory.
The local Node 18.20.7 emits engine warnings for existing dependencies
requiring newer Node versions. These findings predate the QR declaration.

Before a release, perform a focused dependency maintenance slice: align the
Node/toolchain version, assess current supported Vite and LUKSO package
updates, trace affected runtime paths, and verify wallet and publication
boundaries after any upgrade. Do not combine blind dependency upgrades with
Identity layout work or claim build success resolves these advisories.

The subsequent local maintenance check updated Vite 5.4.21 to 6.4.3 and
esbuild 0.21.5 to 0.25.12. Lockfile comparison found no runtime package
version changes. The audit now reports 91 findings (10 low, 60 moderate,
18 high, 3 critical); the inherited wallet-chain findings remain unresolved.
The configured registry still reports `@lukso/up-modal@0.21.11` and
`@lukso/web-components@1.207.0` as latest (rechecked September 8).
This is a targeted remediation, not a claim that Vite 6 is the newest major
or that the application has received security clearance.

Vite 6's changed bundling exceeds the former standalone-wallet budget with
the same application inputs. The measured Windows output is 4,545,415 raw /
1,208,418 gzip bytes. Only that lazy group's limits were recalibrated to
4,600,000 / 1,225,000; initial/core limits and isolation checks are unchanged.
The migration retains Vite's defaults rather than adding compatibility
switches. See the [official Vite 6 migration notes](https://v6.vite.dev/guide/migration#advanced).
Node 24.20.0 LTS is now installed and selected explicitly for local checks and
the development server. `.node-version` pins it for project tooling; the
package engine range is `>=24.20.0 <25`. The global Windows NVM link can still
select Node 18, so a normal terminal is not automatically migrated. Use the
session-only instructions in `NETLIFY_PUBLIC_IPFS_PUBLICATION.md`. No deployment
runtime has been changed or verified remotely.

The September 8 targeted lockfile update retains all existing wallet/LUKSO
versions and updates PostCSS, nanoid, DOMPurify and the Browserslist data chain.
A broad `npm audit fix` trial unexpectedly downgraded transitive packages; it
was reverted before the final clean installation. No downgrade, force option,
or override remains. `npm ci` succeeds under Node 24 with no engine warnings.
The current audit is **87 findings: 10 low, 59 moderate, 15 high, 3 critical**.

The emitted Rollup module inventory and a bundled esbuild import graph of
`netlify/functions/pin-profile-document.mjs` were checked against the affected
installed paths in that audit. The critical `form-data`, `request` and `tar`
paths are absent from both outputs; no high-severity affected paths were found
there either. Eleven flagged parent LUKSO packages are present in the browser
(including contract ABI modules), but have no direct advisory in this audit:
their findings are inherited from dependencies outside the emitted graph.
Axios remains pinned to 1.16.0 by `@coinbase/cdp-sdk`; its affected path was
also absent from these outputs. This bounds the inspected runtime exposure,
not installation/supply-chain risk or every possible exploit. Keep the
inherited findings visible and revisit upstream package releases before release.

Local verification repeated under Node 24 after the targeted updates:
756 Node tests, seven Identity browser
cases, five LUKSO standards checks, production build and build check passed.
The built wallet chunk imported in an isolated browser without creating a
wallet session; live wallet connection/signing remains untested here.
Identity was visually checked at 390 and 1440 pixels. The targeted review
confirmed shared card validation, profile-scoped authoring callbacks and
module-owned shader cleanup; no new abstraction or layout layer was needed.
The Identity browser harness now resolves React through Vite's module IDs
instead of assuming the optimizer's physical cache path.
The Vite watcher also excludes `.browser-test-runtime` and
`.browser-test-profile`: watching Windows-locked Chromium cookie files caused
an observed EBUSY development-server crash during the first Node 24 browser run.
The browser suite and full tests/build passed after that narrowly scoped fix.
