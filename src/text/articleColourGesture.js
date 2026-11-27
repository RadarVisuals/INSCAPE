import { closeHistory } from '@tiptap/pm/history';
import { Selection } from '@tiptap/pm/state';

export const COLOUR_PREVIEW = 'inscapeColourPreview';

export function setArticleColour(editor, color, selection = editor.state.selection, preview = false) {
  if (editor.isDestroyed || !editor.isEditable) return;
  const chain = editor.chain().command(({ tr }) => {
    tr.setSelection(Selection.fromJSON(tr.doc, selection.toJSON()));
    if (preview) tr.setMeta('addToHistory', false).setMeta(COLOUR_PREVIEW, true);
    else closeHistory(tr);
    return true;
  });
  (color === null ? chain.unsetColor() : chain.setColor(color)).run();
}

export function beginArticleColour(editor) {
  const snapshot = editor.state;
  let finalColor = null, previewDoc = snapshot.doc;
  return {
    update({ color }) {
      if (editor.isDestroyed || !editor.state.doc.eq(previewDoc)) return;
      finalColor = color;
      setArticleColour(editor, color, snapshot.selection, true);
      previewDoc = editor.state.doc;
    },
    finish(cancelled) {
      // Another edit/Undo has already replaced this preview: never overwrite it.
      if (editor.isDestroyed || !editor.state.doc.eq(previewDoc)) return;
      const selectionUnchanged = editor.state.selection.eq(snapshot.selection);
      editor.chain().command(({ tr }) => {
        const { from, to, empty } = snapshot.selection;
        if (!empty) {
          tr.removeMark(from, to, editor.schema.marks.textStyle);
          snapshot.doc.nodesBetween(from, to, (node, position) => {
            if (node.isText) for (const mark of node.marks) if (mark.type.name === 'textStyle')
              tr.addMark(Math.max(from, position), Math.min(to, position + node.nodeSize), mark);
          });
        }
        if (selectionUnchanged) tr.setSelection(Selection.fromJSON(tr.doc, snapshot.selection.toJSON())).setStoredMarks(snapshot.storedMarks);
        tr.setMeta('addToHistory', false).setMeta(COLOUR_PREVIEW, true);
        return true;
      }).run();
      if (!cancelled && selectionUnchanged && finalColor) setArticleColour(editor, finalColor, snapshot.selection);
    },
  };
}
