import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp } from 'lucide-react';

// Content owners provide the order operation; these are the same layer commands.
export default function ArtworkOrderControls({ disabled, onOrder }) {
  return <>{[['back', 'Send layers to back', ChevronsDown], ['backward', 'Move layers backward', ArrowDown],
    ['forward', 'Move layers forward', ArrowUp], ['front', 'Bring layers to front', ChevronsUp]].map(([direction, label, Icon]) =>
    <button type="button" key={direction} aria-label={label} title={label} disabled={disabled} onClick={() => onOrder(direction)}><Icon /></button>)}</>;
}
