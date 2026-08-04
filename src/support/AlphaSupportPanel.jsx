import { useMemo, useState } from 'react';
import {
  ALPHA_SUPPORT_CODES,
  alphaRecoveryGuidance,
  createAlphaSupportEvidence,
  formatAlphaSupportEvidence,
} from './alphaSupport.js';
import './alphaSupport.css';

export default function AlphaSupportPanel({
  code = ALPHA_SUPPORT_CODES.ALPHA_SUPPORT_REQUEST,
  phase = 'GENERAL',
  providerCategory,
  profileAddress,
  transactionHash,
  message,
  compact = false,
}) {
  const [copyState, setCopyState] = useState('idle');
  const evidence = useMemo(() => createAlphaSupportEvidence({
    code, phase, providerCategory, profileAddress, transactionHash, message,
  }), [code, message, phase, profileAddress, providerCategory, transactionHash]);
  const report = useMemo(() => formatAlphaSupportEvidence(evidence), [evidence]);
  const recovery = alphaRecoveryGuidance(evidence.code, evidence.transactionHash);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return <section className="alpha-support" data-compact={compact || undefined} aria-label="Alpha support">
    <strong>ALPHA SUPPORT / {evidence.code}</strong>
    <p>{recovery}</p>
    <p>Send the copied details through the private channel where you received your Alpha invitation.</p>
    <button type="button" onClick={copy}>COPY SUPPORT DETAILS</button>
    {copyState === 'copied' && <span role="status">COPIED</span>}
    {copyState === 'failed' && <span role="alert">COPY FAILED - select the details below</span>}
    <details><summary>REVIEW DETAILS</summary><pre>{report}</pre></details>
    {!compact && <small>Invite-only experiment. Desktop authoring only. IPFS publication is public and permanent. Review screenshots for private information before sharing.</small>}
  </section>;
}
