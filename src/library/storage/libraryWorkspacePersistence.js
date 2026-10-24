import { createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { normalizeProfileAddress } from '../config.js';
import { libraryWorkspaceKey, loadLibraryWorkspace, normalizeWorkspace } from './libraryWorkspaceStorage.js';

export function browserLibraryStorage() {
  try { return globalThis.window?.localStorage || null; } catch { return null; }
}

// One persistence authority per storage installation. A successful command is
// saved before it becomes visible; no pending timer can outlive its profile.
export function createLibraryWorkspacePersistence(storage) {
  const records = new Map();
  const unavailable = 'Library storage is unavailable. Your changes were not saved.';
  return {
    load(profileAddress) {
      const profile = normalizeProfileAddress(profileAddress);
      try {
        const { raw, workspace } = loadLibraryWorkspace(storage, profile);
        records.set(profile, { raw });
        return { workspace, persistenceError: null };
      } catch (cause) {
        const error = cause instanceof SyntaxError || cause instanceof TypeError
          ? 'Saved Library data could not be read. It has been preserved; editing is blocked.' : unavailable;
        records.set(profile, { error });
        return { workspace: createEmptyWorkspace(profile), persistenceError: error };
      }
    },
    save(workspace) {
      const profile = normalizeProfileAddress(workspace?.profileAddress);
      const record = records.get(profile);
      if (!record || record.error) return { ok: false, error: record?.error || unavailable };
      try {
        const key = libraryWorkspaceKey(profile);
        if (storage.getItem(key) !== record.raw) return { ok: false,
          error: 'Library data changed in another tab. Reload before editing; the saved version has been preserved.' };
        const raw = JSON.stringify(normalizeWorkspace(workspace, profile));
        storage.setItem(key, raw);
        records.set(profile, { raw });
        return { ok: true, error: null };
      } catch { return { ok: false, error: unavailable }; }
    },
  };
}
