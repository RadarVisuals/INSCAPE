import { assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { resolveIdentityCard } from '../profileIdentity/domain/identityCard.js';

const identityDetails = ({ alias, bio, tags, avatar }) => ({ alias, bio, tags, avatar });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const failure = (code, message) => Object.assign(new Error(message), { code });

// Profile-wide actions never pass through a Display's projected content.
export function createWorkbenchSession({ store }) {
  const profile = store.getProfileAddress();
  function transact(makeCandidate, options = {}) {
    if (store.getProfileAddress() !== profile) throw failure('SYSTEM_WORKFLOW_OPERATION_STALE', 'This profile is no longer active.');
    const generation = store.getGeneration();
    const candidate = makeCandidate(store.getDraft());
    if (candidate === null) return false;
    if (!store.commitCompletedOperation(candidate, { ...options, expectedGeneration: generation })) {
      throw failure('SYSTEM_WORKFLOW_OPERATION_STALE', 'The change could not be saved. Storage may be unavailable or the draft changed in another tab.');
    }
    return true;
  }
  return Object.freeze({
    setMenuSurface({ expected, menuSurfaceId }) {
      return transact(draft => {
        if (draft.appearance.menuSurfaceId !== expected) {
          throw failure('SYSTEM_WORKFLOW_APPEARANCE_STALE', 'The window theme changed. Reopen Settings before saving.');
        }
        if (menuSurfaceId === expected) return null;
        // The v4 envelope stores the shared chrome theme with primary appearance.
        // Its owner is the Workbench, regardless of the selected Display.
        return assertValidSystemWorkflowDraft({ ...draft, appearance: { ...draft.appearance, menuSurfaceId } });
      });
    },
    saveWorkbench(workbench) {
      return transact(draft => assertValidSystemWorkflowDraft({ ...draft, workbench: structuredClone(workbench) }), { recordHistory: false });
    },
    setIdentityConfiguration({ expectedDetails, expectedCard, details, card }) {
      return transact(draft => {
        const current = draft.identityPresentation;
        if (!same(identityDetails(current), identityDetails(expectedDetails)) || !same(resolveIdentityCard(current), expectedCard)) {
          throw failure('SYSTEM_WORKFLOW_IDENTITY_STALE', 'The Identity changed. Reopen the editor before saving.');
        }
        if (same(identityDetails(current), identityDetails(details)) && Object.hasOwn(current, 'card') && same(current.card, card)) return null;
        Object.assign(current, structuredClone(details), { card: structuredClone(card) });
        return assertValidSystemWorkflowDraft(draft);
      });
    },
  });
}
