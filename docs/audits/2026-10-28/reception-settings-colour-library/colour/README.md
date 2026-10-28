# Shared colour sampling

Local implementation and targeted verification, 28 October 2026. No commit,
push or deployment performed by this task.

ReceptionColourPanel is content only: its parent owns the movable window,
selected cell/grid, undo, persistence and temporary preview. It reuses
CommittedColourControls for the existing colour wheel and hex input, and adds
only an optional background reset. TextColourTools accepts the same opt-in
eyedropper with scope extended by the text target and selection. Existing
Workbench callers retain their default controls.

The shared ColourEyedropper uses the browser EyeDropper API on an explicit click.
It captures target, generation and save callback, aborts obsolete requests, and
ignores late results after target/version/disabled/unmount changes. Cancellation
does not save. A successful sample is one edit. Focus returns after the button
is enabled again. Browsers without EyeDropper show a native Choose color input
alongside the wheel and hex field; its input previews do not commit, while its
native change event commits once.

API behavior was checked against the [EyeDropper specification](https://wicg.github.io/eyedropper-api/)
and [MDN open documentation](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper/open).
The API requires a secure context and transient user activation and accepts an
AbortSignal. Availability is feature detected at runtime.

## Verification

- `node --import ./scripts/browserEnvironment.mjs --test browser-tests/colour-eyedropper.browser.mjs`
  with `INSCAPE_TEST_ROOT=http://127.0.0.1:5197`: **3 passed**, zero page errors.
  Evidence: [browser.log](browser.log).
- `npx eslint src/colour/ColourEyedropper.jsx src/colour/CommittedColourControls.jsx src/text/TextColourTools.jsx src/reception/ReceptionColourPanel.jsx`:
  passed, no diagnostics. Evidence: [lint.log](lint.log).
- The isolated suite is registered as `colour-eyedropper` in the release browser
  catalog. Its stub deliberately permits results after AbortSignal cancellation
  to exercise stale-result rejection.

The first run found that cancelling attempted to focus the still-disabled
button. Focus now runs after React re-enables the button; the final run covers
success, cancellation, failure and retry.

The native OS screen-sampling interface itself was not exercised by headless
tests. Native EyeDropper promises are stubbed; the fallback input is tested via
its native input/change events. Parent integration owns final Reception visual
checks, persistent-window behavior, full tests and build budgets.

## Compact pipette correction

The founder requested a single small icon beside the wheel, with no visible
button text or full-width row. ColourControls now exposes an accessory slot in
a separate grid column beside its wheel. The pipette retains its accessible
name and tooltip; unsupported browsers place the native colour input in the
same compact icon target. Sampling behavior is unchanged. Error feedback spans
the row below the wheel instead of squeezing into the icon column.

The updated isolated suite passes **4/4**, including compact geometry at 1920px
and 390px for both supported and unsupported API states. See
[compact-browser.log](compact-browser.log), [desktop](compact-eyedropper-1920.png),
[narrow](compact-eyedropper-390.png) and [narrow fallback](compact-fallback-390.png).
These isolated screenshots were visually inspected for icon placement and
overflow. Targeted eslint including ColourControls passes with no diagnostics:
[compact-lint.log](compact-lint.log). Parent integration verifies the actual
Reception window separately.
