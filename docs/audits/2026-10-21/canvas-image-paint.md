# Filled Workbench: ordinary Image decode stalls

Local implementation and measurement, 21 October 2026. No commit, push,
deployment, upload or wallet action. This continues the
[Nomad loading investigation](nomad-loading.md); both comparisons below use
that same improved Nomad export. This change does not modify either Nomad file,
Keeper, SVG artwork hosting, camera geometry or authored storage.

## Result and limits

Three fresh before runs and three fresh after runs of `nomad-4-60` show a
reduction in the median largest navigation frame interval from **136 to 64 ms
(53%)**. Each before run contained two main-document long tasks during navigation;
the after runs contained none. Ordinary frame timing is not uniformly faster:
the navigation p95 remains 24 ms and individual frames still reach 56–80 ms.

Opening the filled Workbench remains a separate problem. Its median largest
frame interval increased from 112 to 128 ms in this sample, with overlapping
ranges. Preparing disposable paint images adds work and memory. This is a
navigation latency improvement with a measured switching/memory tradeoff,
not a claim that all major stalls or total rendering costs are solved.

| Metric | Before: three runs | After: three runs |
| --- | ---: | ---: |
| Largest navigation frame, each run | 104.2 / 136.0 / 160.1 ms | 64.0 / 80.0 / 56.1 ms |
| Median largest navigation frame | 136.0 ms | 64.0 ms |
| Navigation p95, median | 24.0 ms | 24.0 ms |
| Main-document navigation long tasks | 2 / 2 / 2 | 0 / 0 / 0 |
| Navigation main-thread TaskDuration, median | 2003.8 ms | 1958.9 ms |
| Navigation style + layout, median | 1113.0 ms | 1163.1 ms |
| Largest switch-to-filled frame, each run | 119.9 / 72.1 / 111.9 ms | 128.1 / 96.0 / 142.7 ms |
| Switch-to-filled TaskDuration, median | 408.4 ms | 499.2 ms |
| Quiet Workbench idle p95 | 8.1 ms | 8.1 ms |
| Summed browser-process private memory, median | 2070.6 MiB | 2123.0 MiB |
| Summed renderer private memory, median | 543.3 MiB | 543.7 MiB |
| Summed renderer working set, median | 1655.6 MiB | 1697.6 MiB |

TaskDuration includes time occupying the main thread, including waits; it is
not CPU execution time. Memory is one Windows process snapshot at the overview,
not a peak, leak study or VRAM measurement. The private-memory increase is about
52.4 MiB (2.5%). Independent long tasks still occur inside artwork documents.

## What the trace found

An expanded browser trace distinguished CPU work from waiting. Two main-thread
`LayerTreeHost::WaitForCommitCompletion` events lasted 102.477 and 99.812 ms;
their thread CPU times were only 0.015 and 11.360 ms. Concurrent raster workers
decoded ordinary WebP images for the main renderer, with individual decode
tasks around 25–64 ms. A separate approximately 82 ms main task involved React,
style/layout and GC. These are different costs from Nomad's texture uploads.

The compact [trace excerpt](canvas-image-paint/compositor-waits.json) retains
timestamps, process/thread attribution and overlapping events. Nested events
overlap; their durations must not be added together as independent CPU costs.
The 193 MB raw trace remains in ignored local test evidence. Trace-instrumented
timings are diagnostic and are excluded from the performance comparison above.

Adding `decoding="async"` to the existing SVG image did not remove the stalls.
Changing the image element's rendering route did not establish a reliable gain.
Preparing resized PNGs on the UI thread improved navigation but made switching
substantially worse, so those runtime experiments were removed. The shared
Keeper/SVG raster preparer is byte-for-byte unchanged from this turn's start.

The decoding attribute is a browser preference, not a guarantee that raster
cache work cannot delay a commit; asynchronous presentation can also omit pixels
until decoding finishes. See the [HTML decoding model](https://html.spec.whatwg.org/multipage/images.html#decoding-images)
and Chromium's [SVG image painter](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/paint/svg_image_painter.cc).

## Implemented boundary

`ImageArtwork` retains its SVG viewport, crop, transform, readiness and side-flip
behavior. A new Image-specific hook owns only the displayed paint URL. The
original media URL remains in the saved record and is used for Inspect and
enlargement. Source files and exports are never rewritten.

Mounted Image sides share one bundled worker. A replaceable queue runs one
decode/resize job at a time; each result belongs to its requesting side and
generation. Closing or changing a side cancels its work and releases its URLs.
Closing the last side terminates the worker, including when switching away
from the Workbench. No image cache persists across those lifetimes.

The worker reads and verifies the actual WebP bytes, decodes and downsamples
them off the UI thread, then returns a temporary PNG. The PNG is decoded before
the visible SVG image changes its URL. Two physical pixels per displayed pixel
and 128-pixel size buckets avoid repeated resampling for minor camera changes.
Sufficient larger versions are reused while zooming out. Enlargement restores
the original while a sharper eligible version is prepared.

Preparation is optional and bounded: explicit `.webp` URLs, at most 8 MiB input,
16,777,216 source pixels, 4,000,000 output pixels and an abortable five-second
job deadline. Animated WebP, ICC profiles, EXIF orientation, unknown/truncated
headers, unavailable CORS, unsupported worker APIs and other formats retain
native rendering. The relevant flags and dimensions follow the
[WebP container specification](https://developers.google.com/speed/webp/docs/riff_container).
The same verified bytes are used for conversion, rather than trusting a
separate header request for potentially different content.

This adds an optional read of eligible media. Real WAN latency, cache reuse,
large collections and mobile performance are not established by this local
benchmark. Extensionless IPFS media is deliberately outside this optimization.
Production `connect-src` is unchanged, so sources outside the existing allowed
origins fall back to native rendering. The only CSP change is `worker-src 'self'`
for the bundled worker; remote and blob worker scripts remain excluded.

Workbench still owns navigation and persistence; Image owns its transient
paint preparation. There is no new persistent media record, new global canvas
renderer or claimed general architectural cleanup. The remaining main-thread
style/layout and Workbench remount costs are separate next investigation targets.

## Verification and reproducibility

- Chrome 155.0.8059.85, Windows, i5-12600KF, 31.8 GiB RAM; 1440×1000, DPR 1.
- Same filled fixture: 16 Images including four active 39-layer Nomads at the
  fixture's 60 Hz setting, 12 Text modules with 144 paragraphs, 24 shapes, two
  HTML modules, Keeper and eight saved Workbenches. One Workbench is active.
- Identical measured zoom/Hand/typing/switch/reload/store operations. Before
  builds substitute the saved pre-change `ImageArtwork.jsx`; working files are
  never reset. The after harness also checks worker lifecycle outside measured
  phases. Every after run observed **one active worker, zero on the quiet
  Workbench, zero after unmount**. Browser errors and failed local requests: zero.
- The existing benchmark assertions passed for independent saved Workbenches,
  reload, unchanged authored camera state, HTML placement, Nomad clocks/layers,
  store commits and release of executable artwork.
- New pixel/lifecycle tests: **2 passed** at 1440/DPR 1 and 390/DPR 2. They compare
  actual prepared pixels against native rendering, cover transparency, crop,
  both mirrors and rotation, reuse, enlargement, source replacement, shared
  worker ownership and teardown. Maximum mean channel difference in the six
  comparisons was below 0.1 on the 0–255 scale. Animated WebP visibly continued
  animating. CORS, truncated headers, profile/orientation metadata and excessive
  source dimensions retained the native image. Blob workers remained blocked.
- Existing Image click/Inspect, flip/loading/retry, SVG/Keeper raster quality,
  Focus/Return, camera crop and owner/Visitor behavior: **15 checks covered**.
  The first combined run passed 14; one Focus polling helper encountered a
  missing DOM node. Its isolated rerun passed without relaxing its assertions.
- Built worker under actual production response headers: **1 passed**, including
  a real bundled worker, decoded PNG output and native-size/forbidden-source
  fallback. Production security policy unit checks: **7 passed**.
- `npm run build -- --configLoader native` and `npm run build:check` passed.
  Initial-entry budget remains **822,007 JS bytes**; worker bundle is about 2 KB.
  The existing large optional-wallet chunk warning remains.

The final six raw result sets and discarded probes are under
`.browser-test-runtime/workbench-camera-investigation/`. Durable evidence:
[comparison](canvas-image-paint/comparison.json),
[pixel measurements](canvas-image-paint/pixel-evidence.json),
[quality tests](canvas-image-paint/quality.log),
[regressions](canvas-image-paint/regression.log),
[Focus rerun](canvas-image-paint/focus-recheck.log),
[built worker](canvas-image-paint/production-worker.log),
[security checks](canvas-image-paint/security-tests.log),
[build](canvas-image-paint/build.log),
[budget check](canvas-image-paint/build-check.log).

## Preservation and repository state

Branch remains `codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The existing
[successful CI run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131)
covers that committed HEAD only, not these local changes.

Of 411 pre-existing changed/untracked paths recorded before this turn, 409
are byte-identical and two are intentionally extended measurement scripts.
Previously clean edited sources were copied before editing. Existing artwork,
Keeper trial, old reports and screenshots remain preserved; the original and
incremental Nomad SHA-256 hashes remain respectively
`5151866ee081a24c36e82f8a34547569fb3e6c0fb13651e2a32e2d088366b083` and
`e487c06349930b366c38e2da5df98e3be45c7a636275bd76acb48d0d1e2fd4dc`.
The protected handoff was not read or used. Everything remains local.
