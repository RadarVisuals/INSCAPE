import { useEffect, useRef } from 'react';
import { closeHistory } from '@tiptap/pm/history';
import { Selection } from '@tiptap/pm/state';

// The editor owns the range and marks. This adapter exposes that current target
// to the reference Color panel without creating another article or text editor.
export default function useTextColourSelection({
  editor,
  item,
  selected,
  disabled,
  onChange,
  onTarget,
}) {
  const latest = useRef(null),
    scope = useRef(null),
    publish = useRef(() => {});
  latest.current = { editor, item, selected, disabled, onChange };

  useEffect(() => {
    if (!selected || !editor || editor.isDestroyed) {
      scope.current = null;
      return;
    }
    const usable = () => {
      const current = latest.current;
      return current.selected && !current.disabled && !editor.isDestroyed;
    };
    const setBodyColour = (color, preview = false, selection = editor.state.selection) => {
      if (!usable()) return;
      editor
        .chain()
        .command(({ tr }) => {
          tr.setSelection(Selection.fromJSON(tr.doc, selection.toJSON()));
          if (preview) tr.setMeta('addToHistory', false);
          else closeHistory(tr);
          return true;
        })
        .setColor(color)
        .run();
    };
    const setTitleColour = (color) => {
      if (!usable()) return;
      const article = latest.current.item.article;
      latest.current.onChange({
        ...article,
        appearance: { ...article.appearance, titleColor: color },
      });
    };
    const refresh = () => {
      if (!latest.current.selected || editor.isDestroyed) return;
      const article = latest.current.item.article;
      const body = scope.current === 'body',
        title = scope.current === 'title';
      const selection = editor.state.selection;
      onTarget({
        id: item.id,
        key: body ? `body:${selection.from}:${selection.to}` : title ? 'title' : 'default',
        label: body
          ? selection.empty
            ? 'Text at cursor'
            : 'Selected text'
          : title
            ? 'Title'
            : 'Default text colour',
        color: title
          ? article.appearance.titleColor || article.appearance.color
          : body
            ? editor.getAttributes('textStyle').color || article.appearance.color
            : article.appearance.color,
        apply: body ? setBodyColour : title ? setTitleColour : null,
        begin: body
          ? () => {
              const snapshot = editor.state;
              let finalColour = null;
              const restore = () => {
                if (editor.isDestroyed) return;
                editor
                  .chain()
                  .command(({ tr }) => {
                    // Restore only marks in the captured range. Replacing the whole
                    // document here would remap and damage earlier typing history.
                    const { from, to, empty } = snapshot.selection;
                    if (!empty) {
                      tr.removeMark(from, to, editor.schema.marks.textStyle);
                      snapshot.doc.nodesBetween(from, to, (node, position) => {
                        if (node.isText)
                          for (const mark of node.marks) {
                            if (mark.type.name === 'textStyle')
                              tr.addMark(
                                Math.max(from, position),
                                Math.min(to, position + node.nodeSize),
                                mark,
                              );
                          }
                      });
                    }
                    tr.setSelection(
                      Selection.fromJSON(tr.doc, snapshot.selection.toJSON()),
                    ).setStoredMarks(snapshot.storedMarks);
                    tr.setMeta('addToHistory', false);
                    return true;
                  })
                  .run();
              };
              return {
                update: ({ color }) => {
                  finalColour = color;
                  setBodyColour(color, true, snapshot.selection);
                },
                finish: (cancelled) => {
                  restore();
                  if (!cancelled && finalColour)
                    setBodyColour(finalColour, false, snapshot.selection);
                },
              };
            }
          : title
            ? () => {
                const appearance = latest.current.item.article.appearance;
                return {
                  update: ({ color }) => setTitleColour(color),
                  finish: (cancelled) => {
                    if (cancelled) {
                      const current = latest.current;
                      current.onChange({
                        ...current.item.article,
                        appearance: {
                          ...current.item.article.appearance,
                          titleColor: appearance.titleColor,
                        },
                      });
                    }
                  },
                };
              }
            : null,
      });
    };
    const bodySelection = () => {
      scope.current = 'body';
      refresh();
    };
    publish.current = refresh;
    editor.on('selectionUpdate', bodySelection);
    editor.on('focus', bodySelection);
    editor.on('transaction', refresh);
    refresh();
    return () => {
      editor.off('selectionUpdate', bodySelection);
      editor.off('focus', bodySelection);
      editor.off('transaction', refresh);
      publish.current = () => {};
      onTarget((current) => (current?.id === item.id ? null : current));
    };
  }, [editor, selected, item.id, onTarget]);
  useEffect(() => {
    publish.current();
  }, [item.article, disabled]);
  return (event) => {
    if (event.target.matches('.text-document-title')) {
      scope.current = 'title';
      publish.current();
    }
  };
}
