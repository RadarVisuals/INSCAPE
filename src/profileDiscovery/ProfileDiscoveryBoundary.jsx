import { Component, lazy, Suspense } from 'react';

const ProfileDiscovery = lazy(() => import('./ProfileDiscovery.jsx'));

class DirectoryChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (this.state.failed) return <div className="mode-loading" role="alert">The INSCAPE directory could not be loaded.
      <button type="button" onClick={this.props.onClose}>Close</button></div>;
    return this.props.children;
  }
}

export default function ProfileDiscoveryBoundary(props) {
  return <DirectoryChunkErrorBoundary onClose={props.onClose}><Suspense fallback={null}>
    <ProfileDiscovery {...props} />
  </Suspense></DirectoryChunkErrorBoundary>;
}
