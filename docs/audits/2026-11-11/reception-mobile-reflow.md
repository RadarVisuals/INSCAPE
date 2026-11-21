# Reception mobile reflow follow-up

The reported phone screenshot showed a bottom-positioned text layer reserving nearly an entire screen of empty space. The unanchored-text minimum-height calculation divided the measured article height by its desktop top-position remainder. A layer near the desktop bottom therefore multiplied the phone cell height.

The responsive projection now sizes a cell to its measured text plus a small margin, and maps the layer's vertical placement into the remaining space after its readable height is known. This also keeps a bottom-positioned layer inside its owner. Authored phone placements and anchors retain their separate paths. Desktop source records are unchanged.

Article measurements now use computed border-box height and zoom rather than viewport rectangles. Fractional paint positions cannot change the measured intrinsic height. Automatic bottom-padding compensation is retained. Preview scrollbars reserve their width.

Manual test: native editor fixture with automatic article padding and 1.25 text zoom; repeated widths 320/390/640/641/768/1080; actual browser viewport 390x844. At 390 preview width the three-cell composition settled at 744 px instead of 1446.86 px, with all text inside its cells. A second independent observation after resizing returned 744 px. No maximum-update-depth errors were recorded after a clean reload. This is the fixture, not a verification of the user's saved Reception.

Added domain regressions for compact bottom-positioned text, long text, no document mutation, and position-independent intrinsic measurements. Extended the automated browser regression to compare 30 frame samples and enforce text/cell bounds; that browser suite could not be launched in this environment in the earlier attempt, so no automated-browser pass is claimed.

Validation: full regression run 1,809 passed / 1 failed only because the CSS inventory hash was stale. Regenerated inventory diff contains only receptionPreview.css hash; all four inventory tests then passed. Final production build and unchanged package budgets passed (726,468 initial JavaScript bytes); lint and strict Workbench contracts passed.
