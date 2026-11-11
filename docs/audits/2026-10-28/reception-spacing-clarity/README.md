# Spacing controls clarification

The founder reported that Grid default and Edge to edge appeared identical and
the promised 24px was not visible. Inspection of the active review tab showed
Default content spacing at zero. The slider did not show its numeric value, and
Cell appearance offered no 24px choice; new Text with explicit 24px padding could
therefore have no visibly selected preset. Existing authored zero-padding cells
were not rewritten by the earlier new-Text initialization fix.

Grid settings now displays its live spacing value. Cell appearance displays its
effective value, the inherited value inside Grid default, explicit zero in Edge
to edge, and a Normal (24 px) option. Existing authored data and inheritance
semantics are unchanged. No new state or persistence path was introduced.

Two real browser cases (1920 and 390px) pass: new Text on a zero-spacing grid
starts at 24px with Normal selected; Grid default 0 and Edge to edge 0 both render zero;
changing the grid to 8px keeps explicit 24px unchanged, selecting Grid default renders 8px,
and Edge to edge returns zero. Custom 32px, wrapping, preview and reload still pass.
See `text-browser.log` and the `new-text-spacing-*.png` captures.
The existing desktop/mobile settings suite also passes both cases
(`settings-browser.log`), for four passing browser cases in this follow-up.

Production build and existing budgets passed (`build.log`, `build-check.log`).
Initial JS 830710 bytes; core 2675739 raw / 876314 gzip. No budgets were increased.
The broader 53-browser / 1493-unit run belongs to the immediately preceding fix;
it was not rerun for this small follow-up. Source changes are local and uncommitted.

The current review tab contained two image cells and was actively being edited
by the founder during inspection (grid value subsequently changed). No authored
content or spacing was changed through that tab by the agent, and the earlier
report about a particular existing text cell was not independently reproduced.
This is a control-clarity correction, not a claim of migrating existing zero
spacing or diagnosing an unseen existing cell.
