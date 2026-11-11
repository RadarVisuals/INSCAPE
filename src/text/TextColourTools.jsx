import { useEffect, useReducer } from 'react';
import InspectorColourControls from '../colour/InspectorColourControls.jsx';
import CommittedColourControls from '../colour/CommittedColourControls.jsx';
import EditorToolbarPopover from '../public/ownerSystemWorkflow/EditorToolbarPopover.jsx';
import { OwnerSystemWorkflowSelectMenu } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';
import { ARTICLE_STYLE_ROLES, textAppearance } from './domain/article.js';
import { beginArticleColour, setArticleColour } from './articleColourGesture.js';

export default function TextColourTools({ article, editor, target, onTarget, disabled, onChange, onPreview, store, error, onRecovery, containerControls = true, scopeKey, compact = false }) {
  const [, refresh] = useReducer(value => value + 1, 0);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.on('transaction', refresh);
    return () => editor.off('transaction', refresh);
  }, [editor]);
  const appearance = textAppearance(article), body = target === 'body', style = ARTICLE_STYLE_ROLES.some(role => role.id === target);
  const selection = editor && !editor.isDestroyed ? editor.state.selection : null;
  const bodyAvailable = editor && !editor.isDestroyed && editor.isEditable;
  const inherited = appearance.textStyles?.[`h${editor?.getAttributes('heading').level}`]?.color || appearance.color;
  const colors = new Set();
  if (body && selection && !selection.empty) selection.$from.doc.nodesBetween(selection.from, selection.to, (node, _pos, parent) => {
    if (node.isText) colors.add(node.marks.find(mark => mark.type.name === 'textStyle')?.attrs.color || appearance.textStyles?.[`h${parent.attrs.level}`]?.color || appearance.color);
  });
  const color = body ? (editor?.getAttributes('textStyle').color || inherited) : target === 'title' ? appearance.titleColor || appearance.color
    : target === 'background' ? appearance.background || '#101111' : style ? appearance.textStyles?.[target]?.color || appearance.color : appearance.color;
  const changeAppearance = patch => {
    const next = { ...appearance };
    if (style) {
      const role = { ...next.textStyles?.[target] };
      if (patch.color === null) delete role.color; else role.color = patch.color;
      next.textStyles = { ...next.textStyles, [target]: role };
      if (!Object.keys(role).length) delete next.textStyles[target];
      if (!Object.keys(next.textStyles).length) delete next.textStyles;
    } else {
      if ('color' in patch) {
        const key = target === 'title' ? 'titleColor' : target === 'background' ? 'background' : 'color';
        if (patch.color === null && key === 'titleColor') delete next[key]; else next[key] = patch.color;
      }
      if ('opacity' in patch) next.opacity = patch.opacity;
    }
    return { ...article, appearance: next };
  };
  const apply = patch => { if (disabled) return; if (body) { if (bodyAvailable) setArticleColour(editor, patch.color); } else onChange(changeAppearance(patch)); };
  const resetAvailable = body ? Boolean(editor?.getAttributes('textStyle').color) || colors.size > 1 : target === 'title' ? Boolean(appearance.titleColor) : style && Boolean(appearance.textStyles?.[target]?.color);
  const picker = {
    color, scopeKey: `${scopeKey}:${target}:${body ? `${selection?.from}:${selection?.to}` : ''}`,
    opacity: target === 'background' ? appearance.opacity : undefined,
    disabled: disabled || (body && !bodyAvailable) || (target === 'background' && appearance.background === null),
    getVersion: () => store.getGeneration(), onChange: apply,
    beginPreview: body && bodyAvailable ? () => beginArticleColour(editor) : undefined,
    onPreview: patch => onPreview(patch ? changeAppearance(patch) : null),
  };
  if (compact) return <EditorToolbarPopover label={target === 'title' ? 'Title color' : 'Text color'} disabled={picker.disabled}
    trigger={<span className="workbench-inspector-swatch" data-mixed={body && colors.size > 1 || undefined} style={{ backgroundColor: color }} />}>
    <strong>{colors.size > 1 ? 'Mixed text colors' : target === 'title' ? 'Title color' : 'Text color'}</strong>
    <CommittedColourControls key={picker.scopeKey} {...picker} variant="inspector" />
  </EditorToolbarPopover>;
  return <>
    <div className="workbench-inspector-row workbench-color-target"><span>Apply to</span>
      <OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="workflow-tactile-control" label="Color target" value={target} onChange={onTarget}
        options={[{ value: 'body', label: selection?.empty ? 'Text at cursor' : 'Selected text', disabled: !bodyAvailable },
          { value: 'default', label: 'Article default text' }, { value: 'title', label: 'Article title' },
          ...(containerControls ? [{ value: 'background', label: 'Text box background' }] : []),
          ...ARTICLE_STYLE_ROLES.map(role => ({ value: role.id, label: `${role.label} (all)` }))]} />
    </div>
    {body && colors.size > 1 && <p>Mixed colors</p>}
    {target === 'background' && <div className="workbench-inspector-row"><span>Background</span>
      <OwnerSystemWorkflowSelectMenu flat compact palette="editor" className="workflow-tactile-control" label="Text background" disabled={disabled} value={appearance.background === null ? 'none' : 'color'}
        options={[{ value: 'none', label: 'None' }, { value: 'color', label: 'Color' }]}
        onChange={value => onChange(changeAppearance({ color: value === 'none' ? null : '#101111' }))} />
    </div>}
    <InspectorColourControls key={picker.scopeKey} label={target === 'background' ? 'Background' : 'Text'} {...picker} />
    {(body || target === 'title' || style) && <button className="workflow-tactile-control" type="button" disabled={disabled || !resetAvailable}
      title={body ? 'Follow each paragraph or heading’s default color.' : `Use the article’s default text color (${appearance.color.toUpperCase()}).`}
      onClick={() => apply({ color: null })}>Use default text color</button>}
    {error && <p role="alert">{error} <button type="button" onClick={onRecovery}>Open Text recovery</button></p>}
  </>;
}
