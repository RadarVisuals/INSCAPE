# Native Image crop zoom out

The founder accepted removing the crop-entry enlargement and allowing zoom below fill.

Native Image now requests a fitted starting crop and the existing 0.1 renderer minimum from shared crop-session/zoom functions. Shared defaults and Display placement validators retain their previous 1.0 fill minimum. Native Image validation and its save path now consistently use the renderer minimum, including standalone Workbench Images. No document shape or upload operation changed.

The source crop continues to paint until the first actual adjustment. This preserves the initial image exactly, even for extreme source ratios whose mathematical Fit zoom lies below the supported 10% floor. The first zoom/pan adjustment uses the supported range; underfilled axes remain centred under the existing focus bounds. Done without adjustments closes without saving. Pointer cancellation restores both the prior crop and its dirty state. Miniature and artwork share one displayed-crop value, and completed/cancelled closure share one cleanup path. Fill no longer reports active for zoomed-out crops.

Removed duplicate exact-field validators from native Image/shared crop validation in favour of the existing validator, and removed the old standalone-only save override at zoom 1. No production budget increase or chunk reclassification was made.

Checks: Image/Display authoring/Reception regressions passed, including rotated/mirrored Fit projection, zoom clamp, save, Undo/Redo, reload, public-document validation and crop reopen. Full suite: 1,814 passed; the sole failed production-build test exceeded the unchanged aggregate ceiling by 9 bytes. Reusing the existing crop cleanup removed the duplication; focused affected tests then passed, and the production-build test passed on rerun. Final production build, budget check (726,468 initial JS bytes), lint and strict Workbench contracts passed.

Manual native Reception fixture: rendered image rectangle before/after entering Crop was exactly x=0,y=84,width=684,height=684. Saved zoom .25, reopened at 25%, cancelled an attempted 400%, Undo restored Fit, Redo restored .25, reopened at 25%. Added automated native browser regression for no jump, no-op Done, save, cancel, Undo/Redo and reload; standalone browser test launch remains unverified in this environment. The user composition was not modified during fixture checks.

Changes are local, without commit, push, upload or deployment.
