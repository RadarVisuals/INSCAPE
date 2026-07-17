import { normalizeProfileAddress } from '../../library/config.js';
import { sortSignalsNewestFirst } from '../domain/keeperSignal.js';

export const SIGNAL_STORAGE_VERSION = 1;
export const SIGNAL_HISTORY_LIMIT = 50;
export const SIGNAL_KNOWN_IDS_LIMIT = 200;
export const DEFAULT_SIGNAL_SETTINGS = Object.freeze({ notifications: true, speech: true, visualEffects: true, audio: false });
export const signalStorageKey = (profileAddress) => `os-underneath.keeper-signals.v${SIGNAL_STORAGE_VERSION}:${normalizeProfileAddress(profileAddress) || 'invalid'}`;
export function createEmptySignalDocument(profileAddress) {
  return { version: SIGNAL_STORAGE_VERSION, profileAddress: normalizeProfileAddress(profileAddress), initialized: false,
    knownSignalIds: [], history: [], settings: { ...DEFAULT_SIGNAL_SETTINGS } };
}
function validSignal(signal, profile) {
  return signal && typeof signal.id === 'string' && typeof signal.type === 'string' && Number.isFinite(signal.timestamp)
    && normalizeProfileAddress(signal.profileAddress) === profile;
}
export function decodeSignalDocument(raw, profileAddress) {
  const profile = normalizeProfileAddress(profileAddress); const empty = createEmptySignalDocument(profile);
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || value.version !== SIGNAL_STORAGE_VERSION || normalizeProfileAddress(value.profileAddress) !== profile) return empty;
    const history = sortSignalsNewestFirst((Array.isArray(value.history) ? value.history : []).filter((signal) => validSignal(signal, profile))).slice(0, SIGNAL_HISTORY_LIMIT);
    const knownSignalIds = [...new Set((Array.isArray(value.knownSignalIds) ? value.knownSignalIds : []).filter((id) => typeof id === 'string'))].slice(-SIGNAL_KNOWN_IDS_LIMIT);
    const settings = Object.fromEntries(Object.entries(DEFAULT_SIGNAL_SETTINGS).map(([key, fallback]) => [key, typeof value.settings?.[key] === 'boolean' ? value.settings[key] : fallback]));
    return { ...empty, initialized: value.initialized === true, knownSignalIds, history, settings };
  } catch { return empty; }
}
export function loadSignalDocument(storage, profileAddress) {
  try { return decodeSignalDocument(storage?.getItem(signalStorageKey(profileAddress)), profileAddress); } catch { return createEmptySignalDocument(profileAddress); }
}
export function saveSignalDocument(storage, document) {
  const normalized = decodeSignalDocument(document, document.profileAddress);
  try { storage?.setItem(signalStorageKey(document.profileAddress), JSON.stringify(normalized)); return true; } catch { return false; }
}
