# Phone text inset

The founder reported that a quote reached the bottom cell edge on mobile after desktop text positioning was corrected. Automatic responsive placement used the full cell height, leaving no minimum vertical breathing room.

Automatic unanchored phone Text now reserves 16 px at both ends. Cell minimum height includes 32 px around measured readable content, and the projected Text window is bounded by the available inner height. Source position still determines its relative place inside that space. Desktop geometry, authored phone placements and explicit anchors retain their existing paths; the latter keep their chosen padding. No document/state field was introduced or written.

The previous full-height positioning is replaced in the same projection. Minimum sizing and placement reuse the same inset, and fitted-text membership is computed once. The minimum-height loop no longer allocates a filtered member array; free-layer extent uses one map instead of a filter then map. These equivalent simplifications retain the existing production ceiling.

Domain tests cover 320/390/640 widths and 64/160/800 px measured heights, minimum margins, growth, source immutability, authored phone overrides, explicit anchor padding and desktop proportional placement. The existing browser resize regression now requires the phone bottom inset; standalone automated browser execution is not claimed.

Manual native fixture with a long inline-formatted quote: at 390 width the text measured 787 px inside an 819 px cell, leaving exactly 16 px above and below. Its short neighbour retained more than 30 px below. The founder's saved composition was not edited in this fixture check.

Local work only; no commit, push or deployment.

Validation: full test run passed 1,816 tests with only the unchanged production-budget check failing by 20 bytes. The equivalent projection simplifications above removed duplicate work; all focused layout tests passed again, final production build/budgets passed, and the production build test passed on rerun. Lint and strict Workbench contracts passed.
