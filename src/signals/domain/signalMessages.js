import { SIGNAL_TYPES } from './keeperSignal.js';

export function abbreviateAddress(address) {
  const value = String(address || ''); return /^0x[\da-f]{40}$/i.test(value) ? `${value.slice(0, 6)}…${value.slice(-4).toUpperCase()}` : null;
}
function formatLyx(wei) {
  if (wei == null) return null;
  try { const value = BigInt(wei); const whole = value / 10n ** 18n;
    const fraction = String(value % 10n ** 18n).padStart(18, '0').slice(0, 4).replace(/0+$/, '');
    return `${whole}${fraction ? `.${fraction}` : ''} LYX`; } catch { return null; }
}
export function buildKeeperMessage(signal, displayIdentity = null) {
  const address = abbreviateAddress(signal?.counterparty);
  const counterparty = displayIdentity?.name || address;
  const assetName = signal?.assetReference?.metadataStatus !== 'unavailable' ? signal?.assetReference?.name : null;
  const context = [assetName, counterparty ? `${signal.direction === 'INCOMING' ? 'from' : 'to'} ${counterparty}` : null].filter(Boolean).join(' ');
  switch (signal?.type) {
    case SIGNAL_TYPES.ASSET_RECEIVED: return { label: 'RECEIVED', text: context ? `Received ${context}.` : 'Something new arrived.' };
    case SIGNAL_TYPES.ASSET_SENT: return { label: 'SENT', text: context ? `Sent ${context}.` : 'An asset left the collection.' };
    case SIGNAL_TYPES.LYX_RECEIVED: return { label: 'LYX RECEIVED', text: `${formatLyx(signal.value) || 'LYX'} arrived${counterparty ? ` from ${counterparty}` : ''}.` };
    case SIGNAL_TYPES.LYX_SENT: return { label: 'LYX SENT', text: `${formatLyx(signal.value) || 'LYX'} sent${counterparty ? ` to ${counterparty}` : ''}.` };
    default: return { label: 'SIGNAL', text: 'Profile activity detected.' };
  }
}
