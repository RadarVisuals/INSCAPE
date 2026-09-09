import { Component, createContext, useContext, useEffect } from 'react';

export const StartupDestinationContext = createContext(null);

// Report the first mounted, laid-out destination, not its optional media loads.
// Outside application startup (for example Preview) this is intentionally inert.
export function useStartupDestinationReady() {
  const onReady = useContext(StartupDestinationContext);
  useEffect(() => {
    if (!onReady) return undefined;
    const frame = requestAnimationFrame(onReady);
    return () => cancelAnimationFrame(frame);
  }, [onReady]);
}

export function StartupDestinationReady() {
  useStartupDestinationReady();
  return null;
}

export function StartupReloadButton() {
  return <button className="published-profile-retry" type="button" onClick={() => window.location.reload()}>RELOAD</button>;
}

export function StartupDestinationFailure({ title = 'WORLD COULD NOT BE OPENED', children }) {
  return <main className="published-profile-status" data-published-focus-fallback tabIndex={-1}
    data-lattice-menu-surface data-menu-surface="mist" aria-label={title}>
    <StartupDestinationReady />
    <section className="published-profile-status__card" role="alert">
      <header><span>INSCAPE</span><h1>{title}</h1></header>
      <div className="published-profile-status__body">
        <p>The interface could not finish loading. Reload to try again.</p>
        <div className="published-profile-actions"><StartupReloadButton /></div>
        {children}
      </div>
    </section>
  </main>;
}

export class StartupDestinationBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <StartupDestinationFailure />;
  }
}
