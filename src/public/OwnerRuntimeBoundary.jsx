import { Component, lazy, Suspense } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { loadOwnerRuntime } from './ownerRuntimeLoader.js';
import AlphaSupportPanel from '../support/AlphaSupportPanel.jsx';
import { ALPHA_SUPPORT_CODES } from '../support/alphaSupport.js';

const SelectedOwnerRuntime = lazy(loadOwnerRuntime);

function OwnerRuntimeLoadingFallback() {
  return <div className="mode-loading" role="status">Opening owner workspace…</div>;
}

class OwnerRuntimeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <div className="mode-loading" role="alert">The owner workspace could not be loaded.
        <AlphaSupportPanel compact code={ALPHA_SUPPORT_CODES.UNEXPECTED_APPLICATION_ERROR}
          phase="OWNER_RUNTIME" routeClass="OWNER" message={this.state.error.message} />
      </div>;
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
