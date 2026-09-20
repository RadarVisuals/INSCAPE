import React from 'react';
import { createRoot } from 'react-dom/client';
import Board from '../src/public/ownerSystemWorkflow/PresentationBoardDefinitive.jsx';
import { WorkbenchWindow } from '../src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { WorkbenchPlacement } from '../src/public/ownerSystemWorkflow/WorkbenchPlacement.jsx';
import { WorkbenchViewProvider, WorkbenchViewControls } from '../src/public/ownerSystemWorkflow/WorkbenchView.jsx';
import Settings from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowSettings.jsx';
import Grid from '../src/public/ownerSystemWorkflow/WorkbenchAlignmentGrid.jsx';
import { DEFAULT_WORKBENCH_PREFERENCES } from '../src/public/ownerSystemWorkflow/workbenchPreferences.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

export function mount(width) {
  function App() {
    const hostRef = React.useRef(null);
    const [preferences, setPreferences] = React.useState({ ...DEFAULT_WORKBENCH_PREFERENCES, shortcutSnap: false, surfaceId: 'carbon' });
    const [settings, setSettings] = React.useState(false), [target, setTarget] = React.useState(true);
    window.snapFixture = { setPreferences: patch => setPreferences(p => ({ ...p, ...patch })), setSettings, setTarget };
    const content = <div style={{ width: '100%', height: '100%', background: '#383f43' }}>
      <svg viewBox="0 0 320 180" width="100%" height="100%" style={{ display: 'block' }}>
        <circle cx="160" cy="90" r="58" fill="#aab6b7" /><circle cx="160" cy="90" r="27" fill="#252b2e" />
      </svg></div>;
    return <WorkbenchViewProvider><WorkbenchPlacement hostRef={hostRef} enabled={preferences.edgeSnap} gridEnabled={preferences.shortcutSnap} gap={preferences.moduleGap}>
      <main ref={hostRef} tabIndex={-1} className="system-workflow" data-surface="carbon" data-lattice-menu-surface data-menu-surface="carbon" style={{ position: 'fixed', inset: 0 }}>
        <Grid hostRef={hostRef} mode="LINES" /><WorkbenchViewControls hostRef={hostRef} />
        <div className="system-workflow__display-instance" data-display-instance="moving" data-active-display>
          <Board profileAddress="snap-test" instanceId="moving" documentGeometry={{ columns: 32, rows: 18 }} reducedMotion
            initialPresentation={{ name: 'Moving', shortcut: { visible: true, position: { left: 24, top: 24 } }, window: { left: 48, top: 360, width: 320, height: 180 } }} windowSnap={preferences.shortcutSnap}>{content}</Board>
        </div>
        {target && <div className="system-workflow__display-instance" data-display-instance="target">
          <Board profileAddress="snap-test" instanceId="target" documentGeometry={{ columns: 32, rows: 18 }} reducedMotion
            initialPresentation={{ name: 'Target', window: { left: width === 1440 ? 640 : 420, top: 96, width: 320, height: 180 } }} windowSnap={preferences.shortcutSnap}>{content}</Board>
        </div>}
        <WorkbenchWindow label="Text" title="Snap sample" viewId="text" placementModule resizableWidth
          initialX={60} initialY={690} width={240} initialHeight={200} snapToGrid={preferences.shortcutSnap}>
          <p>A window can align to an edge, a grid line, or the chosen space between modules.</p>
        </WorkbenchWindow>
        {settings && <Settings appearance={{ surfaceId: 'carbon', guideMode: 'NONE', guideSize: 0, guideColor: '#888888' }}
          controller={{ draft: { profileAddress: 'snap-test' }, setAppearance() {} }} phase="open" workbenchPreferences={preferences}
          onWorkbenchPreferencesChange={patch => setPreferences(p => ({ ...p, ...patch }))} onClose={() => setSettings(false)} />}
      </main>
    </WorkbenchPlacement></WorkbenchViewProvider>;
  }
  createRoot(document.getElementById('root')).render(<App />);
}
