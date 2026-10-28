# Text entry geometry follow-up

The empty Reception article inherited a shrink-to-fit wrapper: a fresh title placeholder reduced the title and body to about 62px wide. The shared ArticleEditor correctly delegated padding to its containing cell; this was a Reception width issue rather than a second Text model.

- ReceptionCanvas marks local Text cells, and reception.css gives their reader/editor the entire available content width. Shared typography, formatting, persistence and focus-writing remain unchanged.
- New Text receives 24px inset when its effective starting cell/grid spacing is zero (including an empty cell inherited from image spacing). A nonzero authored inset is preserved; Cell appearance can still change spacing, including Edge to edge, afterwards. Existing Text records are not migrated.
- The narrow-cell toolbar now uses one horizontally scrollable row. Its previous wrapped rows covered the New Text button in a half-width mobile cell.

Verification: two real browser scenarios at1920x1080 and390x844 pass, using actual pointer New Text. They check initial inset and full-width title/body, long title and unbroken-word wrapping, custom32px padding, reader/editor title wrapping, saved reload, and no browser errors. See browser.log and the four PNG captures. The focused existing Library replacement test also passes with the new Text inset expectation. Full integration/build checks belong to the parent agent.

Final full Reception editor browser suite: 24 passed, zero failed/skipped (editor-browser-full.log). The screenshots were refreshed during that run.
