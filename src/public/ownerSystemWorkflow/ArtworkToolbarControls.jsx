import { Info } from 'lucide-react';
import { useSharedDisplayTools } from './SharedDisplayTools.jsx';

// Layers reads this authored name. Keep typing local until the module commits it.
export function LayerNameInput({ label, name, onRename, disabled, compact = false }) {
  return <input key={name} aria-label={label} defaultValue={name} disabled={disabled} maxLength={48}
    className={compact ? 'editor-object-toolbar-name' : undefined} size={compact ? Math.min(16, Math.max(4, name.length)) : undefined}
    title={compact ? `Rename layer: ${name}` : undefined} onFocus={event => event.currentTarget.select()}
    onBlur={event => {
      const input = event.currentTarget, next = input.value.trim();
      input.value = name;
      if (next && next !== name) onRename(next);
    }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing || !['Escape', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') event.currentTarget.value = name;
      event.currentTarget.blur();
    }} />;
}

export function ArtworkInfoButton({ targetId }) {
  const tools = useSharedDisplayTools();
  if (!tools?.dockedMetadata) return null;
  const available = tools.isAvailable('metadata', targetId);
  const open = available && tools.target === targetId && tools.state.metadata;
  return <button className="editor-object-toolbar-button" type="button" aria-label="Artwork info" aria-expanded={open}
    disabled={!available} title={!available ? 'No artwork information available' : open ? 'Close artwork info' : 'Open artwork info'}
    onClick={event => tools.command('metadata', !open, event.currentTarget, targetId)}><Info aria-hidden="true" /></button>;
}
