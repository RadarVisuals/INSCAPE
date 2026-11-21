import { lazy, Suspense } from 'react';

const ProfileDocumentV9Preview = lazy(() => import('./ProfileDocumentV9Preview.jsx'));

export default function PublishedProfileDocumentPreview(props) {
  return <Suspense fallback={<main className="public-shell" role="status">Opening publication…</main>}>
    <ProfileDocumentV9Preview {...props} />
  </Suspense>;
}
