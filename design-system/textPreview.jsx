import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ArticleEditor from '../src/text/ArticleEditor.jsx';
import TextTools from '../src/text/TextTools.jsx';
import { SharedTextToolsProvider, SharedTextToolsWindow } from '../src/text/SharedTextTools.jsx';
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
    (readOnly && item.parent === 'display') ||
    item.textReadOnly ||
    !item.visible;
  const changeArticle = (article) => {
    if (!disabled) onChange(item.id, { article });
  };
  const inDisplay = item.parent === 'display';
  const onFocusCapture = useTextColourSelection({
    editor,
    item,
    selected,
    disabled,
    onChange: changeArticle,
    onTarget: onColourTarget,
  });
  useLayoutEffect(() => {
    const host = selected && inDisplay && layerHost ? layerHost : canvasHost;
    host?.appendChild(mount);
    mount.hidden = !selected;
    return () => mount.remove();
  }, [mount, canvasHost, layerHost, selected, inDisplay]);
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
        connection={
          !inDisplay && (
            <>
              <label>
                Follow Display
                <select aria-label="Follow Display" disabled value="">
                  <option value="">Choose a Display…</option>
                </select>
              </label>
              <button type="button" className="workflow-tactile-control" disabled>
                Link Text to Display
              </button>
              <p>Connection controls are shown for reference. They need a real Display.</p>
            </>
          )
        }
        readOptions={
          !inDisplay && (
            <label className="text-visibility text-settings-wide">
              <input type="checkbox" disabled checked={false} readOnly />
              Read as pages
            </label>
          )
        }
        publication={
          !inDisplay && (
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
      >
        {inDisplay ? (
          <>
            <button type="button" className="workflow-tactile-control" disabled>
              Move onto Workbench
            </button>
            <p>Moving between modules is shown for reference.</p>
          </>
        ) : (
          <details className="text-tools-transfer text-settings-wide">
            <summary>Move into Display</summary>
            <label>
              Destination
              <select aria-label="Text destination" disabled value="">
                <option value="">Choose a Display…</option>
              </select>
            </label>
            <button type="button" className="workflow-tactile-control" disabled>
              Move into Display
            </button>
          </details>
        )}
      </TextTools>
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
  theme,
  readOnly,
  onColourTarget,
}) {
  return (
    <SharedTextToolsProvider
      activeModuleId={selectedId}
      onActivate={() => {}}
      open={open}
      onOpenChange={onOpenChange}
      menuSurface={theme === 'mist' ? 'paper' : 'carbon'}
    >
      <SharedTextToolsWindow />
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
