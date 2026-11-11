import { lazy, Suspense, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { artworkModuleId, artworkRecords } from '../../systemWorkflow/domain/artworkLayers.js';
import { commitWorkbenchSelectionResize } from '../../systemWorkflow/resizeWorkbenchSelection.js';
import { MetadataDockContent, useSharedDisplayTools } from './SharedDisplayTools.jsx';
import { useEditorCells } from '../../reception/EditorCellsContext.jsx';
import { useSharedTextTools, SharedTextToolsInspectorContent } from '../../text/SharedTextTools.jsx';
import InspectorColourPreferences from '../../colour/InspectorColourPreferences.jsx';
import './workbenchSharedTools.css';

const EditorCellPositionControls = lazy(() => import('../../reception/EditorCellPositionControls.jsx'));

function TransformControls({ id, blocked, linkable, aspect, onLinkChange }) {
  const view = useWorkbenchView(), { editingBounds } = useWorkbenchArea();
  const [error, setError] = useState('');
  const target = view.resizeTargets.get(id)?.current;
  const base = view.frames.get(id)?.current, transform = view.transforms[id];
  const frame = base && (transform?.frame || { left: base.left * (transform?.scale || 1) + (transform?.x || 0), top: base.top * (transform?.scale || 1) + (transform?.y || 0), width: base.width * (transform?.scale || 1), height: base.height * (transform?.scale || 1) });
  if (!frame || !target) return <p className="workbench-tools-empty">Open this artwork to edit its dimensions.</p>;
  const disabled = Boolean(blocked || !target.enabled || view.presentationTransforms[id]);
  const fields = [
    ['left', 'X', editingBounds.left, editingBounds.right - frame.width],
    ['top', 'Y', editingBounds.top, editingBounds.bottom - frame.height],
    ['width', 'Width', target.minimumWidth || target.minimumSize || 1, Math.min(target.maximumWidth || 7992, editingBounds.right - frame.left)],
    ['height', 'Height', target.minimumHeight || target.minimumSize || 1, Math.min(target.maximumHeight || 7992, editingBounds.bottom - frame.top)],
  ];
  const change = (name, input) => {
    if (disabled) return;
    if (input.value === input.defaultValue) { setError(''); return; }
    if (input.value === '' || !input.validity.valid) { input.reportValidity(); return; }
    const value = input.valueAsNumber;
    if (value === frame[name]) { setError(''); return; }
    let next = { ...frame, [name]: value };
    if (linkable && aspect && (name === 'width' || name === 'height')) {
      const other = name === 'width' ? 'height' : 'width';
      next[other] = Math.round(name === 'width' ? value / aspect : value * aspect);
      if (fields.some(([key, , min, max]) => next[key] < min || next[key] > max)) {
        setError('This linked size exceeds the available space. Use a smaller size or unlink the proportions.');
        return;
      }
    }
    if (name === 'width' || name === 'height') next = target.constrainFrame?.(next, { bounds: editingBounds }) || next;
    if (commitWorkbenchSelectionResize([{ ...target, id, ...next, getPresentation: view.getPresentation, reportError: message => { setError(message); target.reportError?.(message); } }])) {
      view.setTransforms(current => { const updated = { ...current }; delete updated[id]; return updated; });
      target.applyFrame(next); setError('');
    }
  };
  const field = ([name, label, min, max], prefix) => <label key={name}><span>{prefix}</span><input key={`${id}:${frame[name]}`} aria-label={`Transform ${label}`} type="number" step={target.layoutKey === 'imageModules' && ['width', 'height'].includes(name) ? 1 : 'any'} min={min} max={max}
      disabled={disabled} defaultValue={Math.round(frame[name] * 1000) / 1000} onBlur={event => change(name, event.currentTarget)}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { event.currentTarget.value = frame[name]; event.currentTarget.blur(); } }} /></label>;
  return <>
    <div className="workbench-inspector-row"><span>Position</span><div className="workbench-inspector-fields">{field(fields[0], 'X')}{field(fields[1], 'Y')}</div></div>
    <div className="workbench-inspector-row"><span>Size</span><div className="workbench-inspector-fields">
      {field(fields[2], 'W')}
      {linkable && <button type="button" className="workflow-tactile-control" aria-label="Keep proportions" title={aspect ? 'Unlink width and height' : 'Link width and height'} aria-pressed={Boolean(aspect)} disabled={disabled}
        onClick={() => { onLinkChange(aspect ? null : frame.width / frame.height); setError(''); }}><Link2 /></button>}
      {field(fields[3], 'H')}
    </div></div>
    {(error || blocked) && <p role="alert">{error || blocked}</p>}
  </>;
}

export function WorkbenchInspectorTitle() {
  const view = useWorkbenchView();
  const cells = useEditorCells(), textTools = useSharedTextTools();
  useSyncExternalStore(view.subscribe, view.snapshot);
  const ids = [...new Set(view.selection.map(id => artworkModuleId(view.content, id)))];
  const record = ids.length === 1 && artworkRecords(view.content).find(item => item.id === ids[0]);
  return record ? `${cells?.cells.some(cell => cell.id === record.id) ? 'Cell' : record.key === 'imageModules' ? 'Image' : record.key === 'texts' ? 'Text' : record.key === 'shapes' ? 'Shape' : 'Artwork'} · ${record.name || 'Untitled'}`
    : textTools?.open && textTools.source?.targetId === textTools.activeModuleId ? `Text · ${textTools.source.label || 'Article'}` : 'Inspector';
}

// Sections move together with their host; module controls retain their own state.
function InspectorSection({ name, title = name, requestedSection, request, open = false, onExpand, children }) {
  const element = useRef(null);
  const previousRequest = useRef(-1);
  const [localOpen, setExpanded] = useState(open || requestedSection === name);
  const controlled = Boolean(onExpand);
  const expanded = controlled ? requestedSection === name : localOpen;
  useLayoutEffect(() => {
    if (requestedSection !== name) return;
    if (!controlled) setExpanded(true);
    if (!request || previousRequest.current === request) return;
    // Let the metadata portal populate before scrolling to its heading.
    const frame = requestAnimationFrame(() => {
      element.current?.scrollIntoView({ block: controlled ? 'start' : 'nearest' });
      previousRequest.current = request;
    });
    return () => cancelAnimationFrame(frame);
  }, [name, requestedSection, request, controlled]);
  return <details ref={element} className="workbench-inspector-section" open={expanded} data-inspector-section={name}
    onToggle={onExpand ? undefined : event => setExpanded(event.currentTarget.open)}>
    <summary onClick={onExpand ? event => { event.preventDefault(); onExpand(!expanded); } : undefined}>{title}<ChevronRight aria-hidden="true" /></summary>{(!onExpand || expanded) && children}
  </details>;
}

export default function WorkbenchSharedTools({ visible, historyBlocked, requestedSection, request, colourPreference }) {
  const view = useWorkbenchView();
  const displayTools = useSharedDisplayTools();
  const cellContext = useEditorCells(), textTools = useSharedTextTools();
  const element = useRef(null);
  // Local inspector preferences survive moving/closing the host and crop mode.
  // Capture the linked ratio once, so rounded pixel edits do not accumulate drift.
  // It never becomes authored Image data or a second geometry store.
  const [links, setLinks] = useState(() => new Map());
  useSyncExternalStore(view.subscribe, view.snapshot);
  useSyncExternalStore(view.subscribeTools, view.toolsSnapshot);
  const selected = view.selection, id = selected.length === 1 ? selected[0] : null;
  const moduleIds = [...new Set(selected.map(id => artworkModuleId(view.content, id)))];
  const moduleId = moduleIds.length === 1 ? moduleIds[0] : null;
  const record = artworkRecords(view.content).find(item => item.id === moduleId);
  // Display owns its placement selection and is not an artworkRecords entry.
  const displayInformation = !record && displayTools.getTool('metadata');
  const articleTarget = !record && textTools?.open && textTools.source?.targetId === textTools.activeModuleId ? textTools.activeModuleId : null;
  const source = view.toolSources.get(moduleId)?.current;
  const linkKey = `${view.profileAddress}:${id}`;
  useLayoutEffect(() => {
    if (visible && ['Image', 'Text', 'Shape', 'Cell', 'Contents'].includes(requestedSection)) element.current.scrollTop = 0;
  }, [visible, requestedSection, request, moduleId, record?.key]);
  if (!visible) return null;
  const section = (name, children, title = name, open = false) => <InspectorSection key={`${moduleId || displayTools.target}:${name}`} {...{ name, title, requestedSection, request, open }}
    onExpand={name === 'Info' ? expanded => displayTools.command('metadata', expanded) : undefined}>{children}</InspectorSection>;
  const transform = id && section('Transform', <TransformControls key={id} id={id} blocked={historyBlocked} linkable={['imageModules', 'texts', 'shapes'].includes(record?.key) && record?.record?.kind !== 'grid'} aspect={links.get(linkKey)}
    onLinkChange={ratio => setLinks(current => { const next = new Map(current); if (ratio) next.set(linkKey, ratio); else next.delete(linkKey); return next; })} />, 'Transform', record?.key !== 'shapes');
  const information = section('Info', <MetadataDockContent />, 'Artwork info');
  const owner = cellContext?.cells.find(cell => cell.members.includes(moduleId));
  const position = owner && section('Position', <Suspense fallback={null}><EditorCellPositionControls key={moduleId} cellId={owner.id} memberIds={[moduleId]} disabled={Boolean(historyBlocked)} /></Suspense>, 'Position in cell', true);
  const color = source?.color && section('Color', source.color, 'Color', true);
  return <InspectorColourPreferences preference={colourPreference}><div ref={element} className="workbench-inspector" data-workbench-inspector key={moduleId || 'selection'}>
    {articleTarget ? <><SharedTextToolsInspectorContent targetId={articleTarget} />{information}</>
      : displayInformation ? information
      : !selected.length ? <p className="workbench-tools-empty">Select a cell or artwork to see its settings.</p>
      : !record ? <p className="workbench-tools-empty">Select one artwork to edit its settings.</p>
      : source?.cell ? source.cell({ section, requestedSection, request, historyBlocked })
      : record.key === 'texts' && source?.text ? source.text({ transform, color, position, information })
      : record.key === 'imageModules' && source?.image ? source.image({ transform, position, information })
      : record.key === 'shapes' && source?.shape ? source.shape({ section, transform, position, information })
      : <>{color}{transform}{information}</>}
    {id && record && !view.frames.has(id) && <button className="workflow-tactile-control" type="button" onClick={() => view.openArtwork(moduleId)}>Open artwork</button>}
  </div></InspectorColourPreferences>;
}
