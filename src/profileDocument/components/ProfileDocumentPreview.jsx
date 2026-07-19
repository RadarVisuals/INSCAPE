import ProfileDocumentSurface from './ProfileDocumentSurface.jsx';
import ProfileDocumentSpaceWindow from './ProfileDocumentSpaceWindow.jsx';

export default function ProfileDocumentPreview({ document, onExit }) {
  return <ProfileDocumentSurface document={document} heading="VISITOR PREVIEW" onExit={onExit} SpaceWindow={ProfileDocumentSpaceWindow} />;
}
