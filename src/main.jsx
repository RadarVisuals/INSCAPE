// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

if (import.meta.env.PROD) {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    window.location.reload();
  }, { once: true });
}

const developmentPath = window.location.pathname.replace(/\/+$/, '');
const systemWorkflowDevelopmentRoute = import.meta.env.DEV
  && developmentPath === '/development/owner/system-workflow';
const OwnerSystemWorkflowDevelopmentEntrance = import.meta.env.DEV
  ? React.lazy(() => import('./public/ownerSystemWorkflow/OwnerSystemWorkflowDevelopmentEntrance.jsx'))
  : null;

const developmentEntrance = systemWorkflowDevelopmentRoute && OwnerSystemWorkflowDevelopmentEntrance
  ? <OwnerSystemWorkflowDevelopmentEntrance />
  : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {developmentEntrance
      ? <React.Suspense fallback={<div className="mode-loading">Opening development workspace...</div>}>{developmentEntrance}</React.Suspense>
      : <App />}
  </React.StrictMode>,
);
