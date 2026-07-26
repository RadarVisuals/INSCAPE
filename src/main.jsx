// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const prototypePath = window.location.pathname.replace(/\/+$/, '');
const prototypeRoute = import.meta.env.DEV && prototypePath === '/prototype/navigation-wall';
const worldTransitionRoute = import.meta.env.DEV && prototypePath === '/prototype/grid-to-world';
const inscapeScrambleRoute = import.meta.env.DEV && prototypePath === '/prototype/inscape-scramble';
const keeperDockRoute = import.meta.env.DEV && prototypePath === '/prototype/keeper-dock';
const workspaceRailRoute = import.meta.env.DEV && prototypePath === '/prototype/workspace-rail';
const nftTableViewerRoute = import.meta.env.DEV && prototypePath === '/prototype/nft-table-viewer';
const NavigationWallPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./NavigationWallPrototype.jsx'))
  : null;
const GridToWorldPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./GridToWorldPrototype.jsx'))
  : null;
const InscapeScramblePrototype = import.meta.env.DEV
  ? React.lazy(() => import('./InscapeScramblePrototype.jsx'))
  : null;
const KeeperDockPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./KeeperDockPrototype.jsx'))
  : null;
const WorkspaceRailPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./WorkspaceRailPrototype.jsx'))
  : null;
const NftTableViewerPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./NftTableViewerPrototype.jsx'))
  : null;

const prototype = prototypeRoute && NavigationWallPrototype
  ? <NavigationWallPrototype />
  : worldTransitionRoute && GridToWorldPrototype
    ? <GridToWorldPrototype />
    : inscapeScrambleRoute && InscapeScramblePrototype
      ? <InscapeScramblePrototype />
      : keeperDockRoute && KeeperDockPrototype
        ? <KeeperDockPrototype />
        : workspaceRailRoute && WorkspaceRailPrototype
          ? <WorkspaceRailPrototype />
          : nftTableViewerRoute && NftTableViewerPrototype
            ? <NftTableViewerPrototype />
        : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {prototype
      ? <React.Suspense fallback={<div className="mode-loading">Opening prototype...</div>}>{prototype}</React.Suspense>
      : <App />}
  </React.StrictMode>,
);
