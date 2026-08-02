import { lazy } from 'react';

export const productionModul8rSelected = false;
export const BrowserWorkspace = lazy(() => import('../lattice/browser/BrowserWorkspace.jsx'));
export const ActivityBrowser = lazy(() => import('./ActivityBrowser.jsx'));
export const CreationsBrowser = lazy(() => import('./CreationsBrowser.jsx'));
export const SettingsBrowser = lazy(() => import('./SettingsBrowser.jsx'));
export const ProfileDiscoveryBoundary = lazy(() => import('../profileDiscovery/ProfileDiscoveryBoundary.jsx'));
export const Modul8rOwnerWorkspace = null;
