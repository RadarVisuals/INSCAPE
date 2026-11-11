import { useState } from 'react';
import { useWalletStore } from '../store/useWalletStore.js';
import {
  CREEPS_COLLECTION_ADDRESS,
  CREEPS_METADATA_CID,
  CREEPS_METADATA_KEYS,
  CREEPS_METADATA_VALUES,
  CREEPS_OWNER_PROFILE,
  CREEPS_READ_ABI,
  CREEPS_SET_DATA_BATCH_ABI,
  sameCreepsMetadataValues,
} from './creepsMetadataRecovery.js';
import './creepsMetadataRecovery.css';

const sameAddress = (left, right) => typeof left === 'string' && typeof right === 'string'
  && left.toLowerCase() === right.toLowerCase();

function messageFromError(error) {
  if (error?.code === 4001) return 'The wallet request was rejected. Nothing changed.';
  return String(error?.shortMessage || error?.message || 'The update failed.');
}

export default function CreepsMetadataRecoveryPanel({ onRequestSignIn }) {
  const walletClient = useWalletStore((state) => state.walletClient);
  const publicClient = useWalletStore((state) => state.publicClient);
  const profileAddress = useWalletStore((state) => state.hostProfileAddress);
  const connected = useWalletStore((state) => state.isWalletConnected);
  const ownerVerified = useWalletStore((state) => state.isHostProfileOwner);
  const chainId = useWalletStore((state) => state.chainId);
  const authorityStatus = useWalletStore((state) => state.authorityLifecycleStatus);
  const [status, setStatus] = useState({
    phase: 'ready', message: 'Prepared and mainnet-simulated. No transaction has been sent.',
  });
  const expectedProfile = sameAddress(profileAddress, CREEPS_OWNER_PROFILE);
  const canSubmit = connected && ownerVerified && expectedProfile && chainId === '0x2a'
    && walletClient && publicClient && status.phase !== 'submitting';

  const submit = async () => {
    if (!canSubmit) return;
    const approved = window.confirm(
      `Update CREEPS collection metadata on LUKSO mainnet?\n\nCollection: ${CREEPS_COLLECTION_ADDRESS}\nMetadata CID: ${CREEPS_METADATA_CID}\n\nYour wallet will request one transaction.`,
    );
    if (!approved) return;

    setStatus({ phase: 'submitting', message: 'Rechecking owner and current on-chain values…' });
    try {
      const [contractOwner, ...currentValues] = await Promise.all([
        publicClient.readContract({
          address: CREEPS_COLLECTION_ADDRESS, abi: CREEPS_READ_ABI, functionName: 'owner',
        }),
        ...CREEPS_METADATA_KEYS.map((key) => publicClient.readContract({
          address: CREEPS_COLLECTION_ADDRESS, abi: CREEPS_READ_ABI, functionName: 'getData', args: [key],
        })),
      ]);
      if (!sameAddress(contractOwner, CREEPS_OWNER_PROFILE)) {
        throw new Error('The live collection owner no longer matches the expected Universal Profile.');
      }
      if (sameCreepsMetadataValues(currentValues)) {
        setStatus({ phase: 'complete', message: 'The repaired metadata is already active on-chain.' });
        return;
      }

      setStatus({ phase: 'submitting', message: 'Opening the wallet confirmation…' });
      const account = walletClient.account;
      const { request } = await publicClient.simulateContract({
        address: CREEPS_COLLECTION_ADDRESS,
        abi: CREEPS_SET_DATA_BATCH_ABI,
        functionName: 'setDataBatch',
        args: [CREEPS_METADATA_KEYS, CREEPS_METADATA_VALUES],
        account,
      });
      const hash = await walletClient.writeContract({ ...request, account });
      setStatus({
        phase: 'submitting', message: `Transaction submitted: ${hash}. Waiting for confirmation…`, hash,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt.status !== 'success') throw new Error(`Transaction ${hash} reverted.`);

      const confirmedValues = await Promise.all(CREEPS_METADATA_KEYS.map((key) => publicClient.readContract({
        address: CREEPS_COLLECTION_ADDRESS, abi: CREEPS_READ_ABI, functionName: 'getData', args: [key],
      })));
      if (!sameCreepsMetadataValues(confirmedValues)) {
        throw new Error('The transaction confirmed, but the live metadata values do not match the prepared repair.');
      }
      setStatus({
        phase: 'complete', message: `CREEPS metadata repaired and verified on-chain. Transaction: ${hash}`, hash,
      });
    } catch (error) {
      setStatus({ phase: 'error', message: messageFromError(error) });
    }
  };

  return <main className="creeps-recovery">
    <section className="creeps-recovery__panel" aria-labelledby="creeps-recovery-title">
      <p className="creeps-recovery__eyebrow">LUKSO MAINNET · RECOVERY CONTROL</p>
      <h1 id="creeps-recovery-title">CREEPS icon correction</h1>
      <dl>
        <div><dt>Collection</dt><dd>{CREEPS_COLLECTION_ADDRESS}</dd></div>
        <div><dt>Required profile</dt><dd>{CREEPS_OWNER_PROFILE}</dd></div>
        <div><dt>Metadata CID</dt><dd>{CREEPS_METADATA_CID}</dd></div>
        <div><dt>Connected profile</dt><dd>{profileAddress || (authorityStatus === 'pending' ? 'Resolving…' : 'Not connected')}</dd></div>
      </dl>
      <p className={`creeps-recovery__status creeps-recovery__status--${status.phase}`} role="status">{status.message}</p>
      {!connected
        ? <button type="button" onClick={onRequestSignIn}>Connect Universal Profile</button>
        : <button type="button" disabled={!canSubmit} onClick={submit}>Add CREEPS icon</button>}
      {connected && !expectedProfile && <p className="creeps-recovery__warning">Connect the Universal Profile that owns this collection.</p>}
      <p className="creeps-recovery__note">This writes one ERC725Y key in one transaction: collection-level LSP4 metadata containing the verified icon and cover. The repaired token metadata base URI remains untouched.</p>
    </section>
  </main>;
}
