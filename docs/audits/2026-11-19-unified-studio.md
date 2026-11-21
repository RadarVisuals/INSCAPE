# Unified Studio and public navigation

## Recovery

The local Git tag `rollback/pre-studio-2026-11-19-143427` points to the application source, configuration, tests and design assets as they stood before the Studio changes, including existing working-copy changes. Its commit is `38f4d7e8f1`. To inspect or run that version alongside the current checkout, run the following from the application checkout.

```powershell
git worktree add --detach ../inscape-before-studio rollback/pre-studio-2026-11-19-143427
```

The original local preview is also available at `../rollback/pre-studio-38f4d7e8f1/served-dist.zip`. Its 696 files were compared with the original served files by SHA-256. To view that preview, extract the archive into a separate directory and serve its index.html with a local static server. Browser drafts and wallet data belong to their respective browser and account.

## Changes

- The shared header owns the wordmark, theme action, workspace list and menu placement. Public pages supply the viewed maker, tabs, account actions and owner-only Studio entry. Studio supplies the document context, return destination and editor actions.
- One Studio session owns creation, local save, history and document switching. Canvas and Bento choose the initial layout. Free text, images and shapes can share the same document with cells. Both public renderers use the saved layer and cell relationships.
- Full Canvas modules such as Display, mini-apps and workspace groups use the existing module model. Studio allows switching between that model and Bento cells when the layout can be represented losslessly. Existing module works remain editable. Published Profile Bento documents also retain their editing path.
- Publish records Gallery and Profile placement on the same work. At phone widths the tab strip scrolls horizontally and brings the active tab into view. The public views read verified published data. Studio's Manage compositions view reads the owner's local drafts.

## Verification

Chromium checks covered a mixed composition after save, reload and publication, public rendering and privacy, owner-only edit entry, origin-aware return navigation, local save failures and keyboard use. Publication tests used a simulated service. Screenshots and geometry checks at desktop and compact widths found the wordmark at x 16 and y 11 in both headers.

The production build, bundle budget, lint, type contracts, design-system inventory and five LUKSO checks passed. The full unit suite passed 1,994 of 2,010 tests. The same 16 Windows process-inspection and esbuild directory-access failures were reproduced against the rollback source. Local browser checks ran directly against Chrome. No network publication or deployment was performed.

The local branch `studio/unified-2026-11-19` captures the completed source for review against the rollback tag. The original checkout and its staged changes were kept in place.

Relative to the rollback, production code changed by +1,382/−876 lines, tests and their catalog by +1,055/−357, documentation by +44/−0 and the generated token inventory by +209/−153. The added production code covers shared headers, document transitions, publication destinations and public readback. The initial JavaScript bundle measured 689,877 bytes under the same release settings as the 728,687-byte baseline.

## Removing published Gallery works

The local branch `studio/gallery-removal-2026-11-19` adds an owner-only action in the list and grid. Studio and Gallery use the same publication delivery and wallet verification. Gallery prepares from the verified public document and checks it again before submission. Removing the only Gallery placement drops that work from the current publication. A separate Profile placement keeps the work there. A surviving public link must be resolved before its target can be removed entirely. The local draft store is outside this operation.

Desktop and touch Chromium tests exercised cancellation, focus return, simulated publication, reload of an empty Gallery and retention of a Profile placement and local draft. A changed publication stopped the wallet write. Build, lint, type checks and design inventory passed. The full suite passed 1,998 of 2,014 tests with the same 16 environment failures as the original baseline. Relative to `c8b11ae` the follow-up changed production code by +301/−135 lines, tests by +238/−13, documentation by +9/−1 and the generated inventory by +1/−1.

## Batch removal and the local upload route

The original local preview returned HTTP 404 for the upload challenge. On loopback the built client now uses the configured HTTPS publication service. The Vite preview allows its exact origin. A real browser received a valid origin-bound challenge from the deployed service. Unsigned, deliberately noncanonical synthetic documents established that the service recognizes the legacy canvas format and rejects the new empty Gallery schema. The challenge now advertises `v9-gallery-placements` in the updated function. The client checks this before asking for a signature when a snapshot requires it. Hosted production continues to use its own function.

The owner can select across list pages and the grid and submit all eligible works as one revision. A simulated batch used one upload authorization, one upload and one transaction. Receipt read-back updates the Gallery and supersedes stale reads. The full unit suite passed 2,005 of 2,021 checks with the same 16 Windows environment failures. Relative to `814b2c9` production changed by +304/−106 lines, tests by +352/−27, documentation by +13/−5 and generated output by +22/−6. The local review branch is `studio/gallery-batch-2026-11-19`.
