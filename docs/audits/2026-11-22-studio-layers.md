# Studio layer and cell editing, 22 November 2026

The clean baseline was `e189cce3` on `codex/profile-work-index-2026-10-30`. It already contained the four audit fixes. All exercises used disposable synthetic profiles and isolated browser storage.

| Maker action | Baseline behaviour and owner | Verified outcome |
| --- | --- | --- |
| Click a free shape, then open Layers | The Workbench selection marks the corresponding row. A cell surface takes the first click for its frame. `ReceptionBentoEditor.jsx` enters contents on double-click or Enter. Selecting a child row in `WorkbenchLayers.jsx` opens that cell directly. | The free shape selected on the canvas was pressed in Layers. Selecting its row allowed transfer and subsequent direct manipulation. |
| Assign or release a selected layer from Layers | The folder centre accepts a transfer. A root edge releases and reorders. These targets in `WorkbenchLayers.jsx` required dragging. | The destination picker also invokes the existing transfer. Assignment centres the selection and release keeps its current world position, subject to standalone module minima. |
| Drag a member onto empty canvas | `WorkbenchView.jsx` accepted a transfer only for a destination cell. Ordinary movement otherwise retained the source membership. | Releasing on empty authored canvas saves the dragged position and clears ownership in one operation. With the pointer inside the source, a shape can overhang the edge and remain a member. Undo, Redo and reload preserved the tested document. |
| Group an image in a cell with a free shape, then nudge the group | The audit fix in `workbenchLayerOutline.js` exposed one selectable group. On movement, `editorCellMoveIds` expanded the selected image to its cell and siblings. An unrelated text frame moved in the browser reproduction. | Only the image and free shape moved by the same delta. Cell frames, sibling text and membership stayed fixed. Whole-cell and mixed cell/artwork marquee movement passed separately. |
| Choose Use cells on an existing compatible canvas | `OwnerWorkbenchSession.jsx` invokes `enableStudioCells` and the draft store saves native artwork under `composition`. | ID, text, images and their positions survived conversion, Undo, Redo and reload. The command itself adds zero cells. |
| Choose Use canvas modules on a new Canvas | `canvasModuleDraft` projects a representable cell-free composition back to top-level module data. | The full module tools became available under the same ID. Undo returned to the native editor. |

New Canvas and Bento compositions share the native editor. Their starting content differs. Studio still needs a separate representation for Display, interactive modules, Keeper docks, workspace groups, camera indices and linked or paginated text. The conversion checks keep unsupported authored data in its own representation. Cell-specific clipping, responsive sizing, anchors and the rule that a background paints behind its contents remain local to cell layout. Layer order across different owners still has restrictions in `receptionLayerOrder.js`.

Canvas and Layers now share the post-transfer selection and cell focus in `EditorCellsContext.jsx`. The native membership operation owns geometry and storage. The synthetic group used to obtain authored movement, the redundant selection expansion and an unreachable cell attribute on the ordinary selection overlay were removed. Production code including the type declaration changed by +52 / −42 lines.

## Local verification

The full Node suite passed 2,039 tests. Strict Workbench type checking, the production build and the production budget check passed. Eleven focused Chromium cases passed, including both starting layouts, both format commands, mixed readers, group movement at 1440 and 900 px, transfer, order, geometry, history and reload. The normal development-server dependency optimizer hit a filesystem access error. The browser cases ran against locally built copies of the same fixture entry points. The native editor fixture now waits on the production workspace boundary. The storage test uses the current Compositions submenu and waits for the durable active ID.

| JavaScript in bytes | Baseline | Changed | Delta |
| --- | ---: | ---: | ---: |
| Startup, raw | 700096 | 700096 | 0 |
| Startup, gzip | 213754 | 213765 | +11 |
| All core, raw | 2951460 | 2952222 | +762 |
| All core, gzip | 986019 | 986328 | +309 |

Both measurements used the same checkout, commit metadata, installed dependencies and production budgets. The remaining compressed core budget is 13,672 bytes. These changes were verified locally.
