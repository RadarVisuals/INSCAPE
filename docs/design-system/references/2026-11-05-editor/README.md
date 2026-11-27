# Editor finish at the existing Inscape scale

Founder-reviewed direction, 5 November 2026. This is a pre-implementation
checkpoint, not a claim that the application has adopted these designs.

The founder liked the second study's graphite panels, inset rounded fields,
grouped controls and restrained selection accent. Both Dark and Light are
required. They found its controls substantially oversized at 100% and identified
the running Inscape editor as the preferred scale and density.

## Saved specimens

- [Compact Editor and density comparison](INSCAPE-Editor-Compact.figcraft): the
  complete example in both themes, plus previous/compact inspectors side by side.
- [Finish reference](INSCAPE-Editor-Study-02.figcraft): the earlier liked visual
  treatment. Its oversized density is superseded by the compact study.
- [Density comparison](density-comparison.png).
- [Compact Light Editor](compact-editor-light.png).

These native Figcraft documents contain editable text, shapes, icons and the
existing Inscape wordmark. Sora is the interface font. Lucide icons come from the
project's existing dependency; their [licence](Lucide-LICENSE.txt) is also embedded
in each archive. No new application dependency was installed for these studies.

## Scale and implementation boundary

The compact study uses a 290 px reference panel width, 28 px controls and 11 px
interface text, with the existing 40 px menu and 44 px creation bar. The width
was observed in the running Library/Bento export; sizing is grounded in the
current control and menu styles. Actual panels remain resizable and their saved
arrangements must not be replaced by fixed mockup coordinates. Browser zoom and
display scaling change screenshot pixel sizes.

The first cell-settings block reduces from 428 to 232 px including its header.
The complete inspector example reduces from 868 to 512 px. Repeated alignment
controls are consolidated in the content-alignment example.

The specimens are static designs. Example canvas content and saved-state labels
are not the user's current document or operational evidence. Proposed cell
padding/alignment controls and changed grouping do not implicitly authorize new
behavior. Production's actual controls and their owners must be traced before
an interaction change. Artwork colours remain unchanged between themes.

The founder requested iteration directly in the real Editor. Start with the
existing Bento panel; the design lab is optional, not an implementation gate.
Keep a styling slice separate from new editing behavior, then share the agreed
finish through the existing component and style owners. The original broad UI
redesign and the initial DOM-based UI inventory are not this task's design direction.

## Checkpoint evidence

All supplied design frames were opened and rendered using the installed Figcraft
CLI and inspected visually. Figcraft reported no missing fonts or import notes.
This does not establish application correctness. No local application tests or
builds were run for this checkpoint, following the founder's instruction to stop
running tests during the ongoing UI review. The commit preserves the preceding
Bento, Text, Image, Layers and wallet/bundle work before the new finish is applied.
