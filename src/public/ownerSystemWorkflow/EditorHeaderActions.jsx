import { CircleAlert, Play } from 'lucide-react';
import { HeaderThemeButton } from '../menus/WorkspaceHeader.jsx';

export default function EditorHeaderActions({ saveState, dirty, onPreview, onPublish, publicationOpen, blocked }) {
  const saveFailed = saveState === 'Changes need attention';
  const pending = dirty || saveState === 'Saving layout' || saveFailed;
  return <div className="editor-header-actions">
    <span role="status" aria-label={saveState} title={saveState} className={saveFailed ? 'editor-save-error' : 'editor-save-status'}>
      {saveFailed ? <CircleAlert aria-hidden="true" /> : saveState}
    </span>
    <HeaderThemeButton />
    <button type="button" aria-label="Preview" title="Preview" disabled={blocked} onClick={event => onPreview(event.currentTarget)}><Play aria-hidden="true" /></button>
    <button type="button" className="editor-header-publish" aria-label="Publish" data-dirty={pending || undefined} aria-haspopup="dialog" aria-expanded={publicationOpen}
      disabled={blocked && !publicationOpen} onClick={event => onPublish(event.currentTarget)}>Publish</button>
  </div>;
}
