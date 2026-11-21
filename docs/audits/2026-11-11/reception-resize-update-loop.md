# Reception preview resize update loop — 2026-11-11

Local fix; not committed, pushed or deployed.

The owner report identified REACT_UPDATE_LOOP / Maximum update depth exceeded at ReceptionDocumentCanvas. The canvas measurement layout effect depended on its derived layout, measured immediately, and updated textMetrics, which produced another layout and restarted that same effect. TextViewport also adjusts automatic end padding based on assigned frame height; that fitting space must not become new intrinsic content height.

Replaced that effect with a document/viewport-scoped observer. Derived layout is no longer its dependency. Font and ResizeObserver notifications coalesce into one animation frame; accepted height maps are deduplicated; changing width/document or unmounting cancels pending frames and obsolete callbacks. Natural text height restores authored/automatic end padding independently of temporary fitting padding, accounts for zoom and ignores subpixel paint noise. Native articles, frames, storage, member constraints and Undo are untouched by this read-only measurement.

Removed the old inline measurement implementation. Also removed the previously ignored support message prop and its unused source fields, and unnecessary tiny-report memo caches, rather than increasing the existing bundle ceiling. Production support continues to use the existing bounded evidence; development error details remain development-only.

Validation: 1,808 source-suite tests passed with zero failures. Three new regression tests exercise 80 padding-feedback cycles, coalescing, cancellation on session replacement, late fonts, real content growth, zoom, compact text and authored padding. Production build/build:check, lint and strict Workbench contracts passed with unchanged budgets. Connected-browser checks over the native editor fixture used long, zoomed article text with automatic padding: repeated 1080/768/641/640/390/320-width transitions and six rapid End/Home slider cycles survived without a maximum-update error. At 390px, canvas height settled at 7,302px and text frame/content heights agreed (2,172px and 192px). These oversized heights belong to the deliberately long, bottom-positioned test article. A native browser regression was added to the existing reception-tiling suite; automated Chromium launch remains unavailable in this environment, so the interactive path was verified through the connected browser instead.

The owner must reload the previously failed page to clear its captured error boundary before verifying their own composition.
