import { normalizeProfileAddress } from '../../library/config.js';
import { luksoPublishedProfileRepository, PUBLISHED_PROFILE_STATUS } from '../storage/luksoPublishedProfileRepository.js';

const loadingState = (address) => ({ status: PUBLISHED_PROFILE_STATUS.LOADING, address, document: null, errorCode: null });

export class PublishedProfileResolutionStore {
  constructor({ repository = luksoPublishedProfileRepository } = {}) {
    this.repository = repository; this.entries = new Map(); this.lastValid = new Map(); this.listeners = new Map(); this.generation = 0; this.active = null;
  }
  get(address) { const key = normalizeProfileAddress(address); if (!key) return null; if (!this.entries.has(key)) this.entries.set(key, loadingState(key)); return this.entries.get(key); }
  subscribe(address, listener) { const key = normalizeProfileAddress(address); if (!key) return () => {}; const listeners = this.listeners.get(key) || new Set(); listeners.add(listener); this.listeners.set(key, listeners); return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(key); }; }
  emit(key) { this.listeners.get(key)?.forEach((listener) => listener()); }
  async resolve(address) {
    const key = normalizeProfileAddress(address); if (!key) throw new TypeError('A valid Universal Profile address is required');
    this.active?.controller.abort();
    const controller = new AbortController(); const generation = ++this.generation; const previous = this.entries.get(key);
    this.active = { key, controller, generation }; this.entries.set(key, loadingState(key)); this.emit(key);
    try {
      const result = await this.repository.resolve(key, { signal: controller.signal });
      if (controller.signal.aborted || generation !== this.generation) return this.get(key);
      const next = { ...result, errorCode: result.errorCode || null };
      if (next.status === PUBLISHED_PROFILE_STATUS.RESOLVED) this.lastValid.set(key, next.document);
      else if ([PUBLISHED_PROFILE_STATUS.INVALID, PUBLISHED_PROFILE_STATUS.UNAVAILABLE].includes(next.status)) this.lastValid.delete(key);
      this.entries.set(key, next); this.emit(key); return next;
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted || generation !== this.generation) return this.get(key);
      const priorDocument = this.lastValid.get(key) || (previous && [PUBLISHED_PROFILE_STATUS.RESOLVED, PUBLISHED_PROFILE_STATUS.STALE].includes(previous.status) ? previous.document : null);
      const next = priorDocument
        ? { status: PUBLISHED_PROFILE_STATUS.STALE, address: key, document: priorDocument, errorCode: 'NETWORK_ERROR' }
        : { status: PUBLISHED_PROFILE_STATUS.ERROR, address: key, document: null, errorCode: 'NETWORK_ERROR' };
      this.entries.set(key, next); this.emit(key); return next;
    } finally { if (this.active?.generation === generation) this.active = null; }
  }
  clear() { this.active?.controller.abort(); this.active = null; this.generation += 1; this.entries.clear(); this.lastValid.clear(); }
}

export const publishedProfileResolutionStore = new PublishedProfileResolutionStore();
