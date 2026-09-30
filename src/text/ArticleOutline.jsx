// Positions and labels are derived from the live ProseMirror document. Nothing
// is cached or persisted: edits, undo and article switches cannot stale the list.
export default function ArticleOutline({ editor, disabled }) {
  const headings = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') headings.push({ pos, level: node.attrs.level, label: node.textContent || 'Untitled heading' });
  });
  const cursor = editor.state.selection.from;
  const active = headings.findLast(heading => heading.pos < cursor)?.pos;
  return <details className="text-article-outline">
    <summary>Outline <span>{headings.length}</span></summary>
    {headings.length ? <nav aria-label="Article outline">{headings.map(heading => <button type="button" key={heading.pos}
      style={{ paddingInlineStart: 6 + (heading.level - 1) * 12 }} disabled={disabled}
      aria-current={heading.pos === active ? 'location' : undefined} title={heading.label}
      onMouseDown={event => event.preventDefault()}
      onClick={() => editor.chain().focus().setTextSelection(heading.pos + 1).scrollIntoView().run()}>
      <span aria-hidden="true">H{heading.level}</span>{heading.label}
    </button>)}</nav> : <p>Add headings using Paragraph style to navigate your article.</p>}
  </details>;
}
