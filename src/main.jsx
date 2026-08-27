// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const prototypePath = window.location.pathname.replace(/\/+$/, '');
const prototypeRoute = import.meta.env.DEV && prototypePath === '/prototype/navigation-wall';
const worldTransitionRoute = import.meta.env.DEV && prototypePath === '/prototype/grid-to-world';
const keeperDockRoute = import.meta.env.DEV && prototypePath === '/prototype/keeper-dock';
const workspaceRailRoute = import.meta.env.DEV && prototypePath === '/prototype/workspace-rail';
const nftTableViewerRoute = import.meta.env.DEV && prototypePath === '/prototype/nft-table-viewer';
const latticeEngineRoute = import.meta.env.DEV && prototypePath === '/prototype/lattice-engine';
const modul8rRoute = import.meta.env.DEV && prototypePath === '/prototype/modul-8r';
const spiderKeeperRoute = import.meta.env.DEV && prototypePath === '/prototype/spider-keeper';
const gridWalkerRoute = import.meta.env.DEV && prototypePath === '/prototype/grid-walker';
const systemWorkflowDevelopmentRoute = import.meta.env.DEV
  && prototypePath === '/development/owner/system-workflow';
const NavigationWallPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./NavigationWallPrototype.jsx'))
  : null;
const GridToWorldPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./GridToWorldPrototype.jsx'))
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
const LatticeEnginePrototype = import.meta.env.DEV
  ? React.lazy(() => import('./LatticeEnginePrototype.jsx'))
  : null;
const Modul8rPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./prototypes/modul8r/Modul8rPrototype.jsx'))
  : null;
const SpiderKeeperPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./prototypes/spider-keeper/SpiderKeeperPrototype.jsx'))
  : null;
const GridWalkerPrototype = import.meta.env.DEV
  ? React.lazy(() => import('./prototypes/grid-walker/GridWalkerPrototype.jsx'))
  : null;
const OwnerSystemWorkflowDevelopmentEntrance = import.meta.env.DEV
  ? React.lazy(() => import('./public/ownerSystemWorkflow/OwnerSystemWorkflowDevelopmentEntrance.jsx'))
  : null;

const prototype = prototypeRoute && NavigationWallPrototype
  ? <NavigationWallPrototype />
  : worldTransitionRoute && GridToWorldPrototype
    ? <GridToWorldPrototype />
    : keeperDockRoute && KeeperDockPrototype
      ? <KeeperDockPrototype />
      : workspaceRailRoute && WorkspaceRailPrototype
        ? <WorkspaceRailPrototype />
        : nftTableViewerRoute && NftTableViewerPrototype
          ? <NftTableViewerPrototype />
          : latticeEngineRoute && LatticeEnginePrototype
            ? <LatticeEnginePrototype />
          : modul8rRoute && Modul8rPrototype
            ? <Modul8rPrototype />
  : spiderKeeperRoute && SpiderKeeperPrototype
    ? <SpiderKeeperPrototype />
    : gridWalkerRoute && GridWalkerPrototype
      ? <GridWalkerPrototype />
          : systemWorkflowDevelopmentRoute && OwnerSystemWorkflowDevelopmentEntrance
            ? <OwnerSystemWorkflowDevelopmentEntrance />
        : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {prototype
      ? <React.Suspense fallback={<div className="mode-loading">Opening prototype...</div>}>{prototype}</React.Suspense>
      : <App />}
  </React.StrictMode>,
);
