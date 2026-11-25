import CompositionDocumentCanvas from '../../composition/CompositionDocumentCanvas.jsx';
import { useCompositionPresentation } from '../../composition/CompositionPresentation.jsx';

export default function NativeComposition({ composition, interactive }) {
  const context = useCompositionPresentation();
  return <CompositionDocumentCanvas composition={composition}
    onOpenSource={interactive ? context?.onOpenSource : undefined} />;
}
