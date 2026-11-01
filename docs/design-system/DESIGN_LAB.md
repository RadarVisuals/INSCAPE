# Component design lab

The local lab renders Inscape's actual React components and imports the existing
fonts, tokens and material recipes. It supplies disposable sample data instead
of opening your profile, wallet or publication workflow. The Reception Editor
artboard uses the real shared Editor with an isolated sample draft store. The accepted
product direction remains in `INSCAPE_ACTIVE_CONTRACT.md`.

From the application checkout:

```sh
npm run design:lab
```

Open [the lab](http://127.0.0.1:5179/design-lab.html). The dedicated loopback port
keeps its browser storage separate from the usual application server. Editor
sample drafts use the additional `inscape:design-lab:reception-editor:` storage
prefix. Reset clears only that sample. Dark/Light remains the existing interface
preference. The selected theme,
artboard and width are also recorded in the URL for repeatable comparisons.
Opening the ordinary sample canvas also uses the native Display shortcut
preference for fixture profile `0x1111111111111111111111111111111111111111` on
the lab origin. This preference is separate from Reception's sample document.

## Make a study

1. Choose Reception, reception editor, toolbar or workspace. Try both themes.
   **reception editor** mounts the same Editor as the app: draw a rectangle,
   turn it into a cell, and use the shared Library, Layers and Preview tools.
   **Reset** remounts the artboard with its original sample state.
2. Create an editable study from a built-in artboard:

   ```sh
   npm run design:new -- reception-study-2 --from reception
   ```

   This creates `design-system/lab/experiments/reception-study-2.jsx` and prints
   its URL. Existing files are never overwritten. The adapter is copied; its
   imports still point to the real components. The earlier frameless Bento
   experiment and its independent editing controls have been retired. Use the
   built-in reception editor artboard to experiment with Reception authoring.
   New files appear in the experiment menu after reload.
3. Ask Codex to change that experiment's sample data, props or composition.
   Save changes in the experiment file; interactive values disappear on reset
   or reload. Open the baseline and study in separate tabs to compare them.
4. Use **Inspect source**, then click a visible element (or Tab to it and press
   Enter). The context shows its component, source file and line, classes,
   bounds and computed styles. Copy that context with the requested change.
   Escape returns to normal interaction. Inspection suppresses pointer actions.
5. **Open canvas** gives the artboard its own URL without the lab header.

For example: “In reception-study-2, try a smaller header and give the artwork more
room. Keep the existing controls and typography. Show me the experiment.”

Component-internal structural changes still require editing or explicitly
forking that component. Editing `src/` or a shared CSS file affects the real app
and every artboard importing it. A study is a review surface, not a code branch
or an automatic promotion system. Keep proposed component forks within the
experiment, compare them, then move only an accepted change into its production
owner and remove the displaced implementation.

## Capture evidence

```sh
npm run design:capture -- "http://127.0.0.1:5179/design-lab.html?artboard=artboards/reception-editor&width=1440&theme=light&frame=1" reception-light
```

The command writes a PNG and `context.json` into a new timestamped folder under
`output/design-lab/`. JSON includes source hints/hashes, visible element bounds,
computed styles, form values, theme, viewport, URL and checkout information.
It opens a fresh reduced-motion sample: it does **not** capture unsaved
interactions in another tab. Ask Codex to capture the current browser tab when
that exact interactive state matters. JSON is observational evidence, not
replayable React state or executable captured HTML.

The project browser runner accepts `INSCAPE_BROWSER_EXECUTABLE` if its default
browser cannot launch. On this workstation the verified executable is
`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`.

## Boundaries and ownership

- Reception uses the full `ReceptionOverview`, including its real frame,
  `ReceptionHeader`, `ReceptionNavigation` and `ReceptionCanvas`. Its disposable
  model reproduces the artwork, logo, single cell and crop observed in the
  founder's open Reception on 30 October 2026. It is a visual snapshot, not a
  live connection to saved drafts. Explore/About work locally; buttons for
  destinations outside Reception report their action without opening the editor,
  Editor or wallet. The presentation and shared Editor artboards use seed data in
  `design-system/lab/receptionExample.js`; make study-specific changes in its adapter.
- The reception editor artboard mounts `OwnerSystemWorkflowRuntime` and
  `OwnerWorkbenchSession`, with Reception selected as the document. It is a
  test adapter, not a separate editor implementation. Its iframe supplies the
  ordinary Editor's full viewport and preserves the same pointer/camera rules.
- Toolbar uses `WorkbenchToolbar`; tool selection and action feedback are local.
- Workspace reuses the established design-system adapter, including its sample
  Library and Text tools. Its retained Display preview is explicitly experimental;
  this does not reactivate Display or reproduce the production Workbench store.
- `scripts/designMetadata.js` adds file/line, nearest named component and host-tag
  attributes only during `serve` in `design-lab` mode. Anonymous owners are
  reported as unknown; dependencies, portals without tagged host elements, canvas
  pixels and embedded documents may need inspection at their surrounding component.
- The lab entry, experiments and metadata are excluded from the application build.
  The existing hosted design-system export remains separate. No new dependency,
  MCP server, agent annotation service or video-export system is installed.

## Verify

With `npm run design:lab` running, `npm run test:design-lab` checks source hints, safe experiment creation, real
browser interactions, reset, storage isolation, inspection, themes and narrow
hosting. It owns and closes its own browser with isolated storage; it leaves the
development server running. Screenshots go to
`output/design-lab/verification/`.

When changing shared components, also run their existing focused suites. When
changing lab CSS, regenerate and review `npm run design-system:tokens`; its
inventory includes reference CSS. For build-boundary changes run `npm run build`
and `npm run build:check`. A production release still requires the repository's
complete release checks; a lab screenshot is not release acceptance.

This adapts [Luka's workflow](https://x.com/lukaivanovic/status/2079178687409279303)
using live components and existing fixtures. Metadata uses the existing
[@vitejs/plugin-react Babel hook](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#babel)
with a [Vite command/mode gate](https://vite.dev/guide/api-plugin.html).
