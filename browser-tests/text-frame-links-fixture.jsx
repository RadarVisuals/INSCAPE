import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchView, workbenchModuleTransform } from '../src/public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { TextFrameLinks } from '../src/text/LinkedTextFrames.jsx';

const subscribe = () => () => {}, snapshot = () => 0, transforms = {};
function Fixture() {
  const [entries] = useState(() => new Map());
  const [presentationTransforms, setPresentationTransforms] = useState({});
  const view = { entries, transforms, presentationTransforms, scale: 1, subscribe, snapshot };
  return <WorkbenchView.Provider value={view}>
    <button onClick={() => setPresentationTransforms({ a: { x: 40, y: 60, scale: 1 }, b: { x: -50, y: 100, scale: 1 } })}>Spread frames</button>
    <button onClick={() => setPresentationTransforms({})}>Return frames</button>
    {['a', 'b'].map((id, index) => {
      const local = workbenchModuleTransform(view, id);
      return <div key={id} data-frame={id} ref={node => { if (node) entries.set(id, node); else entries.delete(id); }}
        style={{ position: 'absolute', left: 100 + index * 250, top: 100, width: 180, height: 140,
          transform: `translate(${local.x}px, ${local.y}px)`, background: '#ddd' }}>Text frame {id}</div>;
    })}
    <TextFrameLinks ids={['a', 'b']} />
  </WorkbenchView.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
