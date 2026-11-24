import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, RotateCcw } from 'lucide-react';
import useWorkbenchPan from '../public/ownerSystemWorkflow/useWorkbenchPan.js';
import { createReceptionPreviewPan } from './receptionPreviewPan.js';
import { projectReception } from '../profileDocument/domain/receptionPresentation.js';
import ReceptionDocumentCanvas from './ReceptionDocumentCanvas.jsx';
import ReceptionViewportControls from './ReceptionViewportControls.jsx';
import EditorToolbarPopover from '../public/ownerSystemWorkflow/EditorToolbarPopover.jsx';
import ReceptionPresentation from './ReceptionPresentation.jsx';
import { ReceptionButton as Button } from './ReceptionControls.jsx';
import '../public/ownerSystemWorkflow/workflowTokens.css';
import '../public/ownerSystemWorkflow/workflowTactile.css';
import '../public/ownerSystemWorkflow/workflowFlat.css';
import '../public/ownerSystemWorkflow/workbenchWindowChrome.css';
import './receptionPreview.css';
import ReceptionHeader from './ReceptionHeader.jsx';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';

const editorChrome = { 'data-workflow-material': 'tactile', 'data-workflow-finish': 'flat', 'data-workflow-palette': 'editor' };

export default function ReceptionRestorePreview({ reception, snapshot, onClose, label, actions }) {
  const [width, setWidth] = useState(null);
  const page = useRef(null), [pageWidth, setPageWidth] = useState(null);
  const panViewport = useRef(null), panPlane = useRef(null);
  const [pan] = useState(() => createReceptionPreviewPan({ getPlane: () => panPlane.current }));
  const { cancel: cancelPan } = useWorkbenchPan(panViewport, false, pan);
  useEffect(() => () => pan.dispose(), [pan]);
  const resetView = () => {
    cancelPan(); pan.reset();
    panViewport.current?.scrollTo({ left: 0, top: 0 });
  };
  useLayoutEffect(() => {
    const node = page.current, measure = () => setPageWidth(node.clientWidth);
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const shown = useMemo(() => projectReception(reception), [reception]);
  const previewControls = <div className="reception-preview-controls" role="group" aria-label="Preview controls" {...editorChrome}>
    <EditorToolbarPopover label="Restore preview controls" className="reception-preview-menu-trigger"
      panelClassName="reception-preview-menu" keepMounted trigger={<>Restore preview<ChevronDown size={14} aria-hidden="true" /></>}>
      <strong>Preview size</strong>
      <ReceptionViewportControls width={width} measuredWidth={pageWidth} onChange={setWidth} />
      <Button icon={RotateCcw} label="Reset preview position" onClick={event => {
        event.currentTarget.closest('[popover]')?.hidePopover();
        resetView();
      }}>Reset view</Button>
    </EditorToolbarPopover>
    <div className="reception-preview-back"><Button icon={ArrowLeft} label="Back to editing" onClick={onClose}>Back</Button></div>
  </div>;
  return <ReceptionPresentation snapshot={snapshot?.entries ? snapshot : undefined}>
    <section className="reception-document-preview system-workflow__token-scope" aria-label={label}
      data-workflow-material="tactile" data-workflow-finish="flat" data-system-workflow-overlay
      onKeyDownCapture={event => { if (actions && event.key === 'Escape' && !event.target.closest('dialog[open], [popover], [aria-haspopup="dialog"][aria-expanded="true"]')) {
        event.preventDefault(); event.stopPropagation(); onClose();
      } }}>
      {actions && <div className="reception-preview-restore">{actions}</div>}

      <div className="reception-document-preview-body">
        <div className="reception-document-preview-scroll"><div ref={page} className="reception-preview-page" style={{ width: width || undefined, '--reception-page-background': shown.backgroundColor || undefined,
          '--reception-bento-width': `${workbenchArea(shown.workbench).width}px` }}>
          <ReceptionHeader reception={shown} previewControls={previewControls} />
          <div ref={panViewport} tabIndex={-1} className="reception-preview-content" data-workbench-pan-surface
            aria-label="Preview canvas. Hold Space and drag to move the view.">
            <div ref={panPlane} className="reception-preview-pan-plane" data-workbench-pan-surface><ReceptionDocumentCanvas reception={shown} /></div>
          </div>
        </div></div>
      </div>
    </section>
  </ReceptionPresentation>;
}
