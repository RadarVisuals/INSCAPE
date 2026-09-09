import { normalizeProfileAddress } from '../library/config.js';

export const PROFILE_TARGET_SOURCE = Object.freeze({
  EXPLICIT: 'explicit',
  CONNECTED: 'connected',
  WORKSPACE_FALLBACK: 'workspace-fallback',
  PENDING: 'pending',
  NONE: 'none'
});

export function resolveProfileTarget({
  explicitViewedProfileAddress,
  connectedProfileAddress,
  workspaceFallbackAddress,
  authorityLifecycleStatus
}) {
  const explicit = normalizeProfileAddress(explicitViewedProfileAddress);
  if (explicit) return { address: explicit, source: PROFILE_TARGET_SOURCE.EXPLICIT, pending: false };

  if (authorityLifecycleStatus !== 'complete') {
    return { address: null, source: PROFILE_TARGET_SOURCE.PENDING, pending: true };
  }

  const connected = normalizeProfileAddress(connectedProfileAddress);
  if (connected) return { address: connected, source: PROFILE_TARGET_SOURCE.CONNECTED, pending: false };

  const workspaceFallback = normalizeProfileAddress(workspaceFallbackAddress);
  if (workspaceFallback) {
    return { address: workspaceFallback, source: PROFILE_TARGET_SOURCE.WORKSPACE_FALLBACK, pending: false };
  }

  return { address: null, source: PROFILE_TARGET_SOURCE.NONE, pending: false };
}

export function shouldRequestStandaloneSignIn({ embedded, walletConnected, targetSource }) {
  return !embedded
    && !walletConnected
    && targetSource === PROFILE_TARGET_SOURCE.CONNECTED;
}
