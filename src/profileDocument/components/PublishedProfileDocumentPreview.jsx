import ProfileDocumentSurface from './ProfileDocumentSurface.jsx';
import PublishedProfileDocumentSpaceWindow from './PublishedProfileDocumentSpaceWindow.jsx';

export default function PublishedProfileDocumentPreview({ document }) {
  return <ProfileDocumentSurface document={document} heading="PUBLISHED PROFILE" SpaceWindow={PublishedProfileDocumentSpaceWindow} />;
}
