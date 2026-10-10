// Interaction study only: no wallet/RPC client. Live integration additionally
// needs verified receipts, replacement handling and cross-tab submission locks.
export function createMintSession({ adapter, journal, onChange = () => {} }) {
  let state = { phase: 'loading', offer: null, buyer: null, record: null, message: '' };
  let generation = 0, disposed = false, active = null;
  const current = ticket => !disposed && ticket === generation;
  const emit = patch => {
    if (disposed) return;
    state = { ...state, ...patch }; onChange(state);
  };
  const scope = buyer => `${adapter.scope}:${buyer}`;
  const sameTerms = (a, b) => a.revision === b.revision && a.priceWei === b.priceWei;
  const save = (buyer, record) => journal.write(scope(buyer), record);

  async function refresh(buyer = state.buyer) {
    if (disposed || active) return;
    const ticket = ++generation;
    emit({ buyer, phase: 'loading', offer: null, record: null, message: '' });
    try {
      const offer = await adapter.readOffer(buyer);
      if (!current(ticket)) return;
      const record = buyer ? journal.read(scope(buyer)) : null;
      emit({ offer, record, phase: record ? (record.status === 'confirmed' ? 'confirmed' : 'recovery') : 'ready' });
    } catch {
      if (current(ticket)) emit({ phase: 'unavailable', message: 'Mint details or local recovery could not be read. Retry to check again.' });
    }
  }

  async function mint() {
    if (disposed || active || state.phase !== 'ready' || !state.buyer || !state.offer?.open
      || state.offer.remaining < 1 || !state.offer.eligible) return;
    const operation = active = {}, ticket = generation, buyer = state.buyer, displayedOffer = state.offer;
    let record = null;
    emit({ phase: 'checking', message: '' });
    try {
      const offer = await adapter.readOffer(buyer);
      if (!current(ticket)) return;
      if (!sameTerms(displayedOffer, offer) || !offer.open || offer.remaining < 1 || !offer.eligible) {
        emit({ phase: 'ready', offer, message: 'The sale changed. Review the latest details before continuing.' }); return;
      }
      if (journal.read(scope(buyer))) throw new Error('Previous request exists');
      const reservation = { status: 'requesting', buyer, hash: null, tokenId: null };
      save(buyer, reservation); // Failed persistence prevents confirmation.
      record = reservation;
      emit({ phase: 'wallet', record, offer });
      let hash;
      try { hash = await adapter.submit({ buyer, offer }); }
      catch (error) {
        if (error.code === 4001) {
          save(buyer, null);
          if (current(ticket)) emit({ phase: 'ready', record: null, message: 'Confirmation cancelled. Nothing was submitted.' });
          return;
        }
        throw error; // Ambiguous submission never automatically sends again.
      }
      record = { ...record, status: 'submitted', hash };
      save(buyer, record); // Original buyer survives navigation/close.
      if (current(ticket)) emit({ phase: 'pending', record, message: 'Submitted. Check the result to confirm the mint.' });
    } catch {
      if (current(ticket)) emit({ phase: record ? 'recovery' : 'unavailable', record,
        message: record ? 'The result is uncertain. Check this request before starting another mint.'
          : 'Recovery storage is unavailable or another request exists. Retry to read its status.' });
    } finally { if (active === operation) active = null; }
  }

  async function check() {
    if (disposed || active || !state.record || state.record.status === 'confirmed') return;
    const operation = active = {}, ticket = generation, buyer = state.buyer, record = state.record;
    emit({ phase: 'checking', message: '' });
    try {
      // Only this simulation can prove a request was never submitted. A missing
      // blockchain receipt would not be sufficient evidence.
      const result = await adapter.check(record);
      if (!current(ticket)) return;
      if (result.status === 'pending' || result.status === 'unknown') {
        emit({ phase: 'recovery', message: 'Confirmation is still unavailable. Check again; another mint will not be sent.' });
      } else if (result.status === 'reverted' || result.status === 'not-submitted') {
        save(buyer, null);
        emit({ phase: 'ready', record: null, message: result.status === 'reverted'
          ? 'The transaction failed. No item was minted. You can try again.'
          : 'The simulation confirms nothing was submitted. You can try again.' });
      } else if (result.status === 'confirmed' && result.buyer === buyer && result.scope === adapter.scope
        && result.hash && (!record.hash || result.hash === record.hash) && result.tokenId) {
        const confirmed = { ...record, status: 'confirmed', hash: result.hash, tokenId: result.tokenId };
        save(buyer, confirmed);
        emit({ phase: 'confirmed', record: confirmed, message: '' });
        // The receipt confirms this transaction, not current supply. Invalidate
        // the old offer and derive its replacement from the simulated ledger.
        emit({ offer: null });
        try {
          const offer = await adapter.readOffer(buyer);
          if (current(ticket)) emit({ offer });
        } catch { /* Confirmation remains valid; availability is unknown. */ }
      } else {
        emit({ phase: 'recovery', message: 'The result does not match this mint. It has not been marked successful.' });
      }
    } catch {
      if (current(ticket)) emit({ phase: 'recovery', message: 'The result could not be checked. Your request is retained; try checking again.' });
    } finally { if (active === operation) active = null; }
  }

  return {
    getState: () => state, refresh, mint, check,
    async setBuyer(buyer) {
      ++generation; active = null; adapter.cancelConfirmation(); return refresh(buyer);
    },
    dispose() { disposed = true; ++generation; adapter.cancelConfirmation(); },
  };
}

export function createDemoJournal(storage) {
  const key = scope => `inscape:prototype:visitor-mint:recovery:v1:${scope}`;
  return {
    read(scope) {
      const raw = storage.getItem(key(scope));
      if (raw === null) return null;
      if (raw.length > 1024) throw new Error('Invalid recovery record');
      const value = JSON.parse(raw);
      if (!['requesting', 'submitted', 'confirmed'].includes(value?.status)
        || !['visitor-a', 'visitor-b'].includes(value.buyer) || !scope.endsWith(`:${value.buyer}`)
        || (value.hash !== null && !/^demo-[\da-f-]{36}$/i.test(value.hash))
        || (value.status !== 'requesting' && !value.hash)
        || (value.status === 'confirmed' && !/^demo-token-\d+$/.test(value.tokenId))) {
        throw new Error('Invalid recovery record');
      }
      return { status: value.status, buyer: value.buyer, hash: value.hash, tokenId: value.tokenId };
    },
    write(scope, record) {
      if (record === null) storage.removeItem(key(scope));
      else storage.setItem(key(scope), JSON.stringify(record));
    },
  };
}
