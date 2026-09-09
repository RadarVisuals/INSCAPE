import { normalizeProfileAddress } from '../../library/config.js';
import { createErrorIdentity, createProfileIdentity, PROFILE_IDENTITY_STATUS } from '../domain/profileIdentity.js';

export class ProfileIdentityCache {
  constructor({ repository, maxConcurrent = 4, successTtlMs = 30 * 60_000, failureTtlMs = 60_000,
    timeoutMs = 15_000, maxEntries = 256, now = Date.now } = {}) {
    if (!repository?.resolve) throw new TypeError('An identity repository is required');
    this.repository = repository; this.maxConcurrent = Math.max(1, maxConcurrent);
    this.successTtlMs = successTtlMs; this.failureTtlMs = failureTtlMs;
    this.timeoutMs = timeoutMs; this.maxEntries = maxEntries; this.now = now;
    this.entries = new Map(); this.pending = new Map(); this.listeners = new Map();
    this.queue = []; this.active = 0; this.clearing = false;
  }
  remember(key, identity, expiresAt) {
    this.entries.delete(key); this.entries.set(key, { identity, expiresAt });
    for (const candidate of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      if (candidate !== key && !this.pending.has(candidate) && !this.listeners.has(candidate)) this.entries.delete(candidate);
    }
  }
  get(address) {
    const key = normalizeProfileAddress(address); if (!key) return null;
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > this.now()) return entry.identity;
    const identity = createProfileIdentity(key, { source: this.repository.source });
    this.remember(key, identity, Infinity); return identity;
  }
  peek(address) { const identity = this.get(address); return identity?.status === PROFILE_IDENTITY_STATUS.RESOLVED ? identity : null; }
  subscribe(address, listener) {
    const key = normalizeProfileAddress(address); if (!key) return () => {};
    const listeners = this.listeners.get(key) || new Set(); listeners.add(listener); this.listeners.set(key, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(key); };
  }
  emit(key) { this.listeners.get(key)?.forEach((listener) => listener()); }
  resolve(address, options = {}) {
    const key = normalizeProfileAddress(address);
    if (!key) return Promise.reject(new TypeError('A valid address is required'));
    if (this.pending.has(key)) return this.pending.get(key).promise;
    const cached = this.get(key);
    if (!options.force && ![PROFILE_IDENTITY_STATUS.IDLE, PROFILE_IDENTITY_STATUS.LOADING].includes(cached?.status)) return Promise.resolve(cached);
    if (options.signal?.aborted || this.pending.size >= this.maxEntries) return Promise.resolve(createErrorIdentity(key, { source: this.repository.source }));
    const job = { key, options, controller: new AbortController(), started: false, settled: false };
    job.promise = new Promise(resolve => { job.resolve = resolve; });
    job.finish = (identity, retain = true) => {
      if (job.settled) return;
      job.settled = true; clearTimeout(job.timer);
      options.signal?.removeEventListener('abort', job.cancel);
      if (job.started) this.active--;
      this.queue = this.queue.filter(candidate => candidate !== job);
      if (this.pending.get(key) === job) {
        this.pending.delete(key);
        if (retain) this.remember(key, identity, this.now() + (identity.status === PROFILE_IDENTITY_STATUS.RESOLVED ? this.successTtlMs : this.failureTtlMs));
        else this.entries.delete(key);
      }
      job.resolve(identity);
      if (!this.clearing) { this.emit(key); this.drain(); }
    };
    job.cancel = () => {
      job.controller.abort();
      job.finish(createErrorIdentity(key, { source: this.repository.source }), false);
    };
    this.pending.set(key, job);
    this.queue.push(job);
    options.signal?.addEventListener('abort', job.cancel, { once: true });
    this.remember(key, createProfileIdentity(key, { status: PROFILE_IDENTITY_STATUS.LOADING, source: this.repository.source }), Infinity);
    this.emit(key); this.drain();
    return job.promise;
  }
  drain() {
    if (this.clearing) return;
    while (this.active < this.maxConcurrent && this.queue.length) {
      const job = this.queue.shift(); job.started = true; this.active++;
      const fail = () => job.finish(createErrorIdentity(job.key, { source: this.repository.source }));
      job.timer = setTimeout(() => { job.controller.abort(); fail(); }, this.timeoutMs);
      try {
        Promise.resolve(this.repository.resolve(job.key, { ...job.options, signal: job.controller.signal }))
          .then(identity => identity?.address === job.key ? job.finish(identity) : fail(), fail);
      } catch { fail(); }
    }
  }
  clear() {
    this.clearing = true;
    for (const job of [...this.pending.values()]) job.cancel();
    this.entries.clear(); this.queue = [];
    this.clearing = false;
    for (const key of this.listeners.keys()) this.emit(key);
  }
}
