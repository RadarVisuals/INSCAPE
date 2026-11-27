import { useEffect, useRef, useState } from 'react';
import { useJsonDownload } from './useJsonDownload.js';

export default function WorkspaceRecoveryButton({ profile, disabled = false }) {
  const download = useJsonDownload(profile);
  const [message, setMessage] = useState('');
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function recover() {
    try {
      const { serializeWorkspaceRecovery } = await import('../systemWorkflow/workbenchBackup.js');
      if (!mounted.current) return;
      download(serializeWorkspaceRecovery(profile), `inscape-workspace-recovery-${profile.slice(2, 10)}.json`);
      setMessage('Check your downloads for the private recovery file before closing this tab.');
    } catch (error) { if (mounted.current) setMessage(error.message || 'The recovery file could not be created.'); }
  }
  return <><button type="button" disabled={disabled} onClick={recover}>Download tab recovery</button>{message && <span role="status"> {message}</span>}</>;
}
