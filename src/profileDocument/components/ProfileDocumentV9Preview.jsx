import { lazy, Suspense, useMemo } from 'react';
import { assertValidProfileDocumentV9 } from '../domain/profileDocumentV9Validation.js';

const VisitorGridWorld = lazy(() => import('./VisitorGridWorld.jsx'));

export default function ProfileDocumentV9Preview({ document: input, onExit, onOpenDirectory, onReturn }) {
  const document = useMemo(() => assertValidProfileDocumentV9(input), [input]);
  return <Suspense fallback={<main className="public-shell" role="status">LOADING VISITOR GRID</main>}>
    <VisitorGridWorld document={document} onExit={onExit} onOpenDirectory={onOpenDirectory} onReturn={onReturn} />
  </Suspense>;
}
