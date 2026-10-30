# Governance and adoption

The system is maintained with the product. Its usefulness depends on keeping the code, examples and behavioral guidance aligned.

## Ownership

| Decision | Authority |
| --- | --- |
| Product meaning and accepted visual direction | Founder / active product contract |
| Exact production visual values | Existing owning CSS files |
| Component behavior and accessible interaction | Existing production component/controller |
| Creative content, validation and saving | Owning module and draft boundary |
| Window hosting and navigation | Workbench host and camera/navigation controllers |
| Documentation and inventory | This handbook and `design-system/registry.js`, derived from the above |

Current CSS ownership is already adequate for a system reference. This release does not move module state into a design-system provider, introduce a component framework, or move lazy owner CSS into the initial public bundle. PostCSS was already present through Vite; the inventory tool declares that exact installed version directly as a development dependency, with no new dependency tree or runtime cost.

## Review status

The reference presents three plain-language labels, owned by designDecisions in
design-system/registry.js. **Agreed** means the founder accepted the direction;
it does not mean the application has migrated. **Needs review** means a proposal
or an outstanding decision. **In the app** means existing implemented behavior,
not approval of that material as the new direction. Implementation cards all
describe current application code; the decision list describes the new direction.

The toolbar and two themes are agreed; the toolbar is already in the app.
On 19 October the founder selected the shared creative workspace as the design
basis for Workbench layering, Layers removal and shared dockable/hideable tools.
Its status is Agreed, with production migration pending. Separate Properties/field
coverage and button-state specimens remain references to evaluate in that real
workflow; unimplemented effects or feedback behavior are not approved merely
by appearing in it. Loading, empty and failure-message designs remain open.
No label implies whole-product accessibility certification. See the
[dated decision](../INSCAPE_ACTIVE_CONTRACT.md#workbench-composition-direction-2026-10-19).

## Source of truth and drift

Production CSS remains authoritative. `npm run design-system:tokens` regenerates `design-system/tokens.generated.json` from all production and design-system stylesheets. Reference, Reference material and Reference local roles distinguish preview declarations from application defaults. The JSON records normalized source checksums, definitions, CSS expressions, aliases, selectors and media/support contexts. `npm run design-system:check` fails when that derived file is stale or registered source/evidence paths are missing.

The inventory test runs under ordinary `npm test` as well as the focused command. Regenerate after CSS edits and inspect the diff. Adding a stylesheet causes it to be included automatically. A new shared style owner must also be registered in `tokenSources`; otherwise its declarations appear as Local.

Treat the export as an index, not a second theme database. Do not edit generated values by hand. It includes runtime/custom layout variables and local aliases; inclusion is not promotion to a public token API. It also preserves duplicate scoped definitions rather than incorrectly flattening the cascade.

## Contribution workflow

1. Describe the real task and identify existing consumers. Search the registry and production code before adding an alternative.
2. Trace the relevant UI, state, persistence and access boundaries. Explain prerequisite cleanup only when there is a concrete responsibility conflict.
3. Reuse the existing component or material. Keep new dimensions local until there is evidence they form a shared decision.
4. Exercise all applicable states and input modes. A default-state screenshot is insufficient.
5. Update the registry, examples and documentation when their contract changes. Regenerate the inventory.
6. Run focused behavior checks. Run build/build-check for production-boundary changes and the full suite at a release checkpoint. Inspect representative screenshots.
7. Record what is verified and what remains uncertain. Never label an untested pattern accessible, responsive or production-ready merely because it renders.

A useful component proposal explains the user need, existing examples, why current components cannot serve it, ownership, states, input behavior, content behavior and migration impact. The review standard is useful, coherent and tested in context. It does not require a large new library.

## Lifecycle

| Stage | Meaning and evidence |
| --- | --- |
| Candidate | Concrete need and example; does not yet replace production |
| Trial | Explicitly identified experiment exercised in a bounded context |
| Production | Used in current product; source, responsibilities and checks identified |
| Retained | Current production behavior preserved while a different family is adopted elsewhere |
| Deprecated | Replacement exists and consumers have an explicit migration path |
| Removed | No live consumers; compatibility consequences have been handled |

The underlying production inventory retains Production and Retained for compatibility; both display as In the app, with retained material identified in the description. Historical experiments are not promoted merely by appearing in a screenshot. Retained surfaces remain legitimate consumers of the system.

## Migration rules

Migrate one meaningful surface at a time after its review decision. Shared preview values live in `design-system/referenceTokens.css`; the flat material adapter lives in `referenceMaterial.css`. Layout and component-specific overrides remain in their corresponding reference stylesheets and reuse existing components. When a production migration is requested, move the agreed material into the existing production style owner and remove the superseded preview overrides; do not copy a second recipe into each panel. Retain the panel's target, data owner, geometry, focus and save behavior. Remove superseded local material declarations at their source once replacement behavior is verified.

Do not apply a global radius, font, button reset, grain or colour migration across artwork, embedded documents and authored article content. Do not replace a known shape with a generic card component. A visual migration must leave saved drafts and published byte interpretation unchanged unless a separate explicit data change is required and tested.

The registry's material columns describe the existing app, while the reference decision list tracks the new direction. The production creation toolbar, camera rail and context action bars have
received the recorded flat migrations. Other companion instruments retain
their existing material until their own migration. Identity and compatible windows keep bevel. Library, menus and retained system panels keep structural treatment. The dock currently uses tactile material in its rail layout, although the contract still describes its structural baseline; this observed difference is recorded rather than resolved by a new redesign. Module media remains authored. Distinct material families must not be reported as a failed partial migration.

## Versioning

`system.version` identifies this reference release, not the application's draft or publication schema. Use patch releases for corrections, minor releases for compatible additions, and major releases for a removed/renamed public reuse contract or an intentional broad visual contract change. A version bump never authorizes a product change by itself.

Deprecation needs a defined replacement and affected-consumer checks. Update
current consumers together; do not keep aliases solely for hypothetical older
data when the active contract's development-data policy does not require it. Do not rename longstanding `PresentationBoard` implementation/storage identifiers just to align them with the Display label.

## Evidence and known limits

The registry connects components to existing tests or visual fixtures. A link is a verification starting point, not evidence that it passed in this release. [Verification](VERIFICATION.md) records runs actually performed.

Current inspection also identifies matters for future focused work:

- Some theme and component CSS still contains local values and broad selectors. The inventory makes them visible; it does not silently centralize them.
- Global layer tokens coexist with local Workbench stacks. A universal z-index rewrite has not been attempted.
- Compact typography and retained 26 px bevel controls need contextual usability and touch review.
- The toolbar supports arrows and native Tab stops; it has not been converted to the APG single-tab-stop model.
- Translucent/faint colours and subtle field boundaries require measured context-specific contrast work.
- Chromium browser checks do not establish Firefox, WebKit, screen-reader or real-device conformance.
- The inventory is CSS-native. A future DTCG export needs a deliberately specified mapping for CSS expressions, themes, composites and runtime-only variables.

These are explicit limits of the evidence, not authorization to redesign unrelated product surfaces during ordinary maintenance.
