import { useRef, useState } from 'react';
import RackMenu from '../menus/RackMenu.jsx';
import { CircleAlert, Play } from 'lucide-react';
import { StudioHeaderTools } from '../menus/WorkspaceHeader.jsx';

export default function EditorHeaderActions({ saveState, publicationState, dirty, onPreview, onPublish, publicationOpen, blocked, studioCommands, runStudioCommand }) {
  const trigger = useRef(null), [menu, setMenu] = useState(null);
  const openMenu = focusLast => {
    const rect = trigger.current.getBoundingClientRect();
    setMenu({ anchor: { x: rect.left, y: rect.bottom }, focusLast });
  };
  const studioMenu = <button ref={trigger} type="button" className="studio-header-label" aria-current="page"
    aria-haspopup="menu" aria-expanded={Boolean(menu)} disabled={blocked}
    onClick={() => menu ? setMenu(null) : openMenu(false)}
    onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openMenu(event.key === 'ArrowUp'); }
    }}>Studio</button>;
  const saveFailed = saveState === 'Changes need attention';
  const pending = dirty || saveState === 'Saving layout' || saveFailed;
  return <div className="editor-header-actions">
    <div role="status" aria-label={saveState} className="editor-save-status">
      <span>{saveFailed && <CircleAlert aria-hidden="true" />}{saveState}</span>
      <span title="Where a published version of this composition is visible">{publicationState}</span>
    </div>
    <button type="button" className="editor-header-publish" aria-label="Publish" data-dirty={pending || undefined} aria-haspopup="dialog" aria-expanded={publicationOpen}
      disabled={blocked && !publicationOpen} onClick={event => onPublish(event.currentTarget)}>Publish</button>
    <StudioHeaderTools studioMenu={studioMenu}>
      <button type="button" aria-label="Preview" title="Preview" disabled={blocked} onClick={event => onPreview(event.currentTarget)}><Play aria-hidden="true" /></button>
    </StudioHeaderTools>
    {menu && !blocked && <RackMenu label="Studio" className="workspace-command-menu system-workflow__token-scope" palette="editor"
      systemWorkflowOverlay {...menu} commands={studioCommands} menuBarRef={trigger} returnFocus={trigger.current}
      onClose={() => setMenu(null)} onCommand={id => {
        setMenu(null); trigger.current.focus({ preventScroll: true });
        runStudioCommand(studioCommands.find(entry => entry.id === id), trigger.current);
      }} />}
  </div>;
}
