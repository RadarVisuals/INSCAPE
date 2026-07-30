import { normalizeProfileAddress } from '../../library/config.js';
import { createProfileContractFacts, PROFILE_CONTRACT_FACT_STATUS } from '../domain/profileContractFacts.js';

export class ProfileContractFactsCache {
  constructor({ repository, ttlMs = 5 * 60_000, now = Date.now } = {}) {
    if (!repository?.resolve) throw new TypeError('A contract-facts repository is required');
    this.repository = repository; this.ttlMs = ttlMs; this.now = now;
    this.entries = new Map(); this.listeners = new Map(); this.pending = new Map(); this.generations = new Map();
  }
  get(address) {
    const key = normalizeProfileAddress(address);
    if (!key) return null;
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > this.now()) return entry.facts;
    const facts = createProfileContractFacts(key);
    this.entries.set(key, { facts, expiresAt: Infinity });
    return facts;
  }
  subscribe(address, listener) {
    const key = normalizeProfileAddress(address);
    if (!key) return () => {};
    const listeners = this.listeners.get(key) || new Set();
    listeners.add(listener); this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        this.listeners.delete(key);
        this.pending.get(key)?.controller.abort();
      }
    };
  }
  emit(key) { this.listeners.get(key)?.forEach((listener) => listener()); }
  resolve(address, { force = false } = {}) {
    const key = normalizeProfileAddress(address);
    if (!key) return Promise.reject(new TypeError('A valid address is required'));
    const cached = this.get(key);
    if (this.pending.has(key)) return this.pending.get(key).promise;
    if (!force && cached.chain.status !== PROFILE_CONTRACT_FACT_STATUS.IDLE) return Promise.resolve(cached);
    const generation = (this.generations.get(key) || 0) + 1;
    this.generations.set(key, generation);
    const controller = new AbortController();
    this.entries.set(key, { facts: createProfileContractFacts(key, { status: PROFILE_CONTRACT_FACT_STATUS.LOADING }), expiresAt: Infinity });
    this.emit(key);
    const promise = this.repository.resolve(key, { signal: controller.signal }).then((facts) => {
      if (this.generations.get(key) === generation && !controller.signal.aborted) {
        this.entries.set(key, { facts, expiresAt: this.now() + this.ttlMs });
        this.emit(key);
      }
      return facts;
    }).catch((error) => {
      if (error?.name !== 'AbortError') throw error;
      const facts = createProfileContractFacts(key);
      if (this.generations.get(key) === generation) this.entries.set(key, { facts, expiresAt: Infinity });
      return facts;
    }).finally(() => {
      if (this.pending.get(key)?.generation === generation) this.pending.delete(key);
    });
    this.pending.set(key, { promise, controller, generation });
    return promise;
  }
  clear() {
    this.pending.forEach(({ controller }) => controller.abort());
    this.pending.clear(); this.entries.clear(); this.generations.clear();
  }
}
