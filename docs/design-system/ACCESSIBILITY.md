# Accessibility and interface content

Use WCAG 2.2 AA as the evaluation baseline and the applicable WAI-ARIA pattern for custom widgets. These are acceptance criteria, not a claim that the current application satisfies every criterion. Automated checks, visual inspection, keyboard testing and assistive-technology testing provide different evidence. [WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/).

## Input and focus

Prefer native buttons, links, form fields and disclosures. A visual class does not implement keyboard behavior. Every icon control needs an action name. Interactive groups need an understandable label. Do not make an SVG or generic element pretend to be a button when a native button works.

Keyboard focus must remain visible, distinct from selection and unobscured by sticky controls or clipping. The reference uses a neutral 2 px ring; search uses a quiet neutral border, and forced colours retain the system focus outline. Each focus cue needs surrounding room. Scroll a focused command fully into view. After a popup or tool closes, restore focus to its trigger or a logical surviving target. Do not focus a different module merely because the original disappeared.

The creation toolbar has arrow/Home/End navigation and native Tab stops. The APG toolbar pattern describes a single Tab entry with navigation inside; the current toolbar is not documented as complete roving-tabindex conformance. Any future change must be verified with focus recovery, disabled controls and the two-row layout. [WAI-ARIA toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/).

A true modal moves focus inside, contains it while open, makes the background unavailable, and restores focus when closed. Use `aria-modal` only when the behavior is actually modal. Movable companion tools remain non-modal. Native `dialog` is used by Focus writing; moving the editor must retain its document and undo history. [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Escape belongs to the nearest interaction. Cancelling a resize must not also trigger camera Back. Editor shortcuts, text input, IME composition and native selection must not be captured by Workbench shortcuts. Shortcuts supplement discoverable controls.

## Target size and dragging

The agreed reference toolbar uses 36 px targets, expanding to 44 px at ≤520 px and for coarse pointers. Current production creation keys remain 40/44 px until migration. Companion actions/headers use 44 px on narrow or coarse layouts. Artwork resize handles use a 28-screen-pixel hit area around their visible mark. These product choices should be evaluated separately from WCAG's 24×24 CSS-pixel minimum and its specific exceptions. Do not call every compact control a violation or use the exceptions to excuse avoidable difficulty. [Target size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Check the actual clickable rectangle and target spacing after zoom, at viewport edges and on tiny modules. A visible corner mark must stay within its hit target. Unselected hidden resize targets must not intercept ordinary input. Preserve available numeric, menu or keyboard alternatives to dragging and verify applicable dragging-movement requirements.

## Contrast and state

Evaluate normal text at 4.5:1, qualifying large text at 3:1, and required non-text component/state information against its applicable 3:1 requirement. Disabled controls and purely decorative lines have different treatment; never apply those exemptions to essential active information. The current condensed 10/11 px technical roles are normal text, not large text.

Alpha colours, gradients, overlays and artwork backing require composed contrast measurement. Checking a hex token alone is insufficient. For the flat reference, measure each actual solid surface and state. For retained production tactile text, use the brightest gradient stop as a conservative background. For fields, also inspect whether required boundaries remain identifiable. Do not claim a low-contrast decorative rim passes simply because its text does.

The flat reference uses an inverted active-tool fill and quieter secondary selection with a state mark. Focus is a separate neutral cue. Retained production surfaces still use their existing edge marks or inset material. Error and success have words; colour alone does not identify their meaning. Retained slate/other translucent combinations and low-opacity supporting text require context-specific verification rather than a blanket pass.

Forced-colour mode must retain control identity, selection and focus when gradients and shadows disappear. Use system colours and visible borders/marks. Test native controls alongside custom ones. Never globally disable forced-colour adjustment to preserve the design palette.

## Motion, reflow and reading

Reduced motion removes unnecessary chrome transitions and uses the existing immediate/discrete alternatives for camera travel, inspection and side changes. It must not leave content hidden while waiting for an animation that will no longer run.

Test interface text at 200% sizing and narrow reflow, including long labels, long addresses and errors. Spatial artwork can retain its authored geometry; the surrounding tools still need readable, reachable controls. Content-specific exceptions do not apply to ordinary tool labels or forms.

The owning tool/window should contain scrolling. Avoid page-level sideways overflow, focus clipped under a toolbar and nested scroll regions that trap navigation. Do not truncate errors or the only copy of essential source information. A shortened address needs an accessible full value or explicit copy/detail route.

## Forms and status

Connect labels and descriptions to controls. State units next to dimensions. Use the existing module bounds and validation rather than duplicating them in a generic field. Invalid or incomplete values remain recoverable; do not silently coerce them into unrelated content. Errors identify the field, the issue and the action that resolves it.

Use polite status announcements for ordinary completion/loading feedback and alerts for blocking failures that need prompt attention. Avoid announcing every drag pixel or every animation frame. Preserve save recovery until a confirmed successful operation resolves it.

| Situation | Suitable example | Avoid |
| --- | --- | --- |
| Empty Grid | “No artwork in this Grid.” + applicable Library action | Implying a failed fetch found nothing |
| Invalid size | “Enter a width from 32 to 4096 px.” | “Invalid input” alone |
| Ineligible command | “Select artwork to inspect its source.” | A disabled icon with no explanation |
| Local save complete | “Saved locally.” | “Published” |
| Save failed | “Couldn’t save this change.” + existing recovery action | A success toast or discarding the editor |
| Missing public target | Explain unavailable target + route to the overview | Silently opening unrelated work |

The wording above is guidance, not a change to the application's current strings. Validate bounds against the owning domain before using an example in production.

## Voice and terminology

Use calm, direct, concrete language. Prefer an action plus object: “Duplicate Image”, “Fit canvas to content”, “Return to composition”. Use sentence case for new labels unless the established local treatment says otherwise. Avoid generic success claims, technical implementation terms in normal flows and blame directed at the person using the product.

| Term | Meaning |
| --- | --- |
| Workbench | The containing desktop and authored spatial experience |
| Module | An independent creative application instance |
| Display | The composition module; do not call the whole product a Display |
| Stage | The clipped canonical output of a Display |
| Grid | An authored scene, not a marketplace thumbnail layout |
| Library | Source material available to the owner |
| Properties | Context-specific artwork/Image/Shape controls |
| Layers | Structural order of one Display's current Grid |
| Artwork info | Source and contextual inspection |
| Focus | Camera travel to a module or selection |
| Inspect | Artwork inspection through the existing renderer |
| Close / minimize | Remove a window from the current view; not content deletion |
| Delete | Remove authored content through the existing operation |
| Saved locally / published | Different confirmed outcomes |

Retain the distinction between official identity, authored persona, source creator, current holder and composition author. Do not turn incomplete source facts into asserted ownership or permission. Use consistent wording across owner and public surfaces without exposing editing controls to visitors.

## Verification matrix

For each changed component record the tested viewport, pointer type, theme and state. Cover keyboard-only use, focus return, long content, disabled reasons, empty/loading/failure, reduced motion and forced colours. Add screen-reader and real-device evidence when available. A screenshot proves appearance at one moment, not interaction correctness.
