# Design-system research

Reviewed 2026-10-14. This research uses primary system documentation and accessibility guidance. It informs how Inscape's system is organized; Inscape's active contract determines its actual visual direction. Source guidance was synthesized rather than copied as a foreign visual style.

## Findings and application

| Source | Finding | Application to Inscape |
| --- | --- | --- |
| [USWDS maturity model](https://designsystem.digital.gov/maturity-model/) | Principles, guidance and code are complementary parts of adoption. A stylesheet's presence does not prove usability. | Supply principles, behavioral contracts, real component examples and checks together. |
| [USWDS design principles](https://designsystem.digital.gov/design-principles/) | User needs, trust, accessibility and continuity are evaluation criteria, not only aesthetic aspirations. | Judge a change by whether it helps composition and preserves predictable control of work. |
| [Material foundations](https://m3.material.io/foundations/) | Foundations connect accessibility, layout and interaction with reusable design decisions. | Cover behavior and responsive composition alongside the palette and type. |
| [Material colour roles](https://m3.material.io/styles/color/the-color-system) | Role-based colour expresses how values participate in an interface. | Prefer existing surface, ink, focus and selection roles over a new one-off hex value. |
| [Carbon colour](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview) | Themes change values while semantic roles retain their meaning. Layers and interaction states are part of the colour model. | Keep Carbon and Mist coherent in the reference; retain the six production surface IDs until an explicit migration. |
| [Spectrum design tokens](https://spectrum.adobe.com/page/design-tokens/) | Semantic tokens communicate intent; complete components also supply behavior and accessibility. Reusable structures compose into larger components. | Reuse the production shell and toolbar before assembling a visual imitation from tokens. |
| [Spectrum colours](https://spectrum.adobe.com/page/color-system/) | Colour should establish hierarchy and meaning, with accessible combinations and text for semantic meaning. | Keep artwork chromatically free while interface status and focus remain restrained and explicit. |
| [Spectrum motion](https://spectrum.adobe.com/page/motion/) | Motion should add meaning and account for reduced-motion settings. Different kinds of movement convey different purposes. | Keep tactile feedback separate from camera travel and module inspection. Preserve existing cancellation paths. |
| [DTCG format module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/) | A typed interchange model includes token values, descriptions, grouping and references. | Retain descriptions, aliases and provenance in a machine-readable inventory; do not mislabel raw CSS as conforming interchange data. |
| [DTCG colour module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-color-20251028/) | Colour interchange requires an explicit colour representation rather than ambiguous formatting. | Preserve the current CSS expressions and distinguish a later interchange conversion from today's executable values. |
| [DTCG resolver module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/) | Themes, sizing and accessibility contexts need an explicit resolution model; overlapping contexts can multiply combinations. | Preserve selector and media scopes in the inventory instead of flattening all declarations into one value per name. |
| [GOV.UK contribution criteria](https://design-system.service.gov.uk/community/contribution-criteria/) | Contributions need a useful distinct purpose, consistency and evidence of usability and versatility. | Require concrete consumers and state/input evidence before adding another shared abstraction. |
| [GOV.UK component lifecycle](https://design-system.service.gov.uk/community/component-lifecycle-statuses/) | Lifecycle labels make maturity and intended use visible to consumers. | Distinguish production, retained, trial and deprecated behavior rather than treating every example as equally approved. |
| [Atlassian content foundations](https://atlassian.design/foundations/content/) | Clear, consistent language is part of the interface system. | Record a domain glossary and use concrete action labels across hosts. |
| [Atlassian message design](https://atlassian.design/foundations/content/designing-messages/) | Message type, placement and language should match the purpose and next action. | Separate loading, empty, unavailable, stale, failure and confirmed success; give recovery a meaningful action. |
| [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/) | Accessibility covers perceivable information, operable input, understandable behavior and robust semantics. | Verify contrast, keyboard access, focus, resize/reflow, status and native control semantics. |
| [WCAG target-size explanation](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | The AA minimum and its exceptions differ from larger ergonomic recommendations. | Measure real hit areas and spacing while keeping the reference’s 36/44 px creation controls and existing production 40/44 px controls and screen-sized handles. |
| [WAI-ARIA toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) | Toolbar semantics include a named group and deliberate keyboard movement/focus behavior. | Document the production toolbar's current keyboard model honestly and test its arrows, popups and focus return. |
| [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | A modal must actually control focus and background interaction; a role alone is insufficient. | Keep non-modal instruments distinct from Focus writing and other genuine modal flows. |

## Synthesis

A design system is an operational agreement between product intent, visual decisions, reusable implementation and ongoing evidence. Tokens make decisions addressable. Components connect those decisions to semantics and interaction. Patterns explain how components solve a real task. Governance gives the system a way to change without multiplying alternatives.

For an established application, a useful starting point is an implementation inventory. Inscape already has coherent global roles, multiple intentional surface contexts, a tactile recipe and shared window/toolbar components. Rebuilding these as another library would create competing owners. The initial reference made those owners discoverable and added an inventory and drift checks. The subsequent flat direction remains a bounded preview using those components; it is not yet a production material migration.

Uniformity is not the goal across every visual surface. Artwork, authored article typography, module appearance, window chrome and navigation have different responsibilities. Inscape's system governs their interfaces and relationships while retaining the artist's choices.

## Research boundaries

These sources establish useful engineering/design practices. They do not validate Inscape's particular interaction trials or establish its usability with representative artists. No Figma library, formal user study, assistive-technology audit or universal browser conformance is implied. The reference records the current implementation and provides a concrete basis for those later evaluations.
