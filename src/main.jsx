// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const prototypePath = window.location.pathname.replace(/\/+$/, '');
const prototypeRoute = prototypePath === '/prototype/navigation-wall';
const worldTransitionRoute = prototypePath === '/prototype/grid-to-world';
const NavigationWallPrototype = React.lazy(() => import('./NavigationWallPrototype.jsx'));
const GridToWorldPrototype = React.lazy(() => import('./GridToWorldPrototype.jsx'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {prototypeRoute||worldTransitionRoute?<React.Suspense fallback={<div className="mode-loading">Opening prototype...</div>}>{prototypeRoute?<NavigationWallPrototype/>:<GridToWorldPrototype/>}</React.Suspense>:<App/>}
  </React.StrictMode>,
);
