import PublishedHomeWorld from './PublishedHomeWorld.jsx';
import './profileDocumentPreview.css';

export default function ProfileDocumentPreview({ document, onExit, onMoveKeeper }) {
  return <div className="profile-document-owner-preview" data-preview-mode="visitor">
    <PublishedHomeWorld document={document} onMoveKeeper={onMoveKeeper} />
    <button className="profile-document-owner-preview__exit" type="button" onClick={onExit}>[ EXIT PREVIEW ]</button>
  </div>;
}
