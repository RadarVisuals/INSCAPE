# Published canvas gallery

The Reception action now opens the existing gallery for visitors. Its adapter
reads only verified public documents and supplies the same grid, wrap, list,
inspection, source metadata and camera points as the local overview. Owner
actions are absent when their capabilities are absent. View preferences are
temporary. Touch reveal survives automatic wrap normalization; an actual swipe
or wheel movement dismisses it.

Publication owns explicit selection, not the gallery. The existing rack now
reviews current/checked/all-changed canvases and separately reviews profile
details, Reception and shared Keeper. The collection builder applies existing
public projections and retains unselected published content. Unknown publication
state blocks preparation. Preparation never uploads or requests a wallet write.
The current upload, CID verification, signing, receipt/read-back and recovery
boundaries remain in use.

The v9 root owns the entry canvas and shared profile facts. Additional canvases
contain only composition fields. Each receives the existing closed validation;
the full document retains its 512 KiB byte limit and eight-canvas limit. A fresh
owner restores the complete public collection. Existing local work is never
replaced by that hydration. This removes the collection publication block without
adding another mutable store or a parallel visitor gallery.

## Evidence

- Complete unit suite: 1,462 passed, none skipped.
- Mocked end-to-end collection flow passes the actual upload handler, canonical
  CID verification, wallet publisher and public read-back; no external writes.
- Public gallery browser checks at 390 and 1440 pixels cover touch/keyboard,
  wrap, only one accessible collection, modal metadata, return and private-state
  preservation. Screenshots were inspected at both sizes.
- Reception: six passes. Real App owner/public routing: five passes. Existing
  owner gallery: thirteen passes. Publication panel and recovery: one pass each.
- Lint, strict contract checks, design inventory and LUKSO standards pass.
- Production build retains lazy owner/wallet boundaries and all initial-load,
  owner, wallet, CSS and asset budgets. The added publication and visitor path
  measured about 12 KiB raw and 7 KiB compressed across optional/core chunks;
  only that aggregate budget was adjusted to 2,586,000 / 838,000 bytes.

Official encoding reference checked: [LSP2](https://docs.lukso.tech/standards/metadata/lsp2-json-schema/).
The LUKSO pointer key and encoding did not change.

## Limits

Browser coverage uses Chromium, including a touch viewport; it is not a physical
iPhone Safari certification. The complete hosted release gate is separate from
these local checks. No real upload, signature, transaction or profile content
publication was performed. Owners still explicitly publish their chosen canvases.
The existing inspection uses static mini-app placeholders and the existing
composition renderer; this change does not implement mobile editing or Desktop.
