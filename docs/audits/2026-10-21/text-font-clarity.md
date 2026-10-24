# Text font controls: scope and defaults

21 October 2026. Local, uncommitted work on
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The checkout has substantial other
changes. This report covers the founder's request to clarify the two font scopes.

## Result

Format text shows the actual font at the cursor or across the selection. The
Article font placeholder and redundant Character heading are removed. A mixed
selection says Mixed fonts. A small reset control removes only explicit font
formatting and names the applicable default in its accessible label/tooltip.
Heading defaults are included when deriving the displayed font.

Article settings initially shows a default-style summary, such as Sora · 16 px.
Change default style explicitly reveals Default font, Default size and Default
line spacing, with an explanation that individually formatted text retains its
choices. Heading/caption styles remain inside this area. The reference uses the
same production components; Focus writing, Color and Transform keep their scope.

## Ownership

Article fields and editor marks remain the only owners of font settings. The
displayed font is derived, not separately stored. Existing font commands perform
the edits/reset and retain other marks and Undo. Native disclosure state only
controls visibility. This simplifies presentation; it is not an editor, save,
publication or module-host architecture rewrite. No new dependencies or schema.

## Verification

- Eight Text hierarchy/article-tools/window browser cases passed together in
  `app.log`, including wide/narrow views, no writes from UI navigation, mixed
  fonts, heading defaults, reset, Undo/Redo and default changes preserving overrides.
- Five shared-tools/inspector cases passed across `selection.log` and
  `selection-rerun.log`. The latter corrected a test that waited for tools before
  focusing the embedded editor, matching the established authoring entry point.
- Two focused typography cases passed across `typography.log` and
  `typography-final.log`, including Read/Visitor/reload parity and retaining zero
  tracking on font reset. Intermediate failures came from tests still targeting
  the previous tab state and scroll-container class; the tests now use the current
  visible tab and Text body scroller. Initial outputs are retained.
- Three Text design-system cases passed in `reference.log`: selection/history,
  Focus writing/search, defaults, backup, read-only and article independence.
- 24 focused article/validation/spacing/shared-tools-state unit tests passed.
- Production build with native config loader, build check and regenerated
  design-system inventory check passed. Focused diff whitespace check passed.
- App and reference screenshots inspected at 1440px Mist and 390px Carbon,
  including formatting, collapsed defaults and expanded defaults. Reference
  visual capture also checked overflow and absence of local-storage writes.

These are 18 distinct relevant browser cases across the documented runs, plus
two reference visual captures. This is not a full release-suite or remote-CI
claim. Existing local server port 24970 was reused, with isolated test fixtures;
no user composition was edited by the verification. No upload, deployment,
commit or push was performed. CI configuration still runs the broader verify
workflow; older green CI cannot attest to this dirty local checkout.

Core JavaScript is 2,481,876 raw / 794,466 gzip bytes, up 1,327 / 511 from the
immediately preceding local build. Initial JavaScript remains 822,889 raw /
239,434 gzip bytes. Existing production budgets were retained and passed.

## Visual evidence

- [Formatting, Mist](text-font-clarity/format-mist-1440.png)
- [Article defaults collapsed, Mist](text-font-clarity/article-collapsed-mist-1440.png)
- [Article defaults expanded, Carbon](text-font-clarity/article-carbon-390.png)
- [Reference formatting, Carbon](text-font-clarity/reference-format-carbon-390.png)
- [Reference article settings, Mist](text-font-clarity/reference-article-mist-1440.png)
- [Reference defaults, Carbon](text-font-clarity/reference-defaults-carbon-390.png)

The adjacent directory retains logs, screenshots and the bundle report. The
reference capture script is retained as evidence; run its working copy from
`.browser-test-runtime/text-font-clarity/` so its relative imports resolve.
