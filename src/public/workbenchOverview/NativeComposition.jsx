import ReceptionDocumentCanvas from '../../reception/ReceptionDocumentCanvas.jsx';
import ReceptionCanvas from '../../reception/ReceptionCanvas.jsx';
import { useReceptionPresentation } from '../../reception/ReceptionPresentation.jsx';

export default function NativeComposition({ composition, interactive }) {
  const context = useReceptionPresentation();
  const Reader = composition.version === 3 ? ReceptionDocumentCanvas : ReceptionCanvas;
  return <Reader reception={composition} model={context?.profile} address={context?.snapshot.profileAddress}
    onOpenSource={interactive ? context?.onOpenSource : undefined} />;
}
