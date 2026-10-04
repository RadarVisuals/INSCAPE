import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import { TextSelection } from '@tiptap/pm/state';
import { Extension, commands } from '@tiptap/core';

export function flowDecorations(doc, from, to) {
  from = Math.min(from, doc.content.size); to = Math.max(from, Math.min(to, doc.content.size));
  const decorations = [];
  doc.descendants((node, pos) => {
    const end = pos + node.nodeSize;
    if (node.isText) {
      if (pos < from) decorations.push(Decoration.inline(pos, Math.min(from, end), { style: 'display:none' }));
      if (end > to) decorations.push(Decoration.inline(Math.max(to, pos), end, { style: 'display:none' }));
      return false;
    }
    if (end <= from || pos >= to) {
      decorations.push(Decoration.node(pos, end, { style: 'display:none' })); return false;
    }
    const style = [];
    if (node.isTextblock) {
      if (from > pos + 1) style.push('margin-top:0;padding-top:0');
      if (to < end - 1) style.push('margin-bottom:0;padding-bottom:0');
    }
    if (node.type.name === 'listItem' && from > pos + 1) style.push('list-style-type:none');
    if (style.length) decorations.push(Decoration.node(pos, end, { style: style.join(';') }));
    if (node.type.name === 'orderedList') {
      let skipped = 0; node.forEach((child, offset) => { if (pos + 1 + offset + child.nodeSize <= from) skipped++; });
      if (skipped) decorations.push(Decoration.node(pos, end, { start: (node.attrs.start || 1) + skipped }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

// All windows project one EditorState. Secondary views forward transactions to
// the original Tiptap editor: saving, selection, marks and history have one owner.
export function createArticleFlowEditor() {
  const views = new Map();
  let editor = null, active = null, full = false, enabled = false, pending = 0, drag = null;
  const rangeAt = position => [...views.values()].find(item => position >= item.from && position < item.to)
    || [...views.values()].findLast(item => position === item.to);
  const props = id => ({
    decorations: state => {
      if (!enabled || full || !views.has(id)) return DecorationSet.empty;
      const { from, to } = views.get(id), set = flowDecorations(state.doc, from, to);
      const start = Math.max(from, state.selection.from), end = Math.min(to, state.selection.to);
      return start < end && !state.selection.empty ? set.add(state.doc, [Decoration.inline(start, end, { class: 'text-flow-selection' })]) : set;
    },
    handleScrollToSelection: () => enabled && !full,
    handleDOMEvents: {
      focus: view => { active = view; return false; },
      beforeinput: (view, event) => {
        if (!enabled || full || event.isComposing) return false;
        // A DOM replacement spanning hidden text in a projection can include
        // its hidden prefix. Apply ordinary input to the authoritative range.
        if (event.inputType === 'insertText' && event.data != null) {
          event.preventDefault(); active = view;
          editor.view.dispatch(editor.state.tr.insertText(event.data)); return true;
        }
        if (!editor.state.selection.empty && /^delete/u.test(event.inputType)) {
          event.preventDefault(); active = view;
          editor.view.dispatch(editor.state.tr.deleteSelection()); return true;
        }
        return false;
      },
      mousedown: (view, event) => {
        if (!enabled || full || event.button !== 0 || event.detail > 1 || event.target.closest('[contenteditable="false"]')) return false;
        const hit = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos, range = views.get(id);
        if (hit == null || !range) return false;
        const position = Math.max(range.from, Math.min(range.to, hit));
        // Native browser selection cannot span separate contenteditable roots.
        // Resolve the drag in the shared document, including within one frame.
        event.preventDefault();
        drag = { anchor: event.shiftKey ? editor.state.selection.anchor : position };
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.between(editor.state.doc.resolve(drag.anchor), editor.state.doc.resolve(position))));
        view.focus(); active = view; return true;
      },
    },
    handleKeyDown: (view, event) => {
      if (!enabled || full) return false;
      if ((event.ctrlKey || event.metaKey) && ['Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const end = event.key === 'End' ? TextSelection.atEnd(editor.state.doc) : TextSelection.atStart(editor.state.doc);
        editor.view.dispatch(editor.state.tr.setSelection(event.shiftKey ? TextSelection.create(editor.state.doc, editor.state.selection.anchor, end.head) : end));
        const target = rangeAt(end.head)?.view; if (target) { target.focus(); active = target; } return true;
      }
      if (!view.state.selection.empty && !event.shiftKey) return false;
      const current = views.get(id), head = view.state.selection.head;
      const items = [...views.values()], index = items.indexOf(current);
      const next = event.key === 'ArrowRight' && head >= current.to ? items[index + 1]
        : event.key === 'ArrowLeft' && head <= current.from ? items[index - 1] : null;
      if (!next) return false;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const cursor = TextSelection.near(view.state.doc.resolve(Math.max(0, Math.min(view.state.doc.content.size, head + direction))), direction);
      const selection = event.shiftKey ? TextSelection.create(view.state.doc, view.state.selection.anchor, cursor.head) : cursor;
      editor.view.dispatch(editor.state.tr.setSelection(selection)); next.view.focus(); active = next.view; return true;
    },
  });
  const route = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => { pending = requestAnimationFrame(() => {
      if (!enabled || full || !editor || editor.isDestroyed || active?.composing || drag) return;
      const target = rangeAt(editor.state.selection.head)?.view;
      if (target && active && target !== active && active.hasFocus()) { target.focus(); active = target; }
    }); });
  };
  const sync = ({ transaction, appendedTransactions = [] }) => {
    // Keep each projection attached to its logical positions during the
    // synchronous input transaction, before browser layout measures new breaks.
    for (const tr of [transaction, ...appendedTransactions]) if (tr.docChanged && !tr.getMeta('preventUpdate')) for (const item of views.values()) {
      item.from = tr.mapping.map(item.from, -1); item.to = tr.mapping.map(item.to, 1);
    }
    if (enabled && !full) editor.view.setProps({ decorations: props('first').decorations });
    for (const item of views.values()) if (item.view !== editor.view) item.view.updateState(editor.state);
    if (transaction.docChanged || transaction.selectionSet) route();
  };
  const move = event => {
    if (!drag || drag.anchor == null || !(event.buttons & 1)) return;
    const item = [...views.values()].find(({ view }) => view.dom.contains(event.target));
    if (!item) return;
    const hit = item.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
    if (hit == null) return;
    const position = Math.max(item.from, Math.min(item.to, hit));
    event.preventDefault();
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.between(editor.state.doc.resolve(drag.anchor), editor.state.doc.resolve(position))));
    item.view.focus(); active = item.view;
  };
  const up = () => { drag = null; };
  return {
    props,
    connect(value) {
      editor = value; editor.on('transaction', sync);
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      return () => { cancelAnimationFrame(pending); editor.off('transaction', sync); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); views.clear(); active = null; editor = null; };
    },
    configure(value, focusWriting) { enabled = value; full = focusWriting; },
    register(id, view, from, to) {
      views.set(id, { view, from, to }); view.setProps({ decorations: props(id).decorations, handleScrollToSelection: props(id).handleScrollToSelection });
      return () => { if (views.get(id)?.view === view) views.delete(id); if (active === view) active = null; };
    },
    update(id, from, to) {
      const item = views.get(id); if (!item || item.from === from && item.to === to) return;
      Object.assign(item, { from, to });
      if (!item.view.composing) item.view.setProps({ decorations: props(id).decorations });
    },
    create(id, host, from, to) {
      const base = editor.view.props;
      const view = new EditorView(host, { ...base, ...props(id), state: editor.state,
        handleKeyDown: (view, event) => props(id).handleKeyDown(view, event) || base.handleKeyDown?.(view, event),
        dispatchTransaction: transaction => { active = view; editor.view.dispatch(transaction); },
      });
      const unregister = this.register(id, view, from, to);
      return { view, dispose: () => { unregister(); view.destroy(); } };
    },
    refresh() { for (const [id, item] of views) if (!item.view.composing) item.view.setProps({ decorations: props(id).decorations }); },
    viewAt(point) { return point && [...views.values()].find(({ view }) => {
      const bounds = view.dom.getBoundingClientRect();
      return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
    })?.view; },
    focusView(position, fallback) {
      if (!enabled || full) return fallback;
      const target = position === 'start' ? 1 : position === 'end' ? editor.state.doc.content.size - 1
        : typeof position === 'number' ? position : editor.state.selection.head;
      return rangeAt(target)?.view || active || fallback;
    },
  };
}

export const ArticleFlowFocus = bridge => Extension.create({ name: 'articleFlowFocus',
  addCommands: () => ({ focus: (position, options) => props => commands.focus(position, options)({ ...props, view: bridge.focusView(position, props.view) }) }),
});
