import { LUKSO_CHAIN_ID } from '../../src/library/config.js';

export const CREATURE_URL = 'https://api.universalprofile.cloud/ipfs/QmTj2mCDC12vgVuSmm5Rtd4D1aeSnPoq92PDxoa67DJwMG/images-0-creature.svg';
export const SOURCE_URL = 'https://universaleverything.io/asset/0x611d3df50a3d930fba0a1f951e9d44bd9d3aea21/tokenId/0x0000000000000000000000000000000000000000000000000000000000000004';
export const DEMO_LEDGER_KEY = 'inscape:prototype:visitor-mint:ledger:v1';
export const SCENARIOS = [
  ['standard', 'Available · 2 LYX'], ['free', 'Free mint'], ['paused', 'Mint paused'],
  ['sold-out', 'Sold out'], ['unavailable', 'Read unavailable'],
  ['interrupted', 'Interrupted after submission'], ['reverted', 'Transaction fails'],
  ['changed', 'Price changes before confirmation'],
];

// Sole source of simulated supply/outcomes, separate from UI recovery. This is
// never a blockchain cache. Price/cap/limit are example terms only.
export function createSimulation({ storage, scenario = 'standard', onConfirmation = () => {}, now = Date.now }) {
  let confirmation = null, reads = 0;
  const scope = `demo:${LUKSO_CHAIN_ID}:${scenario}`;
  const read = () => {
    const raw = storage.getItem(DEMO_LEDGER_KEY);
    if (raw === null) return [];
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length > 500 || entries.some(entry =>
      typeof entry?.scope !== 'string' || !['visitor-a', 'visitor-b'].includes(entry.buyer)
      || !/^demo-[\da-f-]{36}$/i.test(entry.hash) || !Number.isFinite(entry.confirmAt)
      || !['confirmed', 'reverted'].includes(entry.outcome) || !/^demo-token-\d+$/.test(entry.tokenId))) {
      throw new Error('Invalid simulation ledger; retained for inspection');
    }
    return entries;
  };
  const cancelConfirmation = () => {
    const pending = confirmation;
    confirmation = null;
    if (pending) { onConfirmation(null); pending.reject(Object.assign(new Error('Cancelled'), { code: 4001 })); }
  };
  return {
    scope,
    async readOffer(buyer) {
      if (scenario === 'unavailable') throw new Error('Simulated unavailable read');
      const entries = read().filter(entry => entry.scope === scope && entry.outcome === 'confirmed');
      const changed = scenario === 'changed' && ++reads > 2;
      return { revision: changed ? 2 : 1, priceWei: scenario === 'free' ? '0' : changed ? '3000000000000000000' : '2000000000000000000',
        cap: 25, remaining: scenario === 'sold-out' ? 0 : 25 - entries.length,
        open: scenario !== 'paused', eligible: !entries.some(entry => entry.buyer === buyer), perProfile: 1 };
    },
    submit({ buyer, offer }) {
      if (confirmation) throw new Error('Confirmation already open');
      return new Promise((resolve, reject) => {
        confirmation = { resolve, reject, buyer, offer }; onConfirmation({ buyer, offer });
      });
    },
    confirm() {
      const pending = confirmation;
      if (!pending) return;
      confirmation = null; onConfirmation(null);
      try {
        const entries = read();
        const issued = entries.filter(entry => entry.scope === scope && entry.outcome === 'confirmed');
        const outcome = scenario === 'reverted' || issued.length >= 25 || issued.some(entry => entry.buyer === pending.buyer)
          ? 'reverted' : 'confirmed';
        const hash = `demo-${crypto.randomUUID()}`;
        entries.push({ scope, buyer: pending.buyer, hash, tokenId: `demo-token-${entries.length + 1}`,
          confirmAt: now() + 1600, outcome });
        storage.setItem(DEMO_LEDGER_KEY, JSON.stringify(entries));
        if (scenario === 'interrupted') pending.reject(new Error('Simulated connection loss after submission'));
        else pending.resolve(hash);
      } catch (error) { pending.reject(error); }
    },
    cancelConfirmation,
    async check(record) {
      const entry = read().findLast(entry => entry.scope === scope && entry.buyer === record.buyer
        && (!record.hash || record.hash === entry.hash));
      if (!entry) return { status: 'not-submitted' };
      if (entry.confirmAt > now()) return { status: 'pending' };
      return { ...entry, status: entry.outcome };
    },
  };
}
