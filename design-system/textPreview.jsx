import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ArticleEditor from '../src/text/ArticleEditor.jsx';
import TextTools from '../src/text/TextTools.jsx';
import { SharedTextToolsProvider, SharedTextToolsInspectorContent } from '../src/text/SharedTextTools.jsx';
import { textSurfaceStyle } from '../src/text/domain/article.js';
import useTextColourSelection from './textColourSelection.js';
import './textPreview.css';

function TextExample({
  item,
  selected,
  canvasHost,
  layerHost,
  onChange,
  onFindRequest,
  readOnly,
  onColourTarget,
}) {
  const [controlsHost, setControlsHost] = useState(null);
  const [editor, setEditor] = useState(null);
  const [mount] = useState(() => document.createElement('div'));
  const disabled =
    item.locked ||
    (readOnly && item.parent === 'cell') ||
    item.textReadOnly ||
    !item.visible;
  const changeArticle = (article) => {
    if (!disabled) onChange(item.id, { article });
  };
  const inCell = item.parent === 'cell';
  const onFocusCapture = useTextColourSelection({
    editor,
    item,
    selected,
    disabled,
    onChange: changeArticle,
    onTarget: onColourTarget,
  });
  useLayoutEffect(() => {
    const host = selected && inCell && layerHost ? layerHost : canvasHost;
    host?.appendChild(mount);
    mount.hidden = !selected;
    return () => mount.remove();
  }, [mount, canvasHost, layerHost, selected, inCell]);
  return (
    <>
      {canvasHost &&
        createPortal(
          <div
            className="ds-text-editor-sample text-workbench"
            hidden={!selected}
            onFocusCapture={onFocusCapture}
            style={{
              ...textSurfaceStyle(item.article),
              borderRadius: 'var(--module-corners,0)',
            }}
          >
            <ArticleEditor sharedColour
              article={item.article}
              onChange={changeArticle}
              onEditor={setEditor}
              controlsHost={controlsHost}
              disabled={disabled || !selected}
              onFindRequest={onFindRequest}
              saveStatus="Local example · changes are not saved"
              focusClassName="ds-text-focus"
            />
            <span className="module-surface-grain" aria-hidden="true" />
          </div>,
          mount,
        )}
      <TextTools sharedColour
        targetId={item.id}
        available={selected}
        article={item.article}
        onChange={changeArticle}
        controlsRef={setControlsHost}
        onClose={() => {}}
        disabled={disabled}
        backupScope={item.id}
        footer={<p>Local example · changes are not saved.</p>}
        readOptions={
          !inCell && (
            <label className="text-visibility text-settings-wide">
              <input type="checkbox" disabled checked={false} readOnly />
              Read as pages
            </label>
          )
        }
        publication={
          !inCell && (
            <label className="text-visibility">
              <input
                type="checkbox"
                disabled={disabled}
                checked={item.included}
                onChange={(event) => onChange(item.id, { included: event.target.checked })}
              />
              Include in Workbench publication
            </label>
          )
        }
      />
    </>
  );
}

export default function TextPreview({
  items,
  selectedId,
  open,
  onOpenChange,
  canvasHost,
  layerHost,
  onChange,
  onFindRequest,
  readOnly,
  onColourTarget,
}) {
  return (
    <SharedTextToolsProvider
      activeModuleId={selectedId}
      onActivate={() => {}}
      open={open}
      onOpenChange={onOpenChange}
    >
      {open && items.some(item => item.kind === 'text' && item.id === selectedId) && <aside className="text-isolated-inspector" aria-label="Text inspector"
        data-workflow-material="tactile" data-workflow-finish="flat" data-system-workflow-overlay>
        <header><strong>Text inspector</strong><button className="workflow-tactile-control" type="button" onClick={() => onOpenChange(false)}>Close Inspector</button></header>
        <SharedTextToolsInspectorContent targetId={selectedId} />
      </aside>}
      {items
        .filter((item) => item.kind === 'text')
        .map((item) => (
          <TextExample
            key={item.id + ':' + (item.textRevision || 0)}
            item={item}
            selected={selectedId === item.id}
            canvasHost={canvasHost}
            layerHost={layerHost}
            onChange={onChange}
            onFindRequest={onFindRequest}
            readOnly={readOnly}
            onColourTarget={onColourTarget}
          />
        ))}
    </SharedTextToolsProvider>
  );
}
