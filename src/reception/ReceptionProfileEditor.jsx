import { useEffect, useRef } from 'react';
import { useIdentityEditor, IdentityProfileEditor, IdentityFields } from '../public/identity/IdentityCardSettings.jsx';
import { resolveIdentityCard } from '../profileIdentity/domain/identityCard.js';
export default function ReceptionProfileEditor({ store, model, onClose }) {
  const presentation = store.getSnapshot().identityPresentation;
  const edit = useIdentityEditor({ card: resolveIdentityCard(presentation), profile: model?.authoredProfile,
    avatar: presentation.avatar, configured: true, onDone: onClose,
    onSave: next => {
      const draft = store.getSnapshot();
      if (draft.identityPresentation !== presentation) return false;
      return store.commitCompletedOperation({ ...draft, identityPresentation: { ...presentation, alias: next.profile.title,
        bio: { mode: next.profile.description ? 'inscape' : 'official', customText: next.profile.description },
        tags: { ...presentation.tags, additional: next.profile.tags }, card: next.card, avatar: next.avatar } }, { expectedGeneration: store.getGeneration(), historyLabel: 'Edit shared profile' });
    } });
  const start = useRef(edit.start);
  useEffect(() => { start.current(); }, []);
  if (!edit.editor) return null;
  return <div><IdentityProfileEditor edit={edit} official={model?.officialProfile || { name: 'Universal Profile', tags: [] }} />
    <IdentityFields card={edit.editor.card} edit={edit} />
    {edit.error && <p role="alert">{edit.error}</p>}
    <button className="workflow-tactile-control" type="button" onClick={edit.save}>Save profile</button>
    <button className="workflow-tactile-control" type="button" onClick={edit.cancel}>Cancel profile edit</button>
  </div>;
}
