import { useMemo, useState, useSyncExternalStore } from 'react';
import { createPresentationAssetReader } from '../presentation/presentationAssetReader.js';
import { receptionDisplayAssetIds } from '../presentation/presentationSources.js';
import { overviewAssetIds } from '../public/workbenchOverview/workbenchOverviewModel.js';
import ReceptionOverview from './ReceptionOverview.jsx';

export default function OwnerReceptionCollection({ snapshot, ...props }) {
  const ids = useMemo(() => [...new Set([...snapshot.entries.flatMap(entry => overviewAssetIds(entry.draft)),
    ...receptionDisplayAssetIds(snapshot, props.reception)])].sort(), [snapshot, props.reception]);
  return <ResolvedCollection key={`${snapshot.profileAddress}:${ids.join(',')}`} {...props} snapshot={snapshot} ids={ids} />;
}
function ResolvedCollection({ snapshot, ids, notice, onRetry, ...props }) {
  const [reader] = useState(() => createPresentationAssetReader(snapshot.profileAddress, ids));
  const { assets, status } = useSyncExternalStore(reader.subscribe, reader.getSnapshot);
  const failed = status === 'unavailable';
  return <ReceptionOverview {...props} snapshot={snapshot} assets={assets} assetStatus={status}
    notice={notice || (failed ? 'Some canvas artwork could not be loaded. Retry to load its source.' : undefined)}
    onRetry={onRetry || (failed ? reader.refresh : undefined)} />;
}
