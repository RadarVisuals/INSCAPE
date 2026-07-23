// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const prototypePath = window.location.pathname.replace(/\/+$/, '');
const prototypeRoute = prototypePath === '/prototype/navigation-wall';
const worldTransitionRoute = prototypePath === '/prototype/grid-to-world';
const inscapeScrambleRoute = import.meta.env.DEV && prototypePath === '/prototype/inscape-scramble';
const NavigationWallPrototype = React.lazy(() => import('./NavigationWallPrototype.jsx'));
const GridToWorldPrototype = React.lazy(() => import('./GridToWorldPrototype.jsx'));
const InscapeScramblePrototype = import.meta.env.DEV
  ? React.lazy(() => import('./InscapeScramblePrototype.jsx'))
  : null;

const prototype = prototypeRoute
  ? <NavigationWallPrototype />
  : worldTransitionRoute
    ? <GridToWorldPrototype />
    : inscapeScrambleRoute && InscapeScramblePrototype
      ? <InscapeScramblePrototype />
      : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {prototype
      ? <React.Suspense fallback={<div className="mode-loading">Opening prototype...</div>}>{prototype}</React.Suspense>
      : <App />}
  </React.StrictMode>,
);
