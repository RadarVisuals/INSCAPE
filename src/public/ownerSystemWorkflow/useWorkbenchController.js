import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../../library/config.js';
import { resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createWorkbenchSession } from '../../systemWorkflow/workbenchSession.js';
import { addDisplayModule } from '../../systemWorkflow/displayModuleSession.js';

function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }

export default function useWorkbenchController(profileAddress, { storage } = {}) {
  const profile = normalizeProfileAddress(profileAddress), selectedStorage = storage ?? browserStorage();
  const authority = useMemo(() => {
    const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: selectedStorage });
    return { store, session: createWorkbenchSession({ store }) };
  }, [profile, selectedStorage]);
  const live = useRef(authority), mounted = useRef(true);
  live.current = authority;
  const [, render] = useState(0), [failure, setFailure] = useState(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => authority.store.subscribe(() => render(v => v + 1)), [authority]);
  const run = useCallback(operation => {
    if (!mounted.current || live.current !== authority) return false;
    try { const result = operation(authority.session); setFailure(null); return result; }
    catch (error) { setFailure({ authority, message: error.message }); return false; }
  }, [authority]);
  const clearError = useCallback(() => setFailure(null), []);
  const draft = authority.store.getDraft();
  return { draft, store: authority.store, storage: selectedStorage, run, clearError, error: failure?.authority === authority ? failure.message : null,
    addDisplay: orientation => run(() => addDisplayModule(authority.store, orientation)),
    saveWorkbench: workbench => run(session => session.saveWorkbench(workbench)),
    saveIdentity: ({ profile: values, card, avatar }) => run(session => {
      const { alias, bio, tags, avatar: expectedAvatar } = draft.identityPresentation;
      const changedBio = values.description !== (bio.mode === 'inscape' ? bio.customText : '');
      return session.setIdentityConfiguration({ expectedDetails: { alias, bio, tags, avatar: expectedAvatar },
        expectedCard: resolveIdentityCard(draft.identityPresentation), card, details: {
          avatar, alias: values.title, bio: changedBio ? { mode: values.description ? 'inscape' : 'official', customText: values.description } : bio,
          tags: { ...tags, additional: values.tags },
        } });
    }),
  };
}
