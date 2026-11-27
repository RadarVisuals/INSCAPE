# Online verification and inspection return — 20 October 2026

The two hosted runs for `06ac24a5837b2cbf375687468015f46f49cfa48d` each passed 1263 Node tests and 211 of 212 browser cases across 55 suites. [Push 39333153325](https://github.com/RadarVisuals/INSCAPE/actions/runs/39333153325) failed returning keyboard focus after Escape from Display artwork inspection at 390 px. [PR 39333160865](https://github.com/RadarVisuals/INSCAPE/actions/runs/39333160865), testing merge `13efb219c72671198b2a53a5848f98c0dd64a620`, failed an SVG retry waiting for Ready. Both archives match GitHub digests and identical source manifests. Later build steps did not run. The previous Arrival recovery timeout and new Grid resize release case passed in both runs.

## Proven repair

The inspection focus failure reproduced in the real component fixture under CPU×4 (five passes, one failure). A deterministic React Suspense/transition fixture then holds the closing commit while frames run: the original implementation permanently skips focus because the source is still marked as inspecting when its one animation-frame callback runs. The ordinary case fails before the fix; all three delayed-commit cases pass after it, including preservation of a newer focus choice and rejection after a profile/Grid scope change.

The inspection session now owns requested focus return and performs it in the layout effect of its completed close. The viewer no longer schedules its own detached callback. A new session, scope change or disposal invalidates the pending return. Existing geometry, animation duration, camera, selection restoration, storage and publication remain under their original owners. This is a small lifecycle correction, not a Display redesign or reintroduction into ordinary creation.

Two additional historical inspection suites were using double-click/Enter to open inspection. They now use the established I shortcut; their return, navigation, scope and storage assertions remain intact. Those two suites are additional focused checks, not silently added to the full CI selection. The three new timing regressions live in the already-maintained context-action-bars suite.

## Verification and limits

- 1263/1263 Node tests, **38/38 browser cases in seven focused suites**, production build/budget and startup pass without skips. Initial JavaScript remains **822884 bytes**.
- Arrival recovery passes eight ordinary and four CPU×4 repetitions with immediate reload and unchanged timeouts. Its older hosted cause remains unexplained.
- SVG retry passes ten CPU×4 repetitions and the complete four-case SVG lifecycle suite. Its hosted timeout has not been explained or assigned a speculative runtime fix. Failure logs now retain source/host responses, frame URLs, page errors and a screenshot for the next occurrence. Assertions and timeouts are unchanged.
- Preparatory probe/import/command mistakes are recorded separately in the local evidence and are not counted as product failures or passing tests.
- Hosted validation of the repaired commit must be read from its new Actions runs. Local green checks do not certify those runs before completion.

[Local verification and changed-source hashes](online-verification/local-verification.json), [browser results](online-verification/browser-results.json), [deterministic failure](online-verification/focus-before.log), [passing regression](online-verification/focus-after.log), [original hosted focus failure](online-verification/hosted-focus-failure.log), [original SVG timeout](online-verification/hosted-svg-failure.log), [Node log](online-verification/node.log), [budgets](online-verification/budget.log).

The founder's Grid resize retest is recorded in [the prior repair](grid-resize-release.md). Remaining release work is dedicated Inscape Pinata credentials/old deployment access, then an explicitly authorized real UP signature, hosted quota reservation, Pinata CID, on-chain Publish and public read-back. No wallet, upload, user composition or main merge was performed by these checks.
