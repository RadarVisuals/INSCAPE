# Phase 2 Identity Rack document v5

Profile document version 5 introduces a closed, presentation-only rack contract. The first and only allowed rack is `identity`; its complete allowed module set is `profile`, `bio`, and `links-tags`. IDs, order, visibility, and authored start-open state are validated. Unknown racks, unknown modules, duplicates, missing modules, invalid ordering, and unexpected fields fail closed.

The public identity cache is privacy-bound to that rack:

- `profile` permits the normalized profile name and validated avatar URL;
- `bio` permits the bounded public description;
- `links-tags` permits bounded tags and canonical absolute HTTPS links;
- fields belonging to a hidden module are invalid and cannot be rendered accidentally.

Only `profile` is visible by default. Bio, tags, and links require explicit authored publication. Unsafe, malformed, duplicate, or over-limit values are omitted by the builder without mutating owner identity state.

Versions 1 through 4 migrate deterministically in memory. A v4 document receives one Identity Rack whose Profile module inherits the legacy public Identity module's visibility and start-open state. Bio and Links/Tags remain hidden, and migration never invents or retrieves identity data that was not present in the verified document bytes. The resolver still verifies the exact published bytes and embedded profile authority before parsing or migration.

Version 5 retains the existing `systemModules` projection during this incremental schema step. No rack UI, owner authoring controls, visitor rearrangement, persistence, wallet action, or publication transaction is introduced by the contract change itself.
