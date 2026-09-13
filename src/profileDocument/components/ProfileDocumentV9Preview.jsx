import { lazy, Suspense, useMemo, useState } from 'react';
import { assertValidProfileDocumentV9 } from '../domain/profileDocumentV9Validation.js';

const VisitorGridWorld = lazy(() => import('./VisitorGridWorld.jsx'));
const MobileVisitor = lazy(() => import('../../mobile/MobileVisitor.jsx'));

export default function ProfileDocumentV9Preview({ document: input, onExit, onOpenDirectory, onReturn, onConnect }) {
  const document = useMemo(() => assertValidProfileDocumentV9(input), [input]);
  // Decide at entry, not during a rotate/resize that would discard visitor navigation.
  const [mobile, setMobile] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 767px) and (pointer: coarse)').matches);
  return <Suspense fallback={<main className="public-shell" role="status">LOADING VISITOR GRID</main>}>
    {mobile ? <MobileVisitor document={document} onExit={onExit} onReturn={onReturn} onDesktop={() => setMobile(false)} />
      : <VisitorGridWorld document={document} onExit={onExit} onOpenDirectory={onOpenDirectory} onReturn={onReturn} onConnect={onConnect} />}
  </Suspense>;
}
