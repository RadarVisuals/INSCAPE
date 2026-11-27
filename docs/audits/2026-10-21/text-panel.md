# Independent Text tool window

Date: 2026-10-21. Local, uncommitted work on
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`.
The checkout already contained unrelated changes; this report describes this
Text-window step, not the entire working-tree diff or a deployed release.

## Accepted scope and implementation

The founder chose to keep Text outside the Layers/Transform/Color/Image/Shape/FX
dock, with the same visual treatment as Layers. Workbench Text colour stays in
Color; position and frame dimensions stay in Transform. Font size, paragraphs,
columns, padding and existing article functions remain in Text.

`SharedTextToolsWindow` now uses the existing `WorkbenchToolPanel` shell:
flat Carbon/Mist material, a compact header naming the active article, rounded
fields, one scrolling body, a persistent save-status footer and eight invisible
resize edges. Keyboard movement/resizing and visible keyboard focus remain.
Its initial frame is at most 326 × 620 CSS pixels, bounded by the viewport and
live camera controls; normal resize minima are 300 × 240. A viewport smaller
than those minima still takes precedence. When the controls below it wrap,
Text shortens from its existing top before moving, keeping the article action
strip reachable during initial layout.

Frame state belongs to this editor session. Closing/reopening or switching
articles preserves it without writing article content or authored frame
geometry. The existing module-owned editor, selections, Undo, save callbacks,
backup and failed-save recovery remain authoritative. No new schema, persistence
path or editor instance was introduced. The existing portal/source relationship
remains; this is shell reuse, not a redesign of editor ownership.

The design-system workspace opens the same independent window instead of a
Text tab. Its former inline portal host and duplicate tool styling were removed.
Reference data remains disposable. Existing Display Text continues through the
shared Text window; this step does not migrate Display colour or add Text FX.

## Validation

- Full `npm test`: **1310 passed**.
- Production `npm run build -- --configLoader native` and `npm run build:check`:
  **passed**. The existing server at `127.0.0.1:24970` was reused.
- `npm run design-system:check`: **passed**, 74 files / 556 definitions / 291 names.
- Reference workspace coverage: **5 passed**, covering wide/narrow themes,
  Text examples, selection, editing, Undo, search, Focus writing, backup,
  read-only states and article independence.
- Reference interaction coverage: **5 passed**, including floating-tool scroll
  containment and retaining the selected Text target.
- App acceptance: **26 of 27 passed in the combined run**. The remaining
  Display companion test tried to open metadata without selecting an artwork.
  After correcting that test setup, its focused rerun **passed (1/1)**; no app
  code changed between those runs. Both logs are retained as
  `text-panel/acceptance-complete.log` and `text-panel/companion-final.log`.
  Together they cover all 27 cases across Text tools, article/recovery workflows,
  companion viewport fitting, shared Color/Transform and docking.

Browser checks use isolated fixture data, including failed-save simulation;
they do not edit the founder's current composition. The new panel checks compare
its computed material against the actual Layers window, exercise invisible
resize and Escape cancellation, retain editor identity and session geometry,
and verify that tool resizing does not change the saved draft. App screenshots
were inspected at 1440 and 390 pixels; viewport checks also cover 700 pixels.

Older tests were updated for the current contextual Display menu, the Text
window's new scroller, independent reference opening and current Display
companion content sizing and explicit artwork selection for metadata. Display
companion close actions in the narrow test
use the keyboard: their existing position can sit under the Workbench switcher.
That separate Display placement was not changed by this Text task.

## Build boundary and limits

The native build measured **822,889 raw / 239,434 gzip initial JavaScript bytes**
and **2,478,555 raw / 793,458 gzip core JavaScript bytes**. An earlier
alternate-output build in the production tests measured 794,172 gzip core
bytes, exceeding the previous 794,000 limit by 172. This step raises only that
gzip limit by **500 bytes, to 794,500**; raw, initial-load, owner and wallet
limits remain unchanged. The final full suite and production budget check pass.
This is a bounded bundle measurement, not a claim of general performance gains.

The CI workflow was inspected, but these uncommitted changes have only local
verification. Nothing was committed, pushed, uploaded or deployed.

## Evidence

- [App, Mist / wide](text-panel/text-mist-1440.png)
- [App, Carbon / narrow](text-panel/text-carbon-390.png)
- [App, expanded settings / wide](text-panel/text-mist-1440-settings.png)
- [App, expanded settings / narrow](text-panel/text-carbon-390-settings.png)
- [Design-system reference / wide](text-panel/reference-mist-1440.png)
- [Design-system reference / narrow](text-panel/reference-carbon-390.png)
- [Production bundle report](text-panel/bundle-report.json)

Full logs are retained beside these screenshots. Earlier exploratory failures
remain in the ignored local `.browser-test-runtime/text-panel` directory.
