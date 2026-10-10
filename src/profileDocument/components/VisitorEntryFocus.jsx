import { useEffect } from 'react';
import { useWorkbenchActions, useWorkbenchView } from '../../public/ownerSystemWorkflow/WorkbenchViewContext.js';

// Wait for the destination's lazy module and its logical frame to register.
// Scope is the mounted visitor session; changing profile/target cancels this work.
export default function VisitorEntryFocus({ target }) {
  const { focusModules } = useWorkbenchActions();
  const { subscribe, entries, frames } = useWorkbenchView();
  useEffect(() => {
    if (!target || !subscribe) return;
    let frame = 0, complete = false;
    const schedule = () => {
      if (complete) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (entries.has(target.moduleId) && frames.get(target.moduleId)?.current
          && focusModules?.([target.moduleId])) { complete = true; unsubscribe(); }
      });
    };
    const unsubscribe = subscribe(schedule);
    schedule();
    return () => { complete = true; cancelAnimationFrame(frame); unsubscribe(); };
  }, [target?.moduleId, subscribe, entries, frames, focusModules]);
  return null;
}
