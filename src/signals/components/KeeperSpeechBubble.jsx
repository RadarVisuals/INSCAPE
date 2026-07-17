import { X } from 'lucide-react';
import { buildKeeperMessage } from '../domain/signalMessages.js';

export default function KeeperSpeechBubble({ signal, onDismiss }) {
  const message = buildKeeperMessage(signal);
  return (
    <aside className="keeper-speech" role="status" aria-atomic="true">
      <span className="keeper-speech__label">{message.label}</span>
      <p>{message.text}</p>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => { event.stopPropagation(); onDismiss(); }}
        onClick={(event) => {
          event.stopPropagation();
          if (event.detail === 0) onDismiss();
        }}
        aria-label="Dismiss Keeper message"
        title="Dismiss"
      ><X aria-hidden="true" /></button>
    </aside>
  );
}
