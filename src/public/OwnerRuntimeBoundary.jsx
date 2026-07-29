import { Component, lazy, Suspense } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { loadOwnerRuntime } from './ownerRuntimeLoader.js';

const SelectedOwnerRuntime = lazy(loadOwnerRuntime);

function OwnerRuntimeLoadingFallback() {
  return <div className="mode-loading" role="status">Opening owner workspace…</div>;
}

class OwnerRuntimeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <div className="mode-loading" role="alert">The owner workspace could not be loaded.</div>;
    }
    return this.props.children;
  }
}

export function ownerRuntimeProfileKey(workspaceProfileAddress, viewedProfileAddress) {
  const workspace = normalizeProfileAddress(workspaceProfileAddress);
  const viewed = normalizeProfileAddress(viewedProfileAddress);
  return workspace && workspace === viewed ? workspace : null;
}

export default function OwnerRuntimeBoundary({ ownerAuthoringEnabled, ...ownerProps }) {
  if (ownerAuthoringEnabled !== true) return null;
  const profileKey = ownerRuntimeProfileKey(
    ownerProps.workspaceProfileAddress,
    ownerProps.viewedProfileAddress,
  );
  if (!profileKey) return null;
  return (
    <OwnerRuntimeErrorBoundary key={profileKey}>
      <Suspense fallback={<OwnerRuntimeLoadingFallback />}>
        <SelectedOwnerRuntime
          key={profileKey}
          ownerAuthoringEnabled={ownerAuthoringEnabled}
          {...ownerProps}
        />
      </Suspense>
    </OwnerRuntimeErrorBoundary>
  );
}
