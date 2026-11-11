import { Fragment } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

export function insertArticleArtwork(attrs, point, inputView) {
  return ({ editor, state, tr, commands }) => {
    let position = state.selection.from;
    if (point) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
      const view = inputView || editor.view;
      const bounds = view.dom.getBoundingClientRect();
      position = point.y < bounds.top ? 0 : point.y > bounds.bottom ? state.doc.content.size
        : view.posAtCoords({ left: point.x, top: point.y })?.pos;
      if (position == null) return false;
    }
    closeHistory(tr);
    // An insertion position is deliberately a collapsed range: dragging from
    // Library must not replace a selection left behind elsewhere in the article.
    return commands.insertContentAt(position, { type: 'artwork', attrs });
  };
}

// Reorder siblings in the current article only. Parent-schema checks preserve
// constraints such as the first paragraph in a list item.
export function moveArticleArtwork(direction) {
  return ({ state, dispatch }) => {
    const { selection } = state;
    if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'artwork' || ![-1, 1].includes(direction)) return false;
    const { $from, node } = selection, parent = $from.parent, index = $from.index(), otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= parent.childCount) return false;
    const other = parent.child(otherIndex), first = Math.min(index, otherIndex);
    const fragment = Fragment.fromArray(direction < 0 ? [node, other] : [other, node]);
    if (!parent.canReplace(first, first + 2, fragment)) return false;
    if (dispatch) {
      const start = direction < 0 ? selection.from - other.nodeSize : selection.from;
      const tr = closeHistory(state.tr).replaceWith(start, start + node.nodeSize + other.nodeSize, fragment);
      tr.setSelection(NodeSelection.create(tr.doc, direction < 0 ? start : start + other.nodeSize));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}
