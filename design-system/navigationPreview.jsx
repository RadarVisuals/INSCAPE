import React, { useState } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Compass,
  Eye,
  FileText,
  Grid3X3,
  Images,
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  Search,
  Settings2,
  Upload,
  UserRound,
} from 'lucide-react';
import './navigationPreview.css';

export default function NavigationPreview({
  collapsed,
  onCollapse,
  libraryOpen,
  onLibrary,
  onWorkbench,
  onGrids,
  navigationHost,
}) {
  const [filter, setFilter] = useState('');
  const matches = (label) =>
    !filter.trim() || label.toLowerCase().includes(filter.trim().toLowerCase());
  const entry = (label, Icon, onClick, active = false) =>
    matches(label) && (
      <button
        type="button"
        className="ds-navigation-link"
        onClick={onClick}
        disabled={!onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        title={onClick ? label : `${label} · available in the app`}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  return (
    <aside
      className="ds-navigation"
      data-workflow-material="tactile"
      data-collapsed={collapsed || undefined}
      aria-label="Workspace sidebar"
    >
      <div className="ds-navigation-identity" title="Personal workspace">
        <PanelsTopLeft size={18} aria-hidden="true" />
        <span>
          <strong>Inscape</strong>
          <small>Personal workspace</small>
        </span>
      </div>
      {!collapsed && (
        <label className="ds-navigation-filter">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Filter navigation"
            placeholder="Filter navigation…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      )}
      <div className="ds-navigation-scroll">
        <nav aria-label="Workspace navigation">
          <div className="ds-navigation-group">
            <p>Workspace</p>
            {entry('Workbench', PanelsTopLeft, onWorkbench, !libraryOpen)}
            {entry('Grids', Grid3X3, onGrids)}
          </div>
          <div className="ds-navigation-group">
            <p>Artwork</p>
            {matches('Library') && (
              <button
                type="button"
                className="ds-navigation-link"
                onClick={onLibrary}
                aria-label="Library"
                aria-expanded={libraryOpen}
                title="Library"
                data-active={libraryOpen || undefined}
              >
                <Images size={18} aria-hidden="true" />
                <span>Library</span>
                {libraryOpen ? (
                  <ChevronDown size={13} aria-hidden="true" />
                ) : (
                  <ChevronRight size={13} aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </nav>
        <div
          ref={navigationHost}
          className="ds-library-navigation"
          hidden={!libraryOpen || collapsed || !matches('Library')}
        />
        <nav aria-label="Explore navigation" className="ds-navigation-group">
          <p>Explore</p>
          {entry('Discover', Compass)}
          {entry('Activity', Bell)}
        </nav>
      </div>
      <footer className="ds-navigation-footer">
        <nav aria-label="Share navigation" className="ds-navigation-group">
          <p>Share</p>
          {entry('Preview', Eye)}
          {entry('Publish', Upload)}
        </nav>
        {!collapsed && (
          <small className="ds-navigation-note">Account & sharing: available in the app</small>
        )}
        <div className="ds-navigation-utilities" role="toolbar" aria-label="Workspace utilities">
          {[
            [UserRound, 'Profile'],
            [FileText, 'Docs'],
            [Settings2, 'Settings'],
          ].map(([Icon, label]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={`${label} · available in the app`}
              disabled
            >
              <Icon size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ds-navigation-link ds-navigation-collapse"
          onClick={() => {
            setFilter('');
            onCollapse();
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={18} aria-hidden="true" />
          )}
          <span>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
        </button>
      </footer>
    </aside>
  );
}
