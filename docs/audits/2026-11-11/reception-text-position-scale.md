# Reception text-position scaling

The founder supplied full-size and reduced desktop screenshots: the quote moved upward toward the title as the card shrank.

The shared responsive projection retained the original unscaled Text window height as a minimum. Its existing relative placement then subtracted that oversized window from the smaller cell, lifting the text. Replace that height floor with the authored height scaled by the cell width ratio; measured readable text still supplies the required minimum. This applies to ordinary and fitted free text. Explicit anchors and phone placements retain their current paths. No authoring geometry, stored article, crop, Undo, or source records were changed. The previous unscaled-height floor was removed rather than compensated by an offset or a second position state.

Focused tests cover exact desktop frame/top/bottom-gap scaling at 1440/1080/720/672, ordinary and fitted text, readable-height overflow, no source writes, existing phone reflow and explicit overrides. Extended the native browser regression to sample 1440/1080/768/672 and return to the original width; standalone automated browser launch remains unverified in this environment.

Manual browser fixture used a 28 px quote with a 200 px authored window and 30 px bottom frame gap. Text heights were 200 at 1440, 150 at 1080, approximately 106.55 at 768 and 93.45 at 672. Top positions followed the proportional projection and returned exactly at 1440. The 672 preview was visually checked. This was representative fixture content, not the founder's saved Reception.

Production build, unchanged bundle ceilings, lint and strict Workbench contracts passed. Changes remain local, without commit, push or deployment.
