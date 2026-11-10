import { Check, CircleAlert, Clock3, Moon, Play, Redo2, Settings2, Sun, Undo2, UserRound } from 'lucide-react';
import { interfaceTheme, useInterfaceTheme } from '../../interfaceTheme.js';

export default function EditorHeaderActions({ menu, triggers, toggle, saveState, undo, redo,
  zoom, onPreview, onPublish, publicationOpen, blocked, onOpenPanel, openPanels, profileName }) {
  const { mode } = useInterfaceTheme();
  const Theme = mode === 'dark' ? Sun : Moon;
  const Status = saveState === 'Saved locally' ? Check : saveState === 'Saving layout' ? Clock3 : CircleAlert;
  const icon = (label, Icon, action, props = {}) => <button type="button" aria-label={label} title={label}
    onClick={event => action(event.currentTarget)} {...props}><Icon aria-hidden="true" /></button>;
  const dropdown = (label, children, accessibleLabel) => <button ref={node => { triggers.current[label] = node; }}
    type="button" className="editor-header-pill" aria-label={accessibleLabel} aria-haspopup="menu" aria-expanded={menu === label}
    onClick={() => toggle(label)} onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); toggle(label, event.key === 'ArrowUp'); }
    }}>{children}</button>;
  return <div className="editor-header-actions">
    <span role="status" aria-label={saveState} title={saveState} className="editor-save-state"><Status aria-hidden="true" /></span>
    <div className="editor-header-history" role="group" aria-label="Edit history">
      {icon('Undo', Undo2, undo.run, { disabled: undo.disabled })}
      {icon('Redo', Redo2, redo.run, { disabled: redo.disabled })}
    </div>
    {dropdown('Zoom', <span><span className="editor-zoom-prefix">Zoom </span>{zoom}%</span>, `Zoom ${zoom}%`)}
    {icon(mode === 'dark' ? 'Switch to Light' : 'Switch to Dark', Theme, () => interfaceTheme.setMode(mode === 'dark' ? 'light' : 'dark'))}
    {icon('Preview', Play, onPreview, { disabled: blocked })}
    <button className="editor-header-publish" type="button" aria-label="Publish" aria-haspopup="dialog" aria-expanded={publicationOpen}
      disabled={blocked && !publicationOpen} onClick={event => onPublish(event.currentTarget)}>Publish</button>
    {icon('Settings', Settings2, trigger => onOpenPanel('settings', trigger), { 'aria-expanded': openPanels.includes('settings'), 'data-system-workflow-panel-trigger': true })}
    <button type="button" aria-label="Profile" title={profileName || 'Profile'} className="editor-header-profile" data-system-workflow-panel-trigger
      aria-expanded={openPanels.includes('profile')} onClick={event => onOpenPanel('profile', event.currentTarget)}>
      {profileName?.trim()[0]?.toUpperCase() || <UserRound aria-hidden="true" />}
    </button>
  </div>;
}
