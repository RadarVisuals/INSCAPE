# Hanssen reference for Inscape

Accepted by the founder on 25 October 2026 as the primary reference for
Inscape's overall presentation and navigation. Refer to this direction as
**the Hanssen reference**. The founder identified it as the example that makes
the whole experience concrete: Reception, browsing compositions, opening a
work, articles and eventually Desktop should feel like connected parts of one
place.

The [active contract](../../INSCAPE_ACTIVE_CONTRACT.md#hanssen-presentation-and-navigation-direction-2026-10-25)
owns the accepted direction. This packet preserves the examples and their
intended meaning. The previous founder screenshot-and-notes packet has been
removed at the founder's request; Hanssen replaces it as the visual reference.

## Source pages

Hanssen is a portfolio template by Gola Templates, published with Framer.

| Reference | Inscape meaning |
| --- | --- |
| [Work overview](https://hanssen-template.framer.website/work) | Browse named compositions with a large preview and a compact list of works. |
| [Darkness project](https://hanssen-template.framer.website/work/darkness) | Open an individual composition with space for its title, introduction and metadata. |
| [Gentlemen project](https://hanssen-template.framer.website/work/gentlemen) | Continue from one work to another within the same presentation. |
| [About](https://hanssen-template.framer.website/about) | Reception: identity, introduction, links and chosen personal content. |
| [Blog](https://hanssen-template.framer.website/blog) | Candidate reference for the Articles or Blog destination; its detailed mapping remains to be worked through. |

The [founder's Framer project copy](https://framer.com/projects/Hanssen-Template-copy--06Bilr9HcNLAg7BjqN7w-98azc?node=augiA20Il&view=preview)
is also available as a source reference. The public links above provide the
interactive examples; the screenshots below preserve the discussed appearance.

## Shared navigation

The founder chose one compact global navigation area at the top left:

**Avatar · Profile name · About · Canvases · Articles or Blog · Desktop**

About leads to Reception. Canvases leads to the composition overview and then
an individual composition. Articles or Blog presents written work. The final
Articles/Blog label remains open. Desktop will be a separate destination for
mini-apps. Each destination occupies the available main area while navigation
remains recognizable and in the same place.

This is the common navigation between destinations. Composition tools and
content-specific controls still belong to the work being opened or edited.
Private owner tools and published profile content retain their access boundaries.

## What to carry into Inscape

- Use the actual reference's proportions, hierarchy, narrow gaps, consistent
  rounded panels, restrained surfaces and large content areas when designing
  these views. A passing resemblance in colour alone misses the direction.
- In the Work overview, a broad preview sits beside a compact list. Moving the
  pointer over a row changes the cover preview; clicking opens that work.
  Inscape's preview browsing must remain separate from activating an editor.
- An opened work has a generous title-and-description area with compact
  metadata alongside it. Inscape's values must describe the actual composition;
  the template's Year, Client, Service and Location fields are examples.
- On the inspected desktop project pages, the left cover stays visible while
  the right content column scrolls. A next-work section continues the browsing
  experience. Adapt these relationships to an interactive composition's needs
  while retaining its authored geometry and exploration controls.
- Reception uses the same panel language for a chosen image or artwork,
  identity, introduction, links and personal sections. The template's clients,
  exhibitions and awards illustrate content organization rather than mandatory
  profile fields. Reception remains friendly to individual branding.
- Use the shared navigation and visual treatment across destinations. Their
  content can require different layouts: the future Desktop is one large frame
  with icons, rather than a required two-column photo arrangement.

## Delivery scope

### Alternative grid: Aerra (25 October 2026)

The founder also chose [Aerra](https://heartwarming-assumptions-940256-b6ef1927f.framer.app/),
another Gola portfolio template, as a second **Workbench overview view**.
Keep Hanssen's list with preview and add a List / Grid toggle. Aerra's dense
image tiles, narrow gaps and vertical wraparound inform Grid. The live homepage
was inspected: scrolling past the final row continues through a repeated first
row, and its scroll position is normalized between repeated visual collections.

Inscape uses the saved compositions themselves as tile previews. The founder's
follow-up chose automatic fill with optional manual crop: centre-crop by default,
then allow positioning and zoom saved per canvas through Crop.
This only frames the thumbnail; List and the opened canvas still fit the whole
composition. Titles and small actions reveal over the image on hover or keyboard
focus. Touch first reveals, then opens through a second tap or View.
The founder's subsequent sketch combines identity/navigation, List, Grid, Wrap
and New Workbench in one bottom-centre Inscape menu for this overview. The
old separate grid information panel and permanent info icon are removed;
Information reveals the introduction and Edit details within the tile.

The founder also approved Aerra's animation treatment for menu opening, details
and entering/leaving a canvas, followed by thumbnail arrangement and card size.
The [published Aerra site](https://aerra-template.framer.website/?via=pawelgola)
serves readable compiled JavaScript. Its menu uses a 0.6-second spring with zero
bounce; several details/category panels use 0.7 seconds with zero bounce, and
text effects combine opacity, a small translation and blur. These are observed
settings in the served output, not access to the editable Framer project.
Inscape approximates the settling motion using native CSS/Web Animations,
preserving its own rendering, keyboard, touch and reduced-motion boundaries.
Card size and Arrange live in the bottom menu. Arrangement saves collection
order, while size is a profile-local preference. See the
[implementation and checks](../../audits/2026-10-25/presentation-motion/README.md).
Wrap is optional, has no autoplay, and exposes one
collection to keyboard/assistive navigation. Aerra's opened-project horizontal
image sequence and About page remain outside this slice. The following canvas
inspection uses its compact metadata reveal, adapted to one composed canvas.
The [saved grid capture](screenshots/04-aerra-grid.jpg) is reference evidence,
not an Inscape asset. See [implementation evidence](../../audits/2026-10-25/overview-layouts/README.md).

The first local implementation now applies this reference to the owner
Workbench overview and its compact avatar/name, About and Canvases navigation.
See the [implementation and checks](../../audits/2026-10-25/hanssen-overview/README.md).
Reception's redesign, public opened-work presentation, Articles/Blog and the remaining
global navigation rollout are subsequent work. This does not describe a published
release or a public multi-Workbench overview.

### Canvas inspection and expansion (25 October 2026)

The founder supplied [a modal sketch](screenshots/06-canvas-modal-founder.png)
and [an expanded canvas with Index](screenshots/07-canvas-index-founder.png),
then approved combining them as two sizes of one viewer. A tile lifts into a
bounded inspection modal over the blurred overview; expand fills the app viewport.
The composition opens fitted in full, with existing named camera points available
through a side drawer and a compact selector below the information controls.
The smaller Edit action opens the authoring environment. Closing returns to the
gallery without losing the browsing position. Desktop remains deferred.

Aerra's [project Details reveal](screenshots/05-aerra-project-details.jpg) informs
the hover interaction, with keyboard focus and tap/click equivalents. Canvas
title/description remain distinct from the individual artworks' metadata. The
founder approved an artwork selector in the information panel: choosing a source
shows its existing creator, description, attributes and provenance and highlights
its placements. Repeated uses share a source; unrelated attributes are never
merged. Camera points choose framing and do not imply shared authorship.

The founder then explicitly requested Aerra-like glass buttons over the artwork
and an unobstructed opening. Viewer controls start hidden and reveal on pointer
movement, keyboard navigation or a tap; they do not reserve a header/footer.
The same glass treatment applies to the overview's combined bottom menu, with
List, Grid and Wrap inside it. The gallery extends behind it without a reserved
header or footer. This scoped choice supersedes the generic no-new-glass guidance
for these presentation controls.
The latest founder screenshots supersede the earlier rim/sheen interpretation.
The supplied [hover example](screenshots/08-hover-reveal-founder.png),
[old information panel](screenshots/09-old-information-panel-founder.png),
[combined-menu sketch](screenshots/10-gallery-menu-founder.png) and
[Aerra material examples](screenshots/11-aerra-glass-founder.png) are preserved
unaltered. The founder explicitly approved combining navigation and view controls.
Aerra's category control was inspected in the live reference: rgba(12,14,15,.5),
10px backdrop blur, 6px corners and a quiet shadow, without a glossy gradient.
This is the shared overview/viewer material. Transparent artwork keeps the
chosen canvas background. See the [hover/menu implementation](../../audits/2026-10-25/gallery-reveal/README.md).

The [local owner implementation](../../audits/2026-10-25/canvas-presentation/README.md)
retains the current read-only projection limits. It does not add a curated image
sequence or public multi-canvas publication. The two founder screenshots are
unaltered copies of this conversation's attachments, not production artwork.

**Desktop remains deferred.** Its accepted shape is one large surface with
mini-app icons and app windows, separate from composition authoring. Existing
URL-and-iframe hosting is a reuse candidate. The experimental HTML-artwork use
case is not a Desktop requirement; the founder uses SVG for that artwork case.

The composition remains a live, structured work. Previews do not replace its
editable content, source identity or metadata. Keep one active editor, reliable
local saves, scoped publication and existing identity/owner boundaries.
Established interface fonts and composition-tool controls continue to apply
until their own scoped design changes are agreed. The overall presentation and
navigation should follow Hanssen when those views are implemented.

## Saved screenshots

Captured or supplied on 25 October 2026. The two browser captures are unedited
2545 × 1297 desktop viewports. The founder's detail image is an unchanged copy
of the attachment supplied in this conversation. These are reference images,
not production assets for Inscape.

| Image | Purpose |
| --- | --- |
| [Work overview](screenshots/01-work-overview.jpg) | Main preview, list of works and compact top-left navigation. |
| [About and Reception](screenshots/02-about-reception.jpg) | Identity visual, introduction, links and personal sections. |
| [Opened work detail supplied by the founder](screenshots/03-work-detail-founder.png) | Title, description, metadata and content hierarchy highlighted by the founder. |

Inspect these images and the live page interactions before implementing a
related screen. Keyboard, touch, narrow layouts and reduced-motion behavior
need their own implementation checks; the captures show the desktop reference.
