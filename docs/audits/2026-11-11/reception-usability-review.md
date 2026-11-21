# Reception usability review — 11 November 2026

## Conclusion

Keep the current native Bento editor. The common cell and image actions are already close to the selection. The next improvement should reduce inactive controls and make editing modes and mobile exceptions easier to find. This review does not establish that every Reception feature is defect-free.

## Evidence and coverage

The walkthrough used an isolated native Reception fixture in connected Chrome, not the user's saved profile. Source review covered the owner Reception, shared document renderer, navigation, publication entry and editor controls. Comparators were assessed from their official documentation, not hands-on performance tests.

| Area | Evidence | Assessment |
| --- | --- | --- |
| Cell selection and contextual actions | Live | Fill, positioning, add cell, add text, add image, contents and grid settings are within reach. Keep this compact toolbar. |
| Structure | Live menus; allocator/source inspection | Split and Merge in the inspector and context menu are sensible. Add-cell wording describes rows while dragging describes cell edges: align the language in a later focused change. |
| Dragging | Live move committed in fixture; source review | Root-column movement works in the walkthrough. Four permanent edge destinations created excessive visual noise. Changed here; held-pointer visual and automated regression still require verification because the standalone browser cannot launch. |
| Cell versus contents | Live | Editing contents exposes an explicit Back to cells action. Keep it, but strengthen the mode cue; entering contents temporarily leaves the inspector empty until a child is selected. |
| Images | Live selection/controls | Fit, Fill, Crop and Replace are present beside the image and in the inspector. Keep both direct shortcuts and detailed properties. |
| Text | Live inspector inspection; renderer source | Formatting dominates a tall inspector even when inactive. Common placement settings are harder to reach. Prefer a compact selected-text view and show the full formatting surface while writing. Do not remove rich text. |
| Layers | Live | A useful second route to select nested objects. Generic Text/Image names become ambiguous with repeated objects; improve naming near creation/editing. |
| Whole Bento | Live Current grid and New layout | Dimensions, gap, margins, radius and line visibility belong here. Keep New layout separate and its explicit Replace layout action. Do not expose layout replacement as an instant styling change. |
| Responsive preview | Live Desktop/Phone controls and phone settings; mobile screenshot inspected | Automatic stacking is present. Manual phone width, height and order are behind Preview then an icon. Make Auto versus custom phone settings explicit and accessible from the selected cell. Do not create a second document. |
| Publication | Live panel only | Scope and privacy distinctions exist, but generic Workbench copy does not clearly explain the current Reception. Add a Reception-specific summary. Preparing, uploading, signing and sending a transaction were not exercised. |
| Reception viewer | Shared preview live; full owner/public navigation inspected in source only | Explore, Enter Inscape, editor return and source-opening each have different jobs. Test labels with new users before merging destinations. Owner draft/published fallback notices and source-error states should remain. |
| Recovery and history | Controls live; existing tests | Preserve saved-local feedback, Undo/Redo, recovery and publication safeguards. They should not be removed merely to shorten the interface. |

No live wallet/public-profile navigation, physical-phone gestures, narrow editor viewport or light-theme walkthrough was completed. The fixture does not reproduce the screenshot's unavailable-artwork state; this change does not claim to repair asset loading.

## Comparison and recommendations

| Reference | Documented pattern | Implication for Inscape |
| --- | --- | --- |
| Shadcn Studio Bento Builder | Selection-based toolbar and Layers; live ghost placement; desktop/tablet/mobile previews | Current contextual tools are on the right track. Keep one visible destination and the movement preview. Its ready-made cards are not equivalent to Inscape's nested artwork composition. |
| Carrd | One insertion bar at the active destination; element properties on selection | Show the action currently targeted, rather than all possible destinations at once. |
| Carrd mobile | Automatic mobile handling with explicit Manual exceptions and a route back to Auto | Make automatic placement and individual phone overrides understandable at the selected object. |
| Bento.page | Click to select, double-click text to write, collapsible panels and selection properties | Borrow direct editing and progressive disclosure. It is a slide editor; this is not evidence for replacing the responsive layout engine with its fixed slide canvas. |

Recommended order:

1. **Text inspector:** keep font, size, alignment and placement prominent; move rarely used find/recovery and advanced formatting behind their existing contextual entry points or a compact disclosure. Verify mixed-format editing before changing it.
2. **Phone controls:** expose a clear link from cell properties, identify automatic versus overridden values and retain reset-to-desktop/automatic behavior.
3. **Publication:** describe precisely whether Reception and profile details are selected and provide an understandable preview of that scope.
4. **Selection clarity:** make cell versus contents mode unmistakable, explain disabled duplication before treating it as a bug, and improve repeated-object names. Duplicate was disabled in the observed cell menu; its cause was not established in this review.

These are recommendations, not additional implemented redesigns.

## Implemented in this change

- Removed the four dashed card-edge bands and all four simultaneous outer-destination labels from ReceptionBentoEditor.
- Retained the existing live layout preview, actual destination rectangle and one action/status label.
- Replaced the stacked outline/shadow with one two-pixel accent border and a seven-percent accent wash. Destination radius follows the dragged cell at the current camera scale.
- Suppressed the redundant selected/focus outline on the cell only while it is actively being dragged. Keyboard focus remains visible outside that gesture.
- Styled the single action label with existing editor surface, text, border and radius tokens. It remains bounded to the viewport.
- Removed obsolete card-target CSS. No new dependency, timer, motion effect, saved field, hit zone or allocator was introduced.
- Extended the existing browser regression to assert one preview, one action label and no obsolete edge bands, and to capture the active-drag state when that runner is available.
- Regenerated the design-system inventory for the current checkout. This checkout already contains substantial unrelated work; no unrelated source was reverted.

## Validation

- Unit suite: **1,817 passed, 0 failed**.
- Source lint: passed; existing recorded hook-dependency observations remain.
- Workbench strict contract checks: passed.
- Vite production build: passed.
- Production budget check: passed; **726,468 initial JavaScript bytes**.
- Focused native-cell browser test: **blocked before assertions** by the runner's Chrome process launch error (spawn UNKNOWN). The new held-drag assertions and screenshot have therefore not run successfully here.
- Local changes only; no commit, push or deployment performed.

Sources accessed 11 November 2026:

- https://shadcnstudio.com/docs/getting-started/bento-builder
- https://carrd.com/docs/building/basics
- https://carrd.com/docs/building/optimizing-elements-for-mobile
- https://bento.page/help/
