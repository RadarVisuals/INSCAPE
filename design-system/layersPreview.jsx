import ArticleView from '../src/text/ArticleView.jsx';
import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Group,
  Layers,
  ListChecks,
  Lock,
  Plus,
  Trash2,
  Type,
  Ungroup,
  Unlock,
  X,
} from 'lucide-react';
import {
  canGroup,
  expandGroup,
  groupFor,
  layerItems,
  selectedGroup,
} from './workspaceLayers.js';
import './layersPreview.css';

const nameOf = (item) => item.name.replace(' · Display', '');
function Key({ label, icon: Icon, buttonRef, ...props }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="workflow-tactile-control ds-layer-key"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}
export function LayerArtwork({ item }) {
  const grainId = useId();
  if (item.kind === 'text')
    return (
      <div className="ds-layer-text-art">
        <ArticleView article={item.article} />
      </div>
    );
  const Shape =
    item.variant === 'moon' ? 'circle' : item.variant === 'backdrop' ? 'rect' : 'path';
  const geometry =
    item.variant === 'moon'
      ? { cx: 72, cy: 72, r: 68 }
      : item.variant === 'backdrop'
        ? { width: 144, height: 144 }
        : { d: 'M0 144V72a72 72 0 0 1 144 0v72Z' };
  return (
    <svg viewBox="0 0 144 144" preserveAspectRatio="none" aria-hidden="true">
      <Shape {...geometry} fill={item.color} />
      {item.grain > 0 && (
        <>
          <defs>
            <pattern id={grainId} width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r=".7" fill="#222" />
            </pattern>
          </defs>
          <Shape {...geometry} fill={`url(#${grainId})`} opacity={item.grain / 100} />
        </>
      )}
    </svg>
  );
}
export function LayerScene({ items, selectedIds, onSelect, zoom, view, onTextHost }) {
  return (
    <div
      className="ds-layer-scene"
      role="group"
      aria-label="Example Display composition"
      style={{
        transform:
          'translate(' +
          (50 - view.x) +
          'px,' +
          (50 - view.y) +
          'px) scale(' +
          zoom / 100 +
          ')',
      }}
    >
      {layerItems(items)
        .filter((item) => item.visible)
        .map((item) => (
          <div
            key={item.id}
            className="ds-layer-object"
            data-selected={selectedIds.includes(item.id) || undefined}
            data-layer-id={item.id}
            style={{
              left: (item.x / 360) * 100 + '%',
              top: (item.y / 240) * 100 + '%',
              width: (item.width / 360) * 100 + '%',
              height: (item.height / 240) * 100 + '%',
              opacity: item.opacity / 100,
              filter: 'blur(' + item.blur + 'px)',
              transform:
                'rotate(' +
                item.rotation +
                'deg) scale(' +
                (item.flipX ? -1 : 1) +
                ',' +
                (item.flipY ? -1 : 1) +
                ')',
            }}
          >
            {item.kind === 'text' && selectedIds.length === 1 && selectedIds[0] === item.id ? (
              <div
                className="ds-layer-editor-host"
                ref={onTextHost}
                aria-label={'Edit ' + nameOf(item) + ' on canvas'}
              />
            ) : (
              <button
                type="button"
                className="ds-layer-canvas-select"
                aria-label={'Select ' + nameOf(item) + ' on canvas'}
                aria-pressed={selectedIds.includes(item.id)}
                disabled={item.locked}
                onClick={(event) =>
                  onSelect(item.id, event.shiftKey || event.ctrlKey || event.metaKey)
                }
              >
                <LayerArtwork item={item} />
              </button>
            )}
          </div>
        ))}
      {!layerItems(items).length && <span>No layers yet</span>}
    </div>
  );
}
export function LayerRemovalConfirmation({ count, onCancel, onConfirm, inline = false }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div
      role="alertdialog"
      aria-label="Remove layers from Grid"
      aria-describedby="ds-layer-remove-copy"
      className={'ds-layer-confirm' + (inline ? ' ds-layer-confirm--inline' : '')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <p id="ds-layer-remove-copy">
        {inline
          ? count === 1
            ? 'Remove layer?'
            : 'Remove ' + count + ' layers?'
          : 'Remove ' +
            (count === 1 ? 'this layer' : count + ' selected layers') +
            ' from Grid?'}
      </p>
      <div>
        {inline ? (
          <>
            <Key buttonRef={cancelRef} label="Cancel" icon={X} onClick={onCancel} />
            <Key label="Remove" icon={Check} onClick={onConfirm} />
          </>
        ) : (
          <>
            <button
              ref={cancelRef}
              type="button"
              className="workflow-tactile-control"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button type="button" className="workflow-tactile-control" onClick={onConfirm}>
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export default function LayersPreview({
  items,
  groups,
  selectedIds,
  readOnly,
  onSelect,
  onClear,
  onToggle,
  onRemove,
  onGroup,
  onUngroup,
  onDrop,
  onAddText,
  onEditText,
  onGutter,
  confirmation,
  onCancelRemove,
  onConfirmRemove,
}) {
  const layers = layerItems(items),
    selected = layers.filter((i) => selectedIds.includes(i.id));
  const group = selectedGroup(items, groups, selectedIds),
    editable =
      selected.length > 0 && selected.every((i) => !i.locked && i.visible) && !readOnly;
  const [multiple, setMultiple] = useState(false),
    [gutter, setGutter] = useState('1'),
    [message, setMessage] = useState(null),
    [dragTarget, setDragTarget] = useState(null);
  const listRef = useRef(null),
    rowRefs = useRef(new Map()),
    removeRefs = useRef(new Map()),
    addRef = useRef(null),
    dragSource = useRef(null);
  useEffect(() => {
    setMessage(null);
    setDragTarget(null);
  }, [groups, readOnly]);
  const rows = [...layers].reverse().map((item) => ({ item }));
  const dropTarget = (event, item) => {
    if (!dragSource.current || confirmation || readOnly || layers.some((i) => i.locked))
      return null;
    const moving = expandGroup(items, groups, [dragSource.current]);
    const targetIds = expandGroup(items, groups, [item.id]);
    if (targetIds.some((id) => moving.includes(id))) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const edge = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    const groupRows = rows.filter((row) => targetIds.includes(row.item.id));
    return { id: (edge === 'before' ? groupRows[0] : groupRows.at(-1)).item.id, edge };
  };
  const choose = (item, event) =>
    onSelect(item.id, multiple || event.shiftKey || event.ctrlKey || event.metaKey);
  const navigate = (event, id) => {
    const eligible = rows.filter((r) => !r.item.locked && r.item.visible).map((r) => r.item.id),
      index = eligible.indexOf(id);
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? eligible.length - 1
            : Math.max(
                0,
                Math.min(eligible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
              );
      rowRefs.current.get(eligible[next])?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClear();
    }
  };
  const remove = (id, event) =>
    onRemove(
      selectedIds.includes(id) && selected.length > 1
        ? selectedIds
        : expandGroup(items, groups, [id]),
      event.currentTarget,
      id,
    );
  const commitRemove = () => {
    onConfirmRemove();
    requestAnimationFrame(() => {
      (layerItems(items).length > confirmation.ids.length
        ? listRef.current
        : addRef.current
      )?.focus();
    });
  };
  const confirmationRow = confirmation?.rowId || confirmation?.ids[0];
  const cancelRowRemove = () => {
    const rowId = confirmation?.rowId;
    onCancelRemove();
    if (rowId) requestAnimationFrame(() => removeRefs.current.get(rowId)?.focus());
  };
  return (
    <section className="ds-studio-layers" aria-label="Layers inspector preview">
      <div className="ds-layer-summary">
        <span>
          {layers.length} layers
          {selected.length > 0 ? ' · ' + selected.length + ' selected' : ''}
        </span>
        <div>
          <Key
            label="Select multiple layers"
            icon={ListChecks}
            aria-pressed={multiple}
            onClick={() => setMultiple(!multiple)}
          />
          <Key
            label="Clear layer selection"
            icon={X}
            disabled={!selected.length}
            onClick={onClear}
          />
        </div>
      </div>
      {readOnly && (
        <p className="ds-layer-notice">Read-only example · editing is unavailable.</p>
      )}
      <div
        ref={listRef}
        tabIndex={-1}
        className="ds-studio-layer-list"
        role="group"
        aria-label="Layers, front to back"
      >
        {rows.map(({ item }) => {
          const membership = groupFor(items, groups, item.id);
          const key = item.id,
            active = selectedIds.includes(item.id);
          const label = nameOf(item),
            hidden = !item.visible;
          return (
            <div
              key={key}
              className="ds-layer-row"
              data-group={membership?.id}
              data-selected={active || undefined}
              data-hidden={hidden || undefined}
              data-drop={dragTarget?.id === key ? dragTarget.edge : undefined}
              data-layer-id={item.id}
              draggable={!confirmation && !readOnly && !layers.some((i) => i.locked)}
              onDragStart={(event) => {
                dragSource.current = item.id;
                event.dataTransfer.setData('text/x-inscape-preview-layer', item.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                const target = dropTarget(event, item);
                if (target) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
                setDragTarget(target);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragTarget(null);
              }}
              onDragEnd={() => {
                dragSource.current = null;
                setDragTarget(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const target = dropTarget(event, item);
                const source = dragSource.current;
                dragSource.current = null;
                setDragTarget(null);
                if (target) onDrop(source, target.id, target.edge);
              }}
            >
              {confirmationRow === item.id ? (
                <LayerRemovalConfirmation
                  inline
                  count={confirmation.ids.length}
                  onCancel={cancelRowRemove}
                  onConfirm={commitRemove}
                />
              ) : (
                <>
                  <span
                    className="ds-layer-indent"
                    title={membership ? 'Group ' + (groups.indexOf(membership) + 1) : undefined}
                  >
                    {membership && <Group size={12} aria-hidden="true" />}
                  </span>
                  <button
                    ref={(node) =>
                      node ? rowRefs.current.set(key, node) : rowRefs.current.delete(key)
                    }
                    type="button"
                    className="ds-layer-select"
                    aria-label={label}
                    aria-pressed={active}
                    disabled={item.locked || hidden}
                    onClick={(event) => choose(item, event)}
                    onKeyDown={(event) => navigate(event, key)}
                  >
                    <span className="ds-layer-thumb">
                      {item.kind === 'text' ? (
                        <Type size={18} aria-hidden="true" />
                      ) : (
                        <LayerArtwork item={item} />
                      )}
                    </span>
                    <span>{label}</span>
                  </button>
                  <Key
                    label={(hidden ? 'Show ' : 'Hide ') + item.name + ' in editor'}
                    icon={hidden ? EyeOff : Eye}
                    aria-pressed={hidden}
                    disabled={readOnly}
                    onClick={() => onToggle(item.id, 'visible')}
                  />
                  <Key
                    label={(item.locked ? 'Unlock ' : 'Lock ') + item.name}
                    icon={item.locked ? Lock : Unlock}
                    aria-pressed={item.locked}
                    disabled={readOnly}
                    onClick={() => onToggle(item.id, 'locked')}
                  />
                  <Key
                    buttonRef={(node) =>
                      node ? removeRefs.current.set(key, node) : removeRefs.current.delete(key)
                    }
                    label={'Remove ' + label + ' from Grid'}
                    icon={Trash2}
                    disabled={readOnly || item.locked}
                    onClick={(event) => remove(item.id, event)}
                  />
                </>
              )}
            </div>
          );
        })}
        {!layers.length && (
          <div className="ds-layer-empty">
            <Layers size={26} strokeWidth={1.2} aria-hidden="true" />
            <strong>No layers yet</strong>
            <p>Add artwork from Library or add text.</p>
          </div>
        )}
      </div>
      <div className="ds-layer-footer" role="group" aria-label="Layer commands">
        <button
          ref={addRef}
          type="button"
          className="workflow-tactile-control"
          disabled={readOnly}
          onClick={onAddText}
        >
          <Plus size={15} aria-hidden="true" />
          Add text
        </button>
        <Key
          label="Group layers"
          icon={Group}
          disabled={readOnly || !canGroup(items, groups, selectedIds)}
          onClick={onGroup}
        />
        <Key
          label="Ungroup layers"
          icon={Ungroup}
          disabled={!editable || !group}
          onClick={onUngroup}
        />
        {selected.length === 1 && selected[0].kind === 'text' && (
          <button
            type="button"
            className="workflow-tactile-control"
            disabled={!editable}
            onClick={() => onEditText(selected[0].id)}
          >
            Edit Text
          </button>
        )}
      </div>
      <p className="ds-layer-hint">
        {group
          ? 'Group selected. Ungroup to edit its layers separately.'
          : multiple
            ? 'Multiple selection on. Tap layers to add or remove them.'
            : 'Shift-click to select multiple layers.'}
      </p>
      <details className="ds-layer-spacing">
        <summary>Composition spacing</summary>
        <div>
          <label>
            Gutter <span>(canvas units)</span>
            <input
              aria-label="Composition gutter"
              type="number"
              min="0"
              max="32"
              step="any"
              value={gutter}
              disabled={readOnly}
              onChange={(event) => {
                setGutter(event.target.value);
                setMessage(null);
              }}
            />
          </label>
          <button
            type="button"
            className="workflow-tactile-control"
            disabled={
              readOnly || layers.length < 2 || layers.some((i) => i.locked || !i.visible)
            }
            onClick={() => {
              const result = onGutter(gutter);
              setMessage(result);
            }}
          >
            Apply to all
          </button>
        </div>
        {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
      </details>
      <small className="ds-layer-hint">
        Visibility affects the editor only. Publication is unchanged.
      </small>
    </section>
  );
}
