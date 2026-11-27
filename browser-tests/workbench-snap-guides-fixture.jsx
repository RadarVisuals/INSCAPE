import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchWindow } from '../src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { WorkbenchPlacement } from '../src/public/ownerSystemWorkflow/WorkbenchPlacement.jsx';
import { WorkbenchViewProvider, WorkbenchViewControls } from '../src/public/ownerSystemWorkflow/WorkbenchView.jsx';
import Settings from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowSettings.jsx';
import { useWorkbenchCamera } from '../src/public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import Grid from '../src/public/ownerSystemWorkflow/WorkbenchAlignmentGrid.jsx';
import { DEFAULT_WORKBENCH_PREFERENCES } from '../src/public/ownerSystemWorkflow/workbenchPreferences.js';
import '../src/index.css';
import '../src/shapes/shapes.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

function GridOrigin() {
  const { offset } = useWorkbenchCamera();
  return <output hidden data-grid-left={offset.x} data-grid-top={offset.y} />;
}

export function mount(width) {
  function App() {
    const hostRef = React.useRef(null);
    const [preferences, setPreferences] = React.useState({ ...DEFAULT_WORKBENCH_PREFERENCES, surfaceId: 'carbon' });
    const [settings, setSettings] = React.useState(false), [target, setTarget] = React.useState(true);
    const [movingActive, setMovingActive] = React.useState(false);
    window.snapFixture = { setMovingActive, setPreferences: patch => setPreferences(p => ({ ...p, ...patch })), setSettings, setTarget };
    const content = <div style={{ width: '100%', height: '100%', background: '#383f43' }}>
      <svg viewBox="0 0 320 180" width="100%" height="100%" style={{ display: 'block' }}>
        <circle cx="160" cy="90" r="58" fill="#aab6b7" /><circle cx="160" cy="90" r="27" fill="#252b2e" />
      </svg></div>;
    return <WorkbenchViewProvider><WorkbenchPlacement hostRef={hostRef} enabled={preferences.edgeSnap} gridEnabled={preferences.shortcutSnap} gap={preferences.moduleGap}>
      <main ref={hostRef} tabIndex={-1} className="system-workflow" data-surface="carbon" data-lattice-menu-surface style={{ position: 'fixed', inset: 0 }}>
        <GridOrigin /><Grid hostRef={hostRef} mode="LINES" /><WorkbenchViewControls hostRef={hostRef} />
        <WorkbenchWindow label="Shape" className="shape-window" chrome="bevel" moveFromContent title="Moving" active={movingActive} viewId="moving" placementModule resizableWidth
          initialX={48} initialY={360} width={320} initialHeight={180} snapToGrid={preferences.shortcutSnap}>
          {content}
        </WorkbenchWindow>
        {target && <WorkbenchWindow label="Shape" className="shape-window" chrome="bevel" moveFromContent title="Target" viewId="target" placementModule resizableWidth
          initialX={width === 1440 ? 640 : 420} initialY={96} width={320} initialHeight={180} snapToGrid={preferences.shortcutSnap}>
          {content}
        </WorkbenchWindow>}
        <WorkbenchWindow label="Text" title="Snap sample" viewId="text" placementModule resizableWidth
          initialX={60} initialY={690} width={240} initialHeight={200} snapToGrid={preferences.shortcutSnap}>
          <p>A window can align to an edge, a grid line, or the chosen space between modules.</p>
        </WorkbenchWindow>
        {settings && <Settings profileAddress="snap-test" phase="open" workbenchPreferences={preferences}
          onWorkbenchPreferencesChange={patch => setPreferences(p => ({ ...p, ...patch }))} onClose={() => setSettings(false)} />}
      </main>
    </WorkbenchPlacement></WorkbenchViewProvider>;
  }
  createRoot(document.getElementById('root')).render(<App />);
}
