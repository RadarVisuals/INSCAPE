import { Component, lazy, Suspense } from 'react';
import { loadOwnerRuntime } from './ownerRuntimeLoader.js';

const ModuleGridShell = lazy(loadOwnerRuntime);

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

export default function OwnerRuntimeBoundary({ ownerAuthoringEnabled, ...ownerProps }) {
  if (ownerAuthoringEnabled !== true) return null;
  return (
    <OwnerRuntimeErrorBoundary>
      <Suspense fallback={<OwnerRuntimeLoadingFallback />}>
        <ModuleGridShell ownerAuthoringEnabled={ownerAuthoringEnabled} {...ownerProps} />
      </Suspense>
    </OwnerRuntimeErrorBoundary>
  );
}
