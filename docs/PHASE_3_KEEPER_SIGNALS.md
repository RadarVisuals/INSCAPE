# Phase 3 Keeper Signals

## Purpose

Phase 3 makes the active Keeper visibly aware of recent read-only activity involving the configured Universal Profile. Blockchain records become normalized Keeper Signals, enter a profile-scoped history, and may produce one concise speech moment, one existing safe actor reaction, and a restrained orange accent.

This phase does not connect a wallet, sign, submit transactions, write to LUKSO, provide push notifications, or create a chatbot.

## Architecture

```text
LUKSO Envio Transfer / Transaction records or deterministic fixture
  -> activity repository
  -> framework-neutral KeeperSignal normalization
  -> profile-scoped signal document + duplicate suppression
  -> bounded reaction director
  -> Keeper speech + guarded Pixi reaction bridge + orange accent
  -> Signals history window
```

`src/signals/domain` owns stable identity, normalization, message construction, ordering, and reaction policy. `data` owns live and fixture repositories. `storage` owns the versioned local document. `state` owns synchronization and transient queue state. React components only render state and call the guarded canvas API; they do not hold or mutate Pixi objects.

## Event vocabulary

- `ASSET_RECEIVED`
- `ASSET_SENT`
- `LYX_RECEIVED`
- `LYX_SENT`
- `UNKNOWN_ACTIVITY`

Every signal has a stable ID, direction, timestamp, source transaction/reference, profile, optional counterparty, optional contract/token identifiers, optional Phase 1-compatible asset reference, amount/value, title, message data, explicit `LIVE` or `FIXTURE` source, and read/seen flags. Records never contain JSX, React components, or Pixi objects.

## Live source and limitations

The live repository uses the documented LUKSO Envio Indexer GraphQL endpoint already used by the Collection:

```text
https://envio.lukso-mainnet.universal.tech/v1/graphql
```

It reads bounded, newest-first `Transfer` records whose `from_id` or `to_id` is the active profile. Contract-level transfers normalize as LSP7 assets; identifiable `tokenId` transfers normalize as LSP8. Asset metadata is passed through the Phase 1 `normalizeProfileAsset` and content URL path. Missing or partially failed metadata never removes the underlying signal.

Direct positive-value `Transaction` records addressed to the profile normalize as `LYX_RECEIVED`. The current indexer activity schema cannot reliably identify LYX sent internally by a Universal Profile execution, so `LYX_SENT` remains in the stable vocabulary and deterministic fixtures but is not fabricated in live history.

The repository accepts an offset and limit for bounded incremental reads. Phase 3 loads the most recent bounded page at startup and on explicit refresh. It does not continuously poll. Envio documents that its indexed format may change, so all response assumptions remain isolated inside the repository.

References:

- https://docs.lukso.tech/tools/apis/indexer-api/
- https://docs.lukso.tech/standards/event-reference/
- https://docs.lukso.tech/standards/tokens/LSP4-Digital-Asset-Metadata

## Normalization and identity

Direction is always classified relative to the normalized active profile. Signal identity combines the lowercased transaction/source reference, normalized type and direction, asset contract, and token ID. It never uses response order. This distinguishes multiple token events in one transaction while allowing repeated synchronizations to suppress exact duplicates.

History is newest-first with the stable ID as a deterministic tie-breaker.

## First-run baseline

The first successful live synchronization establishes a baseline. Its recent activity appears in Signals and all IDs become known, but none enter the automatic reaction queue. Later synchronizations may queue at most two genuinely new records. This prevents old profile history from producing a replay storm after installation or storage recovery.

Explicit fixture synchronization in Edit mode is intentionally different: it may queue one fixture signal so the complete reaction path can be tested without network access.

## Deduplication, queue, and interruption policy

Known IDs are persisted and duplicate IDs are also rejected by the transient director. The queue is capped at six and processes one visible Keeper reaction at a time. Automatic reactions wait until:

- the public interface reveal is ready;
- startup is complete enough to expose the interface;
- the Profile Card resident handoff is closed;
- the actor is not executing click-to-move;
- no reaction is currently visible;
- the five-second cooldown has elapsed.

The canvas exposes only `getKeeperReactionAvailability` and `triggerKeeperReaction`. The Pixi engine rejects unsafe calls while resident handoff or actor movement is active. Speech remains useful if an actor recipe is unavailable. Closing or switching a module does not own or clear the queue. Timers are cleaned up by the runtime layer, and no actor movement lock is introduced.

## Persistence ownership

The versioned key is scoped to the normalized profile:

```text
os-underneath.keeper-signals.v1:0xf3c189...
```

It stores initialization state, up to 200 known IDs, up to 50 recent normalized signals with seen/read state, and signal preferences. Invalid JSON, wrong versions, wrong profiles, and malformed records recover to an empty safe document. Signal persistence is independent from Collection workspace v2, Canvas Space pins, built-in module placement, and Reset Layout.

## Signals module

The established SIGNALS launcher opens a bounded draggable window using the existing module-grid geometry, focus styling, reveal sequencing, Edit placement behavior, mobile full-window presentation, and Escape behavior. It provides newest-first history, direction/type, time, asset/LYX context, abbreviated counterparty, source badges, loading/empty/partial/error states, retry, manual refresh, and seen state. Edit mode additionally exposes deterministic Fixture mode and Replay reaction controls; presentation mode does not show them.

## Settings

The existing Settings HUD command opens a compact Signals surface:

- Keeper notifications on/off
- speech on/off
- visual effects on/off
- audio notifications, default off

Audio is only a stored preference in this phase; there is no audio engine. Disabling Keeper notifications clears pending automatic work while history and refresh remain active.

## Accessibility and reduced motion

The speech bubble uses a single atomic status region for a newly visible message and can be dismissed manually. It follows the Keeper through engine-maintained screen coordinates, clamps to the viewport, and only accepts pointer input on its own dismiss control, leaving canvas click-to-move available elsewhere. Mobile moves the bubble to a stable lower inset.

Reduced-motion presentation disables the Pixi reaction call and replaces the animated accent with a static restrained mark. Startup's existing reduced-motion and reveal decisions remain authoritative.

## Fixture mode

The deterministic repository includes asset received, asset sent, LYX received, LYX sent, unavailable asset metadata, a duplicate record, and a partial repository warning. Fixture data is always labeled `FIXTURE`. A live error remains a live error and is never silently replaced with fixtures.

## Known limitations

- Live outgoing LYX cannot be classified reliably from the current indexed transaction model.
- Only one recent bounded page is shown; the repository boundary supports offsets for later “load older” UX.
- Timestamps and counterparty names are not enriched beyond indexed addresses.
- There is no background polling, service worker, push delivery, or audio playback.
- Actor recipes reuse the current authored reaction configuration; asset sent and LYX sent intentionally use quiet speech/history behavior.

## Phase 4 extension points

- Add a conservative visibility-aware poller or documented GraphQL subscription behind the repository boundary.
- Add reliable indexed Universal Receiver/execute decoding for outgoing native value when an official schema supports it.
- Resolve counterparty profile names without changing stored signal identity.
- Move reaction mappings and Keeper copy into the experience manifest/personality layer.
- Add focused audio cues behind the existing default-off preference.
- Add bounded older-history pagination while retaining the same store and persistence caps.
