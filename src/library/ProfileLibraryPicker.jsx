import { useCallback, useState, useSyncExternalStore } from 'react';
import LibraryWorkspace from '../public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx';
import ToolPanel from '../ui/ToolPanel.jsx';
import './profileLibraryPicker.css';

const subscribeNone = () => () => {};

// The host supplies explicit receivers. Browsing, click/drag threshold, fading,
// cancellation and asynchronous destination capture are the Workbench's path.
export default function ProfileLibraryPicker({ library, menuSurface, onClose, placementScope, placementTargetRef, preferences, framePreferences, boundsRef, initialTop = 16, selectionEnabled, active, onActivate, onPlacingChange }) {
  const [localFrames, setLocalFrames] = useState({}), [placing, setPlacing] = useState(false);
  const frames = useSyncExternalStore(framePreferences?.subscribe || subscribeNone, framePreferences?.getSnapshot || (() => localFrames));
  const [initial] = useState(() => ({ left: 16, top: initialTop,
    width: Math.min(480, Math.max(300, (boundsRef?.current?.clientWidth || innerWidth) * .4)),
    height: Math.min(640, (boundsRef?.current?.clientHeight || innerHeight) - initialTop - 16,
      Math.max(300, (boundsRef?.current?.clientHeight || innerHeight) * .72)) }));
  const updateFrame = change => {
    const update = current => ({ ...current, library: typeof change === 'function' ? change(current.library || initial) : change });
    if (framePreferences) framePreferences.update(update); else setLocalFrames(update);
  };
  const handlePlacing = useCallback(next => { setPlacing(next); onPlacingChange?.(next); }, [onPlacingChange]);
  return <ToolPanel title="Library" label="Library" closeLabel="Close Library" onClose={onClose} chrome="flat"
    className={`reception-library-window workbench-tool-controls${placing ? ' is-placing' : ''}`}
    frame={frames.library || initial} onFrameChange={updateFrame} boundsRef={boundsRef} active={active} onActivate={onActivate}
    minimumWidth={280} minimumHeight={300}>
    {renderHeader => <>{renderHeader()}<LibraryWorkspace className="reception-library" label="Choose Reception image" phase="open" resizable={false} overlayPlacement
      data={library.libraryData} categoryCommands={library.categoryCommands} menuSurface={menuSurface}
      placementScope={placementScope} placementTargetRef={placementTargetRef} preferenceStore={preferences}
      selectionAction="Use selected image" selectionEnabled={selectionEnabled} onPlacingChange={handlePlacing} /></>}
  </ToolPanel>;
}
