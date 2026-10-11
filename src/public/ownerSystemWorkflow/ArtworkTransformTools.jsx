import { FlipHorizontal2, FlipVertical2, RotateCw } from 'lucide-react';

export default function ArtworkTransformTools({ disabled, onTransform }) {
  return <>{[
    ['ROTATE', 'Rotate', RotateCw],
    ['MIRROR_HORIZONTAL', 'Mirror horizontal', FlipHorizontal2],
    ['MIRROR_VERTICAL', 'Mirror vertical', FlipVertical2],
  ].map(([operation, label, Icon]) => <button key={operation} type="button" aria-label={label} title={label}
    disabled={disabled} onClick={() => onTransform(operation)}><Icon size={15} /></button>)}</>;
}
