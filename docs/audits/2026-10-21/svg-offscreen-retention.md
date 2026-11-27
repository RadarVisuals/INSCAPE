# Bounded SVG retention during navigation

Local, uncommitted follow-up authorized by the founder on 21 October 2026.
Checkout: `codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The working tree already contains
many unrelated changes, including the UI migration and Keeper trial. Those are
retained; HEAD or earlier CI is not evidence for this working tree.

## Change and ownership

Previously `ProjectedSvgArtwork` removed its document as soon as its viewport
stopped intersecting, unless inspection or Display preparation held it open.
The new hook retains an already requested document for 30 seconds after it is
no longer requested. A page-local pool limits idle documents to four, evicting
the oldest first. Active and prepared documents do not occupy idle slots.
The pool owns only eviction callbacks and timers; the placement continues to
own the actual document. No source cache, composition state, wallet state,
saved schema or texture data is added to the shared pool.

Source replacement, placement removal and Workbench teardown end retention.
The current owner runtime keys its scene by the Workbench activation, so a
switch destroys the departing placement tree. Offscreen retained documents no
longer trigger density measurements. Returning requests density once again.

`ArtworkSvgDocument` forwards the existing `inscape:html-artwork-visibility`
boolean through the opaque host. The host keeps the latest value while its
inner SVG loads, then delivers it on load. Parent/source checks remain enforced;
the sandbox, CSP and allowed network origins are unchanged. The studied 39-layer
and compact Nomads already understand this signal. Their animation stays owned
by the artwork; no shader or animation engine was copied into Inscape.

This is a bounded document-count policy, **not a byte or VRAM budget**. Arbitrary
third-party SVG code that ignores the signal is not guaranteed to pause and can
continue until eviction. HTML artwork keeps its existing offscreen disposal
policy. Neither inactive Workbenches nor the Keeper runtime are retained here.

## Verification

- 15 focused Node tests passed: retention expiry/cancellation/capacity and stale
  timers, host visibility delivery across loading, rejection of other senders
  and non-booleans, preserved density/inspection messages, existing production
  security policy tests.
- Final `npm run build` and `npm run build:check` passed. Existing bundle-size
  and dependency annotation warnings remain. Initial entry: 822,889 JS bytes.
- Browser lifecycle check, actual React/ProjectedSvgArtwork/opaque host route:
  four idle frames retained, same four frames on return, zero after expiry,
  new frames on subsequent return, source replacement while hidden disposes
  immediately, changing back to the old source while still hidden does not
  reload it, zero immediately on owner unmount. Passed.
  **Artwork readiness was zero in this run.** These assertions establish DOM
  lifecycle only; they do not establish successful artwork rendering.
- Separate artwork-side browser check passed for both the compact two-layer
  Nomad and the 39-layer Nomad: four real, sandboxed SVG documents per source,
  three offscreen/resume cycles each. All four stopped issuing `drawElements`
  between separated hidden samples and resumed drawing with no additional
  `texImage2D` uploads. Initial upload counts were two and 39 per document,
  respectively. Instrumentation was added only to generated test copies.
  This direct-file test intentionally bypasses the failing blob document host,
  so it proves the artwork protocol, not full Inscape navigation performance.
  The first draft used a one-second observation window, which did not reliably
  collect both background-timer samples. Final tests wait 3.2 seconds per phase
  and require at least 300 ms between the hidden samples; insufficient samples
  fail rather than being counted as a pause.
- The original and final production-host probes could not load the inner blob
  SVG document in the available browser session; they reached the existing
  15-second failure state. The frame was present with a `blob:null/...` source,
  but its document stayed blank. Therefore the full four-Nomad pan/zoom
  comparison has no accepted performance result. Do not quote its frame times
  or treat this work as a measured reduction of the earlier 269 ms outlier.
- `browser-tests/svg-lifecycle.browser.mjs` now expects retained documents on
  quick return while still checking zero offscreen density reads and disposal
  on unmount. The Playwright CLI suite was not run in this session; browser
  interaction used the available browser tool.

The in-browser check and its screenshot are under
`output/nomad-retention/lifecycle.json` and `lifecycle.png`; the final build log
is `production-build.log` in that directory. `compact-pause.json` and
`original-pause.json` contain the separate protocol results and raw hidden
samples, with matching screenshots. `svg-retention-fixture.html` runs
the real host comparison and a separate lifecycle-only check.

## Reproduce the local fixture

From the application checkout, copy the study sources to
`output/nomad-retention/compact.svg` and `original.svg`, respectively:

- `../../nomad-two-layer-study-2026-10-21/compact-v4/NOMAD-two-layer-compact.svg`
- `../../asset-inspection-2026-10-21-token-4/NOMAD-original.svg`

Run `node browser-tests/serve-svg-retention.mjs`. It builds an isolated test
bundle without HMR and prints its ephemeral loopback URL. The fixture requires
four actual first-draw reports before starting its animation comparison. Do
not accept a failed or blank load as an animation benchmark.
`/direct.html` tests the compact SVG directly; `?asset=original` tests the
39-layer SVG. Both wait for all four first-draw reports before enabling the test.

Original hashes remain unchanged:

- compact: `0e3535d31ddfbb65668484778a253c6e1bfa774f86b2dc5d032c33bf4adc35eb`
- original: `5151866ee081a24c36e82f8a34547569fb3e6c0fb13651e2a32e2d088366b083`

No commit, push, upload, deployment or wallet action was performed. Existing
servers were not stopped; the isolated test server belongs only to this study.
