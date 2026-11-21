# Bento Text: fade follows the authored top inset

Local changes only; not committed, pushed or deployed. Existing authored compositions were not edited for verification.

## Behavior and ownership

`src/text/useTextExcerpt.js` remains the shared owner of native Bento reading and public/Preview text clipping. For ordinary overflowing text, the visible bottom now mirrors the actual text-frame top inset from its clipping cell. A shorter authored text frame still wins. The margin follows geometry, including free positioning, rather than the selected alignment control.

Only genuinely overflowing text gains the margin and fade. Fitting text stays fully visible. Short cells limit the margin to retain the first two complete lines where possible. Complete-line clipping can add up to a line of blank space beyond the mirrored margin. The fade covers 1.75 rendered line heights, capped at half the visible excerpt. Rendered line height includes inline typography and article scale; camera zoom remains outside that calculation.

The previous 16-pixel vertical fade is replaced in the existing hook. Single-line and stacked text retain their horizontal fading; cell clipping disabled retains the independent text-frame boundary. No saved field, migration, second measurement hook or dependency was added. The full reader and its dots keep their existing owner. Rotated/mirrored and linked-frame rendering remain outside this excerpt path.

## Verification

- Ten focused geometry/text-default unit tests passed. No full suite was run.
- The actual shared native and Reception components were rendered in the in-app browser. DOM measurements and screenshots verified four top positions at 1440 and 900 viewport widths, plus a smaller authored frame, scaled typography, fitting text, short cells, negative top offset and disabled cell clipping.
- Native TextViewport matched the public excerpt at the same geometry. Camera-scale checks at 100%, 60% and 35% retained the same local fade length and proportional bottom margin.
- The three-dot reader opened the complete article, closed, and returned focus to its trigger.
- Production build and bundle checks passed. The build used `npm run build -- --configLoader native` because the default config bundler hit an environment access error. Initial JS: 727217 bytes.
- Targeted JavaScript lint and syntax checks passed; the repository ESLint configuration excludes the JSX browser fixture. The updated fixture rendered successfully in the browser. Whitespace checks passed.
- The Node/Playwright browser test launch failed before running assertions (`spawn UNKNOWN`). Updated `reception-inspect`, `reception-text-resize`, and `reception-text-cell-height` suites are therefore not reported as passing. Their interactive resize/Undo/reload checks were not rerun this turn. Browser measurements above are separate evidence.
- The development app responded with HTTP 200 on port 5173 at completion.

Evidence is in `.browser-test-runtime/fade-margin/`: `browser-measurements.json`, `balanced-1440.png`, and `balanced-900.png`. The review fixture adds native/public and margin scenarios without touching user data. Failed temporary test servers exited; the existing development server was retained.
