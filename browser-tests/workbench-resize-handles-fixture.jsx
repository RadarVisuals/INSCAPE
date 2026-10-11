import React from 'react';
import { createRoot } from 'react-dom/client';
import ImageWindow from '../src/imageModule/ImageWindow.jsx';
import { WorkbenchWindow } from '../src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import Board from '../src/public/ownerSystemWorkflow/PresentationBoardDefinitive.jsx';
import { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView } from '../src/public/ownerSystemWorkflow/WorkbenchView.jsx';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';
import '../src/imageModule/imageModule.css';
import '../src/shapes/shapes.css';
import '../src/text/text.css';

export function mount() {
  function App() {
    const view = useWorkbenchView(), host = React.useRef(null);
    const [sample, setSample] = React.useState({ kind: 'Image', version: 0, left: 64, top: 120, width: 240, height: 180 });
    const [image, setImage] = React.useState(sample);
    window.resizeFixture = {
      show(kind, scale = 1, extra = {}) {
        const next = { kind, version: sample.version + 1, left: 64 / scale, top: 120 / scale, width: 240, height: 180, ...extra };
        view.setSelection([]); view.setTransforms({}); view.setScale(scale); setSample(next); setImage(next);
      },
      select: () => view.setSelection(['sample']),
    };
    return <main ref={host} tabIndex={-1} className="system-workflow" data-surface="slate" data-lattice-menu-surface data-menu-surface="carbon">
      <WorkbenchViewControls hostRef={host} />
      {sample.kind === 'Image' ? <ImageWindow key={sample.version} id="sample" title="Handle sample" position={image} size={image} fitScale={1}
        active editable onClose={() => {}} onPosition={position => setImage(value => ({ ...value, ...position }))}
        onResize={(size, position) => setImage(value => ({ ...value, ...size, ...position }))}>
        {() => <button className="image-module__canvas" style={{ background: '#202828' }}>Image</button>}
      </ImageWindow> : sample.kind === 'Display' ? <Board key={sample.version} profileAddress="resize-handles" instanceId="sample"
        documentGeometry={{ columns: 32, rows: 18 }} reducedMotion initialPresentation={{ name: 'Handle sample', window: sample }}>
        <div style={{ width: '100%', height: '100%', background: '#202828' }}>Display</div>
      </Board> : <WorkbenchWindow key={sample.version} viewId="sample" label={sample.kind} title="Handle sample" active
        className={sample.kind === 'Shape' ? 'shape-window' : 'text-window'} chrome="bevel" resizableWidth minimumWidth={8} minimumHeight={8}
        initialX={sample.left} initialY={sample.top} width={sample.width} initialHeight={sample.height} moveFromContent>
        <div className={sample.kind === 'Shape' ? 'shape-fill' : ''} style={{ background: '#202828', minHeight: '100%' }}>{sample.kind}</div>
      </WorkbenchWindow>}
    </main>;
  }
  createRoot(document.getElementById('root')).render(<WorkbenchViewProvider><App /></WorkbenchViewProvider>);
}
