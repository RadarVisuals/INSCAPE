const DATABASE = 'inscape-workspaces';
const META = 'profiles', DATA = 'records';
const kinds = ['library', 'workbenches', 'receptionRecovery', 'textRecovery'];

function bookkeeping(header) {
  return {
    revision: header.revision,
    lastCommittedWorkspaceRevision: header.lastCommittedWorkspaceRevision ?? header.revision,
    lastExportedRevision: header.lastExportedRevision ?? null,
    lastExportedAt: header.lastExportedAt ?? null,
    restoreRevision: header.restoreRevision ?? 0,
  };
}

function open(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE, 1);
    let blocked = false;
    request.onblocked = () => { blocked = true; reject(new Error('Close other Inscape tabs to open workspace storage.')); };
    request.onupgradeneeded = () => {
      request.result.createObjectStore(META);
      request.result.createObjectStore(DATA);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function transaction(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META, DATA], mode);
    let result, failure;
    const fail = cause => { failure = cause; tx.abort(); };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || Error('Workspace transaction aborted.'));
    const run = fn => event => {
      try { fn(event.target.result); } catch (error) { fail(error); }
    };
    try { operation(tx.objectStore(META), tx.objectStore(DATA), run, value => { result = value; }); }
    catch (error) { fail(error); }
  });
}

function readRows(data, scope, run, done) {
  const rows = {};
  let remaining = kinds.length;
  for (const kind of kinds) data.get([...scope, kind]).onsuccess = run(raw => {
    rows[kind] = raw ?? null;
    if (!--remaining) done(rows);
  });
}

// Seed once under the same lock as the manifest. A crash before verification
// leaves a candidate, never an authoritative empty profile.
export async function openWorkspaceDatabase(factory, scope, readLegacy, validate) {
  const db = await open(factory);
  try {
    let original;
    await transaction(db, 'readwrite', (meta, data, run) => {
      meta.get(scope).onsuccess = run(header => {
        if (header?.verified) return;
        original = readLegacy();
        validate(original);
        if (header) {
          if (header.verified !== false || header.revision !== 0) throw Error('Invalid migration manifest.');
          // Only unverified candidates can be reseeded after an interrupted migration.
          for (const kind of kinds) {
            const key = [...scope, kind];
            if (original[kind] == null) data.delete(key); else data.put(original[kind], key);
          }
          return;
        }
        readRows(data, scope, run, existing => {
          if (Object.values(existing).some(value => value !== null)) throw Error('Workspace records have no migration manifest.');
          for (const kind of kinds) if (original[kind] != null) data.add(original[kind], [...scope, kind]);
          meta.add({ verified: false, revision: 0 }, scope);
        });
      });
    });
    const result = await transaction(db, 'readwrite', (meta, data, run, finish) => {
      meta.get(scope).onsuccess = run(header => {
        if (!header || !Number.isSafeInteger(header.revision) || header.revision < 0) throw Error('Invalid workspace revision.');
        readRows(data, scope, run, rows => {
          validate(rows, header.verified);
          if (!header.verified) {
            const legacy = readLegacy();
            if (kinds.some(kind => rows[kind] !== (legacy[kind] ?? null)
              || rows[kind] !== (original?.[kind] ?? null))) throw Error('Workspace migration read-back differs from the original.');
            header.verified = true;
            header.revision = 1;
            Object.assign(header, bookkeeping(header));
            meta.put(header, scope);
          }
          finish({ rows, ...bookkeeping(header) });
        });
      });
    });
    return { ...result, db };
  } catch (error) { db.close(); throw error; }
}

export function readCommittedRows(db, scope, afterRevision) {
  return transaction(db, 'readonly', (meta, data, run, finish) => {
    meta.get(scope).onsuccess = run(header => {
      if (!header?.verified) throw Error('Workspace has no verified revision.');
      if (header.revision <= afterRevision) finish(null);
      else readRows(data, scope, run, rows => finish({ ...bookkeeping(header), rows }));
    });
  });
}

export function commitWorkspaceRows(db, scope, changes, { expectedRevision, guard, authored = true } = {}) {
  return transaction(db, 'readwrite', (meta, data, run, finish) => {
    meta.get(scope).onsuccess = run(header => {
      if (!header?.verified) throw Error('Workspace migration is incomplete.');
      if (expectedRevision !== undefined && (header.revision !== expectedRevision || !guard?.()))
        throw Error('Workspace changed since preview. Open the file again.');
      for (const [kind, { before, after }] of changes) {
        const key = [...scope, kind];
        data.get(key).onsuccess = run(raw => {
          if (guard && !guard()) throw Error('Restore cancelled before commit.');
          if ((raw ?? null) !== before) throw Error('Workspace changed in another tab. Keep this tab open to recover your edits.');
          if (after === null) data.delete(key); else data.put(after, key);
        });
      }
      const next = bookkeeping(header);
      if (changes.length) {
        next.revision++;
        if (authored) next.lastCommittedWorkspaceRevision++;
        if (expectedRevision !== undefined) next.restoreRevision = next.revision;
        meta.put({ ...header, ...next }, scope);
      }
      finish(next);
    });
  });
}

export function markWorkspaceExported(db, scope, revision, exportedAt) {
  return transaction(db, 'readwrite', (meta, data, run, finish) => {
    meta.get(scope).onsuccess = run(header => {
      if (!header?.verified) throw Error('Workspace unavailable.');
      const next = bookkeeping(header);
      if (revision > next.lastCommittedWorkspaceRevision) throw Error('Invalid export revision.');
      if (next.lastExportedRevision === null || revision > next.lastExportedRevision
        || revision === next.lastExportedRevision && exportedAt >= next.lastExportedAt) {
        next.lastExportedRevision = revision;
        next.lastExportedAt = exportedAt;
        meta.put({ ...header, ...next }, scope);
      }
      finish(next);
    });
  });
}
